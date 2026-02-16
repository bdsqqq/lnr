import type { OperationSpec } from "../lib/operation-spec";
import "../lib/arktype-config";
import { type } from "arktype";
import {
  getClient,
  listGitAutomationStates,
  createGitAutomationState,
  updateGitAutomationState,
  deleteGitAutomationState,
  findTeamByKeyOrName,
  getTeamStates,
  type GitAutomationState,
  type GitAutomationEvent,
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

const gitAutomationEvents = ["draft", "merge", "mergeable", "review", "start"] as const;

export const listGitAutomationStatesInput = type({
  team: type("string").describe("team key"),
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output ids only"),
  "verbose?": type("boolean").describe("show all columns"),
});

export const gitAutomationStateInput = type({
  idOrEvent: type("string").configure({ positional: true }).describe("automation id, event name, or 'new'"),
  team: type("string").describe("team key"),
  "event?": type("'draft' | 'merge' | 'mergeable' | 'review' | 'start'").describe("git event: draft, merge, mergeable, review, start"),
  "state?": type("string").describe("workflow state name to transition to"),
  "branch?": type("string").describe("target branch ID"),
  "delete?": type("boolean").describe("delete the automation"),
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output ids only"),
  "verbose?": type("boolean").describe("show all columns"),
});

type GitAutomationStateCliInput = typeof gitAutomationStateInput.infer;

const automationColumns: TableColumn<GitAutomationState>[] = [
  { header: "EVENT", value: (a) => a.event, width: 12 },
  { header: "STATE", value: (a) => a.stateName ?? "(no action)", width: 20 },
  { header: "BRANCH", value: (a) => a.targetBranchPattern ?? "(all)", width: 20 },
];

const verboseAutomationColumns: TableColumn<GitAutomationState>[] = [
  ...automationColumns,
  { header: "ID", value: (a) => a.id, width: 36 },
];

export const gitAutomationStateOperations = ["create", "read", "update", "delete"] as const;
type Operation = (typeof gitAutomationStateOperations)[number];

export const gitAutomationStateMutationFlags: readonly (keyof GitAutomationStateCliInput)[] = [
  "event", "state", "branch"
] as const;

export function inferOperation(input: GitAutomationStateCliInput): Operation {
  if (input.idOrEvent === "new") return "create";
  if (input.delete) return "delete";

  for (const flag of gitAutomationStateMutationFlags) {
    if (input[flag] !== undefined) return "update";
  }

  return "read";
}

export const gitAutomationStateOperationSpec: OperationSpec<GitAutomationStateCliInput, Operation> = {
  command: "git-automation",
  operations: gitAutomationStateOperations,
  mutationFlags: gitAutomationStateMutationFlags,
  inferOperation,
};

async function handleListGitAutomationStates(
  input: typeof listGitAutomationStatesInput.infer
): Promise<void> {
  try {
    const client = getClient();
    const automations = await listGitAutomationStates(client, input.team);

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    if (format === "json") {
      outputJson(automations);
      return;
    }

    if (format === "quiet") {
      outputQuiet(automations.map((a) => a.id));
      return;
    }

    const columns = input.verbose ? verboseAutomationColumns : automationColumns;
    outputTable(automations, columns, outputOpts);
  } catch (error) {
    handleApiError(error);
  }
}

async function handleShowGitAutomationState(
  idOrEvent: string,
  input: GitAutomationStateCliInput
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    const automations = await listGitAutomationStates(client, input.team);
    let automation: GitAutomationState | null = null;

    if (gitAutomationEvents.includes(idOrEvent as GitAutomationEvent)) {
      automation = automations.find((a) => a.event === idOrEvent) ?? null;
    } else {
      automation = automations.find((a) => a.id === idOrEvent) ?? null;
    }

    if (!automation) {
      exitWithError(
        `git automation "${idOrEvent}" not found`,
        `try: lnr git-automations --team ${input.team}`,
        EXIT_CODES.NOT_FOUND
      );
    }

    if (format === "json") {
      outputJson(automation);
      return;
    }

    if (format === "quiet") {
      console.log(automation.id);
      return;
    }

    console.log(`git automation: ${automation.event}`);
    console.log(`  state: ${automation.stateName ?? "(no action)"}`);
    console.log(`  branch: ${automation.targetBranchPattern ?? "(all branches)"}`);
    if (input.verbose) {
      console.log(`  id: ${automation.id}`);
      console.log(`  team: ${automation.teamKey ?? automation.teamId}`);
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleCreateGitAutomationState(
  input: GitAutomationStateCliInput
): Promise<void> {
  if (!input.event) {
    exitWithError(
      "--event is required",
      "usage: lnr git-automation new --team ENG --event merge --state Done"
    );
  }

  try {
    const client = getClient();

    const team = await findTeamByKeyOrName(client, input.team);
    if (!team) {
      exitWithError(`team "${input.team}" not found`);
    }

    let stateId: string | undefined;
    if (input.state) {
      const states = await getTeamStates(client, team.id);
      const state = states.find(
        (s) => s.name.toLowerCase() === input.state?.toLowerCase()
      );
      if (!state) {
        exitWithError(
          `state "${input.state}" not found in team "${input.team}"`,
          `available states: ${states.map((s) => s.name).join(", ")}`
        );
      }
      stateId = state.id;
    }

    const automation = await createGitAutomationState(client, {
      teamId: team.id,
      event: input.event,
      stateId,
      targetBranchId: input.branch,
    });

    if (automation) {
      console.log(`created git automation: ${automation.event} → ${automation.stateName ?? "(no action)"}`);
    } else {
      exitWithError("failed to create git automation");
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleUpdateGitAutomationState(
  idOrEvent: string,
  input: GitAutomationStateCliInput
): Promise<void> {
  try {
    const client = getClient();

    const automations = await listGitAutomationStates(client, input.team);
    let automation: GitAutomationState | null = null;

    if (gitAutomationEvents.includes(idOrEvent as GitAutomationEvent)) {
      automation = automations.find((a) => a.event === idOrEvent) ?? null;
    } else {
      automation = automations.find((a) => a.id === idOrEvent) ?? null;
    }

    if (!automation) {
      exitWithError(
        `git automation "${idOrEvent}" not found`,
        `try: lnr git-automations --team ${input.team}`,
        EXIT_CODES.NOT_FOUND
      );
    }

    let stateId: string | undefined;
    if (input.state) {
      const team = await findTeamByKeyOrName(client, input.team);
      if (!team) {
        exitWithError(`team "${input.team}" not found`);
      }
      const states = await getTeamStates(client, team.id);
      const state = states.find(
        (s) => s.name.toLowerCase() === input.state?.toLowerCase()
      );
      if (!state) {
        exitWithError(
          `state "${input.state}" not found in team "${input.team}"`,
          `available states: ${states.map((s) => s.name).join(", ")}`
        );
      }
      stateId = state.id;
    }

    const success = await updateGitAutomationState(client, automation.id, {
      event: input.event,
      stateId,
      targetBranchId: input.branch,
    });

    if (!success) {
      exitWithError(
        `failed to update git automation "${idOrEvent}"`,
        undefined,
        EXIT_CODES.NOT_FOUND
      );
    }

    console.log(`updated git automation: ${input.event ?? automation.event}`);
  } catch (error) {
    handleApiError(error);
  }
}

async function handleDeleteGitAutomationState(
  idOrEvent: string,
  input: GitAutomationStateCliInput
): Promise<void> {
  try {
    const client = getClient();

    const automations = await listGitAutomationStates(client, input.team);
    let automation: GitAutomationState | null = null;

    if (gitAutomationEvents.includes(idOrEvent as GitAutomationEvent)) {
      automation = automations.find((a) => a.event === idOrEvent) ?? null;
    } else {
      automation = automations.find((a) => a.id === idOrEvent) ?? null;
    }

    if (!automation) {
      exitWithError(
        `git automation "${idOrEvent}" not found`,
        `try: lnr git-automations --team ${input.team}`,
        EXIT_CODES.NOT_FOUND
      );
    }

    const success = await deleteGitAutomationState(client, automation.id);

    if (!success) {
      exitWithError(
        `failed to delete git automation "${idOrEvent}"`,
        undefined,
        EXIT_CODES.NOT_FOUND
      );
    }

    console.log(`deleted git automation: ${automation.event}`);
  } catch (error) {
    handleApiError(error);
  }
}

export const gitAutomationStatesRouter = router({
  "git-automations": procedure
    .meta({
      aliases: { command: ["ga"] },
      description: "list git automation states for a team",
    })
    .input(listGitAutomationStatesInput)
    .query(async ({ input }) => {
      await handleListGitAutomationStates(input);
    }),

  "git-automation": procedure
    .meta({
      description: "show, create, update, or delete a git automation state",
    })
    .input(gitAutomationStateInput)
    .mutation(async ({ input }) => {
      const operation = inferOperation(input);

      switch (operation) {
        case "create":
          await handleCreateGitAutomationState(input);
          break;
        case "delete":
          await handleDeleteGitAutomationState(input.idOrEvent, input);
          break;
        case "update":
          await handleUpdateGitAutomationState(input.idOrEvent, input);
          break;
        case "read":
        default:
          await handleShowGitAutomationState(input.idOrEvent, input);
          break;
      }
    }),
});
