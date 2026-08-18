import { Inject, Injectable, Logger } from "@nestjs/common";
import { createHash } from "crypto";
import { existsSync } from "fs";
import { copyFile, mkdir, rm } from "fs/promises";
import path from "path";
import { APP_CONFIG, ConfigService } from "src/config/config.service";

/**
 * Caches downloaded firmware source archives (zip files) on disk so a build can
 * still fetch them if Github is temporarily unreachable. Callers that learn
 * from the Github API that a release/branch was actually deleted (not just
 * unreachable) should evict the corresponding entry instead of relying on it.
 */
@Injectable()
export class FirmwareSourceCacheService {
  private readonly logger = new Logger(FirmwareSourceCacheService.name);
  private readonly dir: string;

  constructor(@Inject(APP_CONFIG) appConfig: ConfigService) {
    this.dir = path.join(appConfig.getCacheDir(), "firmware-sources");
  }

  private getFilePath(url: string): string {
    const hash = createHash("sha256").update(url).digest("hex");
    return path.join(this.dir, `${hash}.zip`);
  }

  public has(url: string): boolean {
    return existsSync(this.getFilePath(url));
  }

  public async save(url: string, downloadedFilePath: string) {
    await mkdir(this.dir, { recursive: true });
    await copyFile(downloadedFilePath, this.getFilePath(url));
  }

  public async restore(url: string, destPath: string) {
    await copyFile(this.getFilePath(url), destPath);
  }

  public async evict(url: string) {
    await rm(this.getFilePath(url), { force: true }).catch((err) =>
      this.logger.warn(`Unable to evict cached archive for "${url}": ${err}`),
    );
  }
}
