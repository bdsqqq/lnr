#!/usr/bin/env bun

import { Command } from "commander";
import { registerAuthCommand } from "./commands/auth";
import { registerIssuesCommand } from "./commands/issues";
import { registerTeamsCommand } from "./commands/teams";
import { registerProjectsCommand } from "./commands/projects";
import { registerCyclesCommand } from "./commands/cycles";
import { registerMeCommand } from "./commands/me";
import { registerSearchCommand } from "./commands/search";
import { registerConfigCommand } from "./commands/config";
import pkg from "../package.json";

const program = new Command();

program
  .name("lnr")
  .description("command-line interface for Linear")
  .version(pkg.version);

registerAuthCommand(program);
registerIssuesCommand(program);
registerTeamsCommand(program);
registerProjectsCommand(program);
registerCyclesCommand(program);
registerMeCommand(program);
registerSearchCommand(program);
registerConfigCommand(program);

program.parse();
