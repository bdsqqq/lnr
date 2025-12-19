import { describe, test, expect, afterAll } from "bun:test";
import {
  cli,
  cleanupTestIssues,
  getFirstTeamKey,
  TEST_PREFIX,
} from "./helpers";

describe("issues", () => {
  describe("read-only", () => {
    test("li issues lists issues", async () => {
      const { stdout, exitCode } = await cli("issues");
      expect(exitCode).toBe(0);
      expect(stdout).toBeDefined();
    });

    test("li issues --json outputs valid JSON", async () => {
      const { stdout, exitCode } = await cli("issues", "--json");
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(Array.isArray(parsed)).toBe(true);
    });

    test("li issues --quiet outputs only IDs", async () => {
      const { stdout, exitCode } = await cli("issues", "--quiet");
      expect(exitCode).toBe(0);
      const lines = stdout.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        expect(line).toMatch(/^[A-Z]+-\d+$/);
      }
    });
  });

  describe("create/delete cycle", () => {
    let createdIdentifier: string | null = null;

    afterAll(async () => {
      await cleanupTestIssues();
    });

    test("create issue with [TEST-CLI] prefix, verify, then cleanup archives it", async () => {
      const teamKey = await getFirstTeamKey();
      const testTitle = `${TEST_PREFIX} test issue ${Date.now()}`;

      const createResult = await cli(
        "issue",
        "new",
        "--team",
        teamKey,
        "--title",
        testTitle
      );
      if (createResult.exitCode !== 0) {
        console.error("stderr:", createResult.stderr);
        console.error("stdout:", createResult.stdout);
      }
      expect(createResult.exitCode).toBe(0);
      expect(createResult.stdout).toContain("created");

      const match = createResult.stdout.match(/created ([A-Z]+-\d+):/);
      expect(match).toBeTruthy();
      createdIdentifier = match![1];

      const showResult = await cli("issue", createdIdentifier!, "--json");
      expect(showResult.exitCode).toBe(0);
      const issue = JSON.parse(showResult.stdout);
      expect(issue.title).toBe(testTitle);
      expect(issue.identifier).toBe(createdIdentifier);
    });
  });
});
