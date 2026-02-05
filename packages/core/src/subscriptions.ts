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
 * subscription type mappings per entity.
 * Linear requires specific notification types, not a generic "all".
 */
const SUBSCRIPTION_TYPES = {
  project: ["projectupdatecreated", "projectnewcomment"],
  team: ["issuecreated", "issuestatuschanged"],
  initiative: ["initiativenewcomment", "initiativeupdatecreated"],
  cycle: ["issuecreated"],
  label: ["issuecreated"],
  customView: ["issueaddedtoview"],
  user: ["issuecreated"],
} as const;

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
