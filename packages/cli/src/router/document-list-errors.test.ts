import { expect, mock, spyOn, test } from "bun:test";
import { createCli, FailedToExitError } from "trpc-cli";

const core = await import("@bdsqqq/lnr-core");
let phase: string;
let failure: Error | undefined;
const documents = mock(async (..._args: unknown[]) => {
  if (phase === "connection") throw failure;
  return { nodes: phase === "empty" ? [] : [{
    id: "doc", title: "example", content: "body", url: "https://example.com",
    createdAt: new Date(0), updatedAt: new Date(0),
    get project() { return phase === "project" ? Promise.reject(failure) : Promise.resolve({ name: "project" }); },
  }] };
});
// Keep real list mapping, output rendering, and production error classification.
mock.module("@bdsqqq/lnr-core", () => ({
  ...core, getClient: () => ({ documents }), getConfigValue: () => "table",
}));
const { appRouter } = await import("./index");
const failures = [
  { message: "network unavailable", code: 1, diagnostic: "network unavailable" },
  { message: "unauthorized", code: 2, diagnostic: "not authenticated" },
  { message: "rate limit exceeded", code: 4, diagnostic: "rate limited" },
  { message: "permission denied", code: 5, diagnostic: "requires a Linear Business or Enterprise plan" },
];
for (const format of ["json", "quiet", "table"]) {
  for (const scenario of ["connection", "project", "empty", "populated"]) {
    for (const outcome of ["empty", "populated"].includes(scenario) ? [undefined] : failures) {
      test(`docs ${format} ${scenario} ${outcome?.message ?? "success"}`, async () => {
        phase = scenario;
        failure = outcome ? new Error(outcome.message) : undefined;
        documents.mockClear();
        const stdout = spyOn(console, "log").mockImplementation(() => {});
        const stderr = spyOn(console, "error").mockImplementation(() => {});
        const exit = spyOn(process, "exit").mockImplementation((code): never => {
          throw new FailedToExitError("production exit", { exitCode: Number(code), cause: undefined });
        });
        const previous = process.exitCode;
        try {
          await expect(createCli({ router: appRouter }).run({
            argv: ["docs", ...(format === "table" ? [] : [`--${format}`])],
            logger: { info() {}, error() {} },
            process: { exit(code): never {
              throw new FailedToExitError("cli exit", { exitCode: code, cause: undefined });
            } },
          })).rejects.toMatchObject({ exitCode: outcome?.code ?? 0 });
          expect(documents.mock.calls).toEqual([[{ filter: undefined }]]);
          if (outcome) {
            expect(exit.mock.calls).toEqual([[outcome.code]]);
            expect(stderr.mock.calls.flat().join(" ")).toContain(outcome.diagnostic);
            expect(stdout.mock.calls).toEqual([]);
          } else {
            expect(exit).not.toHaveBeenCalled();
            expect(stderr.mock.calls).toEqual([]);
            if (format === "json") {
              expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toEqual(scenario === "empty" ? [] : [{
                id: "doc", title: "example", content: "body", url: "https://example.com",
                createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), project: "project",
              }]);
            } else if (format === "quiet") {
              expect(stdout.mock.calls).toEqual(scenario === "empty" ? [] : [["doc"]]);
            } else {
              expect(stdout.mock.calls).toHaveLength(1);
              expect(String(stdout.mock.calls[0]?.[0])).toContain(scenario === "empty" ? "no results" : "example");
            }
          }
        } finally {
          exit.mockRestore(); stdout.mockRestore(); stderr.mockRestore();
          process.exitCode = previous;
        }
      });
    }
  }
}
