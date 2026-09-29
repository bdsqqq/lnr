import { expect, test } from "bun:test";
import { executeApi } from "../packages/core/src/api";
import {
  inspectExactProject, knownRunTeamId, organizationId, organizationName,
  organizationQuery, projectQuery, targetName,
} from "./inspect-project-recovery";

const viewerId = "22222222-2222-2222-2222-222222222222";
const projectId = "33333333-3333-3333-3333-333333333333";
const org = { organization: { id: organizationId, name: organizationName } };
const node = { id: projectId, name: targetName, createdAt: "2026-09-29T00:00:00.000Z",
  archivedAt: null, creator: { id: viewerId }, teams: { nodes: [{ id: knownRunTeamId }] } };
const page = (nodes: unknown[], hasNextPage = false, endCursor: string | null = null) => ({
  viewer: { id: viewerId }, projects: { nodes, pageInfo: { hasNextPage, endCursor } },
});

test("fixed public queries validate offline without credentials; invalid field is rejected", async () => {
  const forbidden = () => { throw new Error("unexpected credential access"); };
  for (const document of [organizationQuery, projectQuery]) {
    expect(await executeApi({ document, variables: document === projectQuery ? { after: null } : undefined },
      forbidden)).toEqual({ ok: true, executed: false, operation: "query" });
  }
  await expect(executeApi({ document: projectQuery.replace("createdAt", "nonexistentField") },
    forbidden)).rejects.toThrow("invalid graphql");
  expect(projectQuery).toContain(`filter: { name: { eq: "${targetName}" } }`);
  expect(projectQuery).toContain("includeArchived: true");
  expect(projectQuery).toContain("first: 50");
});

test("organization name AND immutable id gate all project reads", async () => {
  for (const organization of [
    { id: organizationId, name: "wrong" },
    { id: viewerId, name: organizationName },
    { id: null, name: organizationName },
  ]) {
    let calls = 0;
    await expect(inspectExactProject(async document => {
      calls++;
      expect(document).toBe(organizationQuery);
      return { organization };
    })).rejects.toThrow("identity mismatch");
    expect(calls).toBe(1);
  }
});

test("separate organization query precedes exact pagination and explicit metadata projection", async () => {
  const calls: unknown[] = [];
  const result = await inspectExactProject(async (document, variables) => {
    calls.push({ document, variables });
    if (document === organizationQuery) return org;
    return variables?.after === null ? page([], true, "next") :
      page([{ ...node, extra: "secret-body", teams: { nodes: [{ id: knownRunTeamId, name: "secret-body" }] } }]);
  });
  expect(calls).toEqual([
    { document: organizationQuery, variables: undefined },
    { document: projectQuery, variables: { after: null } },
    { document: projectQuery, variables: { after: "next" } },
  ]);
  expect(result.matches).toEqual([{ id: projectId, name: targetName, createdAt: node.createdAt,
    archivedAt: null, creatorId: viewerId, creatorMatchesViewer: true, teamIds: [knownRunTeamId] }]);
  expect(result.source).toEqual({ pullRequest: 48, runId: "36641067664", knownRunTeamId });
  expect(JSON.stringify(result)).not.toContain("secret-body");
  expect(result.pages).toBe(2);
  expect(result.readOnly).toBe(true);
});

test("nullable creator remains unknown; a different creator is false", async () => {
  for (const creator of [null, { id: projectId }]) {
    const result = await inspectExactProject(async document =>
      document === organizationQuery ? org : page([{ ...node, creator }]));
    expect(result.matches[0]?.creatorMatchesViewer).toBe(creator === null ? null : false);
  }
});

test("unexpected exact name and malformed selected metadata fail closed", async () => {
  for (const invalid of [
    { ...node, name: `${targetName}-other` }, { ...node, id: "secret-body" },
    { ...node, createdAt: "secret-body" }, { ...node, archivedAt: "secret-body" },
    { ...node, creator: { id: "secret-body" } },
    { ...node, teams: { nodes: [{ id: "secret-body" }] } },
  ]) {
    await expect(inspectExactProject(async document =>
      document === organizationQuery ? org : page([invalid]))).rejects.toThrow();
  }
});

test("empty results and team projection retain explicit claim limits", async () => {
  const result = await inspectExactProject(async document => document === organizationQuery ? org : page([]));
  expect(result.matches).toEqual([]);
  expect(result.limitation).toContain("accessible");
  expect(result.limitation).toContain("do not prove workspace-wide absence");
  expect(result.limitation).toContain("returned teams page");
  expect(result.limitation).toContain("do not prove run ownership or authorize deletion");
});

test("missing/repeated cursors and page cap fail without completeness claims", async () => {
  for (const cursor of [null, "", "same"]) {
    let calls = 0;
    await expect(inspectExactProject(async document => {
      calls++;
      return document === organizationQuery ? org : page([], true, cursor);
    })).rejects.toThrow("cursor");
    expect(calls).toBe(cursor === "same" ? 3 : 2);
  }
  let calls = 0;
  await expect(inspectExactProject(async document => {
    calls++;
    return document === organizationQuery ? org : page([], true, String(calls));
  })).rejects.toThrow("no completeness claim");
  expect(calls).toBe(21);
});

test("inconsistent viewer identity fails closed", async () => {
  await expect(inspectExactProject(async (document, variables) => {
    if (document === organizationQuery) return org;
    return variables?.after === null ? page([], true, "next") :
      { ...page([node]), viewer: { id: projectId } };
  })).rejects.toThrow("inconsistent viewer");
});

test("request failures are sanitized and never retried at either stage", async () => {
  for (const stage of [organizationQuery, projectQuery]) {
    let calls = 0;
    await expect(inspectExactProject(async document => {
      calls++;
      if (document === stage) throw new Error("secret-body");
      return org;
    })).rejects.toThrow("read-only inspection request failed");
    expect(calls).toBe(stage === organizationQuery ? 1 : 2);
  }
});

test("workflow invokes only new inspection and offline tests; secret stays step-local", async () => {
  const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
  expect(workflow).toContain('branches: ["feat/api-parity-nested-input-witnesses"]');
  expect(workflow).toContain("github.head_ref == 'chore/read-only-project-recovery'");
  expect(workflow).toContain("github.event.pull_request.head.repo.full_name == github.repository");
  expect(workflow).toContain("contents: read");
  expect(workflow).toContain("group: lnr-e2e-bdsqqq-sandbox");
  expect(workflow).not.toMatch(/delete-authorized|inspect-view|e2e-.*test|release/);
  expect(workflow.match(/secrets\./g)).toHaveLength(1);
  expect(workflow).toContain("run: bun scripts/inspect-project-recovery.ts\n        env:\n          LINEAR_API_KEY:");
});
