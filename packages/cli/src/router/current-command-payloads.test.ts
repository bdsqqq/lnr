import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";
import { router } from "./trpc";

const core = await import("@bdsqqq/lnr-core");
const sessionUpdate = mock(async (..._args: unknown[]) => ({ success: true }));
const agentSession = mock(async (..._args: unknown[]) => ({ update: sessionUpdate }));
const document = {
  id: "document-id", title: "title", content: "", url: "https://example.com/doc",
  createdAt: new Date(), updatedAt: new Date(), project: null,
};
const createDocument = mock(async (..._args: unknown[]) => ({ success: true, document }));
const updateDocument = mock(async (..._args: unknown[]) => ({ success: true }));
const projectId = "11111111-1111-4111-8111-111111111111";
let projectLookupError: Error | undefined;
const projects = mock(async () => {
  if (projectLookupError) throw projectLookupError;
  return { nodes: [{ id: projectId, name: "Destination", createdAt: new Date(0) }] };
});
const getClient = mock(() => ({ agentSession, createDocument, updateDocument, projects }));

mock.module("@bdsqqq/lnr-core", () => ({ ...core, getClient }));
mock.module("../lib/error", () => ({
  handleApiError: (error: unknown) => { throw error; },
  exitWithError: (message: string) => { throw new Error(message); },
  EXIT_CODES: { GENERAL_ERROR: 1, NOT_FOUND: 3 },
}));

const { agentSessionsRouter, agentSessionInput } = await import("./agent-sessions");
const { generatedDocsRouter, docInput, inferOperation } = await import("../generated/doc");
const sessions = agentSessionsRouter.createCaller({});
const docs = generatedDocsRouter.createCaller({});

beforeEach(() => {
  projectLookupError = undefined;
  for (const fn of [sessionUpdate, agentSession, createDocument, updateDocument, getClient, projects]) fn.mockClear();
});

describe("agent session summary payload", () => {
  test("summary-only dispatch reaches the existing sdk session update", async () => {
    await sessions["agent-session"]({ id: "session-id", summary: "working" });
    expect(agentSession).toHaveBeenCalledWith("session-id");
    expect(sessionUpdate).toHaveBeenCalledWith({ summary: "working" });
  });
  test("clears with null without reserving the literal title 'null'", async () => {
    await sessions["agent-session"]({ id: "session-id", clearSummary: true });
    expect(sessionUpdate).toHaveBeenLastCalledWith({ summary: null });
    await sessions["agent-session"]({ id: "session-id", summary: "null" });
    expect(sessionUpdate).toHaveBeenLastCalledWith({ summary: "null" });
  });
  test("preserves combined updates and omission", async () => {
    await sessions["agent-session"]({ id: "session-id", summary: "working", externalLink: "https://example.com" });
    expect(sessionUpdate).toHaveBeenLastCalledWith({ summary: "working", externalLink: "https://example.com" });
    await sessions["agent-session"]({ id: "session-id", externalLink: "https://example.com", clearSummary: false });
    expect(sessionUpdate).toHaveBeenLastCalledWith({ externalLink: "https://example.com" });
  });
  test("rejects invalid summaries before sdk access; accepts the length boundary", async () => {
    for (const summary of ["", " ", "x".repeat(256), "a\nb", "a\rb", "a\0b", "a\u2028b"]) {
      await expect(sessions["agent-session"]({ id: "session-id", summary })).rejects.toThrow("summary");
    }
    expect(getClient).not.toHaveBeenCalled();
    await sessions["agent-session"]({ id: "session-id", summary: "x".repeat(255) });
    expect(sessionUpdate).toHaveBeenCalledTimes(1);
  });
  test("rejects conflicting modes and unknown fields", async () => {
    for (const input of [
      { id: "session-id", summary: "title", clearSummary: true },
      { id: "session-id", summary: "title", activities: true },
      { id: "session-id", clearSummary: true, activities: true },
      { id: "new", summary: "title" },
    ]) await expect(sessions["agent-session"](input)).rejects.toThrow();
    expect(() => agentSessionInput.assert({ id: "session-id", summary: 1 })).toThrow();
    expect(() => agentSessionInput.assert({ id: "session-id", ownerId: "user-id" })).toThrow();
    expect(getClient).not.toHaveBeenCalled();
  });
});

describe("document owner payload", () => {
  test("dispatches owner-only updates and preserves null clearing", async () => {
    for (const ownerId of ["user-id", "null"]) {
      const input = { id: "document-id", ownerId };
      expect(inferOperation(input)).toBe("update");
      await docs.doc(input);
      expect(updateDocument).toHaveBeenLastCalledWith("document-id", {
        title: undefined, content: undefined, ownerId: ownerId === "null" ? null : ownerId,
      });
    }
  });
  test("create forwards the owner or explicit null to the sdk", async () => {
    for (const ownerId of ["user-id", "null"]) {
      await docs.doc({ id: "new", title: "title", ownerId });
      expect(createDocument).toHaveBeenLastCalledWith({
        title: "title", content: undefined, projectId: undefined, ownerId: ownerId === "null" ? null : ownerId,
      });
    }
  });
  test("omission does not send an owner on create or update", async () => {
    await docs.doc({ id: "new", title: "title" });
    expect(createDocument.mock.calls[0]![0]).not.toHaveProperty("ownerId");
    await docs.doc({ id: "document-id", title: "title" });
    expect(updateDocument.mock.calls[0]![1]).not.toHaveProperty("ownerId");
  });
  test("rejects invalid owner fields and delete combinations before sdk access", async () => {
    for (const input of [
      { id: "document-id", ownerId: "" }, { id: "document-id", ownerId: " " },
      { id: "document-id", ownerId: "user-id", delete: true },
      { id: "new", title: "title", ownerId: "null", delete: true },
    ]) await expect(docs.doc(input)).rejects.toThrow();
    expect(() => docInput.assert({ id: "document-id", ownerId: 1 })).toThrow();
    expect(() => docInput.assert({ id: "document-id", summary: "title" })).toThrow();
    expect(getClient).not.toHaveBeenCalled();
  });
});

async function argv(args: string[]): Promise<number | undefined> {
  const cli = createCli({ router: router({
    ...agentSessionsRouter._def.procedures, ...generatedDocsRouter._def.procedures,
  }) });
  let code: number | undefined;
  await expect(cli.run({
    argv: args, logger: { info: () => {}, error: () => {} },
    process: { exit: (value): never => {
      code = value;
      throw new FailedToExitError("test exit", { exitCode: value, cause: undefined });
    } },
  })).rejects.toBeInstanceOf(FailedToExitError);
  return code;
}

test("argv reaches SDK payloads, including explicit nulls", async () => {
  expect(await argv(["agent-session", "session-id", "--summary", "working"])).toBe(0);
  expect(sessionUpdate).toHaveBeenLastCalledWith({ summary: "working" });
  expect(await argv(["agent-session", "session-id", "--clear-summary"])).toBe(0);
  expect(sessionUpdate).toHaveBeenLastCalledWith({ summary: null });
  expect(await argv(["doc", "document-id", "--owner-id", "null"])).toBe(0);
  expect(updateDocument).toHaveBeenLastCalledWith("document-id", {
    title: undefined, content: undefined, ownerId: null,
  });
  expect(await argv(["doc", "new", "--title", "title", "--owner-id", "user-id"])).toBe(0);
  expect(createDocument).toHaveBeenLastCalledWith({
    title: "title", content: undefined, projectId: undefined, ownerId: "user-id",
  });
});

test("document project-only and combined argv updates reach the real core and SDK", async () => {
  for (const project of ["Destination", projectId]) {
    expect(await argv(["doc", "document-id", "--project", project])).toBe(0);
    expect(updateDocument).toHaveBeenLastCalledWith("document-id", {
      title: undefined, content: undefined, projectId,
    });
    expect(await argv(["doc", "document-id", "--project", project, "--title", "renamed"])).toBe(0);
    expect(updateDocument).toHaveBeenLastCalledWith("document-id", {
      title: "renamed", content: undefined, projectId,
    });
    expect(await argv(["doc", "new", "--title", "title", "--content", "", "--project", project])).toBe(0);
    expect(createDocument).toHaveBeenLastCalledWith({ title: "title", content: "", projectId });
  }
});
test("document project omission and explicit core null remain distinct", async () => {
  await docs.doc({ id: "document-id", title: "title" });
  expect(updateDocument.mock.calls[0]![1]).not.toHaveProperty("projectId");
  await core.updateDocument(getClient() as unknown as Parameters<typeof core.updateDocument>[0],
    "document-id", { projectId: null });
  expect(updateDocument).toHaveBeenLastCalledWith("document-id", { projectId: null });
});
test("document project validation rejects empty and deletion combinations before client access", async () => {
  for (const id of ["new", "document-id"]) {
    for (const input of [
      { id, project: "" }, { id, project: " " }, { id, project: "Destination", delete: true },
    ]) await expect(docs.doc(input)).rejects.toThrow();
  }
  expect(getClient).not.toHaveBeenCalled();
});
test("document project lookup failures cannot fall through to an uncertain target write", async () => {
  projectLookupError = new Error("lookup unavailable");
  expect(await argv(["doc", "new", "--title", "title", "--project", "Destination"])).toBe(1);
  expect(await argv(["doc", "document-id", "--project", "Destination"])).toBe(1);
  expect(createDocument).not.toHaveBeenCalled();
  expect(updateDocument).not.toHaveBeenCalled();
  expect(projects).toHaveBeenCalledTimes(2);
});
