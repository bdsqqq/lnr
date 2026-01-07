#!/usr/bin/env bun

import { createCli } from "trpc-cli";
import { appRouter } from "./router";
import pkg from "../package.json";

// parse global --api-key flag before trpc-cli
// precedence: --api-key > LINEAR_API_KEY env > config file
const apiKeyIndex = process.argv.findIndex((arg) => arg === "--api-key");
if (apiKeyIndex !== -1 && process.argv[apiKeyIndex + 1]) {
  process.env.LINEAR_API_KEY = process.argv[apiKeyIndex + 1];
  process.argv.splice(apiKeyIndex, 2);
} else {
  const apiKeyEqMatch = process.argv.find((arg) => arg.startsWith("--api-key="));
  if (apiKeyEqMatch) {
    process.env.LINEAR_API_KEY = apiKeyEqMatch.slice("--api-key=".length);
    process.argv = process.argv.filter((arg) => !arg.startsWith("--api-key="));
  }
}

const cli = createCli({
  router: appRouter,
  name: "lnr",
  version: pkg.version,
  description: "command-line interface for Linear",
});

void cli.run();
