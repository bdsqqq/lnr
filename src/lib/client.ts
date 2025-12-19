import { LinearClient } from "@linear/sdk";
import { getApiKey } from "./config";
import { exitWithError } from "./error";

let clientInstance: LinearClient | null = null;

export function getClient(): LinearClient {
  if (clientInstance) {
    return clientInstance;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    exitWithError("not authenticated", "run: li auth <api-key>");
  }

  clientInstance = new LinearClient({ apiKey });
  return clientInstance;
}

export function createClientWithKey(apiKey: string): LinearClient {
  return new LinearClient({ apiKey });
}
