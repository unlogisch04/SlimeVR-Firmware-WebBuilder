import { Module } from "@nestjs/common";
import { FetchModule } from "src/commons/http/fetch.module";
import { GithubService } from "./github.service";
import { configProvider, configService } from "src/config/config.service";
import { PersistentCacheModule } from "src/commons/cache/persistent-cache.module";
import { FirmwareSourceCacheModule } from "src/commons/cache/firmware-source-cache.module";

@Module({
  imports: [
    PersistentCacheModule,
    FirmwareSourceCacheModule,
    FetchModule.config({
      baseUrl: "https://api.github.com",
      headers: { Authorization: `${configService.getGitHubAuth()}` },
    }),
  ],
  providers: [GithubService, configProvider],
  exports: [GithubService],
})
export class GithubModule {}
