import { expect, test } from "bun:test";
import { executeApi } from "../packages/core/src/api";
import { absenceQuery, assertExecutionGate, deleteQuery, deleteRun51View, verifyQuery } from "./delete-run51-view";
import { organizationId, organizationName, organizationQuery, viewId } from "./inspect-run51-fixtures";

const creator = "3d9471f1-862c-4c29-8ebb-653a55553122";
const node = { id: viewId, name: "e2e-view-updated-cc26ca86-6fba-4c4f-96fc-f720ef68acaf",
  createdAt: "2026-09-30T01:09:34.109Z", archivedAt: null,
  creator: { id: creator }, organization: { id: organizationId } };
function fixture(options: { org?: string; node?: unknown; success?: unknown;
  reject?: boolean; survivor?: boolean; incomplete?: boolean } = {}) {
  const calls: string[] = [];
  const request = async (document: string) => {
    calls.push(document);
    if (document === organizationQuery) return { organization: { id: options.org ?? organizationId, name: organizationName } };
    if (document === verifyQuery) return { viewer: { id: creator }, customViews: {
      nodes: [options.node ?? node], pageInfo: { hasNextPage: options.incomplete ?? false },
    } };
    if (document === deleteQuery) {
      if (options.reject) throw new Error("uncertain");
      return { customViewDelete: { success: Object.hasOwn(options, "success") ? options.success : true } };
    }
    expect(document).toBe(absenceQuery);
    return { customViews: { nodes: options.survivor ? [{ id: viewId, name: "renamed" }] : [],
      pageInfo: { hasNextPage: false } } };
  };
  return { request, calls };
}
test("fixed documents validate offline without credential access", async () => {
  for (const document of [organizationQuery, verifyQuery, deleteQuery, absenceQuery]) {
    expect(await executeApi({ document }, () => { throw new Error("credentials"); }))
      .toMatchObject({ ok: true, executed: false, operation: document === deleteQuery ? "mutation" : "query" });
  }
});
test("only the pinned workflow run and first attempt are authorized", () => {
  const env = { GITHUB_RUN_NUMBER: "163", GITHUB_RUN_ATTEMPT: "1",
    LNR_RECOVERY_CONFIRM_ORG: organizationName, LNR_RECOVERY_DELETE_ID: viewId };
  expect(() => assertExecutionGate(env)).not.toThrow();
  for (const changed of [
    { GITHUB_RUN_NUMBER: "164" }, { GITHUB_RUN_NUMBER: undefined }, { GITHUB_RUN_ATTEMPT: "2" },
    { LNR_RECOVERY_CONFIRM_ORG: "other" }, { LNR_RECOVERY_DELETE_ID: organizationId },
  ]) expect(() => assertExecutionGate({ ...env, ...changed })).toThrow();
});
test("workflow exposes only the authorized script to the step-local secret", async () => {
  const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
  expect(workflow).toContain("github.run_number == 163 && github.run_attempt == 1");
  expect(workflow).toContain("github.head_ref == 'chore/read-only-run51-inspection'");
  expect(workflow).toContain('branches: ["feat/api-parity-nested-input-witnesses"]');
  expect(workflow).toContain("run: bun scripts/delete-run51-view.ts\n        env:\n          LINEAR_API_KEY:");
  expect(workflow).not.toMatch(/e2e-mutations|delete-authorized-view\.ts|delete-run51-project|workflow_dispatch/);
});
test("identity mismatch or incomplete preflight permits zero writes", async () => {
  for (const options of [
    { org: viewId }, { node: { ...node, id: organizationId } }, { node: { ...node, name: "other" } },
    { node: { ...node, createdAt: "other" } }, { node: { ...node, archivedAt: "now" } },
    { node: { ...node, creator: { id: organizationId } } }, { incomplete: true },
  ]) {
    const f = fixture(options);
    await expect(deleteRun51View(f.request)).rejects.toThrow();
    expect(f.calls).not.toContain(deleteQuery);
  }
});
test("one deletion is followed by immutable-id absence readback", async () => {
  const f = fixture();
  expect(await deleteRun51View(f.request)).toMatchObject({
    id: viewId, mutationSuccess: true, absentFromArchivedInclusiveIdQuery: true,
  });
  expect(f.calls).toEqual([organizationQuery, verifyQuery, deleteQuery, absenceQuery]);
});
test("uncertain, malformed confirmations and renamed survivors never repeat the write", async () => {
  for (const options of [
    { reject: true }, { success: false }, { success: undefined }, { success: "false" },
    { success: 1 }, { success: {} }, { survivor: true },
  ]) {
    const f = fixture(options);
    await expect(deleteRun51View(f.request)).rejects.toThrow();
    expect(f.calls.filter(document => document === deleteQuery)).toHaveLength(1);
  }
});
