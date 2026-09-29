import { expect, mock, test } from "bun:test";
import type { LinearClient } from "@linear/sdk";
import { listViews } from "./views";
import { listTemplates } from "./templates";

const item = {
  id: "item", name: "example", type: "issue", description: undefined,
  createdAt: new Date(0), updatedAt: new Date(0),
};

for (const message of ["permission denied", "network unavailable"]) {
  test(`views preserves collection error identity: ${message}`, async () => {
    const error = new Error(message);
    const customViews = mock(async () => { throw error; });
    await expect(listViews({ customViews } as unknown as LinearClient)).rejects.toBe(error);
    expect(customViews).toHaveBeenCalledTimes(1);
  });
  for (const scoped of [false, true]) {
    for (const phase of ["lookup", "connection", "later"] as const) {
      if (scoped && phase === "later") continue;
      test(`templates ${scoped ? "scoped" : "all"} ${phase} preserves identity: ${message}`, async () => {
        const error = new Error(message);
        const first = mock(async () => ({ nodes: [item] }));
        const failing = mock(async () => { throw error; });
        const teams = mock(async (..._args: unknown[]) => {
          if (phase === "lookup") throw error;
          return { nodes: [
            ...(phase === "later" ? [{ key: "FIRST", templates: first }] : []),
            { key: "ENG", templates: failing },
          ] };
        });
        await expect(listTemplates({ teams } as unknown as LinearClient, scoped ? "eng" : undefined)).rejects.toBe(error);
        expect(teams).toHaveBeenCalledTimes(1);
        expect(teams.mock.calls[0]).toEqual(scoped ? [{ filter: { key: { eq: "ENG" } } }] : []);
        expect(first).toHaveBeenCalledTimes(phase === "later" ? 1 : 0);
        expect(failing).toHaveBeenCalledTimes(phase === "lookup" ? 0 : 1);
      });
    }
  }
}

test("views preserves empty and populated payloads", async () => {
  const view = { ...item, icon: "icon", color: "blue", shared: false, filterData: { test: true } };
  for (const nodes of [[], [view]]) {
    const client = { customViews: async () => ({ nodes }) } as unknown as LinearClient;
    expect(await listViews(client)).toEqual(nodes.map(({ type, ...v }) => v));
  }
});
for (const scoped of [false, true]) {
  test(`templates ${scoped ? "scoped" : "all"} preserves empty teams, connections and payloads`, async () => {
    for (const nodes of [[], [item]]) {
      const client = { teams: async () => ({ nodes: [
        { key: "ENG", templates: async () => ({ nodes }) },
      ] }) } as unknown as LinearClient;
      expect(await listTemplates(client, scoped ? "eng" : undefined)).toEqual(
        nodes.map(t => ({ ...t, description: null, teamKey: "ENG" })),
      );
    }
    expect(await listTemplates({ teams: async () => ({ nodes: [] }) } as unknown as LinearClient,
      scoped ? "missing" : undefined)).toEqual([]);
  });
}
