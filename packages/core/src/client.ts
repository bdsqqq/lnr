import { LinearClient } from "@linear/sdk";
import { getApiKey } from "./config";

let clientInstance: LinearClient | null = null;

export class NotAuthenticatedError extends Error {
  constructor() {
    super("not authenticated");
    this.name = "NotAuthenticatedError";
  }
}

export function getClient(apiKeyOverride?: string): LinearClient {
  const apiKey = apiKeyOverride ?? getApiKey();
  if (!apiKey) {
    throw new NotAuthenticatedError();
  }

  if (apiKeyOverride) {
    return new LinearClient({ apiKey });
  }

  if (clientInstance) {
    return clientInstance;
  }

  clientInstance = new LinearClient({ apiKey });
  return clientInstance;
}

export function createClientWithKey(apiKey: string): LinearClient {
  return new LinearClient({ apiKey });
}

export function resetClient(): void {
  clientInstance = null;
}
