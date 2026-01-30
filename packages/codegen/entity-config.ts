/**
 * Entity configuration for schema extraction.
 * Explicitly lists supported and excluded entities for visibility into what we support.
 */

export interface EntityConfig {
  name: string;
  reason?: string;
}

/**
 * Entities we actively support in lnr.
 * These are extracted and codegen'd.
 */
export const SUPPORTED_ENTITIES: EntityConfig[] = [
  { name: "Issue", reason: "core entity - primary workflow object" },
  { name: "Project", reason: "core entity - project management" },
  { name: "ProjectMilestone", reason: "project milestones for tracking deliverables" },
  { name: "Comment", reason: "core entity - issue discussion" },
  { name: "Document", reason: "core entity - documentation" },
  { name: "IssueLabel", reason: "core entity - issue categorization" },
];

/**
 * Entities explicitly excluded from extraction.
 * Document WHY each is excluded so future maintainers understand.
 */
export const EXCLUDED_ENTITIES: EntityConfig[] = [
  { name: "User", reason: "read-only in Linear API, no create/update mutations" },
  { name: "Team", reason: "admin-level, not in lnr scope for v1" },
  { name: "Cycle", reason: "team-level, planned for later" },
  { name: "Workflow", reason: "admin-level configuration" },
  { name: "WorkflowState", reason: "admin-level configuration" },
  { name: "Integration", reason: "admin-level, oauth scopes" },
  { name: "Webhook", reason: "admin-level configuration" },
  { name: "Organization", reason: "admin-level, not in lnr scope" },
  { name: "Attachment", reason: "planned for later, needs file handling" },
  { name: "Favorite", reason: "user preference, low priority" },
  { name: "Notification", reason: "read-only, notification handling" },
  { name: "Roadmap", reason: "enterprise feature" },
  { name: "Initiative", reason: "enterprise feature" },
  { name: "CustomerNeed", reason: "enterprise feature" },
  { name: "Company", reason: "enterprise feature" },
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
