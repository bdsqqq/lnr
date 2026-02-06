import { homedir } from "os";
import { join, dirname } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";

export interface Config {
  api_key?: string;
  default_team?: string;
  output_format?: "table" | "json" | "quiet";
}

const GLOBAL_CONFIG_PATH = join(homedir(), ".lnr.json");
const LEGACY_CONFIG_PATH = join(homedir(), ".lnr", "config.json");

export function ensureConfigDir(): void {}

export function findNearestConfig(from?: string): string | null {
  let dir = from ?? process.cwd();
  while (true) {
    const candidate = join(dir, ".lnr.json");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

export function loadConfig(): Config {
  const nearest = findNearestConfig();
  if (nearest) {
    try {
      const raw = readFileSync(nearest, "utf-8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  if (existsSync(LEGACY_CONFIG_PATH)) {
    try {
      const raw = readFileSync(LEGACY_CONFIG_PATH, "utf-8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  return {};
}

export function saveConfig(config: Config): void {
  writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getApiKey(): string | undefined {
  return loadConfig().api_key ?? process.env.LINEAR_API_KEY;
}

export function listConfig(): Config {
  return loadConfig();
}

export function getConfigPath(): string {
  return findNearestConfig() ?? GLOBAL_CONFIG_PATH;
}

export function setApiKey(key: string): void {
  const config = loadConfig();
  config.api_key = key;
  saveConfig(config);
}

export function clearApiKey(): void {
  const config = loadConfig();
  delete config.api_key;
  saveConfig(config);
}

export function getConfigValue<K extends keyof Config>(key: K): Config[K] {
  return loadConfig()[key];
}

export function setConfigValue<K extends keyof Config>(
  key: K,
  value: Config[K]
): void {
  const config = loadConfig();
  config[key] = value;
  saveConfig(config);
}
