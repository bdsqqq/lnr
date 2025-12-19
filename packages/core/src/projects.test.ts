import { describe, test, expect, beforeAll } from "bun:test";
import { LinearClient } from "@linear/sdk";
import { getApiKey } from "./config";
import { listProjects, getProject, createProject, deleteProject } from "./projects";

const TEST_PREFIX = "[TEST-CLI]";

function getTestClient(): LinearClient {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("no api key configured - run: li auth <api-key>");
  }
  return new LinearClient({ apiKey });
}

describe("projects core", () => {
  let client: LinearClient;

  beforeAll(() => {
    client = getTestClient();
  });

  test("listProjects returns project array", async () => {
    const projects = await listProjects(client);
    expect(Array.isArray(projects)).toBe(true);
    if (projects.length > 0) {
      expect(projects[0]).toHaveProperty("id");
      expect(projects[0]).toHaveProperty("name");
      expect(projects[0]).toHaveProperty("state");
    }
  });

  test("getProject returns null for nonexistent project", async () => {
    const project = await getProject(client, "NONEXISTENT_PROJECT_XYZ_123");
    expect(project).toBeNull();
  });

  test("deleteProject returns false for nonexistent project", async () => {
    const result = await deleteProject(client, "NONEXISTENT_PROJECT_XYZ_123");
    expect(result).toBe(false);
  });
});
