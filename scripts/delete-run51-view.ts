import { executeApi } from "../packages/core/src/api";
import { getClient } from "../packages/core/src/client";
import { organizationId, organizationName, organizationQuery, viewId } from "./inspect-run51-fixtures";

export const verifyQuery = `query VerifyAuthorizedView {
  viewer { id }
  customViews(filter: { id: { eq: "${viewId}" } }, includeArchived: true, first: 2) {
    nodes { id name createdAt archivedAt creator { id } organization { id } }
    pageInfo { hasNextPage }
  }
}`;
export const deleteQuery = `mutation DeleteAuthorizedView {
  customViewDelete(id: "${viewId}") { success }
}`;
export const absenceQuery = `query VerifyDeletedView {
  customViews(filter: { id: { eq: "${viewId}" } }, includeArchived: true, first: 2) {
    nodes { id }
    pageInfo { hasNextPage }
  }
}`;
type Request = (document: string) => Promise<unknown>;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid recovery response");
  return value as Record<string, unknown>;
}
function connection(value: unknown) {
  const data = object(value), views = object(data.customViews);
  if (!Array.isArray(views.nodes) || object(views.pageInfo).hasNextPage !== false) {
    throw new Error("incomplete recovery response");
  }
  return { data, nodes: views.nodes };
}

/** One separately authorized id, one write; uncertain outcomes never authorize repetition. */
export async function deleteRun51View(request: Request, beforeAttempt: () => void = () => {}) {
  const org = object(object(await request(organizationQuery)).organization);
  if (org.id !== organizationId || org.name !== organizationName) {
    throw new Error("sandbox identity mismatch");
  }
  const { data, nodes } = connection(await request(verifyQuery));
  if (nodes.length !== 1) throw new Error("authorized view not uniquely visible");
  const view = object(nodes[0]), creator = object(view.creator);
  if (view.id !== viewId || view.name !== "e2e-view-updated-cc26ca86-6fba-4c4f-96fc-f720ef68acaf" ||
      view.createdAt !== "2026-09-30T01:09:34.109Z" || view.archivedAt !== null ||
      creator.id !== "3d9471f1-862c-4c29-8ebb-653a55553122" ||
      object(data.viewer).id !== creator.id || object(view.organization).id !== organizationId) {
    throw new Error("authorized view identity changed");
  }
  beforeAttempt();
  if (object(object(await request(deleteQuery)).customViewDelete).success !== true) {
    throw new Error("deletion unconfirmed; do not retry");
  }
  if (connection(await request(absenceQuery)).nodes.length !== 0) {
    throw new Error("absence unconfirmed; do not retry");
  }
  return { id: viewId, mutationSuccess: true, verifiedAt: new Date().toISOString(),
    absentFromArchivedInclusiveIdQuery: true,
    limitation: "accessible-view absence is not proof of permanent storage erasure" };
}

export function assertExecutionGate(env: Record<string, string | undefined>) {
  if (env.GITHUB_RUN_NUMBER !== "163" || env.GITHUB_RUN_ATTEMPT !== "1" ||
      env.LNR_RECOVERY_CONFIRM_ORG !== organizationName || env.LNR_RECOVERY_DELETE_ID !== viewId) {
    throw new Error("single-run authorization required");
  }
}

if (import.meta.main) {
  let mutationAttempted = false;
  try {
    assertExecutionGate(process.env);
    const key = process.env.LINEAR_API_KEY?.trim();
    if (!key) throw new Error("explicit sandbox credential required");
    const client = getClient(key, { redirect: "error" });
    const result = await deleteRun51View(async document => {
      const response = await executeApi({ document, execute: true }, () => client);
      if (!response.ok || !response.data) throw new Error("recovery request failed");
      return response.data;
    }, () => {
      mutationAttempted = true;
      console.log(JSON.stringify({ id: viewId, mutationAttempted: true, retryPermitted: false }));
    });
    console.log(JSON.stringify(result));
  } catch {
    console.error(JSON.stringify({ id: viewId, mutationAttempted,
      error: "recovery stopped; no retry; manual investigation required" }));
    process.exitCode = 1;
  }
}
