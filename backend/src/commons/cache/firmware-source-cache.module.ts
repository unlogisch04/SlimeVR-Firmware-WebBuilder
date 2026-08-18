import { Module } from "@nestjs/common";
import { configProvider } from "src/config/config.service";
import { FirmwareSourceCacheService } from "./firmware-source-cache.service";

@Module({
  providers: [FirmwareSourceCacheService, configProvider],
  exports: [FirmwareSourceCacheService],
})
export class FirmwareSourceCacheModule {}
