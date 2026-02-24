import { describe, test, expect, afterEach, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
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

let tmpDir: string;
let tmpConfigPath: string;
let originalLnrConfigPath: string | undefined;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "lnr-test-"));
  tmpConfigPath = join(tmpDir, ".lnr.json");
  originalLnrConfigPath = process.env.LNR_CONFIG_PATH;
  process.env.LNR_CONFIG_PATH = tmpConfigPath;
});

afterAll(() => {
  if (originalLnrConfigPath !== undefined) {
    process.env.LNR_CONFIG_PATH = originalLnrConfigPath;
  } else {
    delete process.env.LNR_CONFIG_PATH;
  }
});

afterEach(() => {
  if (existsSync(tmpConfigPath)) {
    unlinkSync(tmpConfigPath);
  }
});

describe("config core", () => {
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
    expect(path).toEndWith(".lnr.json");
  });
});

describe("getApiKey precedence", () => {
  let originalEnv: string | undefined;

  beforeAll(() => {
    originalEnv = process.env.LINEAR_API_KEY;
  });

  afterEach(() => {
    if (existsSync(tmpConfigPath)) {
      unlinkSync(tmpConfigPath);
    }
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

  test("getApiKey falls back to env var when config unset", () => {
    saveConfig({});
    process.env.LINEAR_API_KEY = "env_key_456";
    expect(getApiKey()).toBe("env_key_456");
  });

  test("getApiKey prefers config over env", () => {
    saveConfig({ api_key: "should_return" });
    process.env.LINEAR_API_KEY = "should_not_return";
    expect(getApiKey()).toBe("should_return");
  });

  test("getApiKey returns undefined when neither set", () => {
    delete process.env.LINEAR_API_KEY;
    saveConfig({});
    expect(getApiKey()).toBeUndefined();
  });
});
