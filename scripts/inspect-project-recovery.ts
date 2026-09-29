import { executeApi } from "../packages/core/src/api";
import { getClient } from "../packages/core/src/client";

export const organizationName = "bdsqqq-sandbox";
export const organizationId = "40d4b432-9b66-4a4a-ad6c-2ab39d6208ce";
export const targetName = "e2e-project-ffecd613-ff51-410d-8751-12d00a58043e";
export const knownRunTeamId = "9d826f13-0ccf-43a5-b02b-45ff43ffe181";
export const organizationQuery = "query VerifySandbox { organization { id name } }";
export const projectQuery = `query InspectExactProject($after: String) {
  viewer { id }
  projects(
    filter: { name: { eq: "${targetName}" } }
    includeArchived: true
    first: 50
    after: $after
  ) {
    nodes { id name createdAt archivedAt creator { id } teams { nodes { id } } }
    pageInfo { hasNextPage endCursor }
  }
}`;

type Request = (document: string, variables?: Record<string, unknown>) => Promise<unknown>;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid inspection response");
  return value as Record<string, unknown>;
}
function isId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}
function isDate(value: unknown): value is string {
  return typeof value === "string" &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value));
}

export async function inspectExactProject(request: Request) {
  // Transport failures never escape with SDK bodies, headers, or credentials.
  const read: Request = async (document, variables) => {
    try { return await request(document, variables); }
    catch { throw new Error("read-only inspection request failed"); }
  };
  const org = object(object(await read(organizationQuery)).organization);
  if (org.name !== organizationName || org.id !== organizationId) {
    throw new Error("sandbox identity mismatch; inspection stopped");
  }
  const matches: {
    id: string; name: string; createdAt: string; archivedAt: string | null;
    creatorId: string | null; creatorMatchesViewer: boolean | null; teamIds: string[];
  }[] = [];
  const cursors = new Set<string>();
  let after: string | null = null;
  let viewerId: string | undefined;
  for (let page = 1; page <= 20; page++) {
    const data = object(await read(projectQuery, { after }));
    const viewer = object(data.viewer);
    if (!isId(viewer.id) || (viewerId !== undefined && viewerId !== viewer.id)) {
      throw new Error("missing or inconsistent viewer identity; inspection stopped");
    }
    viewerId = viewer.id;
    const connection = object(data.projects), pageInfo = object(connection.pageInfo);
    if (!Array.isArray(connection.nodes) || typeof pageInfo.hasNextPage !== "boolean") {
      throw new Error("invalid inspection response");
    }
    for (const raw of connection.nodes) {
      const node = object(raw);
      // Project.creator is nullable in the pinned schema; unknown is not false.
      const creatorId = node.creator === null ? null : object(node.creator).id;
      const teams = object(node.teams).nodes;
      if (node.name !== targetName || !isId(node.id) || !isDate(node.createdAt) ||
          !(node.archivedAt === null || isDate(node.archivedAt)) ||
          !(creatorId === null || isId(creatorId)) || !Array.isArray(teams)) {
        throw new Error("unexpected fixture response; inspection stopped");
      }
      const teamIds = teams.map(team => {
        const id = object(team).id;
        if (!isId(id)) throw new Error("invalid team identity");
        return id;
      });
      matches.push({ id: node.id, name: targetName, createdAt: node.createdAt,
        archivedAt: node.archivedAt, creatorId,
        creatorMatchesViewer: creatorId === null ? null : creatorId === viewerId, teamIds });
    }
    if (!pageInfo.hasNextPage) {
      return { inspectedAt: new Date().toISOString(),
        organization: { id: organizationId, name: organizationName },
        source: { pullRequest: 48, runId: "36641067664", knownRunTeamId },
        targetName, pages: page, matches, readOnly: true,
        limitation: "accessible exact-name projects only, including archived; empty results do not prove workspace-wide absence; team IDs are only the returned teams page; name, creator and team matches do not prove run ownership or authorize deletion" };
    }
    const cursor = pageInfo.endCursor;
    if (typeof cursor !== "string" || !cursor || cursors.has(cursor)) {
      throw new Error("invalid or repeated inspection cursor");
    }
    cursors.add(cursor);
    after = cursor;
  }
  throw new Error("inspection page limit reached; no completeness claim");
}

if (import.meta.main) {
  try {
    const key = process.env.LINEAR_API_KEY?.trim();
    if (!key || process.env.LNR_RECOVERY_CONFIRM_ORG !== organizationName) {
      throw new Error("explicit sandbox credential and confirmation required");
    }
    const client = getClient(key, { redirect: "error" });
    const result = await inspectExactProject(async (document, variables) => {
      const response = await executeApi({ document, variables, execute: true }, () => client);
      if (!response.ok || !response.data) throw new Error("read-only inspection request failed");
      return response.data;
    });
    console.log(JSON.stringify(result));
  } catch {
    console.error("read-only inspection failed; no mutation or automatic retry performed");
    process.exitCode = 1;
  }
}
