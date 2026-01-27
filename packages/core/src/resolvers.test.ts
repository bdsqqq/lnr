import { describe, it, expect, mock } from "bun:test";
import {
  resolveIssueIdentifier,
  IssueNotFoundError,
  resolveStateName,
  StateNotFoundError,
  resolveAssignee,
  AssigneeNotFoundError,
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

describe("resolveAssignee", () => {
  it("returns viewer id for @me", async () => {
    const mockClient = {
      viewer: Promise.resolve({
        id: "viewer-uuid-123",
        name: "Alice",
        email: "alice@example.com",
        displayName: "Alice",
        active: true,
        admin: false,
      }),
    } as unknown as LinearClient;

    const result = await resolveAssignee(mockClient, "@me");

    expect(result).toBe("viewer-uuid-123");
  });

  it("returns userId for valid email", async () => {
    const mockClient = {
      users: mock(() =>
        Promise.resolve({
          nodes: [{ id: "user-uuid-456", email: "bob@example.com" }],
        })
      ),
    } as unknown as LinearClient;

    const result = await resolveAssignee(mockClient, "bob@example.com");

    expect(result).toBe("user-uuid-456");
  });

  it("matches email case-insensitively", async () => {
    const mockClient = {
      users: mock(() =>
        Promise.resolve({
          nodes: [{ id: "user-uuid-789", email: "charlie@example.com" }],
        })
      ),
    } as unknown as LinearClient;

    const result = await resolveAssignee(mockClient, "CHARLIE@EXAMPLE.COM");

    expect(result).toBe("user-uuid-789");
    expect(mockClient.users).toHaveBeenCalledWith({
      filter: { email: { eq: "charlie@example.com" } },
    });
  });

  it("throws AssigneeNotFoundError when user not found", async () => {
    const mockClient = {
      users: mock(() => Promise.resolve({ nodes: [] })),
    } as unknown as LinearClient;

    await expect(
      resolveAssignee(mockClient, "nobody@example.com")
    ).rejects.toThrow(AssigneeNotFoundError);
  });

  it("error message includes the assignee value", async () => {
    const mockClient = {
      users: mock(() => Promise.resolve({ nodes: [] })),
    } as unknown as LinearClient;

    try {
      await resolveAssignee(mockClient, "unknown@test.com");
      expect(true).toBe(false);
    } catch (error) {
      expect(error instanceof AssigneeNotFoundError).toBe(true);
      expect((error as Error).message).toBe(
        'assignee not found: "unknown@test.com". use @me or a valid email address'
      );
    }
  });
});
