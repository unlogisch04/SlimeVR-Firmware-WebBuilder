import { Injectable } from "@nestjs/common";
import { FetchHttpError, FetchService } from "src/commons/http/fetch.service";
import { AVAILABLE_FIRMWARE_REPOS } from "src/firmware/firmware.constants";
import { ReleaseDTO } from "./dto/release.dto";
import { GithubRepositoryDTO } from "./dto/repository.dto";
import { PersistentCacheService } from "src/commons/cache/persistent-cache.service";
import { FirmwareSourceCacheService } from "src/commons/cache/firmware-source-cache.service";
import { FirmwareReleaseDTO } from "src/firmware/dto/firmware-release.dto";
import * as semver from "semver";

@Injectable()
export class GithubService {
  constructor(
    private fetchSerice: FetchService,
    private persistentCache: PersistentCacheService,
    private firmwareSourceCache: FirmwareSourceCacheService,
  ) {}

  /** A 404 from the Github API is a definitive "this doesn't exist (any more)", unlike network/5xx errors. */
  private isNotFound(err: unknown): boolean {
    return err instanceof FetchHttpError && err.status === 404;
  }

  async getRepository(
    owner: string,
    repo: string,
  ): Promise<GithubRepositoryDTO> {
    return this.persistentCache.wrap(
      `/repos/${owner}/${repo}`,
      async () => {
        const { data } = await this.fetchSerice.get<GithubRepositoryDTO>(
          `/repos/${owner}/${repo}`,
          {},
        );
        return data;
      },
      5 * 60 * 1000,
      { isDefinitive: (err) => this.isNotFound(err) },
    );
  }

  async getBranchRelease(
    owner: string,
    repo: string,
    branch = "main",
  ): Promise<ReleaseDTO> {
    const zipballUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;

    try {
      return await this.persistentCache.wrap(
        `/repos/${owner}/${repo}/branches/${branch}`,
        async () => {
          const {
            data: {
              commit: { sha },
            },
          } = await this.fetchSerice.get<{ commit: { sha: string } }>(
            `/repos/${owner}/${repo}/branches/${branch}`,
            {},
          );

          return {
            id: sha,
            name: branch,
            zipball_url: zipballUrl,
            prerelease: false,
            draft: false,
            url: zipballUrl,
          };
        },
        5 * 60 * 1000,
        { isDefinitive: (err) => this.isNotFound(err) },
      );
    } catch (err) {
      // Github confirmed the branch is gone, the cached source archive is no longer valid
      if (this.isNotFound(err)) await this.firmwareSourceCache.evict(zipballUrl);
      throw err;
    }
  }

  async getReleases(owner: string, repo: string): Promise<ReleaseDTO[]> {
    return this.persistentCache.wrap(
      `/repos/${owner}/${repo}/releases`,
      async () => {
        const { data } = await this.fetchSerice.get<ReleaseDTO[]>(
          `/repos/${owner}/${repo}/releases`,
          {},
        );

        return [
          ...data.filter(
            ({ name, draft, prerelease }) =>
              ![
                "SlimeVR/v0.2.0", 
                "SlimeVR/v0.2.1", 
                "SlimeVR/v0.2.2",
                "SlimeVR/v0.2.3",
                "SlimeVR/v0.3.0",
                "SlimeVR/v0.3.1",
                "SlimeVR/v0.6.0",
                "SlimeVR/v0.6.1",
              ].includes(
                `${owner}/${name}`,
              ) && !draft && (owner !== "SlimeVR" || semver.lt(name.replace(/^v/, ""), "2.0.0")),
          ),
        ];
      },
      5 * 60 * 1000,
      { isDefinitive: (err) => this.isNotFound(err) },
    );
  }

  async getAllFirmwareReleases(): Promise<FirmwareReleaseDTO[]> {
    const releases: Promise<FirmwareReleaseDTO | FirmwareReleaseDTO[]>[] = [];

    for (const [owner, repos] of Object.entries(AVAILABLE_FIRMWARE_REPOS)) {
      for (const [repo, branches] of Object.entries(repos)) {
        // Get all repo releases for official repo
        if (owner === "SlimeVR") {
          releases.push(
            this.getReleases(owner, repo)
              .catch((e) => {
                throw new Error(
                  `Unable to fetch releases for "${owner}/${repo}"`,
                  {
                    cause: e,
                  },
                );
              })
              .then((releases) =>
                releases.map((r) =>
                  FirmwareReleaseDTO.completeDefaults({
                    owner: owner,
                    repo: repo,
                    version: r.name,
                    isBranch: false,
                    githubRelease: r,
                  }),
                ),
              ),
          );
        }

        // Get each branch as a release version
        for (const branch of branches) {
          releases.push(
            this.getBranchRelease(owner, repo, branch.branch)
              .catch((e) => {
                throw new Error(
                  `Unable to fetch branch release for "${owner}/${repo}/${branch.branch}"`,
                  { cause: e },
                );
              })
              .then((r) =>
                FirmwareReleaseDTO.completeDefaults({
                  owner: owner,
                  repo: repo,
                  version: branch.branch,
                  description: branch.description,
                  isBranch: true,
                  githubRelease: r,
                }),
              ),
          );
        }
      }
    }

    const settled = await Promise.allSettled(releases);
    return settled.flatMap((it) => {
      if (it.status === "fulfilled") {
        return it.value;
      }
      console.warn(`${it.reason.message}: `, it.reason.cause);
      return []; // Needed for filtering invalid promises
    });
  }

  async getRelease(
    owner: string,
    repo: string,
    version: string,
    isBranch: boolean = false,
  ): Promise<ReleaseDTO> {
    if (isBranch) {
      return this.getBranchRelease(owner, repo, version);
    } else {
      return this.getReleases(owner, repo).then((releases) =>
        releases.find((r) => r.name === version),
      );
    }
  }
}
