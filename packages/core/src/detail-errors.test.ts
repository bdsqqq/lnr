import { expect, mock, test } from "bun:test";
import type { LinearClient } from "@linear/sdk";
import { getIssue } from "./issues";
import { getCycle } from "./cycles";

const fields = {
  id: "issue-id", identifier: "ENG-1", title: "example", description: "",
  priority: 0, createdAt: new Date(0), updatedAt: new Date(0),
  url: "https://example.com", branchName: "eng-1",
};
for (const phase of ["root", "state", "assignee", "parent"]) {
  test(`issue ${phase} preserves error identity`, async () => {
    const error = new Error("network unavailable");
    const relation = (name: string) => phase === name ? Promise.reject(error) : Promise.resolve(null);
    const issue = mock(async (..._args: unknown[]) => {
      if (phase === "root") throw error;
      return { ...fields, get state() { return relation("state"); },
        get assignee() { return relation("assignee"); }, get parent() { return relation("parent"); } };
    });
    await expect(getIssue({ issue } as unknown as LinearClient, "ENG-1")).rejects.toBe(error);
    expect(issue.mock.calls).toEqual([["ENG-1"]]);
  });
}
for (const present of [false, true]) {
  test(`issue preserves ${present ? "null optional relations" : "missing root"}`, async () => {
    const issue = mock(async (..._args: unknown[]) => present
      ? { ...fields, state: Promise.resolve(null), assignee: Promise.resolve(null), parent: Promise.resolve(null) }
      : null);
    expect(await getIssue({ issue } as unknown as LinearClient, "ENG-1")).toEqual(
      present ? { ...fields, state: null, assignee: null, parentId: null } : null,
    );
    expect(issue.mock.calls).toEqual([["ENG-1"]]);
  });
}
const cycleFields = {
  id: "cycle-id", number: 12, name: "Sprint", description: "",
  startsAt: new Date(0), endsAt: new Date(1), completedAt: undefined, progress: 0,
};
for (const phase of ["team", "connection", "null-team", "empty", "unmatched", "name", "number"]) {
  test(`cycle ${phase} preserves lookup contract`, async () => {
    const error = new Error("permission denied");
    const cycles = mock(async () => {
      if (phase === "connection") throw error;
      return { nodes: phase === "empty" ? [] : [cycleFields] };
    });
    const team = mock(async (..._args: unknown[]) => {
      if (phase === "team") throw error;
      return phase === "null-team" ? null : { cycles };
    });
    const input = phase === "name" ? "sPrInT" : phase === "unmatched" ? "missing" : "12";
    const result = getCycle({ team } as unknown as LinearClient, "ENG", input);
    if (phase === "team" || phase === "connection") await expect(result).rejects.toBe(error);
    else expect(await result).toEqual(["name", "number"].includes(phase) ? cycleFields : null);
    expect(team.mock.calls).toEqual([["ENG"]]);
    expect(cycles.mock.calls).toEqual(["team", "null-team"].includes(phase) ? [] : [[]]);
  });
}
