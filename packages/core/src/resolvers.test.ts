import { describe, it, expect, mock } from "bun:test";
import {
  resolveIssueIdentifier,
  IssueNotFoundError,
  resolveStateName,
  StateNotFoundError,
  resolveAssignee,
  AssigneeNotFoundError,
  resolveTeamByKey,
  TeamNotFoundError,
  resolveProjectByName,
  ProjectNotFoundError,
  resolveCycleByName,
  CycleNotFoundError,
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

  it("throws IssueNotFoundError when API throws not found", async () => {
    const mockClient = {
      issue: mock(() => Promise.reject(new Error("Entity not found"))),
    } as unknown as LinearClient;

    await expect(
      resolveIssueIdentifier(mockClient, "INVALID-123")
    ).rejects.toThrow(IssueNotFoundError);
  });

  it("re-throws non-not-found API errors as-is", async () => {
    const mockClient = {
      issue: mock(() => Promise.reject(new Error("API error"))),
    } as unknown as LinearClient;

    await expect(
      resolveIssueIdentifier(mockClient, "INVALID-123")
    ).rejects.toThrow("API error");
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

describe("resolveTeamByKey", () => {
  it("returns team id for valid key", async () => {
    const mockClient = {
      teams: mock(() =>
        Promise.resolve({
          nodes: [
            { id: "team-uuid-123", key: "ENG", name: "Engineering", description: null, private: false, timezone: "UTC" },
          ],
        })
      ),
    } as unknown as LinearClient;

    const result = await resolveTeamByKey(mockClient, "ENG");

    expect(result).toBe("team-uuid-123");
  });

  it("throws TeamNotFoundError when team not found", async () => {
    const mockClient = {
      teams: mock(() =>
        Promise.resolve({
          nodes: [
            { id: "team-1", key: "ENG", name: "Engineering", description: null, private: false, timezone: "UTC" },
            { id: "team-2", key: "DES", name: "Design", description: null, private: false, timezone: "UTC" },
          ],
        })
      ),
    } as unknown as LinearClient;

    await expect(resolveTeamByKey(mockClient, "INVALID")).rejects.toThrow(
      TeamNotFoundError
    );
  });

  it("error message includes available teams", async () => {
    const mockClient = {
      teams: mock(() =>
        Promise.resolve({
          nodes: [
            { id: "team-1", key: "ENG", name: "Engineering", description: null, private: false, timezone: "UTC" },
            { id: "team-2", key: "DES", name: "Design", description: null, private: false, timezone: "UTC" },
          ],
        })
      ),
    } as unknown as LinearClient;

    try {
      await resolveTeamByKey(mockClient, "UNKNOWN");
      expect(true).toBe(false);
    } catch (error) {
      expect(error instanceof TeamNotFoundError).toBe(true);
      expect((error as Error).message).toBe(
        'team not found: "UNKNOWN". available teams: ENG, DES'
      );
    }
  });
});

describe("resolveProjectByName", () => {
  const mockProjects = [
    { id: "proj-1", name: "Alpha" },
    { id: "proj-2", name: "Beta Release" },
    { id: "proj-3", name: "Gamma" },
  ];

  function createMockClient(projects: Array<{ id: string; name: string }>) {
    return {
      projects: mock(() => Promise.resolve({ nodes: projects })),
    } as unknown as LinearClient;
  }

  it("returns project id for exact match", async () => {
    const mockClient = createMockClient(mockProjects);

    const result = await resolveProjectByName(mockClient, "Alpha");

    expect(result).toBe("proj-1");
  });

  it("matches case-insensitively", async () => {
    const mockClient = createMockClient(mockProjects);

    const result = await resolveProjectByName(mockClient, "beta release");

    expect(result).toBe("proj-2");
  });

  it("throws ProjectNotFoundError when project not found", async () => {
    const mockClient = createMockClient(mockProjects);

    await expect(
      resolveProjectByName(mockClient, "NonExistent")
    ).rejects.toThrow(ProjectNotFoundError);
  });

  it("error message includes available projects", async () => {
    const mockClient = createMockClient(mockProjects);

    try {
      await resolveProjectByName(mockClient, "missing");
      expect(true).toBe(false);
    } catch (error) {
      expect(error instanceof ProjectNotFoundError).toBe(true);
      expect((error as Error).message).toBe(
        'project not found: "missing". available projects: Alpha, Beta Release, Gamma'
      );
    }
  });

  it("handles empty projects list", async () => {
    const mockClient = createMockClient([]);

    try {
      await resolveProjectByName(mockClient, "anything");
      expect(true).toBe(false);
    } catch (error) {
      expect(error instanceof ProjectNotFoundError).toBe(true);
      expect((error as Error).message).toBe(
        'project not found: "anything". available projects: none'
      );
    }
  });
});

describe("resolveCycleByName", () => {
  const mockCycles = [
    { id: "cycle-1", name: "Sprint 1", number: 1 },
    { id: "cycle-2", name: "Sprint 2", number: 2 },
    { id: "cycle-3", name: null, number: 3 },
  ];

  function createMockClient(cycles: Array<{ id: string; name: string | null; number: number }>) {
    return {
      team: mock(() =>
        Promise.resolve({
          cycles: () => Promise.resolve({ nodes: cycles }),
        })
      ),
    } as unknown as LinearClient;
  }

  it("returns cycle id for name match", async () => {
    const mockClient = createMockClient(mockCycles);

    const result = await resolveCycleByName(mockClient, "ENG", "Sprint 1");

    expect(result).toBe("cycle-1");
  });

  it("matches name case-insensitively", async () => {
    const mockClient = createMockClient(mockCycles);

    const result = await resolveCycleByName(mockClient, "ENG", "sprint 2");

    expect(result).toBe("cycle-2");
  });

  it("matches by cycle number", async () => {
    const mockClient = createMockClient(mockCycles);

    const result = await resolveCycleByName(mockClient, "ENG", "3");

    expect(result).toBe("cycle-3");
  });

  it("throws CycleNotFoundError when cycle not found", async () => {
    const mockClient = createMockClient(mockCycles);

    await expect(
      resolveCycleByName(mockClient, "ENG", "Sprint 99")
    ).rejects.toThrow(CycleNotFoundError);
  });

  it("error message includes available cycles", async () => {
    const mockClient = createMockClient(mockCycles);

    try {
      await resolveCycleByName(mockClient, "ENG", "nonexistent");
      expect(true).toBe(false);
    } catch (error) {
      expect(error instanceof CycleNotFoundError).toBe(true);
      expect((error as Error).message).toBe(
        'cycle not found: "nonexistent". available cycles: Sprint 1, Sprint 2, #3'
      );
    }
  });

  it("handles empty cycles list", async () => {
    const mockClient = createMockClient([]);

    try {
      await resolveCycleByName(mockClient, "ENG", "any");
      expect(true).toBe(false);
    } catch (error) {
      expect(error instanceof CycleNotFoundError).toBe(true);
      expect((error as Error).message).toBe(
        'cycle not found: "any". available cycles: none'
      );
    }
  });
});
