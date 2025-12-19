import { describe, test, expect, afterEach, beforeAll } from "bun:test";
import {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  type Config,
} from "./config";

describe("config core", () => {
  let originalConfig: Config;

  beforeAll(() => {
    originalConfig = loadConfig();
  });

  afterEach(() => {
    saveConfig(originalConfig);
  });

  test("loadConfig returns object", () => {
    const config = loadConfig();
    expect(typeof config).toBe("object");
  });

  test("setConfigValue and getConfigValue work", () => {
    const testValue = "TEST_TEAM_VALUE";
    setConfigValue("default_team", testValue);
    expect(getConfigValue("default_team")).toBe(testValue);
  });

  test("saveConfig and loadConfig roundtrip", () => {
    const testConfig: Config = {
      api_key: "test_key",
      default_team: "TEST",
      output_format: "json",
    };
    saveConfig(testConfig);
    const loaded = loadConfig();
    expect(loaded.api_key).toBe(testConfig.api_key);
    expect(loaded.default_team).toBe(testConfig.default_team);
    expect(loaded.output_format).toBe(testConfig.output_format);
  });
});
