import { $ } from "bun";
import { LinearClient } from "@linear/sdk";
import { getApiKey } from "../lib/config";

export const TEST_PREFIX = "[TEST-CLI]";

export async function cli(
  ...args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const result = await $`bun run src/cli.ts ${args}`.quiet().nothrow();
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode,
  };
}

export function getTestClient(): LinearClient {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("no api key configured - run: li auth <api-key>");
  }
  return new LinearClient({ apiKey });
}

export async function cleanupTestIssues(): Promise<void> {
  const client = getTestClient();
  const issues = await client.issues({
    filter: { title: { startsWith: TEST_PREFIX } },
  });
  for (const issue of issues.nodes) {
    await issue.archive();
  }
}

export async function getFirstTeamKey(): Promise<string> {
  const client = getTestClient();
  const teams = await client.teams();
  // prefer BDSQ team for tests as it has full permissions
  const bdsq = teams.nodes.find((t) => t.key === "BDSQ");
  if (bdsq) {
    return bdsq.key;
  }
  const first = teams.nodes[0];
  if (!first) {
    throw new Error("no teams found");
  }
  return first.key;
}

export async function cleanupTestProjects(): Promise<void> {
  const client = getTestClient();
  const projects = await client.projects();
  for (const project of projects.nodes) {
    if (project.name.startsWith(TEST_PREFIX)) {
      await client.deleteProject(project.id);
    }
  }
}
