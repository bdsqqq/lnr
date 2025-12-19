import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { cli, getTestClient, cleanupTestProjects, TEST_PREFIX } from "./helpers";

describe("projects", () => {
  let projectName: string | undefined;

  beforeAll(async () => {
    const client = getTestClient();
    const projects = await client.projects();
    if (projects.nodes.length > 0) {
      projectName = projects.nodes[0].name;
    }
  });

  describe("li projects", () => {
    test("lists projects", async () => {
      const { stdout, exitCode } = await cli("projects");

      expect(exitCode).toBe(0);
      expect(stdout.length).toBeGreaterThan(0);
    });

    test("--json outputs valid json", async () => {
      const { stdout, exitCode } = await cli("projects", "--json");

      expect(exitCode).toBe(0);
      const data = JSON.parse(stdout);
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0]).toHaveProperty("id");
        expect(data[0]).toHaveProperty("name");
        expect(data[0]).toHaveProperty("state");
        expect(data[0]).toHaveProperty("progress");
      }
    });

    test("--quiet outputs ids only", async () => {
      const { stdout, exitCode } = await cli("projects", "--quiet");

      expect(exitCode).toBe(0);
      expect(stdout).not.toContain("NAME");
      expect(stdout).not.toContain("STATE");
    });
  });

  describe("li project <name>", () => {
    test("shows project details", async () => {
      if (!projectName) {
        console.log("skipping: no projects found");
        return;
      }

      const { stdout, exitCode } = await cli("project", projectName);

      expect(exitCode).toBe(0);
      expect(stdout).toContain(projectName);
      expect(stdout).toContain("state:");
      expect(stdout).toContain("progress:");
    });

    test("--json outputs valid json", async () => {
      if (!projectName) {
        console.log("skipping: no projects found");
        return;
      }

      const { stdout, exitCode } = await cli("project", projectName, "--json");

      expect(exitCode).toBe(0);
      const data = JSON.parse(stdout);
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("name", projectName);
      expect(data).toHaveProperty("state");
      expect(data).toHaveProperty("progress");
    });

    test("exits with error for invalid project name", async () => {
      const { stderr, exitCode } = await cli("project", "INVALID_PROJECT_NAME_XYZ_123");

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("not found");
    });
  });

  describe("create/delete cycle", () => {
    afterAll(async () => {
      await cleanupTestProjects();
    });

    test("create project with [TEST-CLI] prefix, verify, then cleanup deletes it", async () => {
      const testName = `${TEST_PREFIX} test project ${Date.now()}`;

      const createResult = await cli(
        "project",
        "new",
        "--name",
        testName,
        "--team",
        "BDSQ"
      );
      if (createResult.exitCode !== 0) {
        console.error("stderr:", createResult.stderr);
        console.error("stdout:", createResult.stdout);
      }
      expect(createResult.exitCode).toBe(0);
      expect(createResult.stdout).toContain("created project");

      const showResult = await cli("project", testName, "--json");
      expect(showResult.exitCode).toBe(0);
      const project = JSON.parse(showResult.stdout);
      expect(project.name).toBe(testName);
    });
  });
});
