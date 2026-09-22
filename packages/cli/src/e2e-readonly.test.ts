/**
 * e2e tests — READ-ONLY operations only.
 * safe to run with any Linear API key.
 *
 * run: LINEAR_API_KEY=xxx bun test packages/cli/src/e2e-readonly.test.ts
 */

import { describe, test, expect } from "bun:test";
import { getClient } from "@bdsqqq/lnr-core";
import { liveChildEnv, liveCredentials } from "./live-test-support";

const { key: API_KEY } = liveCredentials(process.env);

const client = getClient(API_KEY);
const org = await client.organization;
console.log(`testing org: ${org.name}`);

async function lnr(...args: string[]): Promise<string> {
  const proc = Bun.spawn(["bun", "run", "dev", "--", ...args], {
    cwd: import.meta.dir + "/../..",
    env: liveChildEnv(process.env, API_KEY),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`lnr ${args.join(" ")} failed (${exitCode}):\n${stderr || stdout}`);
  }
  return stdout.trim();
}

describe("e2e: read-only", () => {
  test("me command", async () => {
    const out = await lnr("me");
    expect(out).toContain("@");
  });

  test("list teams", async () => {
    const out = await lnr("teams");
    expect(out).toBeDefined();
  });

  test("list projects", async () => {
    const out = await lnr("projects");
    expect(out).toBeDefined();
  });

  test("list users", async () => {
    const out = await lnr("users");
    expect(out).toContain("@");
  });

  test("list views", async () => {
    const out = await lnr("views", "--json");
    expect(Array.isArray(JSON.parse(out))).toBe(true);
  });

  test("list templates", async () => {
    const out = await lnr("templates", "--json");
    expect(Array.isArray(JSON.parse(out))).toBe(true);
  });

  test("list notifications", async () => {
    const out = await lnr("notifications", "--json");
    expect(Array.isArray(JSON.parse(out))).toBe(true);
  });

  test("list agent sessions", async () => {
    const out = await lnr("agent-sessions", "--json");
    expect(Array.isArray(JSON.parse(out))).toBe(true);
  });

  test("list initiatives (enterprise)", async () => {
    const out = await lnr("initiatives");
    expect(out).toBeDefined();
  });

  test("list roadmaps (enterprise)", async () => {
    const out = await lnr("roadmaps");
    expect(out).toBeDefined();
  });
});
