import { InvalidInputLinearError, LinearClient, LinearErrorType } from "@linear/sdk";
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

/**
 * Allows name fallback after a rejected root identifier, not proof of entity absence.
 * Only the SDK's uniform, exact-root invalid-input errors qualify; mixed failures
 * and errors from lazy relations must propagate instead of selecting another entity.
 */
export function isRootIdentifierRejection(
  error: unknown,
  root: "initiative" | "roadmap",
): boolean {
  return error instanceof InvalidInputLinearError &&
    Array.isArray(error.errors) &&
    error.errors.length > 0 &&
    error.errors.every(entry =>
      entry.type === LinearErrorType.InvalidInput &&
      entry.path?.length === 1 && entry.path[0] === root
    );
}

/** Per-call transport policies use an uncached client rather than mutate shared defaults. */
export function getClient(
  apiKeyOverride?: string,
  requestOptions?: Pick<RequestInit, "redirect">,
): LinearClient {
  const apiKey = apiKeyOverride ?? getApiKey();
  if (!apiKey) {
    throw new NotAuthenticatedError();
  }

  const authOptions = { ...getClientAuthOptions(apiKey), ...requestOptions };

  if (apiKeyOverride || requestOptions) {
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
