import { executeApi } from "../packages/core/src/api";
import { getClient } from "../packages/core/src/client";

export const organizationName = "bdsqqq-sandbox";
export const organizationId = "40d4b432-9b66-4a4a-ad6c-2ab39d6208ce";
export const projectName = "e2e-project-cc26ca86-6fba-4c4f-96fc-f720ef68acaf";
export const viewId = "b3ebbe18-e7ed-4e19-8715-1dbdd93da9be";
export const knownRunTeamId = "ed86db5e-5ca3-4f2d-be6e-4aef279e2ac7";
export const conflictLeadId = "aeda59ee-b037-4995-8adf-c6a808b94e88";
export const organizationQuery = "query VerifySandbox { organization { id name } }";
export const projectQuery = `query InspectRun51Project($after: String) {
  projects(filter: { name: { eq: "${projectName}" } }, includeArchived: true, first: 50, after: $after) {
    nodes { id name createdAt archivedAt creator { id } teams { nodes { id } } }
    pageInfo { hasNextPage endCursor }
  }
}`;
export const viewQuery = `query InspectRun51View($after: String) {
  customViews(filter: { id: { eq: "${viewId}" } }, includeArchived: true, first: 50, after: $after) {
    nodes { id name createdAt archivedAt creator { id } organization { id } }
    pageInfo { hasNextPage endCursor }
  }
}`;

type Request = (document: string, variables?: Record<string, unknown>) => Promise<unknown>;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid inspection response");
  return value as Record<string, unknown>;
}
function id(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("invalid inspection identity");
  }
  return value;
}
function date(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value) ||
      !Number.isFinite(Date.parse(value))) throw new Error("invalid inspection date");
  return value;
}
function metadata(node: Record<string, unknown>) {
  return { id: id(node.id), createdAt: date(node.createdAt),
    archivedAt: node.archivedAt === null ? null : date(node.archivedAt),
    creatorId: node.creator === null ? null : id(object(node.creator).id) };
}

async function pages<T>(request: Request, document: string, root: string,
  project: (node: Record<string, unknown>) => T) {
  const matches: T[] = [], cursors = new Set<string>();
  let after: string | null = null;
  for (let page = 1; page <= 20; page++) {
    const connection = object(object(await request(document, { after }))[root]);
    const info = object(connection.pageInfo);
    if (!Array.isArray(connection.nodes) || typeof info.hasNextPage !== "boolean") {
      throw new Error("invalid inspection page");
    }
    matches.push(...connection.nodes.map(node => project(object(node))));
    if (!info.hasNextPage) return { pages: page, matches };
    const cursor = info.endCursor;
    if (typeof cursor !== "string" || !cursor || cursors.has(cursor)) {
      throw new Error("invalid or repeated inspection cursor");
    }
    cursors.add(cursor);
    after = cursor;
  }
  throw new Error("inspection page limit reached; no completeness claim");
}

export async function inspectRun51(request: Request) {
  const read: Request = async (document, variables) => {
    try { return await request(document, variables); }
    catch { throw new Error("read-only inspection request failed"); }
  };
  const org = object(object(await read(organizationQuery)).organization);
  if (org.id !== organizationId || org.name !== organizationName) {
    throw new Error("sandbox identity mismatch; inspection stopped");
  }
  const projects = await pages(read, projectQuery, "projects", node => {
    if (node.name !== projectName) throw new Error("unexpected project name");
    const teams = object(node.teams).nodes;
    if (!Array.isArray(teams)) throw new Error("invalid team response");
    const teamIds = teams.map(team => id(object(team).id));
    return { ...metadata(node), name: projectName, teamIds,
      returnedTeamsIncludeKnownRunTeam: teamIds.includes(knownRunTeamId) };
  });
  const views = await pages(read, viewQuery, "customViews", node => {
    if (node.id !== viewId || object(node.organization).id !== organizationId) {
      throw new Error("unexpected view identity");
    }
    // Only the selected name is reportable, never arbitrary response properties.
    if (typeof node.name !== "string" || node.name.length > 256 ||
        /[\u0000-\u001f\u007f]|lin_/i.test(node.name)) throw new Error("invalid view name");
    if (node.creator === null) throw new Error("invalid view creator");
    return { ...metadata(node), name: node.name, organizationId };
  });
  return {
    readOnly: true, pullRequest: 51,
    organization: { id: organizationId, name: organizationName },
    targets: { projectName, viewId, knownRunTeamId, conflictLeadId },
    projects, views,
    limitation: "accessible filtered records only; empty results are inconclusive, not proof of absence; team IDs cover only the returned teams page; the conflict ID is an unqueried investigation lead; no metadata or comparison establishes run ownership or authorizes deletion",
  };
}

if (import.meta.main) {
  try {
    const key = process.env.LINEAR_API_KEY?.trim();
    if (!key || process.env.LNR_RECOVERY_CONFIRM_ORG !== organizationName) {
      throw new Error("explicit sandbox credential and confirmation required");
    }
    const client = getClient(key, { redirect: "error" });
    const result = await inspectRun51(async (document, variables) => {
      const response = await executeApi({ document, variables, execute: true }, () => client);
      if (!response.ok || !response.data) throw new Error("read-only inspection request failed");
      return response.data;
    });
    console.log(JSON.stringify(result));
  } catch {
    console.error("read-only fixture inspection failed; no mutation or automatic retry performed");
    process.exitCode = 1;
  }
}
