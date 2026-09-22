#!/usr/bin/env bun
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createClientWithKey } from "../core/src/client";
import { getApiKey } from "../core/src/config";
import { captureToFile, retryIntrospection } from "./introspection";

export async function main(): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("no api key found; run 'lnr auth' or set LINEAR_API_KEY");
  const client = createClientWithKey(apiKey);
  const require = createRequire(new URL("../core/package.json", import.meta.url));
  const { version } = require("@linear/sdk/package.json") as { version: unknown };
  if (typeof version !== "string") throw new Error("cannot determine installed sdk version");
  await captureToFile(
    fileURLToPath(new URL("./schema.json", import.meta.url)),
    retryIntrospection((query, variables) => client.client.rawRequest(query, variables)),
    {
      sdkVersion: version,
      progress: (done, total, pass) => {
        if (done % 80 === 0 || done === total) console.log(`pass ${pass}: captured ${done}/${total} types`);
      },
    },
  );
  console.log("wrote validated schema.json");
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    console.error("fix: verify credentials and modern introspection support; capture failures preserve the previous snapshot");
    process.exitCode = 1;
  });
}
