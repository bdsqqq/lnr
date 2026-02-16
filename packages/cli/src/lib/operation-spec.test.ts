import { describe, test, expect } from "bun:test";
import { allOperationSpecs } from "./operation-specs";
import type { AnyOperationSpec } from "./operation-spec";

import { issueOperationSpec, issueInput } from "../generated/issue";
import { projectOperationSpec, projectInput } from "../generated/project";
import { labelOperationSpec, labelInput } from "../generated/label";
import { docOperationSpec, docInput } from "../generated/doc";
import { cycleOperationSpec, cycleInput } from "../router/cycles";
import { viewOperationSpec, viewInput } from "../router/views";
import { gitAutomationStateOperationSpec, gitAutomationStateInput } from "../router/git-automation-states";
import { gitAutomationTargetBranchOperationSpec, gitAutomationTargetBranchInput } from "../router/git-automation-target-branches";
import { parseSchema, type SchemaJson } from "./command-introspection";

const ITERATIONS = 200;

// mulberry32 seeded PRNG — deterministic across runs
function mulberry32(seed: number) {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seed = Number(process.env.PROP_TEST_SEED) || 42;
const rng = mulberry32(seed);

type SpecWithSchema = {
  spec: AnyOperationSpec;
  schema: unknown;
  positionalKey: string;
  deleteKey?: string;
  archiveKey?: string;
  extraHighPrecedence: { flag: string; operation: string }[];
};

const specsWithSchemas: SpecWithSchema[] = [
  {
    spec: issueOperationSpec,
    schema: issueInput,
    positionalKey: "idOrNew",
    archiveKey: "archive",
    extraHighPrecedence: [],
  },
  {
    spec: projectOperationSpec,
    schema: projectInput,
    positionalKey: "name",
    deleteKey: "delete",
    extraHighPrecedence: [],
  },
  {
    spec: labelOperationSpec,
    schema: labelInput,
    positionalKey: "id",
    deleteKey: "delete",
    extraHighPrecedence: [],
  },
  {
    spec: docOperationSpec,
    schema: docInput,
    positionalKey: "id",
    deleteKey: "delete",
    extraHighPrecedence: [],
  },
  {
    spec: cycleOperationSpec,
    schema: cycleInput,
    positionalKey: "nameOrNumber",
    deleteKey: "delete",
    extraHighPrecedence: [{ flag: "current", operation: "current" }],
  },
  {
    spec: viewOperationSpec,
    schema: viewInput,
    positionalKey: "nameOrId",
    deleteKey: "delete",
    extraHighPrecedence: [],
  },
  {
    spec: gitAutomationStateOperationSpec,
    schema: gitAutomationStateInput,
    positionalKey: "idOrEvent",
    deleteKey: "delete",
    extraHighPrecedence: [],
  },
  {
    spec: gitAutomationTargetBranchOperationSpec,
    schema: gitAutomationTargetBranchInput,
    positionalKey: "patternOrId",
    deleteKey: "delete",
    extraHighPrecedence: [],
  },
];

function getSchemaFlags(schema: unknown): { name: string; type: string; required: boolean }[] {
  if (typeof schema !== "function" || !("json" in schema)) return [];
  const json = (schema as { json: SchemaJson }).json;
  return parseSchema(json);
}

function randomValue(type: string, rng: () => number): unknown {
  if (type === "boolean") return rng() > 0.5;
  if (type === "number") return Math.floor(rng() * 100);
  return `val-${Math.floor(rng() * 10000)}`;
}

function generateRandomInput(
  sws: SpecWithSchema,
  rng: () => number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const flags = getSchemaFlags(sws.schema);
  const input: Record<string, unknown> = {};

  for (const flag of flags) {
    if (flag.required) {
      input[flag.name] = randomValue(flag.type, rng);
    } else if (rng() > 0.6) {
      input[flag.name] = randomValue(flag.type, rng);
    }
  }

  return { ...input, ...overrides };
}

// === property A: operation dispatch determinism ===
describe("property A: operation dispatch determinism", () => {
  for (const sws of specsWithSchemas) {
    describe(sws.spec.command, () => {
      test(`inferOperation returns a value in operations for ${ITERATIONS} random inputs`, () => {
        for (let i = 0; i < ITERATIONS; i++) {
          const input = generateRandomInput(sws, rng);
          const result = sws.spec.inferOperation(input);
          expect(sws.spec.operations).toContain(result);
        }
      });

      test("inferOperation is deterministic (same input → same output)", () => {
        const localRng = mulberry32(seed + 1000);
        for (let i = 0; i < ITERATIONS; i++) {
          const input = generateRandomInput(sws, localRng);
          const frozen = { ...input };
          const r1 = sws.spec.inferOperation(frozen);
          const r2 = sws.spec.inferOperation(frozen);
          expect(r1).toBe(r2);
        }
      });
    });
  }
});

// === property B: precedence under contradictory flags ===
describe("property B: precedence under contradictory flags", () => {
  for (const sws of specsWithSchemas) {
    const highPrecedenceFlags = sws.extraHighPrecedence.map((hp) => hp.flag);

    describe(sws.spec.command, () => {
      if (sws.extraHighPrecedence.length > 0) {
        for (const hp of sws.extraHighPrecedence) {
          test(`--${hp.flag} has highest precedence → ${hp.operation}`, () => {
            for (let i = 0; i < 50; i++) {
              const overrides: Record<string, unknown> = {
                [sws.positionalKey]: rng() > 0.5 ? "new" : `ENG-${i}`,
                [hp.flag]: true,
              };
              if (sws.deleteKey) overrides[sws.deleteKey] = rng() > 0.5 ? true : undefined;
              const input = generateRandomInput(sws, rng, overrides);
              const result = sws.spec.inferOperation(input);
              expect(result).toBe(hp.operation);
            }
          });
        }
      }

      test("positional 'new' → create (without higher-precedence flags)", () => {
        for (let i = 0; i < 50; i++) {
          const overrides: Record<string, unknown> = { [sws.positionalKey]: "new" };
          for (const hp of highPrecedenceFlags) overrides[hp] = undefined;
          const input = generateRandomInput(sws, rng, overrides);
          for (const hp of highPrecedenceFlags) delete input[hp];
          const result = sws.spec.inferOperation(input);
          expect(result).toBe("create");
        }
      });

      if (sws.deleteKey) {
        test(`--${sws.deleteKey} wins over mutation flags (without higher-precedence flags)`, () => {
          const expectedOp = sws.deleteKey === "archive" ? "archive" : "delete";
          for (let i = 0; i < 50; i++) {
            const mutationOverrides: Record<string, unknown> = {
              [sws.positionalKey]: `ENG-${i}`,
              [sws.deleteKey!]: true,
            };
            for (const hp of highPrecedenceFlags) mutationOverrides[hp] = undefined;
            for (const mf of sws.spec.mutationFlags) {
              if (rng() > 0.5) mutationOverrides[mf] = randomValue("string", rng);
            }
            const input = generateRandomInput(sws, rng, mutationOverrides);
            for (const hp of highPrecedenceFlags) delete input[hp];
            const result = sws.spec.inferOperation(input);
            expect(result).toBe(expectedOp);
          }
        });
      }

      if (sws.archiveKey) {
        test(`--${sws.archiveKey} alone → archive`, () => {
          const input = generateRandomInput(sws, rng, {
            [sws.positionalKey]: "ENG-1",
            [sws.archiveKey!]: true,
          });
          for (const mf of sws.spec.mutationFlags) {
            delete input[mf];
          }
          input[sws.archiveKey!] = true;
          const result = sws.spec.inferOperation(input);
          expect(result).toBe("archive");
        });

        test(`--${sws.archiveKey} + mutation flags → update (archive runs after updates)`, () => {
          for (let i = 0; i < 50; i++) {
            const mutationOverrides: Record<string, unknown> = {
              [sws.positionalKey]: `ENG-${i}`,
              [sws.archiveKey!]: true,
            };
            const mf = sws.spec.mutationFlags[i % sws.spec.mutationFlags.length]!;
            mutationOverrides[mf] = randomValue("string", rng);
            const input = generateRandomInput(sws, rng, mutationOverrides);
            const result = sws.spec.inferOperation(input);
            expect(result).toBe("update");
          }
        });
      }

      test("create wins over delete/archive (without higher-precedence flags)", () => {
        const overrides: Record<string, unknown> = { [sws.positionalKey]: "new" };
        if (sws.deleteKey) overrides[sws.deleteKey] = true;
        if (sws.archiveKey) overrides[sws.archiveKey] = true;
        for (const hp of highPrecedenceFlags) overrides[hp] = undefined;
        const input = generateRandomInput(sws, rng, overrides);
        for (const hp of highPrecedenceFlags) delete input[hp];
        const result = sws.spec.inferOperation(input);
        expect(result).toBe("create");
      });
    });
  }
});

// === property C: mutation flag completeness ===
describe("property C: mutation flag completeness", () => {
  for (const sws of specsWithSchemas) {
    describe(sws.spec.command, () => {
      test("every mutation flag triggers 'update' when set alone (no higher-precedence ops)", () => {
        for (const flag of sws.spec.mutationFlags) {
          const input: Record<string, unknown> = {
            [sws.positionalKey]: "ENG-1",
            [flag]: randomValue("string", rng),
          };
          const result = sws.spec.inferOperation(input);
          expect(result).toBe("update");
        }
      });

      test("no mutation flags → 'read' (given non-new positional, no delete/archive)", () => {
        const flags = getSchemaFlags(sws.schema);
        const input: Record<string, unknown> = { [sws.positionalKey]: "ENG-1" };
        const requiredFlags = flags.filter(
          (f) => f.required && f.name !== sws.positionalKey
        );
        for (const rf of requiredFlags) {
          input[rf.name] = randomValue(rf.type, rng);
        }
        const result = sws.spec.inferOperation(input);
        expect(result).toBe("read");
      });

      test("non-mutation optional flags do NOT trigger 'update'", () => {
        const flags = getSchemaFlags(sws.schema);
        const mutationSet = new Set(sws.spec.mutationFlags);
        const nonMutationFlags = flags.filter(
          (f) =>
            !f.required &&
            !mutationSet.has(f.name) &&
            f.name !== sws.positionalKey &&
            f.name !== sws.deleteKey &&
            f.name !== sws.archiveKey &&
            !sws.extraHighPrecedence.some((hp) => hp.flag === f.name)
        );

        const readFlags = nonMutationFlags.filter(
          (f) => !["json", "quiet", "verbose", "open", "branch", "comments", "subIssues", "issues", "updates", "labels", "showStatus", "links", "milestones"].includes(f.name)
              || ["json", "quiet", "verbose"].includes(f.name)
        );

        for (const flag of readFlags) {
          const input: Record<string, unknown> = {
            [sws.positionalKey]: "ENG-1",
            [flag.name]: randomValue(flag.type, rng),
          };
          const flags2 = getSchemaFlags(sws.schema);
          const requiredFlags = flags2.filter(
            (f) => f.required && f.name !== sws.positionalKey
          );
          for (const rf of requiredFlags) {
            input[rf.name] = randomValue(rf.type, rng);
          }
          const result = sws.spec.inferOperation(input);
          expect(result).not.toBe("update");
        }
      });
    });
  }
});
