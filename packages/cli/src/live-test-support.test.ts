import { describe, expect, test } from "bun:test";
import { devNull } from "node:os";
import { cleanupOwned, liveChildEnv, liveCredentials, type OwnedFixture } from "./live-test-support";

describe("live test safety", () => {
  for (const file of ["e2e-readonly.test.ts", "e2e-mutations.test.ts"]) {
    test(`${file} fails rather than skips without credentials`, () => {
      const result = Bun.spawnSync([process.execPath, "test", `${import.meta.dir}/${file}`], {
        env: { ...liveChildEnv(process.env, ""), LNR_E2E_CONFIRM_ORG: "" },
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        timeout: 5000,
      });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("live tests require LINEAR_API_KEY");
    });
  }

  test("requires explicit nonblank credentials and mutation confirmation", () => {
    for (const key of [undefined, "", " "]) {
      expect(() => liveCredentials({ LINEAR_API_KEY: key })).toThrow("LINEAR_API_KEY");
    }
    expect(() => liveCredentials({ LINEAR_API_KEY: "key" }, true)).toThrow("LNR_E2E_CONFIRM_ORG");
    expect(() => liveCredentials({ LINEAR_API_KEY: "key", LNR_E2E_CONFIRM_ORG: " " }, true)).toThrow();
    expect(liveCredentials({ LINEAR_API_KEY: "key", LNR_E2E_CONFIRM_ORG: "sandbox" }, true))
      .toEqual({ key: "key", confirmOrg: "sandbox" });
  });

  test("isolates child config without mutating the supplied environment", () => {
    const env = { LINEAR_API_KEY: "ambient", LNR_CONFIG_PATH: "/ambient" };
    expect(liveChildEnv(env, "explicit")).toEqual({
      LINEAR_API_KEY: "explicit", LNR_CONFIG_PATH: devNull,
    });
    expect(env).toEqual({ LINEAR_API_KEY: "ambient", LNR_CONFIG_PATH: "/ambient" });
  });

  test("cleans only registered ids in reverse order and skips completed deletes", async () => {
    const calls: string[] = [];
    const remove = async (id: string) => { calls.push(id); return { success: true }; };
    const fixtures: OwnedFixture[] = [
      { name: "team", id: "team-id", remove },
      { name: "view", id: "view-id", remove },
      { name: "deleted", id: "deleted-id", deleted: true, remove },
    ];
    await cleanupOwned(fixtures);
    await cleanupOwned(fixtures);
    expect(calls).toEqual(["view-id", "team-id"]);
  });

  test("reports unknown outcomes, continues cleanup, and never retries deletes", async () => {
    const calls: string[] = [];
    const remove = async (id: string) => { calls.push(id); return { success: id === "team" }; };
    const fixtures: OwnedFixture[] = [
      { name: "team", id: "team", remove },
      { name: "failed", id: "failed", remove },
      { name: "uncertain", id: "uncertain", deleteAttempted: true, remove },
      { name: "missing", remove },
    ];
    await expect(cleanupOwned(fixtures)).rejects.toThrow("manual authorized recovery");
    await expect(cleanupOwned(fixtures)).rejects.toThrow("missing (id unknown)");
    expect(calls).toEqual(["failed", "team"]);
  });
});
