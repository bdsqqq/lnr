/**
 * entity definitions for CLI generation.
 *
 * single source of truth for how Linear API entities surface in lnr.
 * generator reads these to produce complete commands — no manual edits to generated files.
 *
 * see docs/adr/0007-entity-config-v2-exploration.md
 */

import {
  type EntityDefinition,
  validateDefinitions,
} from "./entity-schema";

// === raw definitions ===

const definitions: EntityDefinition[] = [
  // ============================================================
  // COMMAND ENTITIES — standalone commands with CRUD
  // ============================================================

  {
    name: "Issue",
    exposure: "command",
    reason: "core entity - primary workflow object",
    command: {
      singular: "issue",
      plural: "issues",
      aliases: ["i"],
      positional: { name: "idOrNew", description: "issue identifier (e.g. ENG-123) or 'new'" },
      operations: { list: true, show: true, create: true, update: true, archive: true },
    },
  },

  {
    name: "Project",
    exposure: "command",
    reason: "core entity - project management",
    command: {
      singular: "project",
      plural: "projects",
      aliases: ["p"],
      positional: { name: "name", description: "project name or 'new'" },
      operations: { list: true, show: true, create: true, update: true, delete: true },
    },
  },

  {
    name: "Document",
    exposure: "command",
    reason: "core entity - documentation",
    command: {
      singular: "doc",
      plural: "docs",
      positional: { name: "title", description: "document title or 'new'" },
      operations: { list: true, show: true, create: true, update: true, delete: true },
    },
  },

  {
    name: "IssueLabel",
    exposure: "command",
    reason: "core entity - issue categorization",
    command: {
      singular: "label",
      plural: "labels",
      positional: { name: "name", description: "label name or 'new'" },
      operations: { list: true, show: true, create: true, update: true, delete: true },
    },
  },

  // ============================================================
  // FLAG ENTITIES — injected as flags on parent commands
  // ============================================================

  {
    name: "Reaction",
    exposure: "flag",
    reason: "reactions via --react/--unreact on comment-like entities",
    flags: {
      parents: ["issue", "project", "initiative"],
      operations: [
        {
          flag: "react",
          inputType: "string",
          description: "entity id to add reaction (requires --emoji)",
          operation: "create",
          handler: "createReaction",
          requires: ["emoji"],
        },
        {
          flag: "emoji",
          inputType: "string",
          description: "emoji for --react",
          operation: "create",
          handler: "", // companion flag, no direct handler
        },
        {
          flag: "unreact",
          inputType: "string",
          description: "reaction id to remove",
          operation: "delete",
          handler: "deleteReaction",
        },
      ],
    },
  },

  {
    name: "NotificationSubscription",
    exposure: "flag",
    reason: "subscriptions via --subscribe/--unsubscribe",
    flags: {
      // issue excluded: uses subscriberIds API (subscribeToIssue/unsubscribeFromIssue)
      // not NotificationSubscription entity. handled inline in generateIssueUpdateHandler.
      parents: ["project", "initiative", "cycle", "label", "view"],
      operations: [
        {
          flag: "subscribe",
          inputType: "boolean",
          description: "subscribe to notifications",
          operation: "create",
          handler: "createSubscription",
        },
        {
          flag: "unsubscribe",
          inputType: "boolean",
          description: "unsubscribe from notifications",
          operation: "delete",
          handler: "deleteSubscription",
        },
      ],
    },
  },

  // TODO: EntityExternalLink flag entity - needs createEntityExternalLink function in core
  // {
  //   name: "EntityExternalLink",
  //   exposure: "flag",
  //   reason: "external links via --link on entities",
  //   flags: {
  //     parents: ["issue", "project"],
  //     operations: [
  //       {
  //         flag: "link",
  //         inputType: "string",
  //         description: "add external link URL",
  //         operation: "create",
  //         handler: "createEntityExternalLink",
  //       },
  //     ],
  //   },
  // },

  // ============================================================
  // SCOPED ENTITIES — accessed via flags on parent commands
  // ============================================================

  {
    name: "ProjectUpdate",
    exposure: "scoped",
    reason: "project updates via --updates",
    scoped: {
      parent: "project",
      flag: "updates",
      description: "list project updates",
      listHandler: "getProjectUpdates",
    },
  },

  {
    name: "ProjectLabel",
    exposure: "scoped",
    reason: "project labels via --labels",
    scoped: {
      parent: "project",
      flag: "labels",
      description: "list project labels",
      listHandler: "getProjectLabels",
    },
  },

  {
    name: "ProjectStatus",
    exposure: "scoped",
    reason: "project status via --show-status",
    scoped: {
      parent: "project",
      flag: "showStatus",
      description: "show project status details",
      getHandler: "getProjectStatus",
    },
  },

  {
    name: "ProjectExternalLink",
    exposure: "scoped",
    reason: "external links via --links (read-only, createEntityExternalLink not in core yet)",
    scoped: {
      parent: "project",
      flag: "links",
      description: "list project external links",
      listHandler: "getProjectExternalLinks",
    },
  },

  {
    name: "InitiativeUpdate",
    exposure: "scoped",
    reason: "initiative updates via --updates",
    scoped: {
      parent: "initiative",
      flag: "updates",
      description: "list initiative updates",
      listHandler: "getInitiativeUpdates",
    },
  },

  {
    name: "Comment",
    exposure: "scoped",
    reason: "issue comments via --comments",
    scoped: {
      parent: "issue",
      flag: "comments",
      description: "list comments on issue",
      listHandler: "getIssueComments",
    },
  },

  {
    name: "SubIssue",
    exposure: "scoped",
    reason: "sub-issues via --sub-issues",
    scoped: {
      parent: "issue",
      flag: "subIssues",
      description: "list sub-issues",
      listHandler: "getSubIssues",
    },
  },

  {
    name: "ProjectMilestone",
    exposure: "scoped",
    reason: "milestones via --milestones (per ADR-0004)",
    scoped: {
      parent: "project",
      flag: "milestones",
      description: "list project milestones",
      listHandler: "listMilestones",
    },
  },

  {
    name: "RoadmapToProject",
    exposure: "scoped",
    reason: "roadmap-project linking via --projects",
    scoped: {
      parent: "roadmap",
      flag: "projects",
      description: "list projects in roadmap",
      listHandler: "getRoadmapProjects",
    },
  },

  {
    name: "ViewPreferences",
    exposure: "scoped",
    reason: "view preferences via --preferences",
    scoped: {
      parent: "view",
      flag: "preferences",
      description: "show view preferences",
      getHandler: "getViewPreferences",
    },
  },

  {
    name: "AgentActivity",
    exposure: "scoped",
    reason: "agent activity via --activity",
    scoped: {
      parent: "agentSession",
      flag: "activity",
      description: "list agent activity",
      listHandler: "getAgentActivity",
    },
  },

  // ============================================================
  // SUBCOMMAND ENTITIES — nested commands under parent
  // ============================================================

  {
    name: "IssueBatch",
    exposure: "subcommand",
    reason: "bulk issue operations via 'issue batch'",
    subcommand: {
      parent: "issue",
      name: "batch",
    },
  },

  {
    name: "ProjectMilestoneCRUD",
    exposure: "subcommand",
    reason: "milestone CRUD via 'project milestone'",
    subcommand: {
      parent: "project",
      name: "milestone",
    },
  },
];

// === validate at module load ===

export const ENTITY_DEFINITIONS = validateDefinitions(definitions);

// === convenience exports ===

export function getCommandEntities() {
  return ENTITY_DEFINITIONS.filter((e) => e.exposure === "command");
}

export function getFlagEntities() {
  return ENTITY_DEFINITIONS.filter((e) => e.exposure === "flag");
}

export function getScopedEntities() {
  return ENTITY_DEFINITIONS.filter((e) => e.exposure === "scoped");
}

export function getSubcommandEntities() {
  return ENTITY_DEFINITIONS.filter((e) => e.exposure === "subcommand");
}
