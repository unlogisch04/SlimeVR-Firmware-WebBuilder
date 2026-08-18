import { Module } from "@nestjs/common";
import { configProvider } from "src/config/config.service";
import { PersistentCacheService } from "./persistent-cache.service";

@Module({
  providers: [PersistentCacheService, configProvider],
  exports: [PersistentCacheService],
})
export class PersistentCacheModule {}
