import type { Command } from "commander";
import { spawn } from "child_process";
import {
  loadConfig,
  getConfigValue,
  setConfigValue,
  getConfigPath,
  type Config,
} from "@bdsqqq/lnr-core";
import { exitWithError } from "../lib/error";

const VALID_KEYS: (keyof Config)[] = ["api_key", "default_team", "output_format"];

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command("config")
    .description("view and manage configuration")
    .option("--edit", "open config file in $EDITOR");

  configCmd
    .command("get <key>")
    .description("get a config value")
    .action((key: string) => {
      if (!VALID_KEYS.includes(key as keyof Config)) {
        exitWithError(`unknown config key: ${key}`, `valid keys: ${VALID_KEYS.join(", ")}`);
      }

      const value = getConfigValue(key as keyof Config);
      if (value === undefined) {
        console.log("(not set)");
      } else {
        console.log(value);
      }
    });

  configCmd
    .command("set <key> <value>")
    .description("set a config value")
    .action((key: string, value: string) => {
      if (!VALID_KEYS.includes(key as keyof Config)) {
        exitWithError(`unknown config key: ${key}`, `valid keys: ${VALID_KEYS.join(", ")}`);
      }

      if (key === "output_format" && !["table", "json", "quiet"].includes(value)) {
        exitWithError(`invalid output_format: ${value}`, "valid values: table, json, quiet");
      }

      setConfigValue(key as keyof Config, value as Config[keyof Config]);
      console.log(`${key} = ${value}`);
    });

  configCmd.action((options: { edit?: boolean }) => {
    if (options.edit) {
      const editor = process.env.EDITOR || "vi";
      const configPath = getConfigPath();
      spawn(editor, [configPath], { stdio: "inherit" });
      return;
    }

    const config = loadConfig();
    const envApiKey = process.env.LINEAR_API_KEY;

    if (Object.keys(config).length === 0 && !envApiKey) {
      console.log("(no configuration set)");
      return;
    }

    if (envApiKey) {
      console.log(`api_key=${envApiKey.slice(0, 10)}... (from env)`);
    } else if (config.api_key) {
      console.log(`api_key=${config.api_key.slice(0, 10)}...`);
    }

    for (const [key, value] of Object.entries(config)) {
      if (key === "api_key") continue;
      console.log(`${key}=${value}`);
    }
  });
}
