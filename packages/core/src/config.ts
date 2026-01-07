import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

export interface Config {
  api_key?: string;
  default_team?: string;
  output_format?: "table" | "json" | "quiet";
}

const CONFIG_DIR = join(homedir(), ".lnr");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): Config {
  ensureConfigDir();
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getApiKey(): string | undefined {
  return process.env.LINEAR_API_KEY ?? loadConfig().api_key;
}

export function listConfig(): Config {
  return loadConfig();
}

export function getConfigPath(): string {
  return CONFIG_PATH;
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
