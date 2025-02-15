import { Inject, Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { ReleaseDTO } from "src/github/dto/release.dto";
import { GithubService } from "src/github/github.service";
import { BuildFirmwareDTO } from "./dto/build-firmware.dto";
import { BuildResponse } from "./dto/build-response.dto";
import { BuildStatus, Firmware } from "./entity/firmware.entity";
import { VersionNotFoundExeption } from "./errors/version-not-found.error";
import os from "os";
import fs from "fs";
import { mkdtemp, readdir, readFile, rename, rm, writeFile } from "fs/promises";
import path, { join } from "path";
import AdmZip from "adm-zip";
import fetch from "node-fetch";
import { BoardType } from "./dto/firmware-board.dto";
import { exec, execSync } from "child_process";
import { Equal, Not } from "typeorm";
import { APP_CONFIG, ConfigService } from "src/config/config.service";
import { debounceTime, filter, map, Subject } from "rxjs";
import { BuildStatusMessage } from "./dto/build-status-message.dto";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { InjectAws } from "aws-sdk-v3-nest";
import { IMUConfigDTO, IMUS } from "./dto/imu.dto";
import { FirmwareReleaseDTO } from "./dto/firmware-release.dto";
import { DebugDTO } from "./dto/debug.dto";

@Injectable()
export class FirmwareService implements OnApplicationBootstrap {
  private readonly buildStatusSubject = new Subject<BuildStatusMessage>();

  constructor(
    @InjectAws(S3Client) private readonly s3: S3Client,
    private githubService: GithubService,
    @Inject(APP_CONFIG) private appConfig: ConfigService,
  ) {}

  public getFirmwares(): Promise<Firmware[]> {
    return Firmware.find({ where: { buildStatus: BuildStatus.DONE } });
  }

  public getFirmware(id: string): Promise<Firmware> {
    return Firmware.findOneOrFail({ where: { id } });
  }

  public getBuildStatusSubject(id: string) {
    return this.buildStatusSubject.asObservable().pipe(
      filter((status) => status.id === id),
      map((event) => ({ data: event })),
      debounceTime(500),
    );
  }

  public async onApplicationBootstrap() {
    await Firmware.createQueryBuilder()
      .update(Firmware)
      .set({
        buildStatus: BuildStatus.FAILED,
      })
      .where("buildStatus = :buildStatus", {
        buildStatus: BuildStatus.BUILDING,
      })
      .execute();

    this.cleanAllOldReleases();
    setInterval(() => {
      this.cleanAllOldReleases();
    }, 5 * 60 * 1000).unref();
  }

  public async cleanAllOldReleases() {
    for (const release of await this.githubService.getAllFirmwareReleases()) {
      this.cleanOldReleases(release);
    }
  }

  public async cleanOldReleases(release: FirmwareReleaseDTO): Promise<void> {
    if (!release.isBranch) return;

    const branchRelease =
      release.githubRelease ??
      (await this.githubService.getBranchRelease(
        release.owner,
        release.repo,
        release.version,
      ));
    if (!branchRelease) return;

    const strippedRelease = FirmwareReleaseDTO.stripCopy(release);

    const firmwares = await Firmware.find({
      where: {
        releaseID: Not(branchRelease.id),
        buildConfig: { release: Equal(strippedRelease) },
      },
    });

    firmwares.forEach(async (firmware) => {
      await Firmware.delete({ id: firmware.id });
      await this.emptyS3Directory(
        this.appConfig.getBuildsBucket(),
        `${firmware.id}`,
      );
      console.log("deleted firmware id:", firmware.id);
    });
  }

  /**
   * Get the board partitions infos
   */
  private async getPartitions(
    boardType: BoardType,
    rootFoler: string,
  ): Promise<{ path: string; offset: number }[]> {
    const ideInfos = (await new Promise((resolve) => {
      const metadata = execSync(
        `platformio project metadata --json-output -e ${boardType}`,
        {
          cwd: rootFoler,
          shell: "/bin/bash",
        },
      );
      resolve(JSON.parse(metadata.toString()));
    })) as {
      [key: string]: {
        extra: {
          flash_images: { offset: string; path: string }[];
          application_offset: string;
        };
      };
    };

    return [
      ...ideInfos[boardType].extra.flash_images.map(
        ({ offset, ...fields }) => ({ offset: parseInt(offset), ...fields }),
      ),
      {
        path: join(rootFoler, `.pio/build/${boardType}/firmware.bin`),
        offset: parseInt(ideInfos[boardType].extra.application_offset ?? "0"),
      },
    ];
  }

  public async emptyS3Directory(bucket, dir) {
    const listObjectsV2 = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: dir,
    });

    const listedObjects = await this.s3.send(listObjectsV2);

    if (listedObjects.Contents.length === 0) return;

    const deleteParams = {
      Bucket: bucket,
      Delete: { Objects: [] },
    };

    listedObjects.Contents.forEach(({ Key }) => {
      deleteParams.Delete.Objects.push({ Key });
    });

    await this.s3.send(new DeleteObjectsCommand(deleteParams));

    if (listedObjects.IsTruncated) await this.emptyS3Directory(bucket, dir);
  }

  uploadFirmware(id: string, name: string, buffer: Buffer) {
    const upload = new PutObjectCommand({
      Bucket: this.appConfig.getBuildsBucket(),
      Key: path.join(id, name),
      Body: buffer,
    });
    return this.s3.send(upload);
  }

  public getFirmwareLink(id: string) {
    return `${this.appConfig.getS3Endpoint()}/${this.appConfig.getBuildsBucket()}/${id}/firmware.bin`;
  }

  /**
   * Returns the content of the define.h based on the board config and imus config
   */
  private getDefines(boardConfig: BuildFirmwareDTO) {
    const rotationToFirmware = function (rotation: number): number {
      // Reduce the angle to its lowest equivalent form,
      // negate it to match the firmware rotation direction,
      // then convert it to radians
      return (-(rotation % 360) / 180) * Math.PI;
    };

    /**
     * Define of one IMU entry, uses the appropriate addess for the first and second IMUs
     */
    let primaryImuAddress = "PRIMARY_IMU_ADDRESS_ONE";
    let secondaryImuAddress = "SECONDARY_IMU_ADDRESS_TWO";
    if (boardConfig.swapAddresses) {
      primaryImuAddress = "PRIMARY_IMU_ADDRESS_TWO";
      secondaryImuAddress = "SECONDARY_IMU_ADDRESS_ONE";
    }

    const imuDesc = (imuConfig: IMUConfigDTO, index: number) => {
      const imu = IMUS.find(({ type }) => type === imuConfig.type);
      if (!imu) return null;

      return `IMU_DESC_ENTRY(${imuConfig.type}, ${
        index <= 0 ? primaryImuAddress : secondaryImuAddress
      }, ${rotationToFirmware(imuConfig.rotation)}, PIN_IMU_SCL, PIN_IMU_SDA, ${
        index <= 0 ? "false" : "true"
      }, ${imuConfig.imuINT || 255})`;
    };

    /**
     * Define of one sensor entry, computes the address
     * For 0.6.0+ firmware versions
     */
    const sensorDesc = (imuConfig: IMUConfigDTO, index: number) => {
      const imu = IMUS.find(({ type }) => type === imuConfig.type);
      if (!imu) return null;

      return `SENSOR_DESC_ENTRY(${imuConfig.type}, ${
        index <= 0 ? primaryImuAddress : secondaryImuAddress
      }, ${rotationToFirmware(imuConfig.rotation)}, DIRECT_WIRE(PIN_IMU_SCL, PIN_IMU_SDA), ${
        index <= 0 ? "false" : "true"
      }, DIRECT_PIN(${imuConfig.imuINT || 255}), 0 )`;
    };

    // This is to deal with old firmware versions where two imus were always declared,
    // I just use the values of the first one if I only have one
    const secondImu =
      boardConfig.imus.length === 1 ? boardConfig.imus[0] : boardConfig.imus[1];

    return `
          #define IMU ${boardConfig.imus[0].type}
          #define SECOND_IMU ${secondImu.type}
          #define BOARD ${boardConfig.board.type}
          #define IMU_ROTATION ${rotationToFirmware(
            boardConfig.imus[0].rotation,
          )}
          #define SECOND_IMU_ROTATION ${rotationToFirmware(secondImu.rotation)}

          #define MAX_IMU_COUNT ${boardConfig.imus.length}
          #define MAX_SENSORS_COUNT ${boardConfig.imus.length}
          #define TRACKER_TYPE 0

          #ifndef IMU_DESC_LIST
          #define IMU_DESC_LIST \\
                ${boardConfig.imus
                  .map(imuDesc)
                  .filter((imu) => !!imu)
                  .join(" \\\n\t\t ")}
          #endif

          #define BATTERY_MONITOR ${boardConfig.battery.type}
          #define PIN_BATTERY_LEVEL ${boardConfig.battery.pin}
          #define BATTERY_SHIELD_RESISTANCE ${boardConfig.battery.resistance}
          #define BATTERY_SHIELD_R1 ${boardConfig.battery.r1}
          #define BATTERY_SHIELD_R2 ${boardConfig.battery.r2}
    
          #define PIN_IMU_SDA ${boardConfig.board.pins.imuSDA}
          #define PIN_IMU_SCL ${boardConfig.board.pins.imuSCL}
          #define PIN_IMU_INT ${boardConfig.imus[0].imuINT || 255}
          #define PIN_IMU_INT_2 ${secondImu.imuINT || 255}
          #define LED_BUILTIN ${boardConfig.board.pins.led}
          #define LED_INVERTED ${boardConfig.board.ledInverted}
          #define LED_PIN ${
            boardConfig.board.enableLed ? boardConfig.board.pins.led : 255
          }

          #define PRIMARY_IMU_OPTIONAL false
          #define SECONDARY_IMU_OPTIONAL true

          #ifndef SENSOR_DESC_LIST
          #define SENSOR_DESC_LIST \\
                ${boardConfig.imus
                  .map(sensorDesc)
                  .filter((imu) => !!imu)
                  .join(" \\\n\t\t ")}
          #endif


        `;
  }

  private applyDefine(file: string, define: string, value: any): string {
    return file.replaceAll(
      new RegExp(`^\\W*#define\\W+${define}\\W+[^\\/\\n]+`, "gmi"),
      `#define ${define} ${value} `,
    );
  }

  private applyDebug(file: string, debug: DebugDTO): string {
    file = this.applyDefine(file, "USE_6_AXIS", debug.use6Axis);
    file = this.applyDefine(file, "OPTIMIZE_UPDATES", debug.optimizeUpdates);
    file = this.applyDefine(file, "COMPLIANCE_MODE", debug.complianceMode);
    file = this.applyDefine(file, "BMI160_USE_TEMPCAL", debug.bmi160UseTempcal);
    file = this.applyDefine(
      file,
      "BMI160_TEMPCAL_DEBUG",
      debug.bmi160TempcalDebug,
    );
    file = this.applyDefine(file, "BMI160_USE_SENSCAL", debug.bmi160UseSenscal);
    return file;
  }

  private async modifyFile(file: string, action: (contents: string) => string) {
    const f = await readFile(file, { encoding: "utf-8" });
    return await writeFile(file, action(f));
  }

  private async startBuildingTask(firmware: Firmware, release: ReleaseDTO) {
    let tmpDir: string;

    try {
      this.buildStatusSubject.next({
        buildStatus: BuildStatus.BUILDING,
        id: firmware.id,
        message: "Creating temporary build folder",
      });

      tmpDir = await mkdtemp(path.join(os.tmpdir(), "slimevr-api"));

      const releaseFileName = `release-${release.name.replace(
        /[^A-Za-z0-9. ]/gi,
        "_",
      )}.zip`;
      const releaseFilePath = path.join(tmpDir, releaseFileName);

      const downloadFile = async (url: string, path: string) => {
        const res = await fetch(url);
        const fileStream = fs.createWriteStream(path);
        await new Promise((resolve, reject) => {
          res.body.pipe(fileStream);
          res.body.on("error", reject);
          fileStream.on("finish", resolve);
        });
      };

      this.buildStatusSubject.next({
        buildStatus: BuildStatus.BUILDING,
        id: firmware.id,
        message: "Downloading SlimeVR firmware from Github",
      });

      await downloadFile(release.zipball_url, releaseFilePath);

      this.buildStatusSubject.next({
        buildStatus: BuildStatus.BUILDING,
        id: firmware.id,
        message: "Extracting firmware",
      });

      const releaseFolderPath = path.join(tmpDir, `release-${release.name}`);
      const zip = new AdmZip(releaseFilePath);
      // Extract release
      console.log("start extract", releaseFilePath, releaseFolderPath);
      await new Promise((resolve) => {
        zip.extractAllTo(releaseFolderPath, true);
        resolve(true);
      });

      this.buildStatusSubject.next({
        buildStatus: BuildStatus.BUILDING,
        id: firmware.id,
        message: "Setting up defines and configs",
      });

      const [root] = await readdir(releaseFolderPath);
      const rootFoler = path.join(releaseFolderPath, root);

      await rm(join(rootFoler, "platformio.ini"));
      await rename(
        join(rootFoler, "platformio-tools.ini"),
        join(rootFoler, "platformio.ini"),
      );

      // Overwrite the defines.h file with the one generated from the configuration
      const newDef = this.getDefines(firmware.buildConfig);
      console.log("[BUILD DEFINES]", newDef);
      await writeFile(path.join(rootFoler, "src", "defines.h"), newDef);

      // Modify debug.h and defines_bmi160.h
      await this.modifyFile(path.join(rootFoler, "src", "debug.h"), (f) =>
        this.applyDebug(f, firmware.buildConfig.debug),
      ).catch((err) => {
        console.error('Error while modifying "debug.h"', err);
      });
      await this.modifyFile(
        path.join(rootFoler, "src", "defines_bmi160.h"),
        (f) => this.applyDebug(f, firmware.buildConfig.debug),
      ).catch((err) => {
        console.error('Error while modifying "defines_bmi160.h"', err);
      });

      this.buildStatusSubject.next({
        buildStatus: BuildStatus.BUILDING,
        id: firmware.id,
        message: "Building firmware (this might take a minute)",
      });

      await new Promise((resolve, reject) => {
        const platformioRun = exec(
          `platformio run -e ${firmware.buildConfig.board.type}`,
          {
            cwd: rootFoler,
            env: {
              // Keep existing variables
              ...process.env,
              // Git commit hash or release tag
              GIT_REV: release.id,
            },
          },
        );

        platformioRun.stdout.on("data", (data) => {
          console.log("[BUILD LOG]", `[${firmware.id}]`, data.toString());
          this.buildStatusSubject.next({
            buildStatus: BuildStatus.BUILDING,
            id: firmware.id,
            message: "Building firmware (this might take a minute)",
          });
        });

        platformioRun.stderr.on("data", (data) => {
          console.log("[BUILD LOG]", `[${firmware.id}]`, data.toString());
        });

        platformioRun.on("exit", (code) => {
          if (code === 0) {
            resolve(true);
          } else reject({ message: "bad exit code" });
        });
      });

      this.buildStatusSubject.next({
        buildStatus: BuildStatus.BUILDING,
        id: firmware.id,
        message: "Uploading Firmware to Bucket",
      });

      const files = await this.getPartitions(
        firmware.buildConfig.board.type,
        rootFoler,
      );

      await Promise.all(
        files.map(async ({ path }, index) =>
          this.uploadFirmware(
            firmware.id,
            `firmware-part-${index}.bin`,
            await readFile(path),
          ),
        ),
      );

      firmware.buildStatus = BuildStatus.DONE;
      firmware.firmwareFiles = files.map(({ offset }, index) => ({
        offset,
        url: `${this.appConfig.getBuildsBucket()}/${
          firmware.id
        }/firmware-part-${index}.bin`,
      }));
      await Firmware.save(firmware);

      this.buildStatusSubject.next({
        buildStatus: BuildStatus.DONE,
        id: firmware.id,
        message: "Build complete",
        firmwareFiles: firmware.firmwareFiles,
      });
    } catch (e) {
      console.log(e);

      this.buildStatusSubject.next({
        buildStatus: BuildStatus.FAILED,
        id: firmware.id,
        message: `Build failed: ${e.message || e}`,
      });

      firmware.buildStatus = BuildStatus.FAILED;
      await Firmware.save(firmware);
    } finally {
      try {
        if (tmpDir) {
          await rm(tmpDir, { recursive: true });
        }
      } catch (e) {
        console.error(
          `An error has occurred while removing the temp folder at ${tmpDir}. Please remove it manually. Error: ${e}`,
        );
      }
    }
  }

  public async buildFirmware(dto: BuildFirmwareDTO): Promise<BuildResponse> {
    try {
      dto = BuildFirmwareDTO.completeDefaults(dto);

      // Redirect v0.3.3 to the patched version
      if (dto.release.owner == "SlimeVR" && dto.release.version == "v0.3.3") {
        dto.release = FirmwareReleaseDTO.completeDefaults({
          owner: "ButterscotchV",
          version: "v0.3.3-bno-patched",
        });
      }

      const release =
        dto.release.githubRelease ??
        (await this.githubService.getRelease(
          dto.release.owner,
          dto.release.repo,
          dto.release.version,
          dto.release.isBranch,
        ));

      // Fake a generic cheesecake board for defaults,
      // then use Wemos D1 Mini for the firmware
      if (dto.board.type == BoardType.BOARD_CHEESECAKE) {
        dto.board.type = BoardType.BOARD_WEMOSD1MINI;
      }

      // Fake a generic Tiny Slime for defaults,
      // then use LOLIN C3 MINI for the firmware
      if (dto.board.type == BoardType.BOARD_TINYSLIME) {
        dto.board.type = BoardType.BOARD_LOLIN_C3_MINI;
      }

      let firmware = await Firmware.findOne({
        where: {
          buildConfig: BuildFirmwareDTO.stripRelease(dto),
          releaseID: release.id,
        },
      });

      if (!firmware) firmware = Firmware.fromDTO(dto);

      if (firmware.id && firmware.buildStatus === BuildStatus.BUILDING) {
        return new BuildResponse(firmware.id, firmware.buildStatus);
      }

      if (firmware.id && firmware.buildStatus === BuildStatus.DONE) {
        return new BuildResponse(
          firmware.id,
          firmware.buildStatus,
          firmware.firmwareFiles,
        );
      }

      firmware.buildStatus = BuildStatus.BUILDING;
      firmware.releaseID = release.id;

      firmware = await Firmware.save(firmware);

      this.startBuildingTask(firmware, release);

      return new BuildResponse(firmware.id, firmware.buildStatus);
    } catch (e) {
      throw VersionNotFoundExeption;
    }
  }
}
