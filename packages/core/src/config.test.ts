import { describe, test, expect, afterEach, beforeAll, afterAll } from "bun:test";
import {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  getApiKey,
  listConfig,
  getConfigPath,
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

  test("listConfig returns full config", () => {
    const testConfig: Config = {
      api_key: "list_test_key",
      default_team: "LIST_TEST",
    };
    saveConfig(testConfig);
    const listed = listConfig();
    expect(listed.api_key).toBe(testConfig.api_key);
    expect(listed.default_team).toBe(testConfig.default_team);
  });

  test("getConfigPath returns path string", () => {
    const path = getConfigPath();
    expect(typeof path).toBe("string");
    expect(path).toContain(".lnr");
    expect(path).toContain("config.json");
  });
});

describe("getApiKey precedence", () => {
  let originalConfig: Config;
  let originalEnv: string | undefined;

  beforeAll(() => {
    originalConfig = loadConfig();
    originalEnv = process.env.LINEAR_API_KEY;
  });

  afterEach(() => {
    saveConfig(originalConfig);
    if (originalEnv !== undefined) {
      process.env.LINEAR_API_KEY = originalEnv;
    } else {
      delete process.env.LINEAR_API_KEY;
    }
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.LINEAR_API_KEY = originalEnv;
    } else {
      delete process.env.LINEAR_API_KEY;
    }
  });

  test("getApiKey returns config value when env not set", () => {
    delete process.env.LINEAR_API_KEY;
    saveConfig({ api_key: "config_key_123" });
    expect(getApiKey()).toBe("config_key_123");
  });

  test("getApiKey returns env var when set", () => {
    saveConfig({ api_key: "config_key_123" });
    process.env.LINEAR_API_KEY = "env_key_456";
    expect(getApiKey()).toBe("env_key_456");
  });

  test("getApiKey prefers env over config", () => {
    saveConfig({ api_key: "should_not_return" });
    process.env.LINEAR_API_KEY = "should_return";
    expect(getApiKey()).toBe("should_return");
  });

  test("getApiKey returns undefined when neither set", () => {
    delete process.env.LINEAR_API_KEY;
    saveConfig({});
    expect(getApiKey()).toBeUndefined();
  });
});
