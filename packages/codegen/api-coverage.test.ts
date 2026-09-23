import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { digest, evaluate, parseLedger, requireAcceptance } from "./api-coverage";

const pins = { sdkVersion: "fixture", schemaSha256: digest("schema"), snapshotSha256: digest("snapshot") };
const sources: Record<string, string> = {
  "binding.ts": "reviewed fixture binding",
  "binding.test.ts": 'test("exact field contract", () => {});',
  "live.json": '{"scenario":"exact field persisted effect","result":"passed"}',
};
const reference = (file: string) => ({ file, sha256: digest(sources[file]!) });
const source = reference("binding.ts");
const read = async (file: string) => {
  if (!Object.hasOwn(sources, file)) throw new Error(`missing source: ${file}`);
  return sources[file]!;
};
function fixture() {
  const coordinates = ["Query.item", "Input.value"].map(coordinate => ({
    coordinate, kind: coordinate.startsWith("Query.") ? "field" : "input-field",
    scope: "public-candidate", operations: coordinate.startsWith("Query.") ? ["query"] : [],
  }));
  const records = coordinates.map(c => ({
    coordinate: c.coordinate, classification: "supported-public", implementation: "implemented",
    reason: "synthetic reviewed fixture, not repository coverage", sources: [source],
    binding: { command: "fixture", mode: "read", resolver: "fixture", mapping: c.coordinate, sources: [source] },
    evidence: [{ ...reference("binding.test.ts"), kind: "contract", test: "exact field contract" }],
    auth: { status: "reviewed", credential: "fixture", scopes: "none", plan: "none", ownership: "none", sources: [source] },
    live: { status: "verified", reason: "synthetic evidence", scenario: c.coordinate, revision: "fixture",
      run: "fixture-run", sources: [reference("live.json")] },
  }));
  return {
    inventory: { formatVersion: 1, source: { ...pins }, coordinates },
    ledger: { formatVersion: 1, pins: { ...pins }, nonGraph: { status: "complete", reason: "fixture reconciliation", sources: [source] }, records },
  };
}
test("small evidenced fixture passes only the coverage prerequisite", async () => {
  const f = fixture(), report = await evaluate(f.inventory, f.ledger, read);
  expect(report.scope).toBe("coverage-prerequisite-only");
  expect(report.rows).toHaveLength(2);
  expect(() => requireAcceptance(report)).not.toThrow();
  f.ledger.records[1]!.evidence = [];
  const incomplete = await evaluate(f.inventory, f.ledger, read);
  expect(incomplete.rows.find(r => r.coordinate === "Input.value")!.gaps).toContain("contract-evidence");
  expect(() => requireAcceptance(incomplete)).toThrow("incomplete");
});
test("empty ledger retains all coordinates; structural roots never cover fields or live behavior", async () => {
  const f = fixture();
  f.ledger.records = [];
  const empty = await evaluate(f.inventory, f.ledger, read);
  expect(empty.rows).toHaveLength(2);
  expect(empty.accepted).toBe(false);
  const g = fixture();
  g.ledger.records = [g.ledger.records[0]!];
  g.ledger.records[0]!.evidence[0]!.kind = "structural";
  g.ledger.records[0]!.live.status = "unverified";
  const report = await evaluate(g.inventory, g.ledger, read);
  expect(report.accepted).toBe(false);
  expect(report.rows.find(r => r.coordinate === "Query.item")!.gaps).toEqual(["contract-evidence", "live-verification"]);
  expect(report.rows.find(r => r.coordinate === "Input.value")!.gaps).toContain("binding");
});
test("missing, blocked, excluded, unknown auth and nonGraph remain gaps", async () => {
  for (const implementation of ["missing", "blocked", "intentionally-excluded", "unclassified"]) {
    const f = fixture(); f.ledger.records[0]!.implementation = implementation;
    expect((await evaluate(f.inventory, f.ledger, read)).accepted).toBe(false);
  }
  const f = fixture(); f.ledger.records[0]!.auth.status = "unknown";
  f.ledger.records[0]!.live.status = "blocked";
  expect((await evaluate(f.inventory, f.ledger, read)).accepted).toBe(false);
  const g = fixture(); g.ledger.nonGraph.status = "unknown";
  expect((await evaluate(g.inventory, g.ledger, read)).accepted).toBe(false);
});
test("internal and sourced unavailable remain separate; subscription support cannot be invented", async () => {
  const f = fixture();
  f.inventory.coordinates[0]!.scope = "internal";
  f.ledger.records[0]!.classification = "internal";
  f.ledger.records[1]!.classification = "upstream-unavailable";
  const report = await evaluate(f.inventory, f.ledger, read);
  expect(report.rows.every(r => r.separate)).toBe(true);
  const g = fixture(); g.inventory.coordinates[0]!.operations = ["subscription"];
  expect((await evaluate(g.inventory, g.ledger, read)).accepted).toBe(false);
  g.ledger.records[0]!.classification = "upstream-unavailable";
  await expect(evaluate(g.inventory, g.ledger, read)).rejects.toThrow("subscription");
});
test("duplicates, unknown coordinates, changed pins and scope contradictions reject integrity", async () => {
  const duplicate = fixture(); duplicate.ledger.records.push(duplicate.ledger.records[0]!);
  await expect(evaluate(duplicate.inventory, duplicate.ledger, read)).rejects.toThrow("duplicate");
  const unknown = fixture(); unknown.ledger.records[0]!.coordinate = "Query.removed";
  await expect(evaluate(unknown.inventory, unknown.ledger, read)).rejects.toThrow("unknown");
  for (const key of ["sdkVersion", "schemaSha256", "snapshotSha256"] as const) {
    const f = fixture(); f.ledger.pins[key] = key === "sdkVersion" ? "old" : digest("old");
    await expect(evaluate(f.inventory, f.ledger, read)).rejects.toThrow("stale coverage pin");
  }
  const scope = fixture(); scope.ledger.records[0]!.classification = "internal";
  await expect(evaluate(scope.inventory, scope.ledger, read)).rejects.toThrow("scope contradiction");
});
test("source hashes and literal test anchors reject stale or dangling evidence", async () => {
  const f = fixture();
  await expect(evaluate(f.inventory, f.ledger, async () => "changed")).rejects.toThrow("stale source");
  f.ledger.records[0]!.evidence[0]!.test = "absent test name";
  await expect(evaluate(f.inventory, f.ledger, read)).rejects.toThrow("missing test anchor");
  const g = fixture(); g.ledger.records[0]!.sources[0] = { file: "missing.ts", sha256: digest("") };
  await expect(evaluate(g.inventory, g.ledger, read)).rejects.toThrow("missing source");
  expect(() => parseLedger({ ...fixture().ledger, records: [{}] })).toThrow();
});
test("new and deprecated fields retain obligations; deleted bindings cannot pass", async () => {
  const f = fixture();
  const changed = { ...f.inventory, coordinates: [
    ...f.inventory.coordinates, { coordinate: "Input.sibling", kind: "input-field",
      scope: "public-candidate", operations: [], deprecated: true },
  ] };
  expect((await evaluate(changed, f.ledger, read)).accepted).toBe(false);
  const ledger = { ...f.ledger, records: f.ledger.records.map(r => ({ ...r, binding: null })) };
  expect((await evaluate(f.inventory, ledger, read)).accepted).toBe(false);
});
test("accepted snapshot has honest gaps and evaluation never mutates inputs", async () => {
  const load = async (name: string) => JSON.parse(await readFile(new URL(name, import.meta.url), "utf8"));
  const inventory = await load("./api-inventory.json"), ledger = await load("./api-coverage.json");
  const before = JSON.stringify([inventory, ledger]);
  const report = await evaluate(inventory, ledger, async () => { throw new Error("empty ledger must not read evidence"); });
  expect(report.rows).toHaveLength(inventory.coordinates.length);
  expect(report.accepted).toBe(false);
  expect(() => requireAcceptance(report)).toThrow("coverage prerequisite incomplete");
  expect(JSON.stringify([inventory, ledger])).toBe(before);
});
