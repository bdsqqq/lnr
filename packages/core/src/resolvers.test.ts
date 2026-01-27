import { describe, it, expect, mock } from "bun:test";
import {
  resolveIssueIdentifier,
  IssueNotFoundError,
  resolveStateName,
  StateNotFoundError,
} from "./resolvers";
import type { LinearClient } from "@linear/sdk";

describe("resolveIssueIdentifier", () => {
  it("returns UUID for valid identifier", async () => {
    const mockClient = {
      issue: mock(() => Promise.resolve({ id: "uuid-123-abc" })),
    } as unknown as LinearClient;

    const result = await resolveIssueIdentifier(mockClient, "ENG-123");

    expect(result).toBe("uuid-123-abc");
    expect(mockClient.issue).toHaveBeenCalledWith("ENG-123");
  });

  it("throws IssueNotFoundError when issue returns null", async () => {
    const mockClient = {
      issue: mock(() => Promise.resolve(null)),
    } as unknown as LinearClient;

    await expect(resolveIssueIdentifier(mockClient, "ENG-999")).rejects.toThrow(
      IssueNotFoundError
    );
  });

  it("throws IssueNotFoundError when API throws", async () => {
    const mockClient = {
      issue: mock(() => Promise.reject(new Error("API error"))),
    } as unknown as LinearClient;

    await expect(
      resolveIssueIdentifier(mockClient, "INVALID-123")
    ).rejects.toThrow(IssueNotFoundError);
  });

  it("error message includes the identifier", async () => {
    const mockClient = {
      issue: mock(() => Promise.resolve(null)),
    } as unknown as LinearClient;

    try {
      await resolveIssueIdentifier(mockClient, "ENG-404");
      expect(true).toBe(false);
    } catch (error) {
      expect(error instanceof IssueNotFoundError).toBe(true);
      expect((error as Error).message).toBe("issue not found: ENG-404");
    }
  });
});

describe("resolveStateName", () => {
  const mockStates = [
    { id: "state-1", name: "Backlog" },
    { id: "state-2", name: "In Progress" },
    { id: "state-3", name: "Done" },
  ];

  function createMockClient(states: Array<{ id: string; name: string }>) {
    return {
      team: mock(() =>
        Promise.resolve({
          states: () => Promise.resolve({ nodes: states }),
        })
      ),
    } as unknown as LinearClient;
  }

  it("returns stateId for exact match", async () => {
    const mockClient = createMockClient(mockStates);

    const result = await resolveStateName(mockClient, "team-123", "Done");

    expect(result).toBe("state-3");
  });

  it("matches case-insensitively", async () => {
    const mockClient = createMockClient(mockStates);

    const result = await resolveStateName(mockClient, "team-123", "in progress");

    expect(result).toBe("state-2");
  });

  it("matches case-insensitively uppercase input", async () => {
    const mockClient = createMockClient(mockStates);

    const result = await resolveStateName(mockClient, "team-123", "BACKLOG");

    expect(result).toBe("state-1");
  });

  it("throws StateNotFoundError when state not found", async () => {
    const mockClient = createMockClient(mockStates);

    await expect(
      resolveStateName(mockClient, "team-123", "invalid")
    ).rejects.toThrow(StateNotFoundError);
  });

  it("error message includes available states", async () => {
    const mockClient = createMockClient(mockStates);

    try {
      await resolveStateName(mockClient, "team-123", "unknown");
      expect(true).toBe(false);
    } catch (error) {
      expect(error instanceof StateNotFoundError).toBe(true);
      expect((error as Error).message).toBe(
        'state not found: "unknown". available states: Backlog, In Progress, Done'
      );
    }
  });

  it("handles empty states list", async () => {
    const mockClient = createMockClient([]);

    try {
      await resolveStateName(mockClient, "team-123", "done");
      expect(true).toBe(false);
    } catch (error) {
      expect(error instanceof StateNotFoundError).toBe(true);
      expect((error as Error).message).toBe(
        'state not found: "done". available states: none'
      );
    }
  });
});
