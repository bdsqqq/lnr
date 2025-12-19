import { describe, test, expect } from "bun:test";
import { cli } from "./helpers";

describe("auth", () => {
  test("li auth --whoami returns current user info", async () => {
    const { stdout, stderr, exitCode } = await cli("auth", "--whoami");

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toMatch(/.+<.+@.+>/); // format: Name <email>
  });
});
