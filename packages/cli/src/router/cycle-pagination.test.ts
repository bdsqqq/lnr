import { expect, mock, spyOn, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const core = await import("@bdsqqq/lnr-core");
const cycle = (number: number) => ({
  id: `cycle-${number}`, number, name: `Sprint ${number}`, description: "",
  startsAt: new Date(0), endsAt: new Date(1), completedAt: undefined, progress: 0,
});
let failure: Error | undefined;
const connection = {
  nodes: [cycle(1)], pageInfo: { hasNextPage: true, endCursor: "a" },
  fetchNext: mock(async () => {
    if (failure) throw failure;
    connection.nodes = [...connection.nodes, cycle(2)];
    connection.pageInfo.hasNextPage = false;
    return connection;
  }),
};
const cycles = mock(async () => connection);
const team = mock(async (..._args: unknown[]) => ({ cycles }));
mock.module("@bdsqqq/lnr-core", () => ({
  ...core, getClient: () => ({ team }), getConfigValue: () => "table",
}));
const { appRouter } = await import("./index");
const outcomes = [
  undefined,
  { message: "network unavailable", code: 1, diagnostic: "network unavailable" },
  { message: "unauthorized", code: 2, diagnostic: "not authenticated" },
  { message: "permission denied", code: 5, diagnostic: "requires a Linear Business or Enterprise plan" },
  { message: "rate limit exceeded", code: 4, diagnostic: "rate limited" },
];
for (const command of ["cycles", "name", "number"]) {
  for (const format of ["table", "json", "quiet"]) {
    for (const outcome of outcomes) {
      test(`cycle pagination argv ${command} ${format} ${outcome?.message ?? "success"}`, async () => {
        failure = outcome ? new Error(outcome.message) : undefined;
        connection.nodes = [cycle(1)];
        connection.pageInfo = { hasNextPage: true, endCursor: "a" };
        for (const fn of [team, cycles, connection.fetchNext]) fn.mockClear();
        const stdout = spyOn(console, "log").mockImplementation(() => {});
        const stderr = spyOn(console, "error").mockImplementation(() => {});
        const exit = spyOn(process, "exit").mockImplementation((code): never => {
          throw new FailedToExitError("production exit", { exitCode: Number(code), cause: undefined });
        });
        const previous = process.exitCode;
        try {
          await expect(createCli({ router: appRouter }).run({
            argv: [...(command === "cycles" ? ["cycles"] : ["cycle", command === "name" ? "sPrInT 2" : "2"]),
              "--team", "ENG", ...(format === "table" ? [] : [`--${format}`])],
            logger: { info() {}, error() {} },
            process: { exit(code): never {
              throw new FailedToExitError("cli exit", { exitCode: code, cause: undefined });
            } },
          })).rejects.toMatchObject({ exitCode: outcome?.code ?? 0 });
          expect(team.mock.calls).toEqual([["ENG"]]);
          expect(cycles.mock.calls).toEqual([[]]);
          expect(connection.fetchNext.mock.calls).toEqual([[]]);
          if (outcome) {
            expect(exit.mock.calls).toEqual([[outcome.code]]);
            expect(stdout.mock.calls).toEqual([]);
            expect(stderr.mock.calls.flat().join(" ")).toContain(outcome.diagnostic);
            expect(stderr.mock.calls.flat().join(" ")).not.toContain("not found");
          } else {
            expect(exit).not.toHaveBeenCalled();
            expect(stderr.mock.calls).toEqual([]);
            if (format === "json") {
              const data = JSON.parse(String(stdout.mock.calls[0]?.[0]));
              expect(command === "cycles" ? data.map((c: { id: string }) => c.id) : data.id)
                .toEqual(command === "cycles" ? ["cycle-1", "cycle-2"] : "cycle-2");
            } else if (format === "quiet") expect(stdout.mock.calls.flat()).toEqual(command === "cycles" ? ["cycle-1", "cycle-2"] : ["cycle-2"]);
            else expect(stdout.mock.calls.flat().join(" ")).toContain("Sprint 2");
          }
        } finally {
          exit.mockRestore(); stdout.mockRestore(); stderr.mockRestore(); process.exitCode = previous;
        }
      });
    }
  }
}
