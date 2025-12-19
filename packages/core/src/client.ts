import { LinearClient } from "@linear/sdk";
import { getApiKey } from "./config";

let clientInstance: LinearClient | null = null;

export class NotAuthenticatedError extends Error {
  constructor() {
    super("not authenticated");
    this.name = "NotAuthenticatedError";
  }
}

export function getClient(): LinearClient {
  if (clientInstance) {
    return clientInstance;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new NotAuthenticatedError();
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
