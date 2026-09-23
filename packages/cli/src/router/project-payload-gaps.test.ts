import { beforeEach, expect, mock, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const core = await import("@bdsqqq/lnr-core");
type Client = ReturnType<typeof core.getClient>;
const project = {
  id: "P1", name: "payload test", description: "", state: "planned",
  progress: 0, createdAt: new Date("2026-01-01"),
};
const sdkCreate = mock(async (
  _input: Parameters<Client["createProject"]>[0],
) => ({ success: true, project: Promise.resolve(project) }));
const sdkUpdate = mock(async (
  _id: string, _input: Parameters<Client["updateProject"]>[1],
) => ({ success: true, project: Promise.resolve(project) }));
const client = { createProject: sdkCreate, updateProject: sdkUpdate };
mock.module("@bdsqqq/lnr-core", () => ({
  ...core,
  getClient: () => client,
  getProject: async () => project,
  resolveTeamByKey: async () => "T1",
  resolveAssignee: async () => "U1",
}));
mock.module("../lib/error", () => ({
  handleApiError: (error: unknown) => { throw error; },
  exitWithError: (message: string) => { throw new Error(message); },
  EXIT_CODES: { GENERAL_ERROR: 1, NOT_FOUND: 3 },
}));
const { generatedProjectsRouter } = await import("../generated/project");
beforeEach(() => { sdkCreate.mockClear(); sdkUpdate.mockClear(); });

const fields = [
  ["description", "", "description", ""],
  ["content", "", "content", ""],
  ["content", "# project", "content", "# project"],
  ["lead", "@me", "leadId", "U1"],
  ["startDate", "2026-10-01", "startDate", "2026-10-01"],
  ["targetDate", "2026-11-01", "targetDate", "2026-11-01"],
  ["priority", 0, "priority", 0],
  ["status", "S1", "statusId", "S1"],
] as const;
for (const name of ["new", "existing"]) {
  for (const [flag, value, field, expected] of fields) {
    test(`${name}: ${flag} reaches the sdk through the route and real core`, async () => {
      await generatedProjectsRouter.createCaller({}).project({
        name, ...(name === "new" ? { newName: "payload test" } : {}), [flag]: value,
      });
      if (name === "new") {
        expect(sdkCreate).toHaveBeenCalledTimes(1);
        expect(sdkUpdate).not.toHaveBeenCalled();
        expect(sdkCreate.mock.calls[0]?.[0]).toMatchObject({ [field]: expected });
      } else {
        expect(sdkUpdate).toHaveBeenCalledTimes(1);
        expect(sdkCreate).not.toHaveBeenCalled();
        expect(sdkUpdate.mock.calls[0]?.[0]).toBe("P1");
        expect(sdkUpdate.mock.calls[0]?.[1]).toMatchObject({ [field]: expected });
      }
    });
  }
  test(`${name}: argv preserves the complete sdk payload and priority zero`, async () => {
    await expect(createCli({ router: generatedProjectsRouter }).run({
      argv: [
        "project", name, "--new-name", "payload test",
        "--description", "summary", "--content", "# project",
        "--team", "ENG", "--lead", "@me",
        "--start-date", "2026-10-01", "--target-date", "2026-11-01",
        "--priority", "0", "--status", "S1",
      ],
      process: { exit(code): never {
        throw new FailedToExitError("test exit", { exitCode: code, cause: undefined });
      } },
      logger: { info: () => {}, error: () => {} },
    })).rejects.toMatchObject({ exitCode: 0 });
    expect(name === "new" ? sdkCreate : sdkUpdate).toHaveBeenCalledTimes(1);
    expect(name === "new" ? sdkUpdate : sdkCreate).not.toHaveBeenCalled();
    const payload = name === "new" ? sdkCreate.mock.calls[0]?.[0] : sdkUpdate.mock.calls[0]?.[1];
    expect(payload).toEqual({
      name: "payload test", description: "summary", content: "# project",
      teamIds: ["T1"], leadId: "U1", startDate: "2026-10-01",
      targetDate: "2026-11-01", priority: 0, statusId: "S1",
    });
  });
}

test("minimal create retains omission and the empty team default", async () => {
  await generatedProjectsRouter.createCaller({}).project({ name: "new", newName: "minimal" });
  expect(sdkCreate).toHaveBeenCalledTimes(1);
  expect(sdkCreate.mock.calls[0]?.[0]).toEqual({
    name: "minimal", description: undefined, teamIds: [],
    content: undefined, leadId: undefined, startDate: undefined,
    targetDate: undefined, priority: undefined, statusId: undefined,
  });
});

test("an explicit empty update name reaches upstream validation instead of being ignored", async () => {
  await generatedProjectsRouter.createCaller({}).project({ name: "existing", newName: "" });
  expect(sdkUpdate.mock.calls[0]?.[1].name).toBe("");
});

test("unconfirmed project mutations do not report success or retry", async () => {
  sdkCreate.mockResolvedValueOnce({ success: false, project: Promise.resolve(project) });
  await expect(generatedProjectsRouter.createCaller({}).project({ name: "new", newName: "test" }))
    .rejects.toThrow("verify the outcome before retrying");
  expect(sdkCreate).toHaveBeenCalledTimes(1);
  sdkUpdate.mockResolvedValueOnce({ success: false, project: Promise.resolve(project) });
  await expect(generatedProjectsRouter.createCaller({}).project({ name: "existing", priority: 0 }))
    .rejects.toThrow("verify the outcome before retrying");
  expect(sdkUpdate).toHaveBeenCalledTimes(1);
});
