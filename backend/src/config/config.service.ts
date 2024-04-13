import { S3ClientConfig } from "@aws-sdk/client-s3";
import * as dotenv from "dotenv";
import { readFile } from "fs/promises";
import { encode } from "universal-base64url";

dotenv.config();

export enum EnvType {
  PROD,
  DEV,
  DEBUG,
}

export class ConfigService {
  constructor(private env: NodeJS.ProcessEnv) {}

  private getValue(key: string, throwOnMissing = true): string {
    const value = this.env[key];
    if (typeof value !== "string" && throwOnMissing) {
      throw new Error(`config error - missing process.env.${key}`);
    }
    return value;
  }

  public ensureValues(keys: string[]) {
    keys.forEach((k) => this.getValue(k, true));
    return this;
  }

  public getPort(): number {
    return +this.getValue("PORT", false) || 80;
  }

  public getListenHost() {
    return this.getValue("LISTEN_HOST", false) || "127.0.0.1";
  }

  public appEnv(): EnvType {
    const env = this.getValue("APP_ENV", false);
    switch (env) {
      case "prod":
        return EnvType.PROD;
      case "dev":
        return EnvType.DEV;
      case "debug":
        return EnvType.DEBUG;
      default:
        throw new Error(`Unknown app env: ${env}`);
    }
  }

  public async getS3Config(): Promise<S3ClientConfig> {
    return {
      region: "us-east-1",
      endpoint: this.getS3Endpoint(),
      credentials: {
        accessKeyId: (await readFile("/run/secrets/access_key"))
          .toString()
          .trim(),
        secretAccessKey: (await readFile("/run/secrets/secret_key"))
          .toString()
          .trim(),
      },
      forcePathStyle: true,
    };
  }

  public getS3Endpoint(): string {
    return this.getValue("S3_ENDPOINT", true);
  }

  public getBuildsBucket(): string {
    return this.getValue("S3_BUILDS_BUCKET", true);
  }

  public getGitHubAuth() {
    var sauth = this.getValue("GITHUB_AUTH", true);
    if (( sauth.lastIndexOf("github_pat", 0) === 0) ||
        ( sauth.lastIndexOf("ghp_", 0) === 0))
    {
      return `Bearer ${sauth}`;
    }
    else
    {
      return `Basic: ${encode(sauth)}`;
    }
  }

  public getHostUrl() {
    return this.getValue("HOST_URL", true);
  }
}

const configService = new ConfigService(process.env).ensureValues([
  "APP_ENV",
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DB",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "S3_ENDPOINT",
  "S3_BUILDS_BUCKET",
  "GITHUB_AUTH",
  "HOST_URL",
]);

const APP_CONFIG = "APP_CONFIG";

const configProvider = {
  provide: APP_CONFIG,
  useValue: configService,
};

export { configProvider, configService, APP_CONFIG };
