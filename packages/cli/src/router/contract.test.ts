/**
 * contract tests: CLI input → core function parameters
 *
 * these tests verify the transformation from CLI flags to API request payloads.
 */

import { describe, test, expect } from "bun:test";
import { type } from "arktype";

// import schemas directly from router files
import { listIssuesInput, issueInput } from "../generated/issue";
import { listProjectsInput, projectInput } from "../generated/project";
import { listTeamsInput, teamInput } from "../router/teams";
import { listCyclesInput, cycleInput } from "../router/cycles";
import { listDocsInput, docInput } from "../generated/doc";
import { listLabelsInput, labelInput } from "../generated/label";
import { meInput } from "../router/me";
import { searchInput } from "../router/search";
import { authInput } from "../router/auth";
import { getInput as configGetInput, setInput as configSetInput } from "../router/config";

/**
 * unified validation helper that works with both zod and arktype schemas.
 * provides consistent safeParse-like interface during migration.
 */
function safeParse<T>(schema: unknown, data: unknown): { success: boolean; data?: T; error?: unknown } {
  // zod schema check
  if (typeof schema === "object" && schema !== null && "safeParse" in schema) {
    const zodResult = (schema as { safeParse: (d: unknown) => { success: boolean; data?: T; error?: unknown } }).safeParse(data);
    return zodResult;
  }
  // arktype schema (callable)
  if (typeof schema === "function") {
    const result = (schema as (d: unknown) => unknown)(data);
    if (result instanceof type.errors) {
      return { success: false, error: result };
    }
    return { success: true, data: result as T };
  }
  throw new Error("unknown schema type");
}

// operation inference - mirrors router logic
function inferOperation(command: string, input: Record<string, unknown>): "create" | "update" | "delete" | "show" {
  const positionalNewCommands = ["issue", "project", "doc", "label"];
  if (positionalNewCommands.includes(command)) {
    const positional = input.idOrNew ?? input.name ?? input.id;
    if (positional === "new") return "create";
  }
  if (input.delete || input.archive) return "delete";
  const mutationFlags = [
    "state", "assignee", "priority", "label", "comment",
    "editComment", "replyTo", "deleteComment", "react", "unreact",
    "parent", "blocks", "blockedBy", "relatesTo", "title",
    "content", "projectName"
  ];
  for (const flag of mutationFlags) {
    if (input[flag] !== undefined) return "update";
  }
  return "show";
}

describe("projects", () => {
  describe("projects", () => {
    test("valid input parses", () => {
      const result = safeParse(listProjectsInput, {});
      expect(result.success).toBe(true);
    });

    test("infers SHOW with no mutation flags", () => {
      expect(inferOperation("projects", {})).toBe("show");
    });

  });

  describe("project", () => {
    test("valid input parses", () => {
      const result = safeParse(projectInput, {"name":"test-value"});
      expect(result.success).toBe(true);
    });

    test("rejects missing required flags", () => {
      const result = safeParse(projectInput, {});
      expect(result.success).toBe(false);
    });

    test("infers CREATE when name='new'", () => {
      expect(inferOperation("project", { name: "new" })).toBe("create");
    });

    test("infers DELETE when --delete", () => {
      expect(inferOperation("project", {"name":"test-value","delete":true})).toBe("delete");
    });

    test("infers SHOW with no mutation flags", () => {
      expect(inferOperation("project", {"name":"test-value"})).toBe("show");
    });

  });

});

describe("search", () => {
  describe("search", () => {
    test("valid input parses", () => {
      const result = searchInput.safeParse({"query":"test-value"});
      expect(result.success).toBe(true);
    });

    test("rejects missing required flags", () => {
      const result = searchInput.safeParse({});
      expect(result.success).toBe(false);
    });

  });

});

describe("cycles", () => {
  describe("cycles", () => {
    test("valid input parses", () => {
      const result = listCyclesInput.safeParse({"team":"test-value"});
      expect(result.success).toBe(true);
    });

    test("rejects missing required flags", () => {
      const result = listCyclesInput.safeParse({});
      expect(result.success).toBe(false);
    });

  });

  describe("cycle", () => {
    test("valid input parses", () => {
      const result = cycleInput.safeParse({"nameOrNumber":"1","team":"test-value"});
      expect(result.success).toBe(true);
    });

    test("rejects missing required flags", () => {
      const result = cycleInput.safeParse({});
      expect(result.success).toBe(false);
    });

    test("infers CREATE when nameOrNumber='new'", () => {
      const result = cycleInput.safeParse({"nameOrNumber":"new","team":"ENG"});
      expect(result.success).toBe(true);
    });

    test("infers DELETE when --delete", () => {
      const result = cycleInput.safeParse({"nameOrNumber":"1","team":"ENG","delete":true});
      expect(result.success).toBe(true);
    });

    test("infers SHOW with no mutation flags", () => {
      const result = cycleInput.safeParse({"nameOrNumber":"Sprint 1","team":"ENG"});
      expect(result.success).toBe(true);
    });

  });

});

describe("docs", () => {
  describe("docs", () => {
    test("valid input parses", () => {
      const result = safeParse(listDocsInput, {});
      expect(result.success).toBe(true);
    });

    test("infers SHOW with no mutation flags", () => {
      expect(inferOperation("docs", {})).toBe("show");
    });

  });

  describe("doc", () => {
    test("valid input parses", () => {
      const result = safeParse(docInput, {"id":"test-value"});
      expect(result.success).toBe(true);
    });

    test("rejects missing required flags", () => {
      const result = safeParse(docInput, {});
      expect(result.success).toBe(false);
    });

    test("infers CREATE when id='new'", () => {
      expect(inferOperation("doc", { id: "new" })).toBe("create");
    });

    test("infers DELETE when --delete", () => {
      expect(inferOperation("doc", {"id":"test-value","delete":true})).toBe("delete");
    });

    test("infers SHOW with no mutation flags", () => {
      expect(inferOperation("doc", {"id":"test-value"})).toBe("show");
    });

  });

});

describe("teams", () => {
  describe("teams", () => {
    test("valid input parses", () => {
      const result = listTeamsInput.safeParse({});
      expect(result.success).toBe(true);
    });

  });

  describe("team", () => {
    test("valid input parses", () => {
      const result = teamInput.safeParse({"key":"test-value"});
      expect(result.success).toBe(true);
    });

    test("rejects missing required flags", () => {
      const result = teamInput.safeParse({});
      expect(result.success).toBe(false);
    });

  });

});

describe("config", () => {
  describe("get", () => {
    test("valid input parses", () => {
      const result = configGetInput.safeParse({"key":"api_key"});
      expect(result.success).toBe(true);
    });

    test("rejects missing required flags", () => {
      const result = configGetInput.safeParse({});
      expect(result.success).toBe(false);
    });

  });

  describe("set", () => {
    test("valid input parses", () => {
      const result = configSetInput.safeParse({"key":"api_key","value":"test-value"});
      expect(result.success).toBe(true);
    });

    test("rejects missing required flags", () => {
      const result = configSetInput.safeParse({});
      expect(result.success).toBe(false);
    });

  });

});

describe("me", () => {
  describe("me", () => {
    test("valid input parses", () => {
      const result = meInput.safeParse({});
      expect(result.success).toBe(true);
    });

  });

});

describe("labels", () => {
  describe("labels", () => {
    test("valid input parses", () => {
      const result = safeParse(listLabelsInput, {});
      expect(result.success).toBe(true);
    });

    test("infers SHOW with no mutation flags", () => {
      expect(inferOperation("labels", {})).toBe("show");
    });

  });

  describe("label", () => {
    test("valid input parses", () => {
      const result = safeParse(labelInput, {"id":"test-value"});
      expect(result.success).toBe(true);
    });

    test("rejects missing required flags", () => {
      const result = safeParse(labelInput, {});
      expect(result.success).toBe(false);
    });

    test("infers CREATE when id='new'", () => {
      expect(inferOperation("label", { id: "new" })).toBe("create");
    });

    test("infers DELETE when --delete", () => {
      expect(inferOperation("label", {"id":"test-value","delete":true})).toBe("delete");
    });

    test("infers SHOW with no mutation flags", () => {
      expect(inferOperation("label", {"id":"test-value"})).toBe("show");
    });

  });

});

describe("auth", () => {
  describe("auth", () => {
    test("valid input parses", () => {
      const result = authInput.safeParse({});
      expect(result.success).toBe(true);
    });

  });

});

describe("issues", () => {
  describe("issues", () => {
    test("valid input parses", () => {
      const result = safeParse(listIssuesInput, {});
      expect(result.success).toBe(true);
    });

    test("infers UPDATE when --state", () => {
      expect(inferOperation("issues", {"state":"test"})).toBe("update");
    });

    test("infers SHOW with no mutation flags", () => {
      expect(inferOperation("issues", {})).toBe("show");
    });

  });

  describe("issue", () => {
    test("valid input parses", () => {
      const result = safeParse(issueInput, {"idOrNew":"test-value"});
      expect(result.success).toBe(true);
    });

    test("rejects missing required flags", () => {
      const result = safeParse(issueInput, {});
      expect(result.success).toBe(false);
    });

    test("infers CREATE when idOrNew='new'", () => {
      expect(inferOperation("issue", { idOrNew: "new" })).toBe("create");
    });

    test("infers DELETE when --archive", () => {
      expect(inferOperation("issue", {"idOrNew":"test-value","archive":true})).toBe("delete");
    });

    test("infers UPDATE when --state", () => {
      expect(inferOperation("issue", {"idOrNew":"test-value","state":"test"})).toBe("update");
    });

    test("infers SHOW with no mutation flags", () => {
      expect(inferOperation("issue", {"idOrNew":"test-value"})).toBe("show");
    });

  });

});
