import { executeApi } from "../packages/core/src/api";
import { getClient } from "../packages/core/src/client";

export const organizationName = "bdsqqq-sandbox";
export const targetName = "e2e-view-4f550931-72c6-4b5b-9821-de19fca79362";
export const organizationQuery = "query VerifySandbox { organization { id name urlKey } }";
export const viewQuery = `query InspectExactView($after: String) {
  viewer { id }
  customViews(
    filter: { name: { eq: "${targetName}" } }
    includeArchived: true
    first: 50
    after: $after
  ) {
    nodes { id name createdAt archivedAt creator { id } organization { id } }
    pageInfo { hasNextPage endCursor }
  }
}`;

type Request = (document: string, variables?: Record<string, unknown>) => Promise<unknown>;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid inspection response");
  return value as Record<string, unknown>;
}
function isId(value: unknown): value is string {
  return typeof value === "string" && value.length === 36 &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}

/** No mutation document, lookup by arbitrary name, or credential output is permitted here. */
export async function inspectExactView(request: Request) {
  const org = object(object(await request(organizationQuery)).organization);
  if (org.name !== organizationName || !isId(org.id)) {
    throw new Error("sandbox identity mismatch; inspection stopped");
  }
  const matches: { id: string; name: string; createdAt: string; archivedAt: string | null;
    creatorId: string; creatorMatchesViewer: boolean }[] = [];
  const cursors = new Set<string>();
  let after: string | null = null;
  let viewerId: string | undefined;
  for (let page = 1; page <= 20; page++) {
    const data = object(await request(viewQuery, { after }));
    const viewer = object(data.viewer);
    if (!isId(viewer.id) || (viewerId !== undefined && viewerId !== viewer.id)) {
      throw new Error("missing or inconsistent viewer identity; inspection stopped");
    }
    viewerId = viewer.id;
    const connection = object(data.customViews);
    const pageInfo = object(connection.pageInfo);
    if (!Array.isArray(connection.nodes) || typeof pageInfo.hasNextPage !== "boolean") {
      throw new Error("invalid inspection response");
    }
    for (const raw of connection.nodes) {
      const node = object(raw), creator = object(node.creator);
      if (node.name !== targetName || object(node.organization).id !== org.id ||
          !isId(node.id) || typeof node.createdAt !== "string" ||
          !(node.archivedAt === null || typeof node.archivedAt === "string") ||
          !isId(creator.id)) {
        throw new Error("unexpected fixture response; inspection stopped");
      }
      matches.push({ id: node.id, name: node.name, createdAt: node.createdAt,
        archivedAt: node.archivedAt, creatorId: creator.id,
        creatorMatchesViewer: creator.id === viewerId });
    }
    if (!pageInfo.hasNextPage) {
      return { inspectedAt: new Date().toISOString(), organization: { id: org.id, name: org.name },
        targetName, pages: page, matches, readOnly: true,
        limitation: "accessible customViews only; excludes project/initiative-scoped views; a match is not deletion authorization" };
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
    const result = await inspectExactView(async (document, variables) => {
      const result = await executeApi({ document, variables, execute: true }, () => client);
      if (!result.ok || !result.data) throw new Error("read-only inspection request failed");
      return result.data;
    });
    console.log(JSON.stringify(result));
  } catch {
    // Never emit SDK exceptions, request headers, credentials, or arbitrary response bodies.
    console.error("read-only inspection failed; no mutation or automatic retry performed");
    process.exitCode = 1;
  }
}
