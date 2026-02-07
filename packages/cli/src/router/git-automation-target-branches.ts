import type { OperationSpec } from "../lib/operation-spec";
import "../lib/arktype-config";
import { type } from "arktype";
import {
  getClient,
  listGitAutomationTargetBranches,
  createGitAutomationTargetBranch,
  updateGitAutomationTargetBranch,
  deleteGitAutomationTargetBranch,
  findTeamByKeyOrName,
  type GitAutomationTargetBranch,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "./trpc";
import { exitWithError, handleApiError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  type OutputOptions,
  type TableColumn,
} from "../lib/output";

export const listGitAutomationTargetBranchesInput = type({
  team: type("string").describe("team key"),
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output ids only"),
  "verbose?": type("boolean").describe("show all columns"),
});

export const gitAutomationTargetBranchInput = type({
  patternOrId: type("string").configure({ positional: true }).describe("branch pattern, id, or 'new'"),
  team: type("string").describe("team key"),
  "pattern?": type("string").describe("branch pattern"),
  "regex?": type("boolean").describe("treat pattern as regex"),
  "delete?": type("boolean").describe("delete the target branch"),
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output ids only"),
  "verbose?": type("boolean").describe("show all columns"),
});

type GitAutomationTargetBranchCliInput = typeof gitAutomationTargetBranchInput.infer;

const branchColumns: TableColumn<GitAutomationTargetBranch>[] = [
  { header: "PATTERN", value: (b) => b.branchPattern, width: 30 },
  { header: "REGEX", value: (b) => (b.isRegex ? "yes" : "no"), width: 8 },
];

const verboseBranchColumns: TableColumn<GitAutomationTargetBranch>[] = [
  ...branchColumns,
  { header: "ID", value: (b) => b.id, width: 36 },
];

export const gitAutomationTargetBranchOperations = ["create", "read", "update", "delete"] as const;
type Operation = (typeof gitAutomationTargetBranchOperations)[number];

export const gitAutomationTargetBranchMutationFlags: readonly (keyof GitAutomationTargetBranchCliInput)[] = [
  "pattern", "regex"
] as const;

export function inferOperation(input: GitAutomationTargetBranchCliInput): Operation {
  if (input.patternOrId === "new") return "create";
  if (input.delete) return "delete";

  for (const flag of gitAutomationTargetBranchMutationFlags) {
    if (input[flag] !== undefined) return "update";
  }

  return "read";
}

export const gitAutomationTargetBranchOperationSpec: OperationSpec<GitAutomationTargetBranchCliInput, Operation> = {
  command: "git-branch",
  operations: gitAutomationTargetBranchOperations,
  mutationFlags: gitAutomationTargetBranchMutationFlags,
  inferOperation,
};

async function handleListGitAutomationTargetBranches(
  input: typeof listGitAutomationTargetBranchesInput.infer
): Promise<void> {
  try {
    const client = getClient();
    const branches = await listGitAutomationTargetBranches(client, input.team);

    if (branches.length === 0) {
      exitWithError(
        `no git automation target branches found for team "${input.team}"`,
        "create one with: lnr git-branch new --team <key> --pattern <pattern>"
      );
    }

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    if (format === "json") {
      outputJson(branches);
      return;
    }

    if (format === "quiet") {
      outputQuiet(branches.map((b) => b.id));
      return;
    }

    const columns = input.verbose ? verboseBranchColumns : branchColumns;
    outputTable(branches, columns, outputOpts);
  } catch (error) {
    handleApiError(error);
  }
}

async function handleShowGitAutomationTargetBranch(
  patternOrId: string,
  input: GitAutomationTargetBranchCliInput
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    const branches = await listGitAutomationTargetBranches(client, input.team);
    let branch: GitAutomationTargetBranch | null = null;

    branch = branches.find((b) => b.branchPattern === patternOrId) ?? null;
    if (!branch) {
      branch = branches.find((b) => b.id === patternOrId) ?? null;
    }

    if (!branch) {
      exitWithError(
        `git automation target branch "${patternOrId}" not found`,
        `try: lnr git-branches --team ${input.team}`,
        EXIT_CODES.NOT_FOUND
      );
    }

    if (format === "json") {
      outputJson(branch);
      return;
    }

    if (format === "quiet") {
      console.log(branch.id);
      return;
    }

    console.log(`git automation target branch: ${branch.branchPattern}`);
    console.log(`  regex: ${branch.isRegex ? "yes" : "no"}`);
    if (input.verbose) {
      console.log(`  id: ${branch.id}`);
      console.log(`  team: ${branch.teamKey ?? branch.teamId}`);
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleCreateGitAutomationTargetBranch(
  input: GitAutomationTargetBranchCliInput
): Promise<void> {
  if (!input.pattern) {
    exitWithError(
      "--pattern is required",
      "usage: lnr git-branch new --team ENG --pattern main"
    );
  }

  try {
    const client = getClient();

    const team = await findTeamByKeyOrName(client, input.team);
    if (!team) {
      exitWithError(`team "${input.team}" not found`);
    }

    const branch = await createGitAutomationTargetBranch(client, {
      teamId: team.id,
      branchPattern: input.pattern,
      isRegex: input.regex,
    });

    if (branch) {
      console.log(`created git automation target branch: ${branch.branchPattern}`);
    } else {
      exitWithError("failed to create git automation target branch");
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleUpdateGitAutomationTargetBranch(
  patternOrId: string,
  input: GitAutomationTargetBranchCliInput
): Promise<void> {
  try {
    const client = getClient();

    const branches = await listGitAutomationTargetBranches(client, input.team);
    let branch: GitAutomationTargetBranch | null = null;

    branch = branches.find((b) => b.branchPattern === patternOrId) ?? null;
    if (!branch) {
      branch = branches.find((b) => b.id === patternOrId) ?? null;
    }

    if (!branch) {
      exitWithError(
        `git automation target branch "${patternOrId}" not found`,
        `try: lnr git-branches --team ${input.team}`,
        EXIT_CODES.NOT_FOUND
      );
    }

    const success = await updateGitAutomationTargetBranch(client, branch.id, {
      branchPattern: input.pattern,
      isRegex: input.regex,
    });

    if (!success) {
      exitWithError(
        `failed to update git automation target branch "${patternOrId}"`,
        undefined,
        EXIT_CODES.NOT_FOUND
      );
    }

    console.log(`updated git automation target branch: ${input.pattern ?? branch.branchPattern}`);
  } catch (error) {
    handleApiError(error);
  }
}

async function handleDeleteGitAutomationTargetBranch(
  patternOrId: string,
  input: GitAutomationTargetBranchCliInput
): Promise<void> {
  try {
    const client = getClient();

    const branches = await listGitAutomationTargetBranches(client, input.team);
    let branch: GitAutomationTargetBranch | null = null;

    branch = branches.find((b) => b.branchPattern === patternOrId) ?? null;
    if (!branch) {
      branch = branches.find((b) => b.id === patternOrId) ?? null;
    }

    if (!branch) {
      exitWithError(
        `git automation target branch "${patternOrId}" not found`,
        `try: lnr git-branches --team ${input.team}`,
        EXIT_CODES.NOT_FOUND
      );
    }

    const success = await deleteGitAutomationTargetBranch(client, branch.id);

    if (!success) {
      exitWithError(
        `failed to delete git automation target branch "${patternOrId}"`,
        undefined,
        EXIT_CODES.NOT_FOUND
      );
    }

    console.log(`deleted git automation target branch: ${branch.branchPattern}`);
  } catch (error) {
    handleApiError(error);
  }
}

export const gitAutomationTargetBranchesRouter = router({
  "git-branches": procedure
    .meta({
      aliases: { command: ["gb"] },
      description: "list git automation target branches for a team",
    })
    .input(listGitAutomationTargetBranchesInput)
    .query(async ({ input }) => {
      await handleListGitAutomationTargetBranches(input);
    }),

  "git-branch": procedure
    .meta({
      description: "show, create, update, or delete a git automation target branch",
    })
    .input(gitAutomationTargetBranchInput)
    .mutation(async ({ input }) => {
      const operation = inferOperation(input);

      switch (operation) {
        case "create":
          await handleCreateGitAutomationTargetBranch(input);
          break;
        case "delete":
          await handleDeleteGitAutomationTargetBranch(input.patternOrId, input);
          break;
        case "update":
          await handleUpdateGitAutomationTargetBranch(input.patternOrId, input);
          break;
        case "read":
        default:
          await handleShowGitAutomationTargetBranch(input.patternOrId, input);
          break;
      }
    }),
});
