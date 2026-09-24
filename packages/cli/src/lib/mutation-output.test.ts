import { expect, test } from "bun:test";
import { validateMutationOutput } from "./mutation-output";

test("omitted and false flags retain default acknowledgements", () => {
  expect(() => validateMutationOutput("write", {})).not.toThrow();
  expect(() => validateMutationOutput("write", { json: false, quiet: false, verbose: false })).not.toThrow();
});
test("unsupported explicit modes reject", () => {
  for (const mode of ["json", "quiet", "verbose"] as const) {
    expect(() => validateMutationOutput("write", { [mode]: true }))
      .toThrow(`--${mode} is not supported for write; omit --${mode}`);
  }
});
test("supported modes remain selectable but cannot hide other modes", () => {
  for (const mode of ["json", "quiet"] as const) {
    expect(() => validateMutationOutput("batch", { [mode]: true }, ["json", "quiet"])).not.toThrow();
  }
  expect(() => validateMutationOutput("batch", { json: true, quiet: true }, ["json", "quiet"]))
    .toThrow("choose one output mode");
  expect(() => validateMutationOutput("batch", { json: true, verbose: true }, ["json", "quiet"]))
    .toThrow("--verbose is not supported");
});
