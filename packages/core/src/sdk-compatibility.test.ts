import { describe, expect, mock, test } from "bun:test";
import type { LinearClient } from "@linear/sdk";
import { listAgentSessions, getAgentSession } from "./agent-sessions";
import { getIssueComments } from "./comments";
import { getViewPreferences } from "./views";
import { createLabel, updateLabel } from "./labels";

describe("sdk nullable responses", () => {
  for (const type of [undefined, null, "commentThread"] as const) {
    test(`agent session type ${type} is normalized without inventing a type`, async () => {
      const session = { id: "S1", type, status: "active" };
      const client = {
        agentSessions: async () => ({ nodes: [session] }),
        agentSession: async () => session,
      } as unknown as LinearClient;
      expect((await listAgentSessions(client))[0]?.type).toBe(type ?? null);
      expect((await getAgentSession(client, "S1"))?.type).toBe(type ?? null);
    });
  }

  for (const syncedWith of [undefined, null, []]) {
    test(`absent comment sync metadata ${syncedWith} returns no services`, async () => {
      const client = {
        issue: async () => ({ comments: async () => ({ nodes: [{ id: "C1", syncedWith }] }) }),
      } as unknown as LinearClient;
      const result = await getIssueComments(client, "I1");
      expect(result.error).toBeUndefined();
      expect(result.comments[0]?.syncedWith).toEqual([]);
    });
  }

  for (const values of [undefined, null, { issueGrouping: null, showCompletedIssues: null, viewOrdering: null }]) {
    test(`absent view preferences ${JSON.stringify(values)} normalize to null fields`, async () => {
      const client = {
        customView: async () => ({
          viewPreferencesValues: values,
          userViewPreferences: { id: "V1", preferences: values },
        }),
      } as unknown as LinearClient;
      const result = await getViewPreferences(client, "V1");
      const expected = { issueGrouping: null, showCompletedIssues: null, viewOrdering: null };
      expect(result?.effective).toEqual(expected);
      expect(result?.user?.preferences).toEqual(expected);
    });
  }
});

describe("label group sdk payloads", () => {
  for (const groupType of [undefined, null, "singleSelect", "multiSelect"] as const) {
    test(`preserves ${groupType} in create and update payloads`, async () => {
      const createIssueLabel = mock(async (..._args: unknown[]) => ({ success: false }));
      const updateIssueLabel = mock(async (..._args: unknown[]) => ({ success: true }));
      const client = { createIssueLabel, updateIssueLabel } as unknown as LinearClient;
      await createLabel(client, { name: "group", groupType });
      await updateLabel(client, "L1", { groupType });
      expect(createIssueLabel.mock.calls[0]?.[0]).toMatchObject({ groupType });
      expect(updateIssueLabel.mock.calls[0]?.[1]).toMatchObject({ groupType });
    });
  }
});
