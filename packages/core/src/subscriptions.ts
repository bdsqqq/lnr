import type { LinearClient } from "@linear/sdk";

export type SubscriptionTarget =
  | { type: "project"; projectId: string }
  | { type: "team"; teamId: string }
  | { type: "initiative"; initiativeId: string }
  | { type: "cycle"; cycleId: string }
  | { type: "label"; labelId: string }
  | { type: "customView"; customViewId: string }
  | { type: "user"; userId: string };

/**
 * valid notification subscription types from Linear API.
 * camelCase required — Linear validates case-sensitively.
 */
export const NOTIFICATION_SUBSCRIPTION_TYPES = [
  "issueCreated",
  "issueStatusChanged",
  "issueAddedToTriage",
  "issueSlaHighRisk",
  "issueSlaBreached",
  "teamUpdateCreated",
  "issueAddedToView",
  "projectUpdateCreated",
  "projectNewComment",
  "projectMilestoneNewComment",
  "projectDescriptionContentChange",
  "projectMilestoneDescriptionContentChange",
  "customerNeedCreated",
  "initiativeNewComment",
  "initiativeDescriptionContentChange",
  "initiativeUpdateCreated",
  "initiativeUpdatePrompt",
  "customerNeedMarkedAsImportant",
  "customerNeedResolved",
] as const;

export type NotificationSubscriptionType =
  (typeof NOTIFICATION_SUBSCRIPTION_TYPES)[number];

/**
 * subscription type mappings per entity.
 * uses subset of valid types relevant to each entity context.
 */
const SUBSCRIPTION_TYPES: Record<
  SubscriptionTarget["type"],
  readonly NotificationSubscriptionType[]
> = {
  project: [
    "projectUpdateCreated",
    "projectNewComment",
    "projectMilestoneNewComment",
    "projectDescriptionContentChange",
    "projectMilestoneDescriptionContentChange",
  ],
  team: ["issueCreated", "issueStatusChanged", "issueAddedToTriage", "teamUpdateCreated"],
  initiative: [
    "initiativeNewComment",
    "initiativeDescriptionContentChange",
    "initiativeUpdateCreated",
    "initiativeUpdatePrompt",
  ],
  cycle: ["issueCreated", "issueStatusChanged"],
  label: ["issueCreated"],
  customView: ["issueAddedToView"],
  user: ["issueCreated"],
};

export async function createSubscription(
  client: LinearClient,
  target: SubscriptionTarget
): Promise<string> {
  const baseInput = (() => {
    switch (target.type) {
      case "project":
        return { projectId: target.projectId };
      case "team":
        return { teamId: target.teamId };
      case "initiative":
        return { initiativeId: target.initiativeId };
      case "cycle":
        return { cycleId: target.cycleId };
      case "label":
        return { labelId: target.labelId };
      case "customView":
        return { customViewId: target.customViewId };
      case "user":
        return { userId: target.userId };
    }
  })();

  const input = {
    ...baseInput,
    notificationSubscriptionTypes: [...SUBSCRIPTION_TYPES[target.type]],
  };

  const result = await client.createNotificationSubscription(input);
  if (!result.success) {
    throw new Error("failed to create subscription");
  }
  return result.lastSyncId.toString();
}

export async function deleteSubscription(
  client: LinearClient,
  subscriptionId: string
): Promise<boolean> {
  const result = await client.deleteNotificationSubscription(subscriptionId);
  return result.success;
}

export async function subscribeToIssue(
  client: LinearClient,
  issueId: string
): Promise<boolean> {
  const viewer = await client.viewer;
  const issue = await client.issue(issueId);
  const subscribers = await issue.subscribers();
  const currentIds = subscribers.nodes.map((u) => u.id);
  
  if (currentIds.includes(viewer.id)) {
    return true; // already subscribed
  }
  
  const result = await client.updateIssue(issueId, {
    subscriberIds: [...currentIds, viewer.id],
  });
  return result.success;
}

export async function unsubscribeFromIssue(
  client: LinearClient,
  issueId: string
): Promise<boolean> {
  const viewer = await client.viewer;
  const issue = await client.issue(issueId);
  const subscribers = await issue.subscribers();
  const currentIds = subscribers.nodes.map((u) => u.id);
  
  if (!currentIds.includes(viewer.id)) {
    return true; // already not subscribed
  }
  
  const result = await client.updateIssue(issueId, {
    subscriberIds: currentIds.filter((id) => id !== viewer.id),
  });
  return result.success;
}
