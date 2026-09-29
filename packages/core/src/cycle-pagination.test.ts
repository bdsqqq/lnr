import { expect, mock, spyOn, test } from "bun:test";
import { LinearClient } from "@linear/sdk";
import { getCycle, listCycles } from "./cycles";

const node = (number: number) => ({
  id: `cycle-${number}`, number, name: `Sprint ${number}`, description: "",
  startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-01-08T00:00:00.000Z",
  completedAt: null, progress: 0,
});
const page = (numbers: number[], hasNextPage: boolean, endCursor?: string | null) => ({
  nodes: numbers.map(node),
  pageInfo: { hasNextPage, hasPreviousPage: false, startCursor: "start", endCursor },
});

for (const mode of ["list", "name", "number", "missing", "empty-initial", "terminal-repeat", "terminal-empty", "terminal-null", "first-single", "later-null", "later-omitted", "missing-cursor", "same-cursor", "cursor-cycle"]) {
  test(`real SDK cycle pagination: ${mode}`, async () => {
    const pages = mode === "missing-cursor" ? [page([], true)]
      : mode === "same-cursor" ? [page([1], true, "a"), page([], true, "a")]
      : mode === "cursor-cycle" ? [page([1], true, "a"), page([], true, "b"), page([], true, "a")]
      : mode === "terminal-repeat" ? [page([1], true, "a"), page([2], false, "a")]
      : mode === "terminal-empty" ? [page([1], true, "a"), page([], false)]
      : mode === "terminal-null" ? [page([1], true, "a"), page([2], false, null)]
      : mode === "first-single" ? [page([1], true, "start"), page([2], false)]
      : mode === "later-null" ? [page([1], true, "a"), page([2], true, null)]
      : mode === "later-omitted" ? [page([1], true, "a"), page([2], true)]
      : [page(mode === "empty-initial" ? [] : [1], true, "a"), page([], true, "b"), page([2], false)];
    const requests: Record<string, unknown>[] = [];
    let index = 0;
    const transport = spyOn(globalThis, "fetch").mockImplementation(Object.assign(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        requests.push(body.variables);
        if (body.query.includes("query team_cycles(")) {
          // Bounded fixture: a missing guard fails, rather than hanging or using a network fallback.
          if (index >= pages.length) throw new Error("unexpected extra page request");
          return Response.json({ data: { team: { cycles: pages[index++] } } });
        }
        expect(body.query).toContain("query team(");
        return Response.json({ data: { team: { id: "team-id" } } });
      }, { preconnect() { throw new Error("unexpected preconnect"); } },
    ));
    try {
      const client = new LinearClient({ apiKey: "fixture", apiUrl: "http://localhost:1/graphql" });
      const result = ["name", "number", "missing"].includes(mode)
        ? getCycle(client, "ENG", mode === "name" ? "sPrInT 2" : mode === "number" ? "2" : "absent")
        : listCycles(client, "ENG");
      if (["missing-cursor", "same-cursor", "cursor-cycle", "later-null", "later-omitted"].includes(mode)) {
        await expect(result).rejects.toThrow("cycle pagination did not advance");
      } else if (mode === "missing") expect(await result).toBeNull();
      else if (["name", "number"].includes(mode)) expect(await result).toMatchObject({ id: "cycle-2", number: 2 });
      else {
        const numbers = mode === "empty-initial" ? [2] : mode === "terminal-empty" ? [1] : [1, 2];
        expect(await result).toEqual(numbers.map(number => ({
          ...node(number), startsAt: new Date(node(number).startsAt), endsAt: new Date(node(number).endsAt),
          completedAt: undefined,
        })));
      }
      expect(index).toBe(pages.length);
      expect(requests).toEqual([
        { id: "ENG" }, { id: "team-id" },
        ...pages.slice(0, -1).map(p => ({ id: "team-id", after: p.pageInfo.endCursor, first: 50 })),
      ]);
    } finally { transport.mockRestore(); }
  });
}

for (const lookup of [false, true]) {
  test(`later-page failure preserves identity even with early match: ${lookup}`, async () => {
    const error = new Error("permission denied");
    const fetchNext = mock(async () => { throw error; });
    const cycles = mock(async () => ({
      nodes: [node(1)], pageInfo: { hasNextPage: true, endCursor: "a" }, fetchNext,
    }));
    const team = mock(async () => ({ cycles }));
    const client = { team } as unknown as LinearClient;
    await expect(lookup ? getCycle(client, "ENG", "1") : listCycles(client, "ENG")).rejects.toBe(error);
    expect(team.mock.calls).toHaveLength(1);
    expect(cycles.mock.calls).toEqual([[]]);
    expect(fetchNext.mock.calls).toEqual([[]]);
  });
}
