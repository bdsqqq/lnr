import { describe, test, expect, beforeAll } from "bun:test";
import { cli, getFirstTeamKey } from "./helpers";

describe("cycles", () => {
  let teamKey: string;

  beforeAll(async () => {
    teamKey = await getFirstTeamKey();
  });

  describe("li cycles --team <key>", () => {
    test("lists cycles or shows no results", async () => {
      const { stdout, exitCode } = await cli("cycles", "--team", teamKey);

      expect(exitCode).toBe(0);
      if (stdout.includes("no results")) {
        expect(stdout).toContain("no results");
      } else {
        expect(stdout).toContain("#");
        expect(stdout).toContain("NAME");
        expect(stdout).toContain("START");
        expect(stdout).toContain("END");
      }
    });

    test("--json outputs valid json", async () => {
      const { stdout, exitCode } = await cli("cycles", "--team", teamKey, "--json");

      expect(exitCode).toBe(0);
      const data = JSON.parse(stdout);
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0]).toHaveProperty("id");
        expect(data[0]).toHaveProperty("number");
        expect(data[0]).toHaveProperty("startsAt");
        expect(data[0]).toHaveProperty("endsAt");
      }
    });

    test("--quiet outputs ids only", async () => {
      const { stdout, exitCode } = await cli("cycles", "--team", teamKey, "--quiet");

      expect(exitCode).toBe(0);
      expect(stdout).not.toContain("#");
      expect(stdout).not.toContain("NAME");
    });

    test("exits with error for invalid team key", async () => {
      const { stderr, exitCode } = await cli("cycles", "--team", "INVALID_TEAM_KEY_XYZ");

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("not found");
    });
  });

  describe("li cycle --current --team <key>", () => {
    test("shows current cycle if exists or errors gracefully", async () => {
      const { stdout, stderr, exitCode } = await cli("cycle", "--current", "--team", teamKey);

      if (exitCode === 0) {
        expect(stdout).toContain("cycle");
        expect(stdout).toContain("start:");
        expect(stdout).toContain("end:");
      } else {
        expect(stderr).toContain("no active cycle");
      }
    });

    test("--json outputs valid json if current cycle exists", async () => {
      const { stdout, stderr, exitCode } = await cli("cycle", "--current", "--team", teamKey, "--json");

      if (exitCode === 0) {
        const data = JSON.parse(stdout);
        expect(data).toHaveProperty("id");
        expect(data).toHaveProperty("number");
        expect(data).toHaveProperty("startsAt");
        expect(data).toHaveProperty("endsAt");
      } else {
        expect(stderr).toContain("no active cycle");
      }
    });

    test("exits with error for invalid team key", async () => {
      const { stderr, exitCode } = await cli("cycle", "--current", "--team", "INVALID_TEAM_KEY_XYZ");

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("not found");
    });
  });
});
