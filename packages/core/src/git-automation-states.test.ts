import { describe, expect, mock, test } from "bun:test";
import { listGitAutomationStates } from "./git-automation-states";
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
