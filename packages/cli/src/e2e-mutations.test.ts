/**
 * ⚠️  DANGER: MUTATION TESTS — creates, updates, deletes Linear data.
 *
 * DO NOT RUN WITH YOUR PRODUCTION LINEAR API KEY.
 * USE A SANDBOX WORKSPACE ONLY.
 *
 * run: LINEAR_API_KEY=<SANDBOX_KEY> LNR_E2E_CONFIRM_ORG=<org-name> bun test packages/cli/src/e2e-mutations.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getClient, type Cycle, type GitAutomationState } from "@bdsqqq/lnr-core";
import { cleanupOwned, liveChildEnv, liveCredentials, type OwnedFixture } from "./live-test-support";

const { key: API_KEY, confirmOrg } = liveCredentials(process.env, true);
const client = getClient(API_KEY);
const RUN_ID = crypto.randomUUID();
const TEST_TEAM_KEY = `E${RUN_ID.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
const TEST_TEAM_NAME = `e2e-test-${RUN_ID}`;
const TEST_PROJECT_NAME = `e2e-project-${RUN_ID}`;
const TEST_VIEW_NAME = `e2e-view-${RUN_ID}`;
const UPDATED_VIEW_NAME = `e2e-view-updated-${RUN_ID}`;
const fixtures: OwnedFixture[] = [];
const teamFixture: OwnedFixture = { name: TEST_TEAM_NAME, remove: (id) => client.deleteTeam(id) };
const projectFixture: OwnedFixture = { name: TEST_PROJECT_NAME, remove: (id) => client.deleteProject(id) };
const viewFixture: OwnedFixture = { name: TEST_VIEW_NAME, remove: (id) => client.deleteCustomView(id) };

let teamId: string;
let issueId: string;
let issueIdentifier: string;
let projectId: string;
let viewId: string;
let commentId: string;

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

describe("e2e: mutations", () => {
  beforeAll(async () => {
    const org = await client.organization;
    if (confirmOrg !== org.name) {
      throw new Error(`aborted — org "${confirmOrg}" does not match actual org "${org.name}"`);
    }
    console.log(`testing org: ${org.name}; run: ${RUN_ID}`);
    console.log(`\n⚠️  MUTATION TESTS — creating test team: ${TEST_TEAM_NAME} (${TEST_TEAM_KEY})`);
    fixtures.push(teamFixture);
    const result = await client.createTeam({
      name: TEST_TEAM_NAME,
      key: TEST_TEAM_KEY,
      cyclesEnabled: true,
      cycleDuration: 2,
      upcomingCycleCount: 1,
    });
    const team = await result.team;
    if (!team) throw new Error("failed to create test team");
    teamId = team.id;
    teamFixture.id = teamId;
    console.log(`created team ${teamId}`);
  }, 30000);

  afterAll(async () => {
    await cleanupOwned(fixtures);
  }, 60000);

  describe("team", () => {
    test("list teams includes test team", async () => {
      const teams = JSON.parse(await lnr("teams", "--json"));
      expect(teams.find((team: { id: string }) => team.id === teamId))
        .toMatchObject({ id: teamId, key: TEST_TEAM_KEY });
    });

    test("show team by key", async () => {
      const out = await lnr("team", TEST_TEAM_KEY);
      expect(out).toContain(TEST_TEAM_NAME);
    });
  });

  describe("automatic cycles", () => {
    let cycleId: string;
    let cycleNumber: string;

    beforeAll(async () => {
      // linear creates cycles asynchronously; cycleCreate is deprecated and always rejects.
      const team = await client.team(teamId);
      for (let attempt = 0; attempt < 15; attempt++) {
        const cycles = await team.cycles();
        const cycle = cycles.nodes[0];
        if (cycle) {
          cycleId = cycle.id;
          cycleNumber = String(cycle.number);
          return;
        }
        await Bun.sleep(1000);
      }
      throw new Error("no automatically generated cycle found for the test team");
    }, 30000);

    test("direct cycle creation reports unsupported operation", async () => {
      const startsAt = new Date(Date.now() + 86400000);
      const endsAt = new Date(startsAt.getTime() + 14 * 86400000);
      await expect(lnr(
        "cycle",
        "new",
        "--team",
        TEST_TEAM_KEY,
        "--name",
        "Test Cycle",
        "--starts-at",
        startsAt.toISOString(),
        "--ends-at",
        endsAt.toISOString()
      )).rejects.toThrow("cycle creation is not supported");
    });

    test("list cycles", async () => {
      const cycles: Cycle[] = JSON.parse(await lnr("cycles", "--team", TEST_TEAM_KEY, "--json"));
      expect(cycles.some((cycle) => cycle.id === cycleId)).toBe(true);
    });

    test("show cycle by number", async () => {
      const cycle = JSON.parse(await lnr("cycle", cycleNumber, "--team", TEST_TEAM_KEY, "--json"));
      expect(cycle.id).toBe(cycleId);
    });

    test("update cycle name", async () => {
      const out = await lnr("cycle", cycleNumber, "--team", TEST_TEAM_KEY, "--name", "Updated Cycle");
      expect(out).toContain("updated");
      const cycle = JSON.parse(await lnr("cycle", cycleNumber, "--team", TEST_TEAM_KEY, "--json"));
      expect(cycle).toMatchObject({ id: cycleId, name: "Updated Cycle" });
    });

    test("delete cycle", async () => {
      const out = await lnr("cycle", cycleNumber, "--team", TEST_TEAM_KEY, "--delete");
      expect(out).toContain("archived");
      // listCycles returns [] on read errors, so verify archival through a strict sdk read.
      const cycle = await client.cycle(cycleId);
      expect(cycle.archivedAt).toBeTruthy();
    });
  });

  describe("view CRUD", () => {
    test("create view", async () => {
      fixtures.push(viewFixture);
      const out = await lnr("view", "new", "--name", TEST_VIEW_NAME);
      const json = await lnr("views", "--json");
      const views = JSON.parse(json);
      const matches = views.filter((v: any) => v.name === TEST_VIEW_NAME);
      expect(matches).toHaveLength(1);
      const testView = matches[0];
      expect(testView).toBeTruthy();
      viewId = testView.id;
      viewFixture.id = viewId;
      expect(out).toContain("created");
    });

    test("list views", async () => {
      expect(viewId).toBeTruthy();
      const views = JSON.parse(await lnr("views", "--json"));
      expect(views.some((view: { id: string }) => view.id === viewId)).toBe(true);
    });

    test("show view", async () => {
      expect(viewId).toBeTruthy();
      const out = await lnr("view", viewId);
      expect(out).toContain(TEST_VIEW_NAME);
    });

    test("update view name", async () => {
      expect(viewId).toBeTruthy();
      const out = await lnr("view", viewId, "--name", UPDATED_VIEW_NAME);
      expect(out).toContain("updated");
    });

    test("delete view", async () => {
      expect(viewId).toBeTruthy();
      viewFixture.deleteAttempted = true;
      const out = await lnr("view", viewId, "--delete");
      expect(out).toContain("deleted");
      viewFixture.deleted = true;
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
    }, 60000);

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
      fixtures.push(projectFixture);
      const out = await lnr("project", "new", "--new-name", TEST_PROJECT_NAME, "--team", TEST_TEAM_KEY);
      const json = await lnr("projects", "--json");
      const projects = JSON.parse(json);
      const matches = projects.filter((p: any) => p.name === TEST_PROJECT_NAME);
      expect(matches).toHaveLength(1);
      const testProject = matches[0];
      expect(testProject).toBeTruthy();
      projectId = testProject.id;
      projectFixture.id = projectId;
      expect(out).toContain("created");
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

    test("unsubscribe from project", async () => {
      // auto-finds subscription, no id required
      try {
        const out = await lnr("project", TEST_PROJECT_NAME, "--unsubscribe");
        expect(out.toLowerCase()).toMatch(/unsubscrib/);
      } catch (e: any) {
        // may fail if not subscribed
        expect(e.message).toMatch(/no subscription found|not subscribed/);
      }
    });
  });

  describe("git automation", () => {
    let automationId: string;

    async function automations(): Promise<GitAutomationState[]> {
      return JSON.parse(await lnr("git-automations", "--team", TEST_TEAM_KEY, "--json"));
    }

    test("list git automations", async () => {
      expect(Array.isArray(await automations())).toBe(true);
    });

    test("create git automation state", async () => {
      const team = await client.team(teamId);
      const states = await team.states();
      const inProgressState = states.nodes.find((s) => s.type === "started");
      if (!inProgressState) throw new Error("test team has no started workflow state");

      // fresh teams contain default rules; remove only this fixture's conflicting rule.
      for (const automation of await automations()) {
        if (automation.event === "start" && automation.targetBranchId === null) {
          expect(automation.teamId).toBe(teamId);
          const out = await lnr("git-automation", automation.id, "--team", TEST_TEAM_KEY, "--delete");
          expect(out).toContain("deleted");
        }
      }
      expect((await automations()).some((a) => a.event === "start" && a.targetBranchId === null)).toBe(false);

      const out = await lnr(
        "git-automation",
        "new",
        "--team",
        TEST_TEAM_KEY,
        "--event",
        "start",
        "--state",
        inProgressState.name
      );
      expect(out).toContain("created");
      const created = (await automations()).filter((a) => a.event === "start" && a.targetBranchId === null);
      expect(created).toHaveLength(1);
      const automation = created[0]!;
      expect(automation).toMatchObject({ teamId, stateId: inProgressState.id });
      automationId = automation.id;
    }, 60000);

    test("list git automations after create", async () => {
      expect(automationId).toBeDefined();
      expect((await automations()).some((a) => a.id === automationId)).toBe(true);
    });

    test("delete git automation", async () => {
      expect(automationId).toBeDefined();
      const out = await lnr("git-automation", automationId, "--team", TEST_TEAM_KEY, "--delete");
      expect(out).toContain("deleted");
      expect((await automations()).some((a) => a.id === automationId)).toBe(false);
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
      expect(projectId).toBeTruthy();
      projectFixture.deleteAttempted = true;
      const out = await lnr("project", TEST_PROJECT_NAME, "--delete");
      expect(out).toContain("deleted");
      projectFixture.deleted = true;
    });
  });
});
