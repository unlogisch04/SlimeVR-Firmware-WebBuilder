import { Inject, Injectable, Logger } from "@nestjs/common";
import { createHash } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { APP_CONFIG, ConfigService } from "src/config/config.service";

interface CacheEntry<T> {
  value: T;
  cachedAt: number;
}

/**
 * Cache that keeps values in memory for fast access, persists them to disk so
 * they survive restarts, and falls back to the last known (possibly stale)
 * value whenever the underlying fetcher fails, e.g. when Github is down.
 */
@Injectable()
export class PersistentCacheService {
  private readonly logger = new Logger(PersistentCacheService.name);
  private readonly memory = new Map<string, CacheEntry<any>>();
  private readonly ready: Promise<void>;

  constructor(@Inject(APP_CONFIG) private appConfig: ConfigService) {
    this.ready = mkdir(this.appConfig.getCacheDir(), { recursive: true }).then(
      () => undefined,
    );
  }

  private getFilePath(key: string): string {
    const hash = createHash("sha256").update(key).digest("hex");
    return path.join(this.appConfig.getCacheDir(), `${hash}.json`);
  }

  private async readFromDisk<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const raw = await readFile(this.getFilePath(key), "utf-8");
      return JSON.parse(raw) as CacheEntry<T>;
    } catch {
      return null;
    }
  }

  private async writeToDisk<T>(key: string, entry: CacheEntry<T>) {
    try {
      await this.ready;
      await writeFile(this.getFilePath(key), JSON.stringify(entry));
    } catch (err) {
      this.logger.warn(`Unable to persist cache for key "${key}": ${err}`);
    }
  }

  /**
   * @param options.isDefinitive Predicate identifying errors that mean the resource is
   * confirmed gone (e.g. a 404 from the API), as opposed to a transient/outage error.
   * Definitive errors evict the entry and are rethrown instead of falling back to a
   * stale cached value.
   */
  public async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number,
    options?: { isDefinitive?: (err: unknown) => boolean },
  ): Promise<T> {
    const cached = this.memory.get(key);
    if (cached && Date.now() - cached.cachedAt < ttl) {
      return cached.value;
    }

    try {
      const value = await fn();
      const entry: CacheEntry<T> = { value, cachedAt: Date.now() };
      this.memory.set(key, entry);
      // Fire and forget, we don't want a slow disk to slow down requests
      void this.writeToDisk(key, entry);
      return value;
    } catch (err) {
      if (options?.isDefinitive?.(err)) {
        this.logger.warn(
          `"${key}" no longer exists according to the API, evicting cached value`,
        );
        await this.evict(key);
        throw err;
      }

      const fallback = cached ?? (await this.readFromDisk<T>(key));
      if (fallback) {
        this.logger.warn(
          `Failed to refresh "${key}" (${err?.message ?? err}), serving cached value from ${new Date(
            fallback.cachedAt,
          ).toISOString()}`,
        );
        this.memory.set(key, fallback);
        return fallback.value;
      }
      throw err;
    }
  }

  public async evict(key: string) {
    this.memory.delete(key);
    await rm(this.getFilePath(key), { force: true }).catch((err) =>
      this.logger.warn(`Unable to evict cache file for "${key}": ${err}`),
    );
  }
}
