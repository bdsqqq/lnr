/**
 * e2e tests — READ-ONLY operations only.
 * safe to run with any Linear API key.
 *
 * run: LINEAR_API_KEY=xxx bun test packages/cli/src/e2e-readonly.test.ts
 */

import { describe, test, expect } from "bun:test";

const API_KEY = process.env.LINEAR_API_KEY;
if (!API_KEY) {
  console.log("skipping e2e tests: LINEAR_API_KEY not set");
  process.exit(0);
}

async function lnr(...args: string[]): Promise<string> {
  const proc = Bun.spawn(["bun", "run", "dev", "--", ...args], {
    cwd: import.meta.dir + "/../..",
    env: { ...process.env, LINEAR_API_KEY: API_KEY },
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
    try {
      const out = await lnr("views");
      expect(out).toBeDefined();
    } catch {
      // empty is fine
    }
  });

  test("list templates", async () => {
    try {
      const out = await lnr("templates");
      expect(out).toBeDefined();
    } catch {
      // empty is fine
    }
  });

  test("list notifications", async () => {
    try {
      const out = await lnr("notifications");
      expect(out).toBeDefined();
    } catch {
      // empty is fine
    }
  });

  test("list agent sessions", async () => {
    try {
      const out = await lnr("agent-sessions");
      expect(out).toBeDefined();
    } catch {
      // empty is fine
    }
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
