import { expect, test } from "bun:test";
import { executeApi } from "../packages/core/src/api";
import { getClient } from "../packages/core/src/client";
import {
  missingId, organizationId, organizationName, organizationQuery,
  probeMissingLookups, projectLookupError,
} from "./readonly-missing-lookup";

const org = { organization: { id: organizationId, name: organizationName } };
const fail = async (): Promise<never> => { throw new Error("unexpected lookup"); };

test("organization query validates offline without credentials", async () => {
  expect(await executeApi({ document: organizationQuery }, () => { throw new Error("credentials"); }))
    .toEqual({ ok: true, executed: false, operation: "query" });
});

test("separate verification gates both lookups on name and id and sanitizes failure", async () => {
  let calls = 0;
  const client = { initiative: async () => { calls++; return fail(); }, roadmap: fail };
  for (const organization of [
    { id: missingId, name: organizationName }, { id: organizationId, name: "wrong" }, {},
  ]) {
    await expect(probeMissingLookups(async document => {
      expect(document).toBe(organizationQuery);
      return { organization };
    }, client)).rejects.toThrow("identity mismatch");
  }
  await expect(probeMissingLookups(async () => { throw new Error("lin_api_secret"); }, client))
    .rejects.toThrow("sandbox verification failed");
  expect(calls).toBe(0);
});

test("one call to each fixed SDK lookup after verification; no retry or success data output", async () => {
  const calls: string[] = [];
  const results = await probeMissingLookups(async () => { calls.push("org"); return org; }, {
    initiative: async id => { calls.push(`initiative:${id}`); throw new Error("lin_api_secret"); },
    roadmap: async id => { calls.push(`roadmap:${id}`); return null as never; },
  });
  expect(calls).toEqual(["org", `initiative:${missingId}`, `roadmap:${missingId}`]);
  expect(results[0]?.rejected).toBe(true);
  expect(results[1]).toEqual({ root: "roadmap", rejected: false, dataIsNull: true });
  expect(JSON.stringify(results)).not.toContain("lin_api_secret");
});

test("projection uses fixed allowlists, not token-shaped regex acceptance", () => {
  for (const secret of ["lin_api_secret", "LIN_SECRET", "BEARER_TOKEN", "innocent_looking_secret",
    "Entity not found lin_api_secret", "ENTITY_NOT_FOUND\n", "x".repeat(1000)]) {
    const entry = { type: secret, message: secret, path: ["initiative", secret],
      extensions: { code: secret, type: secret, userPresentableMessage: secret } };
    const output = projectLookupError({
      status: secret, type: secret, constructor: { name: secret },
      message: secret, query: secret, headers: secret, data: { initiative: secret },
      errors: [entry], raw: { response: { errors: [entry], headers: secret }, request: secret },
    }, "initiative");
    expect(output).toEqual({
      status: null, constructor: "unrecognized", type: "unrecognized",
      dataIsNull: false, rootDataIsNull: false,
      errors: [{ type: "unrecognized", extensionCode: "unrecognized", extensionType: "unrecognized",
        path: null, messagePattern: "unrecognized" }],
      rawErrors: [{ type: "unrecognized", extensionCode: "unrecognized", extensionType: "unrecognized",
        path: null, messagePattern: "unrecognized" }],
    });
    expect(JSON.stringify(output)).not.toContain(secret);
  }
});

test("status bounds and exact known-message equality; no permission inference", () => {
  for (const status of [99, 600, 200.5, NaN, Infinity, "404", null]) {
    expect(projectLookupError({ status }, "roadmap").status).toBeNull();
  }
  for (const status of [100, 200, 404, 599]) {
    expect(projectLookupError({ status }, "roadmap").status).toBe(status);
  }
  for (const [message, pattern] of [
    ["Entity not found", "entity_title"], ["entity not found", "entity_lower"],
    ["Initiative not found", "initiative_title"], ["Roadmap not found", "roadmap_title"],
    ["permission denied", "unrecognized"], ["Entity not found.", "unrecognized"],
  ]) {
    expect(projectLookupError({ errors: [{ message }] }, "initiative").errors[0]?.messagePattern).toBe(pattern);
  }
  expect(projectLookupError({ data: null }, "initiative").dataIsNull).toBe(true);
});

test("real installed SDK transport preserves raw codes and normalized errors without retries (offline)", async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    expect(init?.redirect).toBe("error");
    const body = JSON.parse(String(init?.body));
    const root = /\binitiative\s*\(/.test(body.query) ? "initiative" : "roadmap";
    requests.push(root);
    expect(body.variables).toEqual({ id: missingId });
    expect(body.query.trimStart().startsWith("query ")).toBe(true);
    return new Response(JSON.stringify({
      data: { [root]: null },
      errors: [{ message: "Entity not found", path: [root],
        extensions: { type: "invalid input", code: "ENTITY_NOT_FOUND" } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const results = await probeMissingLookups(async () => org, getClient("offline-fixture", { redirect: "error" }));
    expect(requests).toEqual(["initiative", "roadmap"]);
    for (const result of results) {
      expect(result.error).toEqual({
        status: 200, constructor: "InvalidInputLinearError", type: "InvalidInput",
        dataIsNull: false, rootDataIsNull: true,
        errors: [{ type: "InvalidInput", extensionCode: "unrecognized", extensionType: "unrecognized",
          path: [result.root], messagePattern: "entity_title" }],
        rawErrors: [{ type: "unrecognized", extensionCode: "ENTITY_NOT_FOUND", extensionType: "invalid input",
          path: [result.root], messagePattern: "entity_title" }],
      });
    }
  } finally { globalThis.fetch = original; }
});

test("workflow secret remains step-local and only new probe is invoked", async () => {
  const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
  expect(workflow).toContain("bun test scripts/readonly-missing-lookup.test.ts");
  expect(workflow).toContain("bun scripts/readonly-missing-lookup.ts\n        env:\n          LINEAR_API_KEY:");
  expect(workflow).not.toMatch(/bun .*inspect-project|delete-authorized|bun .*e2e|bun .*release/);
  expect(workflow.match(/secrets\./g)).toHaveLength(1);
});
