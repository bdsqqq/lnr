/**
 * Hand-crafted handlers for CLI-only issue features.
 * These are not backed by Linear's schema — they're pure CLI UX.
 *
 * The generator imports these and dispatches to them.
 * Edit freely; regeneration won't touch this file.
 */

import { linkGitHubPR, type Issue } from "@bdsqqq/lnr-core";
import { exitWithError } from "../lib/error";

type Client = Parameters<typeof linkGitHubPR>[0];

/**
 * --pr: link a GitHub PR URL to the issue
 */
export async function handlePr(
  client: Client,
  issue: Issue,
  prUrl: string
): Promise<void> {
  const success = await linkGitHubPR(client, issue.id, prUrl);
  if (!success) {
    exitWithError(`failed to link pr ${prUrl}`);
  }
  console.log(`linked pr ${prUrl} to ${issue.identifier}`);
}
