import "../lib/arktype-config";
import { type } from "arktype";
import {
  loadConfig,
  getConfigValue,
  setConfigValue,
  type Config,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "./trpc";
import { exitWithError } from "../lib/error";

export const getInput = type({
  key: type("'api_key' | 'default_team' | 'output_format'").configure({ positional: true }).describe("config key to get"),
});

export const setInput = type({
  key: type("'api_key' | 'default_team' | 'output_format'").configure({ positional: true }).describe("config key to set"),
  value: type("string").configure({ positional: true }).describe("value to set"),
});

export const configRouter = router({
  config: router({
    get: procedure
      .meta({
        description: "get a config value",
      })
      .input(getInput)
      .query(({ input }) => {
        const value = getConfigValue(input.key as keyof Config);
        if (value === undefined) {
          console.log("(not set)");
        } else {
          console.log(value);
        }
      }),

    set: procedure
      .meta({
        description: "set a config value",
      })
      .input(setInput)
      .mutation(({ input }) => {
        if (input.key === "output_format" && !["table", "json", "quiet"].includes(input.value)) {
          exitWithError(`invalid output_format: ${input.value}`, "valid values: table, json, quiet");
        }

        setConfigValue(input.key as keyof Config, input.value as Config[keyof Config]);
        console.log(`${input.key} = ${input.value}`);
      }),

    list: procedure
      .meta({
        description: "view and manage configuration",
        default: true,
      })
      .query(() => {
        const config = loadConfig();
        if (Object.keys(config).length === 0) {
          console.log("(no configuration set)");
          return;
        }

        for (const [key, value] of Object.entries(config)) {
          if (key === "api_key" && value) {
            console.log(`${key} = ${(value as string).slice(0, 10)}...`);
          } else {
            console.log(`${key} = ${value}`);
          }
        }
      }),
  }),
});
