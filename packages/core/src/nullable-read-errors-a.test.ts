import { expect, mock, test } from "bun:test";
import type { LinearClient } from "@linear/sdk";
import { getView, getViewById, getViewPreferences } from "./views";
import { getTemplate } from "./templates";
import { getLabel } from "./labels";
import { getDocument } from "./documents";

const dates = { createdAt: new Date(0), updatedAt: new Date(1) };
const view = { id: "view-id", name: "Example", description: "", icon: undefined,
  color: undefined, filterData: {}, shared: false, ...dates };
const template = { id: "template-id", name: "Example", type: "issue", description: "", ...dates };
const label = { id: "label-id", name: "Example", color: "#000", description: "" };
const doc = { id: "doc-id", title: "Example", content: "", url: "https://example.com", ...dates };
const emptyValues = { issueGrouping: null, showCompletedIssues: null, viewOrdering: null };
const prefs = { id: "prefs-id", type: "user", viewType: "issues", ...dates,
  preferences: { issueGrouping: "status", showCompletedIssues: "all", viewOrdering: "priority" } };

const cases = [
  { name: "view", phases: ["root"], read: (c: LinearClient, target: string) => getView(c, target) },
  { name: "view-id", phases: ["root"], read: (c: LinearClient, target: string) => getViewById(c, target) },
  { name: "preferences", phases: ["root", "user", "organization", "effective"], read: (c: LinearClient, target: string) => getViewPreferences(c, target) },
  { name: "template", phases: ["root", "templates", "later-team"], read: (c: LinearClient, target: string) => getTemplate(c, target) },
  { name: "scoped-template", phases: ["root", "templates"], read: (c: LinearClient, target: string) => getTemplate(c, target, "eng") },
  { name: "label", phases: ["root"], read: (c: LinearClient, target: string) => getLabel(c, target) },
  { name: "document", phases: ["root", "project"], read: (c: LinearClient, target: string) => getDocument(c, target) },
];

function fixture(name: string, phase: string, error?: unknown) {
  const relation = mock((key: string, value: unknown) => phase === key ? Promise.reject(error) : Promise.resolve(value));
  const templates = mock(async () => {
    if (phase === "templates") throw error;
    return { nodes: phase === "missing" ? [] : [template] };
  });
  const laterTemplates = mock(async () => {
    if (phase === "later-team") throw error;
    return { nodes: [] };
  });
  const root = mock(async (..._args: unknown[]) => {
    if (phase === "root") throw error;
    const absent = phase === "missing";
    switch (name) {
      case "view": return { nodes: absent ? [] : [view] };
      case "view-id": return absent ? null : view;
      case "preferences": return absent ? null : {
        get userViewPreferences() { return relation("user", phase === "populated" ? prefs : null); },
        get organizationViewPreferences() { return relation("organization", phase === "populated" ? prefs : undefined); },
        get viewPreferencesValues() { return relation("effective", phase === "populated" ? prefs.preferences : null); },
      };
      case "template":
      case "scoped-template": return { nodes: phase === "missing-team" ? [] :
        [{ key: "ENG", templates }, ...(name === "template" ? [{ key: "OPS", templates: laterTemplates }] : [])] };
      case "label": return absent ? null : label;
      default: return absent ? null : { ...doc,
        get project() { return relation("project", phase === "populated" ? { name: "Project" } : null); } };
    }
  });
  const method = name === "view" ? "customViews" :
    name === "view-id" || name === "preferences" ? "customView" :
    name.includes("template") ? "teams" : name === "label" ? "issueLabel" : "document";
  const client = { [method]: root } as unknown as LinearClient;
  const calls = (target: string) => name === "view" || name === "template" ? [[]] :
    name === "scoped-template" ? [[{ filter: { key: { eq: "ENG" } } }]] : [[target]];
  const assertRelations = () => {
    // Preference promises are started together; rejection must not suppress siblings.
    expect(relation.mock.calls.map(([key]) => key)).toEqual(
      ["root", "missing"].includes(phase) ? [] :
      name === "preferences" ? ["user", "organization", "effective"] :
      name === "document" ? ["project"] : [],
    );
  };
  return { client, root, templates, laterTemplates, calls, assertRelations };
}

for (const entry of cases) {
  for (const phase of entry.phases) {
    for (const error of [new Error("network unavailable"), { reason: "opaque rejection" }]) {
      test(`${entry.name} ${phase} preserves rejection identity`, async () => {
        const f = fixture(entry.name, phase, error);
        await expect(entry.read(f.client, "Example")).rejects.toBe(error);
        expect(f.root.mock.calls).toEqual(f.calls("Example"));
        expect(f.templates.mock.calls).toEqual(entry.name.includes("template") && phase !== "root" ? [[]] : []);
        expect(f.laterTemplates.mock.calls).toEqual(phase === "later-team" ? [[]] : []);
        f.assertRelations();
      });
    }
  }
  for (const phase of ["present", "populated", "missing",
    ...(entry.name.includes("template") ? ["missing-team", "unmatched"] : []),
    ...(entry.name === "view" ? ["unmatched"] : [])]) {
    test(`${entry.name} ${phase} preserves payload and absence`, async () => {
      const f = fixture(entry.name, phase);
      const target = phase === "unmatched" ? "unknown" : "eXaMpLe";
      const expected = ["missing", "missing-team", "unmatched"].includes(phase) ? null :
        entry.name === "view" || entry.name === "view-id" ? view :
        entry.name.includes("template") ? { ...template, teamKey: "ENG" } :
        entry.name === "label" ? label :
        entry.name === "document" ? { ...doc, project: phase === "populated" ? "Project" : null } :
        phase === "populated" ? { user: prefs, organization: prefs, effective: prefs.preferences } :
        { user: null, organization: null, effective: emptyValues };
      expect(await entry.read(f.client, target)).toEqual(expected);
      expect(f.root.mock.calls).toEqual(f.calls(target));
      expect(f.templates.mock.calls).toEqual(entry.name.includes("template") && phase !== "missing-team" ? [[]] : []);
      expect(f.laterTemplates.mock.calls).toEqual(entry.name === "template" && phase !== "missing-team" ? [[]] : []);
      f.assertRelations();
    });
  }
}
