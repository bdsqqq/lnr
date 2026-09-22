import { describe, expect, mock, test } from "bun:test";
import { createGitAutomationState, listGitAutomationStates } from "./git-automation-states";
import type { LinearClient } from "@linear/sdk";

describe("git automation states", () => {
  test("listGitAutomationStates rethrows team fetch errors", async () => {
    const client = {
      team: mock(() => Promise.reject(new Error("unauthorized"))),
    } as unknown as LinearClient;

    await expect(listGitAutomationStates(client, "ENG")).rejects.toThrow(
      "unauthorized"
    );
  });

  test("listGitAutomationStates returns empty array when team is missing", async () => {
    const client = {
      team: mock(() => Promise.resolve(null)),
    } as unknown as LinearClient;

    await expect(listGitAutomationStates(client, "ENG")).resolves.toEqual([]);
  });
});

describe("createGitAutomationState", () => {
  const input = { teamId: "T1", event: "start", stateId: "S1" } as const;

  test("preserves mutation errors for the cli error boundary", async () => {
    const error = new Error("automation creation rejected");
    const client = {
      createGitAutomationState: mock(async () => { throw error; }),
    } as unknown as LinearClient;
    await expect(createGitAutomationState(client, input)).rejects.toBe(error);
  });

  for (const relation of ["state", "team"] as const) {
    test(`preserves ${relation} read errors after successful creation`, async () => {
      const error = new Error(`${relation} read failed`);
      const automation = {
        state: Promise.resolve({ id: "S1", name: "started" }),
        team: Promise.resolve({ id: "T1", key: "ENG" }),
        get [relation]() { return Promise.reject(error); },
      };
      const client = {
        createGitAutomationState: mock(async () => ({
          success: true, gitAutomationState: automation,
        })),
      } as unknown as LinearClient;
      await expect(createGitAutomationState(client, input)).rejects.toBe(error);
    });
  }

  test("unsuccessful payload does not read the automation", async () => {
    const readAutomation = mock(() => { throw new Error("must not read"); });
    const client = {
      createGitAutomationState: mock(async () => ({
        success: false,
        get gitAutomationState() { return readAutomation(); },
      })),
    } as unknown as LinearClient;
    await expect(createGitAutomationState(client, input)).resolves.toBeNull();
    expect(readAutomation).not.toHaveBeenCalled();
  });

  test("maps successful creation and sends the event to the sdk", async () => {
    const createdAt = new Date("2026-09-22");
    const create = mock(async () => ({
      success: true,
      gitAutomationState: {
        id: "G1", event: "start", createdAt, updatedAt: createdAt,
        state: Promise.resolve({ id: "S1", name: "started" }),
        team: Promise.resolve({ id: "T1", key: "ENG" }),
        targetBranch: { id: "B1", branchPattern: "main" },
      },
    }));
    const client = { createGitAutomationState: create } as unknown as LinearClient;
    await expect(createGitAutomationState(client, input)).resolves.toEqual({
      id: "G1", event: "start", stateId: "S1", stateName: "started",
      teamId: "T1", teamKey: "ENG", targetBranchId: "B1",
      targetBranchPattern: "main", createdAt, updatedAt: createdAt, archivedAt: null,
    });
    expect(create).toHaveBeenCalledWith({ ...input, targetBranchId: undefined });
  });
});
