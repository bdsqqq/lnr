import { expect, mock, test } from "bun:test";
import type { LinearClient } from "@linear/sdk";
import { listCycles } from "./cycles";
import { listGitAutomationTargetBranches } from "./git-automation-target-branches";

for (const [name, list, connectionName] of [
  ["cycles", listCycles, "cycles"],
  ["git-branches", listGitAutomationTargetBranches, "gitAutomationStates"],
] as const) {
  for (const phase of ["lookup", "connection"] as const) {
    for (const message of ["permission denied", "network unavailable"]) {
      test(`${name} preserves ${phase} error identity: ${message}`, async () => {
        const error = new Error(message);
        const connection = mock(async () => { throw error; });
        const team = mock(async () => {
          if (phase === "lookup") throw error;
          return { [connectionName]: connection };
        });
        await expect(list({ team } as unknown as LinearClient, "ENG")).rejects.toBe(error);
        expect(team).toHaveBeenCalledTimes(1);
        expect(team).toHaveBeenCalledWith("ENG");
        expect(connection).toHaveBeenCalledTimes(phase === "connection" ? 1 : 0);
      });
    }
  }
  for (const missingTeam of [false, true]) {
    test(`${name} preserves ${missingTeam ? "null team" : "empty connection"} fallback`, async () => {
      const connection = mock(async () => ({ nodes: [] }));
      const team = mock(async () => missingTeam ? null : { [connectionName]: connection });
      expect(await list({ team } as unknown as LinearClient, "ENG")).toEqual([]);
      expect(team).toHaveBeenCalledTimes(1);
      expect(connection).toHaveBeenCalledTimes(missingTeam ? 0 : 1);
    });
  }
}
