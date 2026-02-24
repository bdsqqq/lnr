/**
 * Entity configuration for schema extraction.
 * Categorizes all Linear API entities per ADR-0005.
 */

export interface EntityConfig {
  name: string;
  reason?: string;
}

/**
 * Core entities with full CRUD support.
 * These are extracted and codegen'd as standalone commands.
 */
export const CORE_ENTITIES: EntityConfig[] = [
  { name: "Issue", reason: "core entity - primary workflow object" },
  { name: "Project", reason: "core entity - project management" },
  { name: "ProjectMilestone", reason: "project milestones, scoped to project per ADR-0004" },
  { name: "Comment", reason: "core entity - issue discussion" },
  { name: "Document", reason: "core entity - documentation" },
  { name: "IssueLabel", reason: "core entity - issue categorization" },
];

/**
 * Tier 1: read-only entities.
 * No mutations available in Linear API or admin-level only.
 */
export const READ_ONLY_ENTITIES: EntityConfig[] = [
  { name: "Template", reason: "issue templates, read-only access" },
  { name: "User", reason: "read-only in Linear API, no create/update mutations" },
  { name: "Notification", reason: "read-only, notification list and mark-as-read" },
  { name: "Initiative", reason: "enterprise feature, read-only access" },
  { name: "Roadmap", reason: "enterprise feature, read-only access" },
  { name: "AgentSession", reason: "experimental - AI agent sessions, read-only" },
];

/**
 * Tier 2: full CRUD entities.
 * Standalone commands with list/show/create/update/delete.
 */
export const CRUD_ENTITIES: EntityConfig[] = [
  { name: "Cycle", reason: "team-scoped cycles" },
  { name: "CustomView", reason: "saved filters for workflow automation" },
];

/**
 * Embedded/scoped entities.
 * Accessed through parent entity commands, not standalone.
 */
export const SCOPED_ENTITIES: EntityConfig[] = [
  { name: "ProjectUpdate", reason: "scoped to project via --updates" },
  { name: "InitiativeUpdate", reason: "scoped to initiative via --updates" },
  { name: "ProjectLabel", reason: "scoped to project via --labels" },
  { name: "ProjectStatus", reason: "scoped to project via --statuses" },
  { name: "ViewPreferences", reason: "embedded in view command" },
  { name: "AgentActivity", reason: "embedded in agent session" },
  { name: "RoadmapToProject", reason: "roadmap-project linking via roadmap command" },
];

/**
 * Flag-based entities.
 * Operations via flags on parent commands (--react, --subscribe, --link).
 */
export const FLAG_ENTITIES: EntityConfig[] = [
  { name: "Reaction", reason: "extended to all comment-like entities via --react/--unreact" },
  { name: "NotificationSubscription", reason: "via --subscribe/--unsubscribe flags" },
  { name: "EntityExternalLink", reason: "via --link flag on issue/project" },
];

/**
 * Subcommand entities.
 * Accessed as subcommands of parent entity.
 */
export const SUBCOMMAND_ENTITIES: EntityConfig[] = [
  { name: "IssueBatch", reason: "lnr issue batch subcommand" },
];

/**
 * Git automation entities.
 * Team-scoped, require --team flag.
 */
export const GIT_AUTOMATION_ENTITIES: EntityConfig[] = [
  { name: "GitAutomationState", reason: "state-based branch rules, team-scoped" },
  { name: "GitAutomationTargetBranch", reason: "target branch config, team-scoped" },
];

/**
 * Entities explicitly excluded from lnr.
 * Admin-only, internal, or not in scope.
 */
export const EXCLUDED_ENTITIES: EntityConfig[] = [
  { name: "Organization", reason: "admin-only" },
  { name: "OrganizationInvite", reason: "admin-only" },
  { name: "OrganizationDomain", reason: "admin-only" },
  { name: "Team", reason: "read-only access via team command, not codegen'd" },
  { name: "Workflow", reason: "admin-level configuration" },
  { name: "WorkflowState", reason: "admin-level configuration" },
  { name: "Integration", reason: "admin-level, oauth scopes" },
  { name: "IntegrationsSettings", reason: "admin config" },
  { name: "Webhook", reason: "admin-level configuration" },
  { name: "Attachment", reason: "deferred - needs file handling" },
  { name: "Favorite", reason: "user preference, low priority" },
  { name: "PushSubscription", reason: "internal" },
  { name: "TeamMembership", reason: "accessed via Team read" },
  { name: "EmailIntakeAddress", reason: "admin config" },
  { name: "Contact", reason: "enterprise CRM" },
  { name: "ContactSales", reason: "enterprise CRM" },
  { name: "CustomerNeed", reason: "enterprise CRM" },
  { name: "Company", reason: "enterprise CRM" },
  { name: "Release", reason: "ALPHA feature, defer" },
  { name: "ReleasePipeline", reason: "ALPHA feature, defer" },
  { name: "ReleaseStage", reason: "ALPHA feature, defer" },
  { name: "IssueToRelease", reason: "ALPHA feature, defer" },
];

/**
 * All supported entities (for introspection).
 */
export const SUPPORTED_ENTITIES: EntityConfig[] = [
  ...CORE_ENTITIES,
  ...READ_ONLY_ENTITIES,
  ...CRUD_ENTITIES,
  ...SCOPED_ENTITIES,
  ...FLAG_ENTITIES,
  ...SUBCOMMAND_ENTITIES,
  ...GIT_AUTOMATION_ENTITIES,
];

export function getSupportedEntityNames(): string[] {
  return SUPPORTED_ENTITIES.map((e) => e.name);
}

export function getExcludedEntityNames(): string[] {
  return EXCLUDED_ENTITIES.map((e) => e.name);
}

export function getExclusionReason(name: string): string | undefined {
  return EXCLUDED_ENTITIES.find((e) => e.name === name)?.reason;
}

export function getEntityCategory(name: string): string | undefined {
  if (CORE_ENTITIES.find((e) => e.name === name)) return "core";
  if (READ_ONLY_ENTITIES.find((e) => e.name === name)) return "read-only";
  if (CRUD_ENTITIES.find((e) => e.name === name)) return "crud";
  if (SCOPED_ENTITIES.find((e) => e.name === name)) return "scoped";
  if (FLAG_ENTITIES.find((e) => e.name === name)) return "flag";
  if (SUBCOMMAND_ENTITIES.find((e) => e.name === name)) return "subcommand";
  if (GIT_AUTOMATION_ENTITIES.find((e) => e.name === name)) return "git-automation";
  if (EXCLUDED_ENTITIES.find((e) => e.name === name)) return "excluded";
  return undefined;
}
