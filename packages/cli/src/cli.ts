#!/usr/bin/env bun

import { createCli } from "trpc-cli";
import { appRouter } from "./router";
import pkg from "../package.json";

const cli = createCli({
  router: appRouter,
  name: "lnr",
  version: pkg.version,
  description: "command-line interface for Linear",
});

void cli.run();
