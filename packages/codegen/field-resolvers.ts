/**
 * field resolver registry
 *
 * defines how each Linear API field maps to CLI input and resolution logic.
 * generators consume this to produce consistent payload construction across
 * all entities and operations (create, update).
 *
 * to add a new field:
 * 1. add entry here with cliFlag, resolution strategy
 * 2. if needs resolver function, add to packages/core/src/resolvers.ts
 * 3. regenerate commands
 */

export interface ResolvedField {
  cliFlag: string;
  cliDescription?: string;
  inputType: "string" | "number" | "boolean";
  resolve: string; // code template, uses `client` and `input.{cliFlag}`
  import: string; // function to import
  from: string; // module path
  requiresTeamId?: boolean; // some resolvers need teamId context
}

export interface PassthroughField {
  cliFlag: string;
  cliDescription?: string;
  inputType: "string" | "number" | "boolean";
  passthrough: true;
  transform?: string; // optional transform, e.g. "priorityFromString"
  transformImport?: string;
  transformFrom?: string;
}

export interface ExcludedField {
  exclude: true;
  reason?: string;
}

export type FieldResolver = ResolvedField | PassthroughField | ExcludedField;

/**
 * registry of Linear API fields → CLI handling
 *
 * key = Linear API field name (e.g., "projectId", "assigneeId")
 * value = how to handle in CLI
 */
export const fieldResolvers: Record<string, FieldResolver> = {
  // === ID fields requiring resolution ===

  projectId: {
    cliFlag: "project",
    cliDescription: "project name",
    inputType: "string",
    resolve: "await resolveProjectByName(client, input.project)",
    import: "resolveProjectByName",
    from: "@bdsqqq/lnr-core",
  },

  assigneeId: {
    cliFlag: "assignee",
    cliDescription: "assignee email or @me",
    inputType: "string",
    resolve: "await resolveAssignee(client, input.assignee)",
    import: "resolveAssignee",
    from: "@bdsqqq/lnr-core",
  },

  stateId: {
    cliFlag: "state",
    cliDescription: "workflow state name",
    inputType: "string",
    resolve: "await resolveStateName(client, teamId, input.state)",
    import: "resolveStateName",
    from: "@bdsqqq/lnr-core",
    requiresTeamId: true,
  },

  cycleId: {
    cliFlag: "cycle",
    cliDescription: "cycle name or number",
    inputType: "string",
    resolve: "await resolveCycleByName(client, teamId, input.cycle)",
    import: "resolveCycleByName",
    from: "@bdsqqq/lnr-core",
    requiresTeamId: true,
  },

  teamId: {
    cliFlag: "team",
    cliDescription: "team key",
    inputType: "string",
    resolve: "await resolveTeamByKey(client, input.team)",
    import: "resolveTeamByKey",
    from: "@bdsqqq/lnr-core",
  },

  parentId: {
    cliFlag: "parent",
    cliDescription: "parent issue identifier",
    inputType: "string",
    resolve: "await resolveIssueIdentifier(client, input.parent)",
    import: "resolveIssueIdentifier",
    from: "@bdsqqq/lnr-core",
  },

  delegateId: {
    cliFlag: "delegate",
    cliDescription: "agent user to delegate to",
    inputType: "string",
    resolve: "await resolveAssignee(client, input.delegate)",
    import: "resolveAssignee",
    from: "@bdsqqq/lnr-core",
  },

  leadId: {
    cliFlag: "lead",
    cliDescription: "project lead email or @me",
    inputType: "string",
    resolve: "await resolveAssignee(client, input.lead)",
    import: "resolveAssignee",
    from: "@bdsqqq/lnr-core",
  },

  // === passthrough fields (no resolution, direct value) ===

  title: {
    cliFlag: "title",
    cliDescription: "title",
    inputType: "string",
    passthrough: true,
  },

  description: {
    cliFlag: "description",
    cliDescription: "description in markdown",
    inputType: "string",
    passthrough: true,
  },

  content: {
    cliFlag: "content",
    cliDescription: "content in markdown",
    inputType: "string",
    passthrough: true,
  },

  name: {
    cliFlag: "name",
    cliDescription: "name",
    inputType: "string",
    passthrough: true,
  },

  color: {
    cliFlag: "color",
    cliDescription: "hex color (e.g., #ff0000)",
    inputType: "string",
    passthrough: true,
  },

  priority: {
    cliFlag: "priority",
    cliDescription: "priority (urgent, high, medium, low, none)",
    inputType: "string",
    passthrough: true,
    transform: "priorityFromString(input.priority)",
    transformImport: "priorityFromString",
    transformFrom: "@bdsqqq/lnr-core",
  },

  estimate: {
    cliFlag: "estimate",
    cliDescription: "estimate points",
    inputType: "number",
    passthrough: true,
  },

  dueDate: {
    cliFlag: "dueDate",
    cliDescription: "due date (YYYY-MM-DD)",
    inputType: "string",
    passthrough: true,
  },

  startDate: {
    cliFlag: "startDate",
    cliDescription: "start date (YYYY-MM-DD)",
    inputType: "string",
    passthrough: true,
  },

  targetDate: {
    cliFlag: "targetDate",
    cliDescription: "target date (YYYY-MM-DD)",
    inputType: "string",
    passthrough: true,
  },

  sortOrder: {
    cliFlag: "sortOrder",
    cliDescription: "sort order position",
    inputType: "number",
    passthrough: true,
  },

  prioritySortOrder: {
    cliFlag: "prioritySortOrder",
    cliDescription: "priority sort order position",
    inputType: "number",
    passthrough: true,
  },

  subIssueSortOrder: {
    cliFlag: "subIssueSortOrder",
    cliDescription: "sub-issue sort order position",
    inputType: "number",
    passthrough: true,
  },

  // === excluded fields (internal, not CLI-relevant) ===

  id: { exclude: true, reason: "auto-generated by backend" },
  descriptionData: { exclude: true, reason: "internal prosemirror format" },
  subscriberIds: { exclude: true, reason: "bulk operation, not single-flag" },
  labelIds: { exclude: true, reason: "handled separately via +label/-label syntax" },
  memberIds: { exclude: true, reason: "bulk operation, not single-flag" },
  teamIds: {
    cliFlag: "team",
    cliDescription: "team key(s) for project",
    inputType: "string",
    resolve: "[await resolveTeamByKey(client, input.team)]",
    import: "resolveTeamByKey",
    from: "@bdsqqq/lnr-core",
  },
  createAsUser: { exclude: true, reason: "internal impersonation" },
  displayIconUrl: { exclude: true, reason: "internal" },
  preserveSortOrderOnCreate: { exclude: true, reason: "internal" },
  createdAt: { exclude: true, reason: "internal override" },
  completedAt: { exclude: true, reason: "internal override" },
  slaBreachesAt: { exclude: true, reason: "SLA internal" },
  slaStartedAt: { exclude: true, reason: "SLA internal" },
  slaType: { exclude: true, reason: "SLA internal" },
  templateId: { exclude: true, reason: "template system" },
  lastAppliedTemplateId: { exclude: true, reason: "template system" },
  useDefaultTemplate: { exclude: true, reason: "template system" },
  projectMilestoneId: {
    cliFlag: "milestone",
    cliDescription: "milestone name within project",
    inputType: "string",
    resolve: "await resolveMilestoneByName(client, projectId, input.milestone)",
    import: "resolveMilestoneByName",
    from: "@bdsqqq/lnr-core",
    requiresTeamId: false,
  },
  referenceCommentId: { exclude: true, reason: "internal linking" },
  sourceCommentId: { exclude: true, reason: "internal linking" },
  sourcePullRequestCommentId: { exclude: true, reason: "internal linking" },
  convertedFromIssueId: { exclude: true, reason: "internal conversion" },
  bodyData: { exclude: true, reason: "internal prosemirror format" },
  issueId: { exclude: true, reason: "context-dependent, handled per-entity" },
  projectUpdateId: { exclude: true, reason: "internal linking" },
  initiativeUpdateId: { exclude: true, reason: "internal linking" },
  postId: { exclude: true, reason: "internal linking" },
  documentContentId: { exclude: true, reason: "internal linking" },
  doNotSubscribeToIssue: { exclude: true, reason: "internal flag" },
  createOnSyncedSlackThread: { exclude: true, reason: "internal slack sync" },
  quotedText: { exclude: true, reason: "internal quoting" },
  initiativeId: { exclude: true, reason: "initiatives not exposed" },
  releaseId: { exclude: true, reason: "releases not exposed" },
  resourceFolderId: { exclude: true, reason: "folders not exposed" },
  icon: { exclude: true, reason: "icon picker not CLI-friendly" },
  statusId: {
    cliFlag: "status",
    cliDescription: "project status",
    inputType: "string",
    passthrough: true,
  },
  startDateResolution: { exclude: true, reason: "internal date resolution" },
  targetDateResolution: { exclude: true, reason: "internal date resolution" },
  isGroup: { exclude: true, reason: "label groups not exposed" },
  retiredAt: { exclude: true, reason: "use --delete instead" },
};

/**
 * helper: check if field is excluded
 */
export function isExcluded(field: FieldResolver): field is ExcludedField {
  return "exclude" in field && field.exclude === true;
}

/**
 * helper: check if field is passthrough
 */
export function isPassthrough(field: FieldResolver): field is PassthroughField {
  return "passthrough" in field && field.passthrough === true;
}

/**
 * helper: check if field requires resolution
 */
export function isResolved(field: FieldResolver): field is ResolvedField {
  return "resolve" in field;
}

/**
 * get CLI flag name for a field (registry is source of truth for mappings)
 */
export function getCliFlagForField(fieldName: string): string {
  const resolver = fieldResolvers[fieldName];
  if (resolver && !isExcluded(resolver)) {
    return resolver.cliFlag;
  }
  return fieldName;
}

/**
 * get all imports needed for a set of fields
 */
export function getImportsForFields(
  fieldNames: string[]
): Map<string, Set<string>> {
  const imports = new Map<string, Set<string>>();

  for (const name of fieldNames) {
    const resolver = fieldResolvers[name];
    if (!resolver) continue;

    if (isResolved(resolver)) {
      const existing = imports.get(resolver.from) ?? new Set();
      existing.add(resolver.import);
      imports.set(resolver.from, existing);
    }

    if (isPassthrough(resolver) && resolver.transformImport && resolver.transformFrom) {
      const existing = imports.get(resolver.transformFrom) ?? new Set();
      existing.add(resolver.transformImport);
      imports.set(resolver.transformFrom, existing);
    }
  }

  return imports;
}
