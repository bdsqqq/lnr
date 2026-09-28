import { expect, test } from "bun:test";
import { executeApi } from "../packages/core/src/api";
import { inspectExactView, organizationName, organizationQuery, targetName, viewQuery } from "./inspect-view-recovery";

const orgId = "11111111-1111-1111-1111-111111111111";
const viewerId = "22222222-2222-2222-2222-222222222222";
const viewId = "33333333-3333-3333-3333-333333333333";
const org = { organization: { id: orgId, name: organizationName } };
const node = { id: viewId, name: targetName, createdAt: "2026-09-24T17:56:49.500Z",
  archivedAt: null, creator: { id: viewerId }, organization: { id: orgId } };
const page = (nodes: unknown[], hasNextPage = false, endCursor: string | null = null) => ({
  viewer: { id: viewerId }, customViews: { nodes, pageInfo: { hasNextPage, endCursor } },
});

test("both fixed documents validate as queries without acquiring credentials", async () => {
  const forbidden = () => { throw new Error("unexpected credential access"); };
  for (const document of [organizationQuery, viewQuery]) {
    expect(await executeApi({ document, variables: document === viewQuery ? { after: null } : undefined },
      forbidden)).toEqual({ ok: true, executed: false, operation: "query" });
  }
});
test("identity mismatch prevents all inventory requests", async () => {
  let calls = 0;
  await expect(inspectExactView(async document => {
    calls++;
    expect(document).toBe(organizationQuery);
    return { organization: { id: orgId, name: "not-the-sandbox" } };
  })).rejects.toThrow("identity mismatch");
  expect(calls).toBe(1);
});
test("exact filtered pagination reports only selected fixture metadata", async () => {
  const calls: unknown[] = [];
  const result = await inspectExactView(async (document, variables) => {
    calls.push({ document, variables });
    if (document === organizationQuery) return org;
    expect(document).toBe(viewQuery);
    return variables?.after === null ? page([], true, "next") : page([{ ...node, extra: "not printed" }]);
  });
  expect(calls).toEqual([
    { document: organizationQuery, variables: undefined },
    { document: viewQuery, variables: { after: null } },
    { document: viewQuery, variables: { after: "next" } },
  ]);
  expect(result.matches).toEqual([{ id: viewId, name: targetName, createdAt: node.createdAt,
    archivedAt: null, creatorId: viewerId, creatorMatchesViewer: true }]);
  expect(JSON.stringify(result)).not.toContain("not printed");
  expect(result.readOnly).toBe(true);
});
test("unexpected names/orgs or malformed identities fail closed", async () => {
  for (const invalid of [
    { ...node, name: "unrelated" }, { ...node, organization: { id: viewerId } },
    { ...node, id: "not-an-id" }, { ...node, creator: null },
  ]) {
    await expect(inspectExactView(async document =>
      document === organizationQuery ? org : page([invalid]))).rejects.toThrow();
  }
});
test("empty accessible result is not a workspace-wide absence claim", async () => {
  const result = await inspectExactView(async document => document === organizationQuery ? org : page([]));
  expect(result.matches).toEqual([]);
  expect(result.limitation).toContain("accessible");
  expect(result.limitation).toContain("excludes project/initiative-scoped");
});
test("repeated cursors and request failures are not retried", async () => {
  let calls = 0;
  await expect(inspectExactView(async document => {
    calls++;
    return document === organizationQuery ? org : page([], true, "same");
  })).rejects.toThrow("repeated");
  expect(calls).toBe(3);
  calls = 0;
  await expect(inspectExactView(async () => { calls++; throw new Error("failed"); })).rejects.toThrow("failed");
  expect(calls).toBe(1);
});
