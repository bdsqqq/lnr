import { test, expect, mock, describe, beforeEach } from "bun:test";

const mockUpdateIssue = mock(async () => true);
const mockGetIssue = mock(
  async () =>
    ({
      id: "I1",
      identifier: "ENG-1",
      title: "test",
      url: "https://linear.app/test",
      branchName: "eng-1-test",
      priority: 3,
      state: "Todo",
      assignee: "alice",
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as const
);
const mockClientLabels = mock(async () => ({ nodes: [] }));
const mockClientIssue = mock(async () => ({
  team: Promise.resolve({ id: "T1" }),
  labels: mockClientLabels,
}));
const mockGetClient = mock(() => ({
  issue: mockClientIssue,
  viewer: Promise.resolve({ id: "U1" }),
  users: mock(async () => ({
    nodes: [{ id: "U2", email: "bob@example.com" }],
  })),
}));
const mockListIssues = mock(async () => [
  {
    id: "I1",
    identifier: "ENG-1",
    title: "test",
    state: "Todo",
    assignee: "alice",
    priority: 3,
  },
  {
    id: "I2",
    identifier: "ENG-2",
    title: "test2",
    state: "Done",
    assignee: "bob",
    priority: 1,
  },
]);
const mockPriorityFromString = mock((s: string) => (s === "high" ? 2 : 0));
const mockGetTeamStates = mock(async () => [
  { id: "S1", name: "Done" },
  { id: "S2", name: "Todo" },
]);
const mockGetTeamLabels = mock(async () => [
  { id: "L1", name: "bug" },
  { id: "L2", name: "feature" },
]);

const mockOutputJson = mock((..._args: unknown[]) => {});
const mockOutputQuiet = mock((..._args: unknown[]) => {});
const mockOutputTable = mock((..._args: unknown[]) => {});
const mockGetOutputFormat = mock(
  (opts: { format?: string }) => opts?.format ?? "table"
);

mock.module("@bdsqqq/lnr-core", () => ({
  getClient: mockGetClient,
  getIssue: mockGetIssue,
  updateIssue: mockUpdateIssue,
  listIssues: mockListIssues,
  createIssue: mock(async () => ({
    id: "I3",
    identifier: "ENG-3",
    title: "new",
  })),
  archiveIssue: mock(async () => true),
  findTeamByKeyOrName: mock(async () => ({ id: "T1", key: "ENG" })),
  getAvailableTeamKeys: mock(async () => ["ENG"]),
  getTeamLabels: mockGetTeamLabels,
  resolveAssignee: mock(async () => "U2"),
  priorityFromString: mockPriorityFromString,
  resolveStateName: mock(async () => "S1"),
  resolveIssueIdentifier: mock(async () => "I1"),
  resolveProjectByName: mock(async () => "P1"),
  resolveCycleByName: mock(async () => "C1"),
  resolveMilestoneByName: mock(async () => "M1"),
  createIssueRelation: mock(async () => true),
  addComment: mock(async () => true),
  updateComment: mock(async () => true),
  replyToComment: mock(async () => true),
  deleteComment: mock(async () => true),
  createCommentReaction: mock(async () => true),
  deleteReaction: mock(async () => true),
  getIssueComments: mock(async () => ({ comments: [], error: null })),
  getSubIssues: mock(async () => []),
  getTeamStates: mockGetTeamStates,
  subscribeToIssue: mock(async () => true),
  unsubscribeFromIssue: mock(async () => true),
  createReaction: mock(async () => true),
  batchUpdateIssues: mock(async () => ({ success: true, issues: [] })),
  getConfigValue: mock(() => undefined),
  linkGitHubPR: mock(async () => true),
}));

mock.module("./output", () => ({
  outputJson: mockOutputJson,
  outputQuiet: mockOutputQuiet,
  outputTable: mockOutputTable,
  getOutputFormat: mockGetOutputFormat,
  formatDate: (d: unknown) => (d ? "2026-01-01" : "-"),
  formatPriority: (p: unknown) => String(p ?? "-"),
  truncate: (s: string) => s,
  formatRelativeTime: () => "1d ago",
}));

mock.module("./error", () => ({
  handleApiError: mock((e: unknown) => {
    throw e;
  }),
  exitWithError: mock((msg: string) => {
    throw new Error(msg);
  }),
  EXIT_CODES: { SUCCESS: 0, GENERAL_ERROR: 1, AUTH_ERROR: 2, NOT_FOUND: 3, RATE_LIMITED: 4, PLAN_REQUIRED: 5 },
}));

mock.module("./renderers/comments", () => ({
  outputCommentThreads: mock(() => {}),
  shortcodeToEmoji: mock((s: string) => s),
  formatReactions: mock(() => ""),
  wrapText: mock((s: string) => [s]),
  buildChildMap: mock(() => new Map()),
}));

mock.module("./renderers/detail", () => ({
  outputDetail: mock(() => {}),
}));

mock.module("./adapters", () => ({
  issueToDetail: mock(() => ({})),
}));

mock.module("../../hand-crafted/issue", () => ({
  handlePr: mock(async () => {}),
  handleBranch: mock(() => {}),
}));

mock.module("./arktype-config", () => ({}));

const { generatedIssuesRouter } = await import("../generated/issue");

function resetAll() {
  mockUpdateIssue.mockClear();
  mockGetIssue.mockClear();
  mockGetClient.mockClear();
  mockClientIssue.mockClear();
  mockListIssues.mockClear();
  mockPriorityFromString.mockClear();
  mockGetTeamStates.mockClear();
  mockGetTeamLabels.mockClear();
  mockOutputJson.mockClear();
  mockOutputQuiet.mockClear();
  mockOutputTable.mockClear();
  mockGetOutputFormat.mockClear();
}

describe("property D: flag → payload effect (issue update)", () => {
  beforeEach(resetAll);

  test("--title sets title in updateIssue payload", async () => {
    const caller = generatedIssuesRouter.createCaller({});
    await caller.issue({ idOrNew: "ENG-1", title: "new title" });

    expect(mockUpdateIssue).toHaveBeenCalled();
    const payload = (mockUpdateIssue.mock.calls[0] as unknown as unknown[])[2] as Record<string, unknown>;
    expect(payload.title).toBe("new title");
  });

  test("--description sets description in updateIssue payload", async () => {
    const caller = generatedIssuesRouter.createCaller({});
    await caller.issue({ idOrNew: "ENG-1", description: "some desc" });

    expect(mockUpdateIssue).toHaveBeenCalled();
    const payload = (mockUpdateIssue.mock.calls[0] as unknown as unknown[])[2] as Record<string, unknown>;
    expect(payload.description).toBe("some desc");
  });

  test("--priority passes numeric priority to updateIssue", async () => {
    const caller = generatedIssuesRouter.createCaller({});
    await caller.issue({ idOrNew: "ENG-1", priority: "high" });

    expect(mockUpdateIssue).toHaveBeenCalled();
    const payload = (mockUpdateIssue.mock.calls[0] as unknown as unknown[])[2] as Record<string, unknown>;
    expect(payload.priority).toBe(2);
  });

  test("--state resolves to stateId in updateIssue payload", async () => {
    const caller = generatedIssuesRouter.createCaller({});
    await caller.issue({ idOrNew: "ENG-1", state: "Done" });

    expect(mockUpdateIssue).toHaveBeenCalled();
    const payload = (mockUpdateIssue.mock.calls[0] as unknown as unknown[])[2] as Record<string, unknown>;
    expect(payload.stateId).toBe("S1");
  });
});

describe("property E: resolver call discipline (issue update)", () => {
  beforeEach(resetAll);

  test("--state calls getTeamStates, not getTeamLabels", async () => {
    const caller = generatedIssuesRouter.createCaller({});
    await caller.issue({ idOrNew: "ENG-1", state: "Done" });

    expect(mockGetTeamStates).toHaveBeenCalled();
    expect(mockGetTeamLabels).not.toHaveBeenCalled();
  });

  test("--label calls getTeamLabels, not getTeamStates", async () => {
    const caller = generatedIssuesRouter.createCaller({});
    await caller.issue({ idOrNew: "ENG-1", label: "bug" });

    expect(mockGetTeamLabels).toHaveBeenCalled();
    expect(mockGetTeamStates).not.toHaveBeenCalled();
  });

  test("--priority calls priorityFromString, not getTeamStates", async () => {
    const caller = generatedIssuesRouter.createCaller({});
    await caller.issue({ idOrNew: "ENG-1", priority: "high" });

    expect(mockPriorityFromString).toHaveBeenCalledWith("high");
    expect(mockGetTeamStates).not.toHaveBeenCalled();
    expect(mockGetTeamLabels).not.toHaveBeenCalled();
  });

  test("no mutation flags → read path, no resolvers called", async () => {
    const caller = generatedIssuesRouter.createCaller({});
    await caller.issue({ idOrNew: "ENG-1" });

    expect(mockUpdateIssue).not.toHaveBeenCalled();
    expect(mockGetTeamStates).not.toHaveBeenCalled();
    expect(mockGetTeamLabels).not.toHaveBeenCalled();
    expect(mockPriorityFromString).not.toHaveBeenCalled();
  });
});

describe("property F: output-format equivalence (issue list)", () => {
  beforeEach(resetAll);

  test("json/quiet/table all receive same entity count", async () => {
    const caller = generatedIssuesRouter.createCaller({});

    await caller.issues({ json: true });
    const jsonEntities = mockOutputJson.mock.calls[0]?.[0] as unknown[];

    await caller.issues({ quiet: true });
    const quietIds = mockOutputQuiet.mock.calls[0]?.[0] as string[];

    await caller.issues({});
    const tableEntities = mockOutputTable.mock.calls[0]?.[0] as unknown[];

    expect(jsonEntities.length).toBe(2);
    expect(quietIds.length).toBe(2);
    expect(tableEntities.length).toBe(2);
  });

  test("json and table receive identical entity set", async () => {
    const caller = generatedIssuesRouter.createCaller({});

    await caller.issues({ json: true });
    const jsonEntities = mockOutputJson.mock.calls[0]?.[0] as {
      identifier: string;
    }[];

    mockOutputTable.mockClear();
    await caller.issues({});
    const tableEntities = mockOutputTable.mock.calls[0]?.[0] as {
      identifier: string;
    }[];

    expect(jsonEntities.map((e) => e.identifier)).toEqual(
      tableEntities.map((e) => e.identifier)
    );
  });

  test("quiet receives identifiers matching json entities", async () => {
    const caller = generatedIssuesRouter.createCaller({});

    await caller.issues({ json: true });
    const jsonEntities = mockOutputJson.mock.calls[0]?.[0] as {
      identifier: string;
    }[];

    mockOutputQuiet.mockClear();
    await caller.issues({ quiet: true });
    const quietIds = mockOutputQuiet.mock.calls[0]?.[0] as string[];

    expect(quietIds).toEqual(jsonEntities.map((e) => e.identifier));
  });
});
