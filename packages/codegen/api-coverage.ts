import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { main as checkInventory } from "./api-inventory";

type Ref = { file: string; sha256: string };
type Evidence = Ref & { kind: "structural" | "contract"; test: string };
type Pins = { sdkVersion: string; schemaSha256: string; snapshotSha256: string };
type Row = {
  coordinate: string;
  classification: "public-candidate" | "supported-public" | "internal" | "upstream-unavailable";
  implementation: "unclassified" | "missing" | "implemented" | "intentionally-excluded" | "blocked";
  reason: string;
  sources: Ref[];
  binding: null | { command: string; mode: string; resolver: string; mapping: string; sources: Ref[] };
  evidence: Evidence[];
  auth: { status: "unknown" | "reviewed"; credential: string; scopes: string; plan: string; ownership: string; sources: Ref[] };
  live: { status: "unverified" | "blocked" | "verified"; reason: string; scenario: string; revision: string; run: string; sources: Ref[] };
};
type Ledger = {
  formatVersion: 1;
  pins: Pins;
  nonGraph: { status: "unknown" | "complete"; reason: string; sources: Ref[] };
  records: Row[];
};
type Coordinate = { coordinate: string; kind: string; scope: string; operations: string[] };
type Reader = (file: string) => Promise<string>;
export const digest = (text: string) => createHash("sha256").update(text).digest("hex");

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("expected object");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("expected string");
  return value;
}
function nonempty(value: unknown): string {
  const result = text(value);
  if (!result.trim()) throw new Error("expected nonempty string");
  return result;
}
function array<T>(value: unknown, parse: (value: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error("expected array");
  return value.map(parse);
}
function choice<const T extends readonly string[]>(value: unknown, choices: T): T[number] {
  const result = text(value);
  if (!choices.includes(result)) throw new Error(`invalid value: ${result}`);
  return result as T[number];
}
function hash(value: unknown): string {
  const result = text(value);
  if (!/^[a-f0-9]{64}$/.test(result)) throw new Error("expected sha256");
  return result;
}
function ref(value: unknown): Ref {
  const o = object(value), file = nonempty(o.file);
  if (!/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(file) ||
      file.split("/").some(part => part === "." || part === "..")) throw new Error("invalid source path");
  return { file, sha256: hash(o.sha256) };
}
function pins(value: unknown): Pins {
  const o = object(value);
  return { sdkVersion: nonempty(o.sdkVersion), schemaSha256: hash(o.schemaSha256), snapshotSha256: hash(o.snapshotSha256) };
}
export function parseLedger(value: unknown): Ledger {
  const o = object(value), nonGraph = object(o.nonGraph);
  if (o.formatVersion !== 1) throw new Error("unsupported coverage format");
  return {
    formatVersion: 1, pins: pins(o.pins),
    nonGraph: {
      status: choice(nonGraph.status, ["unknown", "complete"]),
      reason: nonempty(nonGraph.reason), sources: array(nonGraph.sources, ref),
    },
    records: array(o.records, value => {
      const r = object(value), auth = object(r.auth), live = object(r.live);
      const b = r.binding === null ? null : object(r.binding);
      return {
        coordinate: nonempty(r.coordinate),
        classification: choice(r.classification, ["public-candidate", "supported-public", "internal", "upstream-unavailable"]),
        implementation: choice(r.implementation, ["unclassified", "missing", "implemented", "intentionally-excluded", "blocked"]),
        reason: nonempty(r.reason), sources: array(r.sources, ref),
        binding: b && {
          command: nonempty(b.command), mode: nonempty(b.mode), resolver: nonempty(b.resolver),
          mapping: nonempty(b.mapping), sources: array(b.sources, ref),
        },
        evidence: array(r.evidence, value => {
          const e = object(value);
          return { ...ref(e), kind: choice(e.kind, ["structural", "contract"]), test: nonempty(e.test) };
        }),
        auth: {
          status: choice(auth.status, ["unknown", "reviewed"]),
          credential: text(auth.credential), scopes: text(auth.scopes),
          plan: text(auth.plan), ownership: text(auth.ownership), sources: array(auth.sources, ref),
        },
        live: {
          status: choice(live.status, ["unverified", "blocked", "verified"]),
          reason: nonempty(live.reason), scenario: text(live.scenario),
          revision: text(live.revision), run: text(live.run), sources: array(live.sources, ref),
        },
      };
    }),
  };
}
function parseInventory(value: unknown) {
  const o = object(value);
  if (o.formatVersion !== 1) throw new Error("unsupported inventory format");
  return {
    pins: pins(o.source),
    coordinates: array(o.coordinates, value => {
      const r = object(value);
      return {
        coordinate: nonempty(r.coordinate), kind: nonempty(r.kind),
        scope: choice(r.scope, ["internal", "public-candidate"]),
        operations: array(r.operations ?? [], value => choice(value, ["query", "mutation", "subscription"])),
      };
    }),
  };
}

/**
 * Reviewed evidence, not an assertion detector or live runner. A record attests
 * only its exact coordinate/binding; structural roots never cover sibling fields.
 * Hashes pin source bytes. Literal test anchors aid review, not execution proof.
 * Non-graphql "complete" attests a separately reviewed, gap-free reconciliation.
 * Passing this prerequisite does not establish generation or exact-head CI.
 */
export async function evaluate(inventoryValue: unknown, ledgerValue: unknown, read: Reader) {
  const inventory = parseInventory(inventoryValue), ledger = parseLedger(ledgerValue);
  for (const key of ["sdkVersion", "schemaSha256", "snapshotSha256"] as const)
    if (inventory.pins[key] !== ledger.pins[key]) throw new Error(`stale coverage pin: ${key}`);
  const coordinates = new Map<string, Coordinate>();
  for (const row of inventory.coordinates) {
    if (coordinates.has(row.coordinate)) throw new Error(`duplicate inventory coordinate: ${row.coordinate}`);
    coordinates.set(row.coordinate, row);
  }
  const records = new Map<string, Row>();
  const cache = new Map<string, Promise<string>>();
  async function verify(reference: Ref, anchor?: string) {
    let source = cache.get(reference.file);
    if (!source) { source = read(reference.file); cache.set(reference.file, source); }
    const bytes = await source;
    if (digest(bytes) !== reference.sha256) throw new Error(`stale source: ${reference.file}`);
    if (anchor && !bytes.includes(anchor)) throw new Error(`missing test anchor: ${reference.file}: ${anchor}`);
  }
  for (const r of ledger.records) {
    if (records.has(r.coordinate)) throw new Error(`duplicate coverage coordinate: ${r.coordinate}`);
    const c = coordinates.get(r.coordinate);
    if (!c) throw new Error(`unknown coverage coordinate: ${r.coordinate}`);
    if ((c.scope === "internal") !== (r.classification === "internal"))
      throw new Error(`scope contradiction: ${r.coordinate}`);
    if (c.operations.includes("subscription") && r.classification === "upstream-unavailable")
      throw new Error(`unsupported subscription is not upstream-unavailable: ${r.coordinate}`);
    if (r.classification !== "public-candidate" && !r.sources.length)
      throw new Error(`classification requires sources: ${r.coordinate}`);
    if (r.binding && !r.binding.sources.length) throw new Error(`binding requires sources: ${r.coordinate}`);
    if (r.auth.status === "reviewed" &&
        (!r.auth.sources.length || [r.auth.credential, r.auth.scopes, r.auth.plan, r.auth.ownership]
          .some(v => !v.trim() || v.trim().toLowerCase() === "unknown")))
      throw new Error(`reviewed auth requires explicit requirements: ${r.coordinate}`);
    if (r.live.status === "verified" &&
        (!r.live.sources.length || [r.live.scenario, r.live.revision, r.live.run].some(v => !v.trim())))
      throw new Error(`verified live evidence requires scenario, revision, run and sources: ${r.coordinate}`);
    for (const reference of [...r.sources, ...(r.binding?.sources ?? []), ...r.auth.sources, ...r.live.sources])
      await verify(reference);
    for (const evidence of r.evidence) await verify(evidence, evidence.test);
    records.set(r.coordinate, r);
  }
  if (ledger.nonGraph.status === "complete" && !ledger.nonGraph.sources.length)
    throw new Error("complete nonGraph requires reconciliation sources");
  for (const reference of ledger.nonGraph.sources) await verify(reference);
  const rows = [...coordinates.values()].sort((a, b) => a.coordinate < b.coordinate ? -1 : a.coordinate > b.coordinate ? 1 : 0).map(c => {
    const r = records.get(c.coordinate);
    const classification = r?.classification ?? (c.scope === "internal" ? "internal" : "public-candidate");
    const separate = classification === "internal" || classification === "upstream-unavailable";
    const gaps: string[] = [];
    if (!separate) {
      if (classification !== "supported-public") gaps.push("classification");
      if (r?.implementation !== "implemented") gaps.push("implementation");
      if (!r?.binding) gaps.push("binding");
      if (!r?.evidence.some(e => e.kind === "contract")) gaps.push("contract-evidence");
      if (r?.auth.status !== "reviewed") gaps.push("auth-requirements");
      if (r?.live.status !== "verified") gaps.push("live-verification");
      if (c.operations.includes("subscription")) gaps.push("unsupported-subscription");
    }
    return {
      coordinate: c.coordinate, kind: c.kind, classification,
      implementation: r?.implementation ?? "unclassified",
      binding: r?.binding ?? null, evidence: r?.evidence ?? [],
      auth: r?.auth ?? null, live: r?.live ?? null,
      reason: r?.reason ?? "no reviewed ledger record", separate, gaps,
    };
  });
  const counts: Record<string, { total: number; unresolved: number; internal: number; unavailable: number }> = Object.create(null);
  for (const row of rows) {
    const count = counts[row.kind] ??= { total: 0, unresolved: 0, internal: 0, unavailable: 0 };
    count.total++;
    if (row.gaps.length) count.unresolved++;
    if (row.classification === "internal") count.internal++;
    if (row.classification === "upstream-unavailable") count.unavailable++;
  }
  return {
    scope: "coverage-prerequisite-only",
    pins: ledger.pins, nonGraph: ledger.nonGraph, counts,
    accepted: ledger.nonGraph.status === "complete" && rows.every(row => !row.gaps.length),
    rows,
  };
}
export function requireAcceptance(report: Awaited<ReturnType<typeof evaluate>>) {
  if (!report.accepted) throw new Error("coverage prerequisite incomplete; this is not full task 0098 release acceptance");
}
export async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || !["--check", "--accept", "--report"].includes(args[0]!))
    throw new Error("use --check, --accept or --report");
  await checkInventory(["--check"]);
  const root = new URL("../../", import.meta.url);
  const read: Reader = file => readFile(new URL(file, root), "utf8");
  const report = await evaluate(
    JSON.parse(await read("packages/codegen/api-inventory.json")),
    JSON.parse(await read("packages/codegen/api-coverage.json")), read,
  );
  const { rows, ...summary } = report;
  console.log(JSON.stringify(args[0] === "--report" ? report : summary, null, 2));
  if (args[0] === "--accept") requireAcceptance(report);
}
if (import.meta.main) main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
