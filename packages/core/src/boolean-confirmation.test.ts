import { expect, mock, test } from "bun:test";
import { GitAutomationStates, IssueRelationType, type LinearClient } from "@linear/sdk";
import * as core from "./index";

type Case = {
  name: string;
  method: string;
  run: (client: LinearClient) => Promise<boolean>;
  args: unknown[];
  catches?: boolean;
  subscribed?: boolean;
};

// Boolean helpers promise confirmation, not SDK truthiness. Entity/payload contracts stay separate.
const cases: Case[] = [
  { name: "updateIssue", method: "updateIssue", run: c => core.updateIssue(c, "I1", { title: "changed" }), args: ["I1", { title: "changed" }] },
  { name: "addComment", method: "createComment", run: c => core.addComment(c, "I1", "body"), args: [{ issueId: "I1", body: "body" }] },
  { name: "archiveIssue", method: "archiveIssue", run: c => core.archiveIssue(c, "I1"), args: ["I1"] },
  { name: "updateComment", method: "updateComment", run: c => core.updateComment(c, "C1", "body"), args: ["C1", { body: "body" }] },
  { name: "replyToComment", method: "createComment", run: c => core.replyToComment(c, "I1", "C1", "body"), args: [{ issueId: "I1", parentId: "C1", body: "body" }] },
  { name: "deleteComment", method: "deleteComment", run: c => core.deleteComment(c, "C1"), args: ["C1"] },
  { name: "updateDocument", method: "updateDocument", run: c => core.updateDocument(c, "D1", { title: "changed", ownerId: null }), args: ["D1", { title: "changed", ownerId: null }] },
  { name: "deleteDocument", method: "deleteDocument", run: c => core.deleteDocument(c, "D1"), args: ["D1"] },
  { name: "updateLabel", method: "updateIssueLabel", run: c => core.updateLabel(c, "L1", { name: "changed", groupType: "singleSelect" }), args: ["L1", { name: "changed", groupType: "singleSelect" }] },
  { name: "deleteLabel", method: "deleteIssueLabel", run: c => core.deleteLabel(c, "L1"), args: ["L1"] },
  { name: "linkGitHubPR", method: "attachmentLinkGitHubPR", run: c => core.linkGitHubPR(c, "I1", "https://example.invalid/pr"), args: ["I1", "https://example.invalid/pr"] },
  { name: "createIssueRelation", method: "createIssueRelation", run: c => core.createIssueRelation(c, "I1", "I2", "blocks"), args: [{ issueId: "I1", relatedIssueId: "I2", type: IssueRelationType.Blocks }] },
  { name: "deleteProject", method: "deleteProject", run: c => core.deleteProject(c, "project"), args: ["P1"] },
  { name: "createReaction", method: "createReaction", run: c => core.createReaction(c, { type: "projectUpdate", id: "PU1" }, "+1"), args: [{ projectUpdateId: "PU1", emoji: "+1" }] },
  { name: "createCommentReaction", method: "createReaction", run: c => core.createCommentReaction(c, "C1", "+1"), args: [{ commentId: "C1", emoji: "+1" }] },
  { name: "deleteReaction", method: "deleteReaction", run: c => core.deleteReaction(c, "R1"), args: ["R1"] },
  { name: "deleteSubscription", method: "deleteNotificationSubscription", run: c => core.deleteSubscription(c, "S1"), args: ["S1"] },
  { name: "subscribeToIssue", method: "updateIssue", run: c => core.subscribeToIssue(c, "I1"), args: ["I1", { subscriberIds: ["other", "viewer"] }] },
  { name: "unsubscribeFromIssue", method: "updateIssue", run: c => core.unsubscribeFromIssue(c, "I1"), args: ["I1", { subscriberIds: ["other"] }], subscribed: true },
  { name: "updateCycle", method: "updateCycle", run: c => core.updateCycle(c, "CY1", { name: "changed", startsAt: "2026-01-01" }), args: ["CY1", { name: "changed", description: undefined, startsAt: new Date("2026-01-01"), endsAt: undefined, completedAt: undefined }], catches: true },
  { name: "deleteCycle", method: "archiveCycle", run: c => core.deleteCycle(c, "CY1"), args: ["CY1"], catches: true },
  { name: "updateView", method: "updateCustomView", run: c => core.updateView(c, "V1", { name: "changed", shared: false }), args: ["V1", { name: "changed", description: undefined, icon: undefined, color: undefined, filterData: undefined, shared: false }], catches: true },
  { name: "deleteView", method: "deleteCustomView", run: c => core.deleteView(c, "V1"), args: ["V1"], catches: true },
  { name: "updateGitAutomationState", method: "updateGitAutomationState", run: c => core.updateGitAutomationState(c, "G1", { event: "merge", stateId: "ST1", targetBranchId: "B1" }), args: ["G1", { event: GitAutomationStates.Merge, stateId: "ST1", targetBranchId: "B1" }], catches: true },
  { name: "deleteGitAutomationState", method: "deleteGitAutomationState", run: c => core.deleteGitAutomationState(c, "G1"), args: ["G1"], catches: true },
  { name: "updateGitAutomationTargetBranch", method: "updateGitAutomationTargetBranch", run: c => core.updateGitAutomationTargetBranch(c, "B1", { branchPattern: "main", isRegex: false }), args: ["B1", { branchPattern: "main", isRegex: false }], catches: true },
  { name: "deleteGitAutomationTargetBranch", method: "deleteGitAutomationTargetBranch", run: c => core.deleteGitAutomationTargetBranch(c, "B1"), args: ["B1"], catches: true },
  { name: "deleteMilestone", method: "deleteProjectMilestone", run: c => core.deleteMilestone(c, "M1"), args: ["M1"], catches: true },
  { name: "markNotificationRead", method: "updateNotification", run: c => core.markNotificationRead(c, "N1"), args: ["N1", { readAt: expect.any(Date) }], catches: true },
  { name: "archiveNotification", method: "archiveNotification", run: c => core.archiveNotification(c, "N1"), args: ["N1"], catches: true },
  { name: "updateAgentSession", method: "update", run: c => core.updateAgentSession(c, "AS1", { summary: null }), args: [{ summary: null }], catches: true },
];

for (const entry of cases) {
  for (const outcome of [true, false, undefined, "false", 1, {}, new Error("sdk rejected mutation")]) {
    test(`${entry.name} confirmation ${typeof outcome}:${String(outcome)}`, async () => {
      const mutate = mock(async (..._args: unknown[]) => {
        if (outcome instanceof Error) throw outcome;
        return outcome === undefined ? {} : { success: outcome };
      });
      const issue = mock(async (id: string) => {
        expect(id).toBe("I1");
        return { subscribers: async () => ({ nodes: (entry.subscribed ? ["other", "viewer"] : ["other"]).map(id => ({ id })) }) };
      });
      const agentSession = mock(async (id: string) => {
        expect(id).toBe("AS1");
        return { update: mutate };
      });
      const client = {
        [entry.method]: mutate,
        viewer: { id: "viewer" },
        issue,
        agentSession,
        projects: async () => ({ nodes: [{ id: "P1", name: "project" }] }),
      } as unknown as LinearClient;

      if (outcome instanceof Error && !entry.catches) {
        await expect(entry.run(client)).rejects.toBe(outcome);
      } else {
        expect(await entry.run(client)).toBe(outcome === true);
      }
      expect(mutate).toHaveBeenCalledTimes(1);
      expect(mutate).toHaveBeenCalledWith(...entry.args);
      expect(issue).toHaveBeenCalledTimes(entry.name === "subscribeToIssue" || entry.name === "unsubscribeFromIssue" ? 1 : 0);
      expect(agentSession).toHaveBeenCalledTimes(entry.name === "updateAgentSession" ? 1 : 0);
    });
  }
}

test("subscription no-ops stay confirmed without writing; missing project stays false", async () => {
  const updateIssue = mock(async () => { throw new Error("unexpected write"); });
  const deleteProject = mock(async () => { throw new Error("unexpected write"); });
  for (const subscribed of [false, true]) {
    const client = {
      viewer: { id: "viewer" },
      issue: async () => ({ subscribers: async () => ({ nodes: subscribed ? [{ id: "viewer" }] : [] }) }),
      updateIssue,
    } as unknown as LinearClient;
    expect(await (subscribed ? core.subscribeToIssue : core.unsubscribeFromIssue)(client, "I1")).toBe(true);
  }
  expect(await core.deleteProject({
    projects: async () => ({ nodes: [] }), deleteProject,
  } as unknown as LinearClient, "missing")).toBe(false);
  expect(updateIssue).not.toHaveBeenCalled();
  expect(deleteProject).not.toHaveBeenCalled();
});
