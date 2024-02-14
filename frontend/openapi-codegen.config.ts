import {
  generateSchemaTypes,
  generateReactQueryComponents,
} from "@openapi-codegen/typescript";
import { defineConfig } from "@openapi-codegen/cli";
export default defineConfig({
  firmware: {
    from: {
      source: "url",
      url: "http://127.0.0.1:3000/api-json",
    },
    outputDir: "./src/firmwareApi",
    to: async (context) => {
      const filenamePrefix = "firmware";
      const { schemasFiles } = await generateSchemaTypes(context, {
        filenamePrefix,
      });
      await generateReactQueryComponents(context, {
        filenamePrefix,
        schemasFiles,
      });
    },
  },
});
