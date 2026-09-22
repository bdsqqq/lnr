import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateInventory, main } from "./api-inventory";

const sdl = `
schema { query: Read mutation: Write subscription: Watch }
interface Named { name: String! }
type Node implements Named {
  name: String!
  peers(limit: Int = 2): [Node!]!
  """[Internal] restricted"""
  secret: String
  """internal notes for customers"""
  notes: String
  _dummy: Boolean
}
union Result = Node
enum Mode { ON OLD @deprecated(reason: "use ON") }
input Orphan { mode: Mode = ON }
type Read {
  node(flag: Boolean = false, nil: String = null, ids: [ID!] = ["b", "a"]): Node
  result: Result
  old: String @deprecated(reason: "use node")
  cycleCreate: Boolean @deprecated(reason: "Cycle creation is not supported.")
  """[Internal] restricted"""
  hidden(arg: Boolean): Boolean
}
type Write {
  cycleCreate: Boolean @deprecated(reason: "Cycle creation is not supported.")
  cycleCreateOther: Boolean @deprecated(reason: "Cycle creation is not supported.")
}
type Watch { changed: Node }
`;
function provenance(text = sdl) {
  return {
    source: "sdk-release" as const, sdkVersion: "fixture", commit: "fixture",
    sourceSha256: "fixture", url: "https://example.invalid/schema.graphql",
    schemaSha256: createHash("sha256").update(text).digest("hex"),
  };
}
function rows(text = sdl) {
  const inventory = JSON.parse(generateInventory(text, provenance(text), "fixture.graphql"));
  return new Map<string, any>(inventory.coordinates.map((row: any) => [row.coordinate, row]));
}

test("stable coordinates retain roots, wrappers, defaults, references and source lines", () => {
  const bytes = generateInventory(sdl, provenance());
  expect(generateInventory(sdl, provenance())).toBe(bytes);
  expect(JSON.parse(bytes).source.kind).toBe("sdk-release");
  expect(JSON.parse(bytes).roots).toEqual({ query: "Read", mutation: "Write", subscription: "Watch" });
  const r = rows();
  for (const [coordinate, value] of [
    ["Read.node(flag:)", "false"], ["Read.node(nil:)", "null"], ["Read.node(ids:)", '["b", "a"]'],
  ]) expect(r.get(coordinate!).defaultValue).toBe(value);
  expect(r.get("Read.hidden(arg:)").defaultValue).toBeNull();
  expect(r.get("Read.node(ids:)").type).toBe("[ID!]");
  expect(r.get("Node.peers").type).toBe("[Node!]!");
  expect(r.get("Node.peers(limit:)").defaultValue).toBe("2");
  expect(r.get("Node").interfaces).toEqual(["Named"]);
  expect(r.get("Named").possibleTypes).toEqual(["Node"]);
  expect(r.get("Result").possibleTypes).toEqual(["Node"]);
  expect(r.get("Watch.changed").operations).toEqual(["subscription"]);
  expect(r.get("Node.peers").source).toEqual({ file: "fixture.graphql", line: 6, location: "definition" });
  expect(JSON.parse(bytes).coordinates.map((r: any) => r.coordinate)).toEqual([...r.keys()].sort());
});

test("scope and deprecation do not fabricate coverage", () => {
  const r = rows();
  for (const key of ["Node.secret", "Node._dummy", "Read.hidden", "Read.hidden(arg:)"])
    expect(r.get(key).scope).toBe("internal");
  for (const key of ["Node.notes", "Orphan", "Orphan.mode", "Watch.changed"])
    expect(r.get(key).scope).toBe("public-candidate");
  expect(r.get("Read.old").deprecated).toBe(true);
  expect(r.get("Mode.OLD").deprecationReason).toBe("use ON");
  expect(r.get("Write.cycleCreate").coverage.status).toBe("upstream-unavailable");
  for (const [key, row] of r) if (key !== "Write.cycleCreate") expect(row.coverage).toEqual({ status: "unclassified" });
  for (const reason of ["use another mutation", "Cycle creation is not supported. "])
    expect(rows(sdl.replaceAll("Cycle creation is not supported.", reason)).get("Write.cycleCreate").coverage.status).toBe("unclassified");
  expect(() => generateInventory(`${sdl}\n`, provenance())).toThrow("provenance");
});

test("check preserves missing, corrupt and valid outputs and detects changed source", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lnr-inventory-"));
  const schema = join(dir, "schema.graphql"), metadata = join(dir, "provenance.json"), output = join(dir, "inventory.json");
  const args = ["--schema", schema, "--provenance", metadata, "--output", output];
  try {
    await writeFile(schema, sdl);
    await writeFile(metadata, JSON.stringify(provenance()));
    await expect(main([...args, "--check"])).rejects.toThrow("inventory missing");
    await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
    await writeFile(output, "{ corrupt\n");
    await expect(main([...args, "--check"])).rejects.toThrow("inventory stale");
    expect(await readFile(output, "utf8")).toBe("{ corrupt\n");
    await main(args);
    const before = await readFile(output, "utf8");
    await main([...args, "--check"]);
    expect(await readFile(output, "utf8")).toBe(before);
    const changed = sdl.replace("old: String", "added: Int\n  old: String");
    await writeFile(schema, changed);
    await writeFile(metadata, JSON.stringify(provenance(changed)));
    await expect(main([...args, "--check"])).rejects.toThrow("inventory stale");
    expect(await readFile(output, "utf8")).toBe(before);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
