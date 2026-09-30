import { expect, test } from "bun:test";
import { executeApi } from "../packages/core/src/api";
import {
  conflictLeadId, inspectRun51, knownRunTeamId, organizationId, organizationName,
  organizationQuery, projectName, projectQuery, viewId, viewQuery,
} from "./inspect-run51-fixtures";

const org = { organization: { id: organizationId, name: organizationName } };
const creatorId = "22222222-2222-2222-2222-222222222222";
const base = { id: creatorId, createdAt: "2026-09-29T00:00:00.000Z", archivedAt: null,
  creator: { id: creatorId } };
const project = { ...base, name: projectName, teams: { nodes: [{ id: knownRunTeamId }] } };
const view = { ...base, id: viewId, name: "e2e-view-fixture", organization: { id: organizationId } };
const page = (root: string, nodes: unknown[], hasNextPage = false, endCursor: string | null = null) =>
  ({ [root]: { nodes, pageInfo: { hasNextPage, endCursor } } });

test("all fixed documents validate as public queries offline, never querying conflict lead", async () => {
  for (const document of [organizationQuery, projectQuery, viewQuery]) {
    expect(await executeApi({ document, variables: document === organizationQuery ? undefined : { after: null } },
      () => { throw new Error("credentials forbidden"); }))
      .toEqual({ ok: true, executed: false, operation: "query" });
    expect(document).not.toContain(conflictLeadId);
  }
  expect(projectQuery).toContain(`name: { eq: "${projectName}" }`);
  expect(viewQuery).toContain(`id: { eq: "${viewId}" }`);
  for (const document of [projectQuery, viewQuery]) {
    expect(document).toContain("includeArchived: true, first: 50, after: $after");
  }
  await expect(executeApi({ document: viewQuery.replace("createdAt", "nonexistentField") }))
    .rejects.toThrow("invalid graphql");
});

test("org name and immutable id verified FIRST; failures prevent both fixture reads", async () => {
  for (const organization of [
    { id: creatorId, name: organizationName }, { id: organizationId, name: "wrong" }, {},
  ]) {
    let calls = 0;
    await expect(inspectRun51(async document => {
      calls++;
      expect(document).toBe(organizationQuery);
      return { organization };
    })).rejects.toThrow("identity mismatch");
    expect(calls).toBe(1);
  }
});

test("both connections paginate independently and output only selected metadata", async () => {
  const calls: unknown[] = [];
  const result = await inspectRun51(async (document, variables) => {
    calls.push({ document, variables });
    if (document === organizationQuery) return org;
    const root = document === projectQuery ? "projects" : "customViews";
    return variables?.after === null ? page(root, [], true, "next") :
      page(root, [{ ...(root === "projects" ? project : view), headers: "lin_api_secret" }]);
  });
  expect(calls).toEqual([
    { document: organizationQuery, variables: undefined },
    { document: projectQuery, variables: { after: null } },
    { document: projectQuery, variables: { after: "next" } },
    { document: viewQuery, variables: { after: null } },
    { document: viewQuery, variables: { after: "next" } },
  ]);
  expect(result.projects).toEqual({ pages: 2, matches: [{
    id: creatorId, name: projectName, createdAt: base.createdAt, archivedAt: null, creatorId,
    teamIds: [knownRunTeamId], returnedTeamsIncludeKnownRunTeam: true,
  }] });
  expect(result.views).toEqual({ pages: 2, matches: [{
    id: viewId, name: view.name, createdAt: base.createdAt, archivedAt: null, creatorId, organizationId,
  }] });
  expect(JSON.stringify(result)).not.toContain("lin_api_secret");
});

test("empty reads remain inconclusive and never trigger conflict-id lookup", async () => {
  const documents: string[] = [];
  const result = await inspectRun51(async document => {
    documents.push(document);
    return document === organizationQuery ? org : page(document === projectQuery ? "projects" : "customViews", []);
  });
  expect(documents).toEqual([organizationQuery, projectQuery, viewQuery]);
  expect(result.projects.matches).toEqual([]);
  expect(result.views.matches).toEqual([]);
  expect(result.limitation).toContain("empty results are inconclusive");
  expect(result.limitation).toContain("unqueried investigation lead");
  expect(result.limitation).toContain("no metadata or comparison establishes run ownership");
});

test("nullable project creator and different team are observations, not ownership", async () => {
  const result = await inspectRun51(async document => document === organizationQuery ? org :
    document === projectQuery ? page("projects", [{ ...project, creator: null, teams: { nodes: [{ id: creatorId }] } }]) :
      page("customViews", []));
  expect(result.projects.matches[0]?.creatorId).toBeNull();
  expect(result.projects.matches[0]?.returnedTeamsIncludeKnownRunTeam).toBe(false);
});

test("wrong names, view ids/orgs and malformed selected fields fail closed", async () => {
  for (const [document, invalid] of [
    [projectQuery, { ...project, name: `${projectName}-other` }],
    [projectQuery, { ...project, teams: { nodes: [{ id: "lin_secret" }] } }],
    [projectQuery, { ...project, createdAt: "lin_secret" }],
    [viewQuery, { ...view, id: creatorId }],
    [viewQuery, { ...view, organization: { id: creatorId } }],
    [viewQuery, { ...view, name: "lin_api_secret" }],
    [viewQuery, { ...view, creator: null }],
  ] as const) {
    await expect(inspectRun51(async query => query === organizationQuery ? org :
      page(query === projectQuery ? "projects" : "customViews", query === document ? [invalid] : [])))
      .rejects.toThrow();
  }
});

test("invalid cursors and page caps fail for either connection, without retry", async () => {
  for (const target of [projectQuery, viewQuery]) {
    for (const cursor of [null, "", "same", "unique"]) {
      let targetCalls = 0;
      await expect(inspectRun51(async document => {
        if (document === organizationQuery) return org;
        const root = document === projectQuery ? "projects" : "customViews";
        if (document !== target) return page(root, []);
        targetCalls++;
        return page(root, [], true, cursor === "unique" ? String(targetCalls) : cursor);
      })).rejects.toThrow(cursor === "unique" ? "no completeness claim" : "cursor");
      expect(targetCalls).toBe(cursor === "unique" ? 20 : cursor === "same" ? 2 : 1);
    }
  }
});

test("transport errors sanitized without retries at all three stages", async () => {
  for (const [index, target] of [organizationQuery, projectQuery, viewQuery].entries()) {
    let calls = 0;
    await expect(inspectRun51(async document => {
      calls++;
      if (document === target) throw new Error("lin_api_secret arbitrary response");
      return document === organizationQuery ? org : page("projects", []);
    })).rejects.toThrow("read-only inspection request failed");
    expect(calls).toBe(index + 1);
  }
});

test("workflow keeps branch/repo gates and sandbox serialization; only new inspector invoked", async () => {
  const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
  expect(workflow).toContain('branches: ["feat/api-parity-nested-input-witnesses"]');
  expect(workflow).toContain("github.head_ref == 'chore/read-only-run51-inspection'");
  expect(workflow).toContain("github.event.pull_request.head.repo.full_name == github.repository");
  expect(workflow).toContain("contents: read");
  expect(workflow).toContain("group: lnr-e2e-bdsqqq-sandbox");
  expect(workflow).toContain("bun test scripts/inspect-run51-fixtures.test.ts");
  expect(workflow).toContain("bun scripts/inspect-run51-fixtures.ts\n        env:\n          LINEAR_API_KEY:");
  expect(workflow.match(/secrets\./g)).toHaveLength(1);
  expect(workflow).not.toMatch(/delete-authorized|readonly-missing-lookup|bun .*e2e|bun .*release/);
});
