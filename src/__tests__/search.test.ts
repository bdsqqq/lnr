import { describe, it, expect } from "bun:test";
import { cli } from "./helpers";

describe("search", () => {
  it("li search <common-word> returns results", async () => {
    const { stdout, exitCode } = await cli("search", "issue");

    expect(exitCode).toBe(0);
    expect(stdout.length).toBeGreaterThan(0);
  });

  it("li search <query> --json outputs valid JSON", async () => {
    const { stdout, exitCode } = await cli("search", "issue", "--json");

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
  });
});
