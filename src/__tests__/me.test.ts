import { describe, test, expect } from "bun:test";
import { cli } from "./helpers";

describe("me", () => {
  test("li me shows current user", async () => {
    const { stdout, stderr, exitCode } = await cli("me");

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("email:");
  });

  test("li me --issues shows assigned issues", async () => {
    const { stdout, stderr, exitCode } = await cli("me", "--issues");

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    // output contains issue identifiers (TEAM-123 format) or is empty
    if (stdout.trim()) {
      expect(stdout).toMatch(/[A-Z]+-\d+/);
    }
  });

  test("li me --created shows created issues", async () => {
    const { stdout, stderr, exitCode } = await cli("me", "--created");

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    // output contains issue identifiers (TEAM-123 format) or is empty
    if (stdout.trim()) {
      expect(stdout).toMatch(/[A-Z]+-\d+/);
    }
  });
});
