import { executeApi } from "../packages/core/src/api";
import { getClient } from "../packages/core/src/client";

export const organizationQuery = "query VerifySandbox { organization { id name } }";
export const organizationName = "bdsqqq-sandbox";
export const organizationId = "40d4b432-9b66-4a4a-ad6c-2ab39d6208ce";
export const missingId = "00000000-0000-4000-8000-000000000099";
type Root = "initiative" | "roadmap";

// SDK 95.1.0 dist/index.mjs:8–23,66–80,119–148,251–275.
// Fixed strings, not a permissive code regex: credentials can resemble codes.
const sdkTypes = [
  "FeatureNotAccessible", "InvalidInput", "Ratelimited", "NetworkError",
  "AuthenticationError", "Forbidden", "BootstrapError", "Unknown", "InternalError",
  "Other", "UserError", "GraphqlError", "LockTimeout", "UsageLimitExceeded",
] as const;
const wireTypes = [
  "feature not accessible", "invalid input", "ratelimited", "network error",
  "authentication error", "forbidden", "bootstrap error", "unknown", "internal error",
  "other", "user error", "graphql error", "lock timeout", "usage limit exceeded",
] as const;
const constructors = [
  "LinearError", "FeatureNotAccessibleLinearError", "InvalidInputLinearError",
  "RatelimitedLinearError", "NetworkLinearError", "AuthenticationLinearError",
  "ForbiddenLinearError", "BootstrapLinearError", "UnknownLinearError",
  "InternalLinearError", "OtherLinearError", "UserLinearError", "GraphqlLinearError",
  "LockTimeoutLinearError", "UsageLimitExceededLinearError",
] as const;
// Candidate equality probes, NOT assertions that upstream uses these codes.
const codes = ["ENTITY_NOT_FOUND", "NOT_FOUND"] as const;
const messagePatterns = [
  ["Entity not found", "entity_title"],
  ["entity not found", "entity_lower"],
  ["Initiative not found", "initiative_title"],
  ["Roadmap not found", "roadmap_title"],
] as const;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function selected(value: unknown, allowed: readonly string[]) {
  return allowed.find(item => item === value) ?? "unrecognized";
}
function messagePattern(value: unknown) {
  return messagePatterns.find(([message]) => message === value)?.[1] ?? "unrecognized";
}
function projectEntry(value: unknown, root: Root) {
  const error = record(value), extensions = record(error.extensions);
  return {
    type: selected(error.type, sdkTypes),
    extensionCode: selected(extensions.code, codes),
    extensionType: selected(extensions.type, [...wireTypes, ...sdkTypes, ...codes]),
    // Only the exact selected root path is eligible; no arbitrary field names.
    path: Array.isArray(error.path) && error.path.length === 1 && error.path[0] === root ? [root] : null,
    messagePattern: messagePattern(error.message),
  };
}

/** Never serialize an SDK error: raw includes request/query/headers and arbitrary data. */
export function projectLookupError(value: unknown, root: Root) {
  const error = record(value), response = record(record(error.raw).response);
  const status = error.status;
  return {
    status: typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
    constructor: selected(typeof error.constructor === "function" ? error.constructor.name : undefined, constructors),
    type: selected(error.type, sdkTypes),
    dataIsNull: error.data === null,
    rootDataIsNull: record(error.data)[root] === null,
    errors: Array.isArray(error.errors) ? error.errors.map(entry => projectEntry(entry, root)) : [],
    rawErrors: Array.isArray(response.errors) ? response.errors.map(entry => projectEntry(entry, root)) : [],
  };
}

type ProbeClient = Pick<ReturnType<typeof getClient>, "initiative" | "roadmap">;
export async function probeMissingLookups(
  verify: (document: string) => Promise<unknown>, client: ProbeClient,
) {
  let identity: unknown;
  try { identity = await verify(organizationQuery); }
  catch { throw new Error("sandbox verification failed"); }
  const org = record(record(identity).organization);
  if (org.id !== organizationId || org.name !== organizationName) {
    throw new Error("sandbox identity mismatch; probe stopped");
  }
  // Exactly one SDK call per fixed root, even when the preceding lookup rejects.
  const results = [];
  for (const root of ["initiative", "roadmap"] as const) {
    try {
      const result = await client[root](missingId);
      results.push({ root, rejected: false, dataIsNull: result === null });
    } catch (error) {
      results.push({ root, rejected: true, error: projectLookupError(error, root) });
    }
  }
  return results;
}

if (import.meta.main) {
  try {
    const key = process.env.LINEAR_API_KEY?.trim();
    if (!key || process.env.LNR_RECOVERY_CONFIRM_ORG !== organizationName) {
      throw new Error("explicit sandbox credential and confirmation required");
    }
    const client = getClient(key, { redirect: "error" });
    const results = await probeMissingLookups(async document => {
      const response = await executeApi({ document, execute: true }, () => client);
      if (!response.ok || !response.data) throw new Error("sandbox verification failed");
      return response.data;
    }, client);
    console.log(JSON.stringify(results));
  } catch {
    console.error("read-only lookup probe failed; no mutation or automatic retry performed");
    process.exitCode = 1;
  }
}
