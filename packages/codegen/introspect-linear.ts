#!/usr/bin/env bun

/**
 * Run GraphQL introspection query against Linear API.
 * Saves full schema to schema.json with types, enums, descriptions, and deprecation status.
 *
 * Usage: LINEAR_API_KEY=xxx bun run packages/codegen/introspect-linear.ts
 */

import { getSupportedEntityNames } from "./entity-config";

// Get base entity types from config
const supportedEntities = getSupportedEntityNames();

// Linear API limits query complexity to 10000, so we fetch schema in batches
// First get all type names, then fetch details for specific types we need

const TYPE_LIST_QUERY = `
  query TypeListQuery {
    __schema {
      types {
        kind
        name
      }
    }
  }
`;

// Fetch details for a single type
function typeDetailQuery(typeName: string) {
  return `
    query TypeDetailQuery {
      __type(name: "${typeName}") {
        kind
        name
        description
        fields(includeDeprecated: true) {
          name
          description
          isDeprecated
          deprecationReason
          type {
            kind
            name
            ofType { kind name ofType { kind name ofType { kind name } } }
          }
          args {
            name
            description
            type {
              kind
              name
              ofType { kind name ofType { kind name ofType { kind name } } }
            }
            defaultValue
          }
        }
        inputFields {
          name
          description
          type {
            kind
            name
            ofType { kind name ofType { kind name ofType { kind name } } }
          }
          defaultValue
        }
        enumValues(includeDeprecated: true) {
          name
          description
          isDeprecated
          deprecationReason
        }
      }
    }
  `;
}

async function getApiKey(): Promise<string> {
  // Try environment variable first
  if (process.env.LINEAR_API_KEY) {
    return process.env.LINEAR_API_KEY;
  }

  // Fall back to lnr config
  const configPath = `${process.env.HOME}/.lnr/config.json`;
  try {
    const config = await Bun.file(configPath).json();
    if (config.api_key) {
      console.log("using API key from ~/.lnr/config.json");
      return config.api_key;
    }
  } catch {
    // Config doesn't exist or is invalid
  }

  console.error("error: no API key found");
  console.error("fix: export LINEAR_API_KEY=lin_api_xxx or run 'lnr auth'");
  process.exit(1);
}

async function fetchGraphQL(apiKey: string, query: string) {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(`GraphQL: ${result.errors[0]?.message || "unknown error"}`);
  }

  return result.data;
}

async function main() {
  const apiKey = await getApiKey();

  console.log("fetching type list from Linear API...");

  // Get list of all types
  const typeListData = await fetchGraphQL(apiKey, TYPE_LIST_QUERY);
  const allTypes = typeListData.__schema.types as { kind: string; name: string }[];

  // Filter to types we care about (skip internal __ types)
  const relevantTypes = allTypes.filter(
    (t) => !t.name.startsWith("__") && (t.kind === "INPUT_OBJECT" || t.kind === "ENUM" || t.kind === "OBJECT")
  );

  console.log(`found ${relevantTypes.length} relevant types, fetching details...`);

  // Prioritize types we need for CLI generation
  // Start with supported entities from config, then add related input types
  const priorityTypes = [
    // Base entity types from config
    ...supportedEntities,
    // Additional related types not in config but needed for introspection
    "Team",
    "WorkflowState",
    "Label",
    // Input types for CRUD operations
    "IssueCreateInput",
    "IssueUpdateInput",
    "ProjectCreateInput",
    "ProjectUpdateInput",
    "ProjectMilestoneCreateInput",
    "ProjectMilestoneUpdateInput",
    "CommentCreateInput",
    "CommentUpdateInput",
    "DocumentCreateInput",
    "DocumentUpdateInput",
    "IssueLabelCreateInput",
    "IssueLabelUpdateInput",
    "CycleCreateInput",
    "CycleUpdateInput",
    "CustomViewCreateInput",
    "CustomViewUpdateInput",
    "GitAutomationStateCreateInput",
    "GitAutomationStateUpdateInput",
    "GitAutomationTargetBranchCreateInput",
    "GitAutomationTargetBranchUpdateInput",
    "ReactionCreateInput",
    "NotificationSubscriptionCreateInput",
    "EntityExternalLinkCreateInput",
    "EntityExternalLinkUpdateInput",
    "IssueBatchPayload",
    "AgentSessionUpdateInput",
  ];

  // Also get all enums
  const enumTypes = relevantTypes.filter((t) => t.kind === "ENUM").map((t) => t.name);

  // Fetch priority types + enums
  const typesToFetch = [...new Set([...priorityTypes, ...enumTypes])];

  const types: any[] = [];
  const failedTypes: string[] = [];
  for (const typeName of typesToFetch) {
    try {
      const data = await fetchGraphQL(apiKey, typeDetailQuery(typeName));
      if (data.__type) {
        types.push(data.__type);
        process.stdout.write(".");
      }
    } catch (err) {
      failedTypes.push(typeName);
      console.error(`\nwarning: failed to fetch ${typeName}: ${(err as Error).message}`);
    }
  }
  console.log();

  // summary of fetch results
  const total = typesToFetch.length;
  const succeeded = types.length;
  const failed = failedTypes.length;

  if (failed === total) {
    console.error(`error: all ${total} type fetches failed`);
    console.error(`fix: check LINEAR_API_KEY and network connectivity`);
    process.exit(1);
  }

  console.log(`fetched ${succeeded} of ${total} types (${failed} failed)`);
  if (failed > 0) {
    console.log(`failed types: ${failedTypes.join(", ")}`);
  }

  // Build schema structure
  const schema = {
    __schema: {
      types,
      allTypeNames: allTypes.map((t) => t.name),
    },
  };

  const outputPath = new URL("./schema.json", import.meta.url).pathname;
  await Bun.write(outputPath, JSON.stringify(schema, null, 2));
  console.log(`wrote schema to ${outputPath}`);

  // Check IssueUpdateInput
  const issueUpdateInput = types.find((t: any) => t.name === "IssueUpdateInput");
  if (issueUpdateInput) {
    const fieldsWithDesc = issueUpdateInput.inputFields?.filter((f: any) => f.description) || [];
    console.log(`\nIssueUpdateInput: ${issueUpdateInput.inputFields?.length || 0} fields, ${fieldsWithDesc.length} with descriptions`);

    // Show sample fields
    const samples = issueUpdateInput.inputFields?.slice(0, 3) || [];
    for (const field of samples) {
      console.log(`  - ${field.name}: ${field.description?.slice(0, 60) || "(no description)"}...`);
    }
  } else {
    console.error("warning: IssueUpdateInput not found in schema");
  }

  // Check Priority enum
  const priorityEnum = types.find((t: any) => t.name === "PriorityValue" || t.name === "Priority");
  if (!priorityEnum) {
    // Linear uses Int for priority, check IssuePriorityValue
    const issuePriorityValue = types.find((t: any) => t.name === "IssuePriorityValue");
    if (issuePriorityValue) {
      console.log(`\nIssuePriorityValue enum: ${issuePriorityValue.enumValues?.length || 0} values`);
      for (const val of issuePriorityValue.enumValues || []) {
        console.log(`  - ${val.name}: ${val.description || "(no description)"}`);
      }
    } else {
      // Priority might be defined differently, check for any priority-related enums
      const priorityRelated = types.filter((t: any) => t.name.toLowerCase().includes("priority") && t.kind === "ENUM");
      console.log(`\npriority-related enums: ${priorityRelated.map((t: any) => t.name).join(", ") || "none found"}`);
    }
  } else {
    console.log(`\n${priorityEnum.name} enum: ${priorityEnum.enumValues?.length || 0} values`);
    for (const val of priorityEnum.enumValues || []) {
      console.log(`  - ${val.name}: ${val.description || "(no description)"}`);
    }
  }

  // Check for workflow states
  const workflowState = types.find((t: any) => t.name === "WorkflowState");
  if (workflowState) {
    console.log(`\nWorkflowState type: ${workflowState.fields?.length || 0} fields`);
  }

  // Summary stats
  const enums = types.filter((t: any) => t.kind === "ENUM" && !t.name.startsWith("__"));
  const inputTypes = types.filter((t: any) => t.kind === "INPUT_OBJECT");
  const objectTypes = types.filter((t: any) => t.kind === "OBJECT" && !t.name.startsWith("__"));

  console.log(`\nschema summary:`);
  console.log(`  - ${objectTypes.length} object types`);
  console.log(`  - ${inputTypes.length} input types`);
  console.log(`  - ${enums.length} enums`);
  console.log(`  - ${types.filter((t: any) => t.description).length} types with descriptions`);

  // Check deprecations
  const deprecatedFields: string[] = [];
  for (const type of types) {
    for (const field of type.fields || []) {
      if (field.isDeprecated) {
        deprecatedFields.push(`${type.name}.${field.name}`);
      }
    }
    for (const val of type.enumValues || []) {
      if (val.isDeprecated) {
        deprecatedFields.push(`${type.name}.${val.name}`);
      }
    }
  }
  console.log(`  - ${deprecatedFields.length} deprecated fields/values`);
  if (deprecatedFields.length > 0 && deprecatedFields.length <= 5) {
    for (const d of deprecatedFields) {
      console.log(`    - ${d}`);
    }
  }
}

main().catch((err) => {
  console.error("error:", err.message);
  process.exit(1);
});
