import { expect, mock, test } from "bun:test";
import { InvalidInputLinearError, LinearError, LinearErrorType, type LinearGraphQLError, type LinearClient } from "@linear/sdk";
import { isRootIdentifierRejection } from "./client";
import { getInitiative, findInitiativeByName } from "./initiatives";
import { getRoadmap, findRoadmapByName } from "./roadmaps";

const common = { id: "aabbccdd-1234-5678-9abc-123456789abc", name: "Example", slugId: "example-slug",
  description: "", createdAt: new Date(0), updatedAt: new Date(1), url: "https://example.com", color: null };
const initiative = { ...common, status: "Planned" as const, health: null, icon: null,
  targetDate: null, startedAt: null, completedAt: null };
for (const entity of ["initiative", "roadmap"] as const) {
  for (const mode of ["direct", "name", "slug"] as const) {
    for (const phase of ["root", ...(entity === "roadmap" ? ["owner"] : []), "missing", "present", "populated"]) {
      for (const failure of ["root", "owner"].includes(phase) ? [new Error("permission denied"), { opaque: true }] : [undefined]) {
        test(`${entity} ${mode} ${phase} ${failure instanceof Error ? "error" : failure ? "opaque" : "control"}`, async () => {
          const owner = mock(async () => {
            if (phase === "owner") throw failure;
            return phase === "populated" ? { id: "owner-id", name: "Owner" } : null;
          });
          const root = mock(async (..._args: unknown[]) => {
            if (phase === "root") throw failure;
            const value = entity === "initiative" ? initiative : { ...common, get owner() { return owner(); } };
            return mode === "direct" ? phase === "missing" ? null : value :
              { nodes: phase === "missing" ? [] : [value] };
          });
          const client = { [mode === "direct" ? entity : `${entity}s`]: root } as unknown as LinearClient;
          // Core direct methods remain arbitrary-string SDK forwards, not CLI UUID parsers.
          const input = mode === "direct" ? "arbitrary SDK identifier" : mode === "slug" ? "EXAMPLE-SLUG" : "eXaMpLe";
          const read = entity === "initiative"
            ? mode === "direct" ? getInitiative : findInitiativeByName
            : mode === "direct" ? getRoadmap : findRoadmapByName;
          const result = read(client, input);
          if (failure) await expect(result).rejects.toBe(failure);
          else expect(await result).toEqual(phase === "missing" ? null : entity === "initiative" ? initiative :
            { ...common, ownerId: phase === "populated" ? "owner-id" : null, ownerName: phase === "populated" ? "Owner" : null });
          expect(root.mock.calls).toEqual(mode === "direct" ? [[input]] : [[]]);
          expect(owner.mock.calls).toEqual(entity === "roadmap" && !["root", "missing"].includes(phase) ? [[]] : []);
        });
      }
    }
  }
}

for (const root of ["initiative", "roadmap"] as const) {
  const parsed = (type = LinearErrorType.InvalidInput, path: string[] = [root]): LinearGraphQLError =>
    ({ message: "arbitrary diagnostic", type, path, userError: undefined });
  const cases = [
    { name: "one exact root", error: new InvalidInputLinearError(undefined, [parsed()]), allowed: true },
    { name: "multiple exact roots", error: new InvalidInputLinearError(undefined, [parsed(), parsed()]), allowed: true },
    { name: "empty parsed errors", error: new InvalidInputLinearError(undefined, []), allowed: false },
    { name: "missing parsed errors", error: new InvalidInputLinearError(), allowed: false },
    { name: "generic class", error: new LinearError(undefined, [parsed()], LinearErrorType.InvalidInput), allowed: false },
    { name: "plain error", error: new Error("invalid input"), allowed: false },
    { name: "structural impostor", error: { type: LinearErrorType.InvalidInput, errors: [parsed()] }, allowed: false },
    { name: "empty path", error: new InvalidInputLinearError(undefined, [parsed(LinearErrorType.InvalidInput, [])]), allowed: false },
    { name: "missing path", error: new InvalidInputLinearError(undefined, [{ ...parsed(), path: undefined }]), allowed: false },
    { name: "nested path", error: new InvalidInputLinearError(undefined, [parsed(LinearErrorType.InvalidInput, [root, "owner"])]), allowed: false },
    { name: "lazy user root", error: new InvalidInputLinearError(undefined, [parsed(LinearErrorType.InvalidInput, ["user"])]), allowed: false },
    { name: "wrong entity root", error: new InvalidInputLinearError(undefined, [parsed(LinearErrorType.InvalidInput, [root === "initiative" ? "roadmap" : "initiative"])]), allowed: false },
    { name: "mixed forbidden", error: new InvalidInputLinearError(undefined, [parsed(), parsed(LinearErrorType.Forbidden)]), allowed: false },
    { name: "mixed network", error: new InvalidInputLinearError(undefined, [parsed(), parsed(LinearErrorType.NetworkError)]), allowed: false },
    { name: "mixed paths", error: new InvalidInputLinearError(undefined, [parsed(), parsed(LinearErrorType.InvalidInput, ["user"])]), allowed: false },
  ];
  for (const entry of cases) test(`${root} identifier rejection guard: ${entry.name}`, () => {
    expect(isRootIdentifierRejection(entry.error, root)).toBe(entry.allowed);
  });
}
