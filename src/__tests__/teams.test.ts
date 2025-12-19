import { describe, test, expect, beforeAll } from "bun:test";
import { cli, getFirstTeamKey } from "./helpers";

describe("teams", () => {
  let teamKey: string;

  beforeAll(async () => {
    teamKey = await getFirstTeamKey();
  });

  describe("li teams", () => {
    test("lists teams", async () => {
      const { stdout, exitCode } = await cli("teams");

      expect(exitCode).toBe(0);
      expect(stdout).toContain(teamKey);
      expect(stdout.trim().split("\n").length).toBeGreaterThan(0);
    });

    test("--json outputs valid json", async () => {
      const { stdout, exitCode } = await cli("teams", "--json");

      expect(exitCode).toBe(0);
      const data = JSON.parse(stdout);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty("id");
      expect(data[0]).toHaveProperty("key");
      expect(data[0]).toHaveProperty("name");
    });

    test("--quiet outputs keys only", async () => {
      const { stdout, exitCode } = await cli("teams", "--quiet");

      expect(exitCode).toBe(0);
      expect(stdout).toContain(teamKey);
      expect(stdout).not.toContain("KEY");
      expect(stdout).not.toContain("NAME");
    });
  });

  describe("li team <key>", () => {
    test("shows team details", async () => {
      const { stdout, exitCode } = await cli("team", teamKey);

      expect(exitCode).toBe(0);
      expect(stdout).toContain(teamKey);
      expect(stdout).toContain("timezone:");
      expect(stdout).toContain("private:");
    });

    test("--json outputs valid json", async () => {
      const { stdout, exitCode } = await cli("team", teamKey, "--json");

      expect(exitCode).toBe(0);
      const data = JSON.parse(stdout);
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("key", teamKey);
      expect(data).toHaveProperty("name");
      expect(data).toHaveProperty("timezone");
      expect(data).toHaveProperty("private");
    });

    test("--members shows team members", async () => {
      const { stdout, exitCode } = await cli("team", teamKey, "--members");

      expect(exitCode).toBe(0);
      expect(stdout).toContain("members:");
    });

    test("--members --json outputs valid json", async () => {
      const { stdout, exitCode } = await cli("team", teamKey, "--members", "--json");

      expect(exitCode).toBe(0);
      const data = JSON.parse(stdout);
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0]).toHaveProperty("id");
        expect(data[0]).toHaveProperty("name");
        expect(data[0]).toHaveProperty("email");
        expect(data[0]).toHaveProperty("active");
      }
    });

    test("exits with error for invalid team key", async () => {
      const { stderr, exitCode } = await cli("team", "INVALID_TEAM_KEY_XYZ");

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("not found");
    });
  });
});
