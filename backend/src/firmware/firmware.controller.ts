import {
  Body,
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Sse,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ReleaseDTO } from "src/github/dto/release.dto";
import { GithubService } from "src/github/github.service";
import { BatteryType } from "./dto/battery.dto";
import { BoardTypeBoard } from "./dto/board-type-board.dto";
import { BuildFirmwareDTO } from "./dto/build-firmware.dto";
import { BuildResponse } from "./dto/build-response.dto";
import { BoardType, FirmwareBoardDTO } from "./dto/firmware-board.dto";
import { IMUDTO, IMUS } from "./dto/imu.dto";
import { Firmware } from "./entity/firmware.entity";
import { VersionNotFoundError } from "./errors/version-not-found.error";
import { FirmwareService } from "./firmware.service";

@ApiTags("slimevr")
@Controller("firmwares")
export class FirmwareController {
  constructor(
    private firmwareService: FirmwareService,
    private githubService: GithubService,
  ) {}

  @Get("/")
  @Header("Cache-Control", "private, max-age=300")
  @Header("CDN-Cache-Control", "public, max-age=7200")
  @ApiResponse({ type: [Firmware] })
  getFirmwares() {
    return this.firmwareService.getFirmwares();
  }

  @Post("/build")
  @Header("Cache-Control", "no-cache")
  @ApiOperation({
    description: "Build a specific configuration of the firmware",
  })
  @ApiOkResponse({ type: BuildResponse })
  @ApiBadRequestResponse({ description: VersionNotFoundError })
  async buildAll(@Body() body: BuildFirmwareDTO) {
    return this.firmwareService.buildFirmware(body);
  }

  @Sse("/build-status/:id")
  @Header("Cache-Control", "no-cache")
  buildStatus(@Param("id") id: string) {
    return this.firmwareService.getBuildStatusSubject(id);
  }

  @Get("/boards")
  @Header("Cache-Control", "private, max-age=300")
  @Header("CDN-Cache-Control", "public, max-age=7200")
  @ApiOkResponse({ type: [BoardTypeBoard] })
  getBoardsTypes(): BoardTypeBoard[] {
    return Object.keys(BoardType).map((board) => ({
      boardType: BoardType[board],
    }));
  }

  @Get("/versions")
  @Header("Cache-Control", "private, max-age=300")
  @Header("CDN-Cache-Control", "public, max-age=7200")
  @ApiOkResponse({ type: [ReleaseDTO] })
  async getVersions(): Promise<ReleaseDTO[]> {
    return this.githubService.getAllReleases();
  }

  @Get("/imus")
  @Header("Cache-Control", "private, max-age=300")
  @Header("CDN-Cache-Control", "public, max-age=7200")
  @ApiOkResponse({ type: [IMUDTO] })
  getIMUSTypes(): IMUDTO[] {
    return IMUS;
  }

  @Get("/batteries")
  @Header("Cache-Control", "private, max-age=300")
  @Header("CDN-Cache-Control", "public, max-age=7200")
  @ApiOkResponse({ type: [String] })
  getBatteriesTypes(): string[] {
    return Object.keys(BatteryType);
  }

  @Get("/default-config/:board")
  @Header("Cache-Control", "private, max-age=300")
  @Header("CDN-Cache-Control", "public, max-age=7200")
  @ApiOkResponse({ type: BuildFirmwareDTO })
  getDefaultConfig(@Param("board") board: BoardType): BuildFirmwareDTO {
    const dto = new BuildFirmwareDTO();
    dto.board = new FirmwareBoardDTO();
    dto.board.type = board;

    return BuildFirmwareDTO.completeDefaults(dto);
  }

  @Get("/:id")
  @Header("Cache-Control", "no-cache")
  @ApiResponse({ type: Firmware })
  @ApiNotFoundResponse()
  async getFirmware(@Param("id") id: string) {
    try {
      return await this.firmwareService.getFirmware(id);
    } catch {
      throw new HttpException("Firmware not found", HttpStatus.NOT_FOUND);
    }
  }
}
