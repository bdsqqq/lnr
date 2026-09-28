import { expect, test } from "bun:test";
import { executeApi } from "../packages/core/src/api";
import { absenceDocument, authorizedId, deleteAuthorizedView, deleteDocument } from "./delete-authorized-view";
import { organizationName, organizationQuery, targetName, viewQuery } from "./inspect-view-recovery";

const orgId = "40d4b432-9b66-4a4a-ad6c-2ab39d6208ce";
const creatorId = "3d9471f1-862c-4c29-8ebb-653a55553122";
const node = { id: authorizedId, name: targetName, createdAt: "2026-09-24T17:56:49.537Z",
  archivedAt: null, creator: { id: creatorId }, organization: { id: orgId } };
function fixture(options: { changed?: boolean; reject?: boolean; success?: boolean; remains?: boolean } = {}) {
  let writes = 0;
  const request = async (document: string) => {
    if (document === organizationQuery) return { organization: { id: orgId, name: organizationName } };
    if (document === absenceDocument) return { customViews: {
      nodes: options.remains ? [{ id: authorizedId, name: "renamed surviving target" }] : [],
      pageInfo: { hasNextPage: false },
    } };
    if (document === viewQuery) return { viewer: { id: creatorId }, customViews: {
      nodes: writes && !options.remains ? [] : [{ ...node, id: options.changed ? creatorId : authorizedId }],
      pageInfo: { hasNextPage: false, endCursor: null },
    } };
    expect(document).toBe(deleteDocument);
    writes++;
    if (options.reject) throw new Error("uncertain transport outcome");
    return { customViewDelete: { success: options.success ?? true } };
  };
  return { request, writes: () => writes };
}
test("only the pinned mutation validates offline without credentials", async () => {
  expect(await executeApi({ document: deleteDocument }, () => { throw new Error("credentials"); }))
    .toEqual({ ok: true, executed: false, operation: "mutation" });
  expect(await executeApi({ document: absenceDocument }, () => { throw new Error("credentials"); }))
    .toEqual({ ok: true, executed: false, operation: "query" });
});
test("identity change forbids deletion", async () => {
  const f = fixture({ changed: true });
  await expect(deleteAuthorizedView(f.request)).rejects.toThrow("identity changed");
  expect(f.writes()).toBe(0);
});
test("one confirmed deletion followed by independent absence", async () => {
  const f = fixture();
  expect(await deleteAuthorizedView(f.request)).toMatchObject({
    id: authorizedId, mutationSuccess: true, absentFromArchivedInclusiveIdQuery: true,
  });
  expect(f.writes()).toBe(1);
});
test("transport failure, unconfirmed mutation and stale readback never repeat the write", async () => {
  for (const options of [{ reject: true }, { success: false }, { remains: true }]) {
    const f = fixture(options);
    await expect(deleteAuthorizedView(f.request)).rejects.toThrow();
    expect(f.writes()).toBe(1);
  }
});
