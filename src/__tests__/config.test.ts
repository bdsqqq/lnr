import { describe, test, expect, beforeAll, afterEach } from "bun:test";
import { cli } from "./helpers";
import { loadConfig, saveConfig, type Config } from "../lib/config";

describe("config", () => {
  let originalConfig: Config;

  beforeAll(() => {
    originalConfig = loadConfig();
  });

  afterEach(() => {
    saveConfig(originalConfig);
  });

  test("li config shows config", async () => {
    const { stdout, exitCode } = await cli("config");
    expect(exitCode).toBe(0);
    // should show either config values or "(no configuration set)"
    expect(stdout.length).toBeGreaterThan(0);
  });

  test("li config set/get works", async () => {
    const testValue = "TEST_TEAM_VALUE";

    // set a value
    const setResult = await cli("config", "set", "default_team", testValue);
    expect(setResult.exitCode).toBe(0);
    expect(setResult.stdout).toContain(`default_team = ${testValue}`);

    // get the value back
    const getResult = await cli("config", "get", "default_team");
    expect(getResult.exitCode).toBe(0);
    expect(getResult.stdout.trim()).toBe(testValue);
  });

  test("li config get returns (not set) for unset keys", async () => {
    // clear default_team first
    const config = loadConfig();
    delete config.default_team;
    saveConfig(config);

    const { stdout, exitCode } = await cli("config", "get", "default_team");
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("(not set)");
  });
});
