/**
 * ⚠️  DANGER: MUTATION TESTS — creates, updates, deletes Linear data.
 *
 * DO NOT RUN WITH YOUR PRODUCTION LINEAR API KEY.
 * USE A SANDBOX WORKSPACE ONLY.
 *
 * run: LINEAR_API_KEY=<SANDBOX_KEY> bun test packages/cli/src/e2e-mutations.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createClientWithKey } from "@bdsqqq/lnr-core";

const API_KEY = process.env.LINEAR_API_KEY;
if (!API_KEY) {
  console.log("skipping e2e mutation tests: LINEAR_API_KEY not set");
  process.exit(0);
}

const client = createClientWithKey(API_KEY);
const TEST_TEAM_KEY = `E2E${Date.now().toString(36).slice(-4).toUpperCase()}`;
const TEST_TEAM_NAME = `e2e-test-${Date.now()}`;
const TEST_PROJECT_NAME = `e2e-project-${Date.now()}`;

let teamId: string;
let issueId: string;
let issueIdentifier: string;
let projectId: string;
let viewId: string;
let commentId: string;

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

describe("e2e: mutations", () => {
  beforeAll(async () => {
    console.log(`\n⚠️  MUTATION TESTS — creating test team: ${TEST_TEAM_NAME} (${TEST_TEAM_KEY})`);
    const result = await client.createTeam({
      name: TEST_TEAM_NAME,
      key: TEST_TEAM_KEY,
    });
    const team = await result.team;
    if (!team) throw new Error("failed to create test team");
    teamId = team.id;
    console.log(`created team ${teamId}`);
  }, 30000);

  afterAll(async () => {
    console.log(`cleaning up: deleting team ${teamId}`);
    if (teamId) {
      await client.deleteTeam(teamId);
      console.log("team deleted");
    }
  }, 30000);

  describe("team", () => {
    test("list teams includes test team", async () => {
      const out = await lnr("teams");
      expect(out).toContain(TEST_TEAM_KEY);
    });

    test("show team by key", async () => {
      const out = await lnr("team", TEST_TEAM_KEY);
      expect(out).toContain(TEST_TEAM_NAME);
    });
  });

  describe("cycle CRUD", () => {
    test("create cycle", async () => {
      const out = await lnr(
        "cycle",
        "new",
        "--team",
        TEST_TEAM_KEY,
        "--name",
        "Test Cycle",
        "--starts-at",
        "2026-03-01",
        "--ends-at",
        "2026-03-14"
      );
      expect(out).toContain("created cycle");
    });

    test("list cycles", async () => {
      const out = await lnr("cycles", "--team", TEST_TEAM_KEY);
      expect(out).toContain("Test Cycle");
    });

    test("show cycle by number", async () => {
      const out = await lnr("cycle", "1", "--team", TEST_TEAM_KEY);
      expect(out).toContain("Test Cycle");
    });

    test("update cycle name", async () => {
      const out = await lnr("cycle", "1", "--team", TEST_TEAM_KEY, "--name", "Updated Cycle");
      expect(out).toContain("updated");
    });

    test("delete cycle", async () => {
      const out = await lnr("cycle", "1", "--team", TEST_TEAM_KEY, "--delete");
      expect(out).toContain("archived");
    });
  });

  describe("view CRUD", () => {
    test("create view", async () => {
      const out = await lnr("view", "new", "--name", "Test View");
      expect(out).toContain("created");
      const json = await lnr("views", "--json");
      const views = JSON.parse(json);
      const testView = views.find((v: any) => v.name === "Test View");
      expect(testView).toBeTruthy();
      viewId = testView.id;
    });

    test("list views", async () => {
      const out = await lnr("views");
      expect(out).toContain("Test View");
    });

    test("show view", async () => {
      const out = await lnr("view", "Test View");
      expect(out).toContain("Test View");
    });

    test("update view name", async () => {
      const out = await lnr("view", "Test View", "--name", "Updated View");
      expect(out).toContain("updated");
    });

    test("delete view", async () => {
      const out = await lnr("view", "Updated View", "--delete");
      expect(out).toContain("deleted");
    });
  });

  describe("issue + comment + reaction", () => {
    test("create issue", async () => {
      const out = await lnr("issue", "new", "--team", TEST_TEAM_KEY, "--title", "Test Issue");
      expect(out).toContain("created");
      const json = await lnr("issues", "--team", TEST_TEAM_KEY, "--json");
      const issues = JSON.parse(json);
      const testIssue = issues.find((i: any) => i.title === "Test Issue");
      expect(testIssue).toBeTruthy();
      issueId = testIssue.id;
      issueIdentifier = testIssue.identifier;
    });

    test("add comment", async () => {
      const out = await lnr("issue", issueIdentifier, "--comment", "Test comment body");
      expect(out).toContain("comment");
    });

    test("list comments", async () => {
      const out = await lnr("issue", issueIdentifier, "--comments");
      expect(out).toContain("Test comment body");
    });

    test("add reaction to comment", async () => {
      const json = await lnr("issue", issueIdentifier, "--comments", "--json");
      const comments = JSON.parse(json);
      expect(comments.length).toBeGreaterThan(0);
      commentId = comments[0].id;
      const out = await lnr("issue", issueIdentifier, "--react", commentId, "--emoji", "thumbsup");
      expect(out).toContain("reaction");
    });

    test("subscribe to issue", async () => {
      const out = await lnr("issue", issueIdentifier, "--subscribe");
      expect(out.toLowerCase()).toMatch(/subscrib/);
    });

    test("unsubscribe from issue", async () => {
      const out = await lnr("issue", issueIdentifier, "--unsubscribe");
      expect(out.toLowerCase()).toMatch(/unsubscrib/);
    });
  });

  describe("issue batch", () => {
    test("create additional issues for batch", async () => {
      await lnr("issue", "new", "--team", TEST_TEAM_KEY, "--title", "Batch Issue 1");
      await lnr("issue", "new", "--team", TEST_TEAM_KEY, "--title", "Batch Issue 2");
      const out = await lnr("issues", "--team", TEST_TEAM_KEY);
      expect(out).toContain("Batch Issue 1");
      expect(out).toContain("Batch Issue 2");
    });

    test("batch update priority", async () => {
      const json = await lnr("issues", "--team", TEST_TEAM_KEY, "--json");
      const issues = JSON.parse(json);
      const batchIssues = issues.filter((i: any) => i.title.startsWith("Batch Issue"));
      const ids = batchIssues.map((i: any) => i.identifier).join(",");
      const out = await lnr("issue batch", ids, "--priority", "high");
      expect(out).toContain("updated");
    });
  });

  describe("project + scoped entities", () => {
    test("create project", async () => {
      const out = await lnr("project", "new", "--new-name", TEST_PROJECT_NAME, "--team", TEST_TEAM_KEY);
      expect(out).toContain("created");
      const json = await lnr("projects", "--json");
      const projects = JSON.parse(json);
      const testProject = projects.find((p: any) => p.name === TEST_PROJECT_NAME);
      expect(testProject).toBeTruthy();
      projectId = testProject.id;
    });

    test("show project labels (scoped)", async () => {
      const out = await lnr("project", TEST_PROJECT_NAME, "--labels");
      expect(out).toBeDefined();
    });

    test("show project status (scoped)", async () => {
      const out = await lnr("project", TEST_PROJECT_NAME, "--show-status");
      expect(out).toBeDefined();
    });

    test("show project updates (scoped)", async () => {
      const out = await lnr("project", TEST_PROJECT_NAME, "--updates");
      expect(out).toBeDefined();
    });

    test("subscribe to project", async () => {
      // may succeed or fail with "already subscribed" — both are valid
      try {
        const out = await lnr("project", TEST_PROJECT_NAME, "--subscribe");
        expect(out.toLowerCase()).toMatch(/subscrib/);
      } catch (e: any) {
        expect(e.message).toContain("already have an existing subscription");
      }
    });
  });

  describe("git automation", () => {
    test("list git automations (empty ok)", async () => {
      try {
        const out = await lnr("git-automations", "--team", TEST_TEAM_KEY);
        expect(out).toBeDefined();
      } catch (e: any) {
        expect(e.message).toContain("no git automation");
      }
    });

    test("create git automation state", async () => {
      const team = await client.team(teamId);
      const states = await team.states();
      const inProgressState = states.nodes.find((s) => s.name === "In Progress");
      if (!inProgressState) {
        console.log("skipping: no In Progress state found");
        return;
      }

      const out = await lnr(
        "git-automation",
        "new",
        "--team",
        TEST_TEAM_KEY,
        "--event",
        "start",
        "--state",
        "In Progress"
      );
      expect(out).toContain("created");
    });

    test("list git automations after create", async () => {
      const out = await lnr("git-automations", "--team", TEST_TEAM_KEY);
      expect(out).toContain("start");
    });

    test("delete git automation", async () => {
      const out = await lnr("git-automation", "start", "--team", TEST_TEAM_KEY, "--delete");
      expect(out).toContain("deleted");
    });
  });

  describe("cleanup", () => {
    test(
      "archive all test issues",
      async () => {
        const json = await lnr("issues", "--team", TEST_TEAM_KEY, "--json");
        const issues = JSON.parse(json);
        for (const issue of issues) {
          await lnr("issue", issue.identifier, "--archive");
        }
        expect(true).toBe(true);
      },
      30000
    );

    test("delete test project", async () => {
      if (projectId) {
        const out = await lnr("project", TEST_PROJECT_NAME, "--delete");
        expect(out).toContain("deleted");
      }
    });
  });
});
