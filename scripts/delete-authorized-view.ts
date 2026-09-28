import { executeApi } from "../packages/core/src/api";
import { getClient } from "../packages/core/src/client";
import { inspectExactView, organizationName } from "./inspect-view-recovery";

export const authorizedId = "54429643-f5fd-4ee9-b3bb-9948cf7245e8";
export const deleteDocument = `mutation DeleteAuthorizedFixture {
  customViewDelete(id: "${authorizedId}") { success }
}`;
export const absenceDocument = `query VerifyDeletedFixture {
  customViews(filter: { id: { eq: "${authorizedId}" } }, includeArchived: true, first: 2) {
    nodes { id }
    pageInfo { hasNextPage }
  }
}`;
type Request = (document: string, variables?: Record<string, unknown>) => Promise<unknown>;

/** Authorization applies only to this identified fixture, never a name-based replacement. */
export async function deleteAuthorizedView(request: Request, beforeAttempt: () => void = () => {}) {
  const before = await inspectExactView(request);
  const view = before.matches[0];
  if (before.organization.id !== "40d4b432-9b66-4a4a-ad6c-2ab39d6208ce" ||
      before.matches.length !== 1 || view?.id !== authorizedId ||
      view.creatorId !== "3d9471f1-862c-4c29-8ebb-653a55553122" ||
      !view.creatorMatchesViewer || view.createdAt !== "2026-09-24T17:56:49.537Z" ||
      view.archivedAt !== null) {
    throw new Error("fixture identity changed; deletion refused");
  }
  beforeAttempt();
  const result = await request(deleteDocument);
  if (!result || typeof result !== "object" || !("customViewDelete" in result) ||
      !result.customViewDelete || typeof result.customViewDelete !== "object" ||
      !("success" in result.customViewDelete) || result.customViewDelete.success !== true) {
    throw new Error("deletion unconfirmed; do not retry");
  }
  const after = await request(absenceDocument);
  const connection = (after as { customViews?: { nodes?: unknown; pageInfo?: { hasNextPage?: unknown } } } | null)?.customViews;
  if (!Array.isArray(connection?.nodes) || connection.nodes.length !== 0 ||
      connection.pageInfo?.hasNextPage !== false) {
    throw new Error("post-deletion absence unconfirmed; do not retry");
  }
  return { id: authorizedId, mutationSuccess: true, verifiedAt: new Date().toISOString(),
    absentFromArchivedInclusiveIdQuery: true,
    limitation: "absence from accessible customViews is not proof of permanent storage erasure" };
}

if (import.meta.main) {
  let mutationAttempted = false;
  try {
    const key = process.env.LINEAR_API_KEY?.trim();
    if (!key || process.env.LNR_RECOVERY_CONFIRM_ORG !== organizationName ||
        process.env.LNR_RECOVERY_DELETE_ID !== authorizedId || process.env.GITHUB_RUN_ATTEMPT !== "1" ||
        process.env.GITHUB_RUN_NUMBER !== "150") {
      throw new Error("explicit single-attempt deletion authorization required");
    }
    const client = getClient(key, { redirect: "error" });
    const result = await deleteAuthorizedView(async (document, variables) => {
      const response = await executeApi({ document, variables, execute: true }, () => client);
      if (!response.ok || !response.data) throw new Error("recovery request failed");
      return response.data;
    }, () => {
      mutationAttempted = true;
      console.log(JSON.stringify({ id: authorizedId, mutationAttempted: true, retryPermitted: false }));
    });
    console.log(JSON.stringify(result));
  } catch {
    console.error(JSON.stringify({ id: authorizedId, mutationAttempted,
      error: "recovery stopped; no automatic retry; manual investigation required" }));
    process.exitCode = 1;
  }
}
