import type { Command } from "commander";
import { loadConfig, getConfigValue, setConfigValue, type Config } from "../lib/config";
import { exitWithError } from "../lib/error";

const VALID_KEYS: (keyof Config)[] = ["api_key", "default_team", "output_format"];

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command("config")
    .description("view and manage configuration");

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

  configCmd.action(() => {
    const config = loadConfig();
    if (Object.keys(config).length === 0) {
      console.log("(no configuration set)");
      return;
    }

    for (const [key, value] of Object.entries(config)) {
      if (key === "api_key" && value) {
        console.log(`${key} = ${value.slice(0, 10)}...`);
      } else {
        console.log(`${key} = ${value}`);
      }
    }
  });
}
