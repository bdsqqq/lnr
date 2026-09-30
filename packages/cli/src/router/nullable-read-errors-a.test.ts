import { expect, mock, spyOn, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const core = await import("@bdsqqq/lnr-core");
let entity: string;
let phase: string;
let failure: Error | undefined;
const dates = { createdAt: new Date(0), updatedAt: new Date(1) };
const view = { id: "view-id", name: "Example", description: "", filterData: {}, shared: false, ...dates };
const template = { id: "template-id", name: "Example", type: "issue", description: "", ...dates };
const label = { id: "label-id", name: "Example", color: "#000", description: "" };
const doc = { id: "doc-id", title: "Example", content: "", url: "https://example.com", ...dates };
const relation = mock((key: string) => phase === key ? Promise.reject(failure) : Promise.resolve(null));
const templates = mock(async () => {
  if (phase === "templates") throw failure;
  return { nodes: phase === "missing" ? [] : [template] };
});
const laterTemplates = mock(async () => {
  if (phase === "later-team") throw failure;
  return { nodes: [] };
});
const root = mock(async (..._args: unknown[]) => {
  if (phase === "root") throw failure;
  if (entity === "view" || entity === "preferences") return { nodes: phase === "missing" ? [] : [view] };
  if (entity.includes("template")) return { nodes: phase === "missing-team" ? [] :
    [{ key: "ENG", templates }, ...(entity === "template" ? [{ key: "OPS", templates: laterTemplates }] : [])] };
  if (entity === "label") return phase === "missing" ? null : label;
  return phase === "missing" ? null : { ...doc, get project() { return relation("project"); } };
});
const customView = mock(async (..._args: unknown[]) => {
  if (phase === "preferences-root") throw failure;
  if (phase === "missing-preferences") return null;
  return {
    get userViewPreferences() { return relation("user"); },
    get organizationViewPreferences() { return relation("organization"); },
    get viewPreferencesValues() { return relation("effective"); },
  };
});
// Only client/config boundaries are stubbed: argv, helpers, rendering and classifier remain real.
mock.module("@bdsqqq/lnr-core", () => ({
  ...core,
  getClient: () => {
    if (entity === "preferences") return { customViews: root, customView };
    const method = entity === "view" ? "customViews" :
      entity.includes("template") ? "teams" : entity === "label" ? "issueLabel" : "document";
    return { [method]: root };
  },
  getConfigValue: () => "table",
}));
const { appRouter } = await import("./index");
const failures = [
  { message: "network unavailable", code: 1, diagnostic: "network unavailable" },
  { message: "unauthorized", code: 2, diagnostic: "not authenticated" },
  { message: "permission denied", code: 5, diagnostic: "requires a Linear Business or Enterprise plan" },
  { message: "rate limit exceeded", code: 4, diagnostic: "rate limited" },
  { message: "entity not accessible", code: 5, diagnostic: "requires a Linear Business or Enterprise plan" },
  { message: "entity not found", code: 3, diagnostic: "entity not found" },
];
for (const entry of [
  { name: "view", phases: ["root"], controls: ["missing", "unmatched"] },
  { name: "preferences", phases: ["root", "preferences-root", "user", "organization", "effective"], controls: ["missing", "missing-preferences"] },
  { name: "template", phases: ["root", "templates", "later-team"], controls: ["missing", "missing-team", "unmatched"] },
  { name: "scoped-template", phases: ["root", "templates"], controls: ["missing", "missing-team", "unmatched"] },
  { name: "label", phases: ["root"], controls: ["missing"] },
  { name: "doc", phases: ["root", "project"], controls: ["missing"] },
]) {
  for (const format of entry.name === "label" ? ["table", "json"] : ["table", "json", "quiet"]) {
    for (const scenario of [...entry.phases, ...entry.controls, "present"]) {
      for (const outcome of entry.phases.includes(scenario) ? failures : [undefined]) {
        test(`${entry.name} ${format} ${scenario} ${outcome?.message ?? "control"}`, async () => {
          entity = entry.name; phase = scenario; failure = outcome ? new Error(outcome.message) : undefined;
          for (const fn of [root, customView, templates, laterTemplates, relation]) fn.mockClear();
          const stdout = spyOn(console, "log").mockImplementation(() => {});
          const stderr = spyOn(console, "error").mockImplementation(() => {});
          const exit = spyOn(process, "exit").mockImplementation((code): never => {
            throw new FailedToExitError("production exit", { exitCode: Number(code), cause: undefined });
          });
          const previous = process.exitCode;
          const absent = entry.controls.includes(scenario);
          const code = outcome?.code ?? (absent ? scenario === "missing-preferences" ? 1 : 3 : 0);
          const target = scenario === "unmatched" ? "unknown" : "eXaMpLe";
          try {
            await expect(createCli({ router: appRouter }).run({
              argv: [entity === "preferences" ? "view" : entity === "scoped-template" ? "template" : entity, target,
                ...(entity === "preferences" ? ["--preferences"] : []),
                ...(entity === "scoped-template" ? ["--team", "eng"] : []),
                ...(format === "table" ? [] : [`--${format}`])],
              logger: { info() {}, error() {} },
              process: { exit(value): never {
                throw new FailedToExitError("cli exit", { exitCode: value, cause: undefined });
              } },
            })).rejects.toMatchObject({ exitCode: absent ? 1 : code });
            expect(root.mock.calls).toEqual(entity === "scoped-template"
              ? [[{ filter: { key: { eq: "ENG" } } }]]
              : ["view", "preferences", "template"].includes(entity) ? [[]] : [[target]]);
            expect(customView.mock.calls).toEqual(entity === "preferences" && !["root", "missing"].includes(scenario) ? [["view-id"]] : []);
            expect(templates.mock.calls).toEqual(entity.includes("template") && !["root", "missing-team"].includes(scenario) ? [[]] : []);
            expect(laterTemplates.mock.calls).toEqual(entity === "template" && !["root", "missing-team", "templates"].includes(scenario) ? [[]] : []);
            // Preferences use Promise.all; document.project is only reached after its root succeeds.
            expect(relation.mock.calls).toEqual(
              entity === "preferences" && !["root", "missing", "preferences-root", "missing-preferences"].includes(scenario)
                ? [["user"], ["organization"], ["effective"]] :
              entity === "doc" && !["root", "missing"].includes(scenario) ? [["project"]] : [],
            );
            if (code) {
              expect(exit.mock.calls).toEqual(absent ? [[code], [1]] : [[code]]);
              expect(stdout.mock.calls).toEqual([]);
              const diagnostic = stderr.mock.calls.flat().join(" ");
              expect(diagnostic).toContain(outcome?.diagnostic ?? (scenario === "missing-preferences" ? "no preferences found" : "not found"));
              if (outcome && outcome.code !== 3) {
                expect(diagnostic).not.toContain("not found");
                expect(diagnostic).not.toContain("no preferences found");
              }
            } else {
              expect(exit).not.toHaveBeenCalled();
              expect(stderr.mock.calls).toEqual([]);
              if (format === "json") {
                expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toMatchObject(
                  entity === "preferences" ? { user: null, organization: null,
                    effective: { issueGrouping: null, showCompletedIssues: null, viewOrdering: null } } :
                  entity === "doc" ? { id: "doc-id", content: "", project: null } :
                  entity.includes("template") ? { id: "template-id", teamKey: "ENG", description: "" } :
                  entity === "view" ? { id: "view-id", shared: false, filterData: {} } : label,
                );
              } else if (format === "quiet" && entity !== "preferences") {
                expect(stdout.mock.calls).toEqual([[entity.includes("template") ? "template-id" : `${entity}-id`]]);
              } else if (format === "table") expect(stdout.mock.calls.length).toBeGreaterThan(0);
            }
          } finally {
            exit.mockRestore(); stdout.mockRestore(); stderr.mockRestore(); process.exitCode = previous;
          }
        });
      }
    }
  }
}
