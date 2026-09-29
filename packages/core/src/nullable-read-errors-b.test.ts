import { expect, mock, test } from "bun:test";
import type { LinearClient } from "@linear/sdk";
import { getCurrentCycle, getCycleById } from "./cycles";
import { getUser } from "./users";
import { getMilestone } from "./milestones";
import { getGitAutomationTargetBranch, findGitAutomationTargetBranchByPattern } from "./git-automation-target-branches";
import { getNotification } from "./notifications";
import { getAgentSession } from "./agent-sessions";

const date = new Date(0);
const cycle = { id: "id", number: 1, name: "cycle", description: "", startsAt: date, endsAt: date, completedAt: undefined, progress: 0 };
const user = { id: "id", name: "user", email: "a@b.c", displayName: "a", active: true, admin: false };
const milestone = { id: "id", name: "milestone", description: "", targetDate: "2026-10-01", sortOrder: 0, createdAt: date, updatedAt: date };
const branch = { id: "id", branchPattern: "main", isRegex: false, createdAt: date, updatedAt: date, archivedAt: null };
const notification = { id: "id", type: "issue", category: "issue", createdAt: date, readAt: null, snoozedUntilAt: null, archivedAt: null, actorId: null, actorName: null };
const session = {
  id: "id", status: "active" as const, type: null, summary: null, externalLink: null, plan: null, sourceMetadata: null,
  createdAt: date, updatedAt: date, startedAt: null, endedAt: null, dismissedAt: null, archivedAt: null,
  issueId: null, issueIdentifier: null, commentId: null, creatorId: null, creatorName: null, appUserId: null, appUserName: null,
};
type Case = {
  name: string; root: string; args: string[]; relations: string[];
  read: (client: LinearClient) => Promise<unknown>;
  value: Record<string, unknown>; expected: unknown;
};
const cases: Case[] = [
  { name: "current cycle", root: "team", args: ["ENG"], relations: ["activeCycle"], read: c => getCurrentCycle(c, "ENG"), value: { activeCycle: cycle }, expected: cycle },
  { name: "cycle by id", root: "cycle", args: ["id"], relations: [], read: c => getCycleById(c, "id"), value: cycle, expected: cycle },
  { name: "user", root: "user", args: ["id"], relations: [], read: c => getUser(c, "id"), value: user, expected: user },
  { name: "milestone", root: "projectMilestone", args: ["id"], relations: [], read: c => getMilestone(c, "id"), value: milestone, expected: milestone },
  ...[
    { name: "branch id", read: (c: LinearClient) => getGitAutomationTargetBranch(c, "ENG", "id") },
    { name: "branch pattern", read: (c: LinearClient) => findGitAutomationTargetBranchByPattern(c, "ENG", "main") },
  ].map(c => ({ ...c, root: "team", args: ["ENG"], relations: ["gitAutomationStates"], value: { id: "team-id", key: "ENG", gitAutomationStates: async () => ({ nodes: [{ targetBranch: branch }] }) }, expected: { ...branch, teamId: "team-id", teamKey: "ENG" } })),
  { name: "notification", root: "notification", args: ["id"], relations: ["actor"], read: c => getNotification(c, "id"), value: notification, expected: notification },
  { name: "agent session", root: "agentSession", args: ["id"], relations: ["creator", "appUser", "issue"], read: c => getAgentSession(c, "id"), value: session, expected: session },
];
for (const c of cases) {
  for (const phase of ["root", ...c.relations]) {
    test(`${c.name}: ${phase} error identity`, async () => {
      const error = new Error("network unavailable");
      const value = { ...c.value };
      const relations = c.relations.map(name => {
        const read = mock(async () => {
          if (phase === name) throw error;
          return null;
        });
        if (name === "gitAutomationStates") value[name] = read;
        else {
          value[`${name}Id`] = "relation-id";
          Object.defineProperty(value, name, { get: read });
        }
        return read;
      });
      const root = mock(async (..._args: unknown[]) => {
        if (phase === "root") throw error;
        return value;
      });
      await expect(c.read({ [c.root]: root } as unknown as LinearClient)).rejects.toBe(error);
      expect(root.mock.calls).toEqual([c.args]);
      relations.forEach((read, index) => {
        expect(read).toHaveBeenCalledTimes(phase === "root" || index > c.relations.indexOf(phase) ? 0 : 1);
      });
    });
  }
  for (const present of [false, true]) {
    test(`${c.name}: ${present ? "payload" : "missing root"}`, async () => {
      const value = { ...c.value };
      const relations = c.relations.map(name => {
        const read = mock(async () => {
          const original = c.value[name];
          return typeof original === "function" ? original() : original;
        });
        if (name === "gitAutomationStates") value[name] = read;
        else Object.defineProperty(value, name, { get: read });
        return { name, read };
      });
      const root = mock(async (..._args: unknown[]) => present ? value : null);
      expect(await c.read({ [c.root]: root } as unknown as LinearClient)).toEqual(present ? c.expected : null);
      expect(root.mock.calls).toEqual([c.args]);
      for (const { name, read } of relations) {
        expect(read).toHaveBeenCalledTimes(present && ["activeCycle", "gitAutomationStates"].includes(name) ? 1 : 0);
      }
    });
  }
}
test("current cycle: absent active cycle", async () => {
  const activeCycle = mock(async () => null);
  expect(await getCurrentCycle({ team: async () => ({ get activeCycle() { return activeCycle(); } }) } as unknown as LinearClient, "ENG")).toBeNull();
  expect(activeCycle).toHaveBeenCalledTimes(1);
});
for (const c of cases.filter(c => c.name.startsWith("branch"))) {
  for (const nodes of [[], [{ targetBranch: null }], [{ targetBranch: { ...branch, id: "other", branchPattern: "other" } }]]) {
    test(`${c.name}: absent or unmatched branch ${JSON.stringify(nodes)}`, async () => {
      const gitAutomationStates = mock(async () => ({ nodes }));
      expect(await c.read({ team: async () => ({ gitAutomationStates }) } as unknown as LinearClient)).toBeNull();
      expect(gitAutomationStates).toHaveBeenCalledTimes(1);
    });
  }
}
for (const populated of [false, true]) {
  test(`notification: nullable actor, populated=${populated}`, async () => {
    const actor = mock(() => Promise.resolve(populated ? { name: "actor" } : null));
    const result = await getNotification({ notification: async () => ({ ...notification, actorId: "actor-id", get actor() { return actor(); } }) } as unknown as LinearClient, "id");
    expect(result).toEqual({ ...notification, actorId: "actor-id", actorName: populated ? "actor" : null });
    expect(actor).toHaveBeenCalledTimes(1);
  });
  test(`agent session: nullable relations, populated=${populated}`, async () => {
    const creator = mock(async () => populated ? { name: "creator" } : null);
    const appUser = mock(async () => populated ? { name: "app" } : null);
    const issue = mock(async () => populated ? { identifier: "ENG-1" } : null);
    const result = await getAgentSession({ agentSession: async () => ({
      ...session, creatorId: "creator-id", appUserId: "app-id", issueId: "issue-id",
      get creator() { return creator(); },
      get appUser() { return appUser(); },
      get issue() { return issue(); },
    }) } as unknown as LinearClient, "id");
    expect(result).toEqual({ ...session, creatorId: "creator-id", appUserId: "app-id", issueId: "issue-id",
      creatorName: populated ? "creator" : null, appUserName: populated ? "app" : null, issueIdentifier: populated ? "ENG-1" : null });
    for (const read of [creator, appUser, issue]) expect(read).toHaveBeenCalledTimes(1);
  });
}
