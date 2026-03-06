import { LinearClient } from "@linear/sdk";
import { getApiKey } from "./config";

let clientInstance: LinearClient | null = null;

type LinearClientAuthOptions =
  | { apiKey: string }
  | { accessToken: string };

function getClientAuthOptions(apiKey: string): LinearClientAuthOptions {
  return apiKey.startsWith("lin_oauth_")
    ? { accessToken: apiKey }
    : { apiKey };
}

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

  const authOptions = getClientAuthOptions(apiKey);

  if (apiKeyOverride) {
    return new LinearClient(authOptions);
  }

  if (clientInstance) {
    return clientInstance;
  }

  clientInstance = new LinearClient(authOptions);
  return clientInstance;
}

export function createClientWithKey(apiKey: string): LinearClient {
  return new LinearClient(getClientAuthOptions(apiKey));
}

export function resetClient(): void {
  clientInstance = null;
}
