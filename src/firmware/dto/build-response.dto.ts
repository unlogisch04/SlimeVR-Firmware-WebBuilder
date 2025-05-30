import { BuildStatus } from '@prisma/client';
import { FirmwareFileDTO } from './firmware-file.dto';

export class BuildResponseDTO {
  /**
   * Id of the firmware
   * @see {Firmware}
   *
   * @format uuid
   */
  public id: string;

  /**
   * Build status of the firmware
   * @see {BuildStatus}
   */
  public status: BuildStatus;

  /**
   * List of built firmware files, only set if the build succeeded
   */
  public firmwareFiles?: FirmwareFileDTO[];

  constructor(
    id: string,
    status: BuildStatus,
    firmwareFiles: FirmwareFileDTO[] | undefined = undefined,
  ) {
    this.id = id;
    this.status = status;
    this.firmwareFiles = firmwareFiles;
  }
}
