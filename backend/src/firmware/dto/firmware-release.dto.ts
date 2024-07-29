import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import {
  AVAILABLE_FIRMWARE_REPOS,
  getFirmwareBranch,
} from "../firmware.constants";
import { ReleaseDTO } from "src/github/dto/release.dto";

export class FirmwareReleaseDTO {
  @ApiProperty()
  public owner: string;

  @ApiProperty({ required: false })
  @IsOptional()
  public repo?: string;

  @ApiProperty()
  public version: string;

  @ApiProperty({ required: false })
  @IsOptional()
  public isBranch?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  public description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  public url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  public githubRelease?: ReleaseDTO;

  static completeDefaults(dto: FirmwareReleaseDTO): FirmwareReleaseDTO {
    // Resolve missing repo
    if (dto.repo === undefined) {
      // Fill default
      dto.repo = "SlimeVR-Tracker-ESP";
      // If there's a matching owner
      const ownerRepos = AVAILABLE_FIRMWARE_REPOS[dto.owner];
      if (ownerRepos !== undefined) {
        for (const [repoToSearch, branches] of Object.entries(ownerRepos)) {
          // And a matching branch
          if (Array.isArray(branches) && branches.includes(dto.version)) {
            // This is the target repo *probably*
            dto.repo = repoToSearch;
            break;
          }
        }
      }
    }

    if (dto.isBranch === undefined) {
      dto.isBranch =
        getFirmwareBranch(dto.owner, dto.repo, dto.version) !== undefined;
    }

    if (dto.description === undefined && dto.isBranch) {
      dto.description = getFirmwareBranch(
        dto.owner,
        dto.repo,
        dto.version,
      )?.description;
    }

    if (dto.url === undefined) {
      dto.url = dto.isBranch
        ? `https://github.com/${dto.owner}/${dto.repo}/tree/${dto.version}`
        : `https://github.com/${dto.owner}/${dto.repo}/releases/tag/${dto.version}`;
    }

    return dto;
  }

  static stripCopy(dto: FirmwareReleaseDTO): FirmwareReleaseDTO {
    // Create a copy with only essential keys
    return {
      owner: dto.owner,
      repo: dto.repo,
      version: dto.version,
    };
  }
}
