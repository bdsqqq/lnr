import { expect, mock, test } from "bun:test";
import type { LinearClient } from "@linear/sdk";
import { getCycleIssues, getCycleIssuesById } from "./cycles";

const issue = (identifier: string) => ({
  id: identifier, identifier, title: identifier, description: undefined,
  state: Promise.resolve({ name: "Todo" }), assignee: Promise.resolve(null),
  priority: 0, createdAt: new Date(0), updatedAt: new Date(0), url: "", branchName: "",
});
test("exact lookup preserves selected cycle; team helper retains active-cycle API", async () => {
  const selected = { issues: mock(async () => ({ nodes: [issue("ENG-12")] })) };
  const current = { issues: mock(async () => ({ nodes: [issue("ENG-13")] })) };
  const active = mock(() => Promise.resolve(current));
  const cycle = mock(async (id: string) => {
    if (id !== "cycle-12") throw new Error("wrong cycle");
    return selected;
  });
  const team = mock(async () => ({ get activeCycle() { return active(); } }));
  const client = { cycle, team } as unknown as LinearClient;
  expect((await getCycleIssuesById(client, "cycle-12"))[0]).toMatchObject({
    identifier: "ENG-12", state: "Todo", assignee: null,
  });
  expect(cycle).toHaveBeenCalledWith("cycle-12");
  expect(team).not.toHaveBeenCalled();
  expect(active).not.toHaveBeenCalled();
  expect(current.issues).not.toHaveBeenCalled();
  expect((await getCycleIssues(client, "ENG"))[0]?.identifier).toBe("ENG-13");
  expect(team).toHaveBeenCalledWith("ENG");
  expect(active).toHaveBeenCalledTimes(1);
});
test("exact lookup propagates cycle, issue-list, and issue-relation failures", async () => {
  const error = new Error("read failed");
  for (const cycle of [
    async () => { throw error; },
    async () => ({ issues: async () => { throw error; } }),
    async () => ({ issues: async () => ({ nodes: [{
      ...issue("ENG-12"), get state() { throw error; },
    }] }) }),
  ]) {
    await expect(getCycleIssuesById({ cycle } as unknown as LinearClient, "cycle-12")).rejects.toBe(error);
  }
});
