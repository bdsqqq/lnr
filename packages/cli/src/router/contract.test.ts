/**
 * contract tests: CLI input → core function parameters
 * generated from cli-spec.json at 2026-01-27T19:52:44.600Z
 *
 * these tests verify the transformation from CLI flags to API request payloads.
 * regenerate with: bun run packages/codegen/generate-contract-tests.ts
 */

import { describe, test, expect } from "bun:test";

// import schemas directly from router files
import { listIssuesInput, issueInput } from "../router/issues";
import { listProjectsInput, projectInput } from "../router/projects";
import { listTeamsInput, teamInput } from "../router/teams";
import { listCyclesInput, cycleInput } from "../router/cycles";
import { listDocsInput, docInput } from "../router/docs";
import { listLabelsInput, labelInput } from "../router/labels";
import { meInput } from "../router/me";
import { searchInput } from "../router/search";
import { authInput } from "../router/auth";
import { getInput as configGetInput, setInput as configSetInput } from "../router/config";

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
      const result = listProjectsInput.safeParse({});
      expect(result.success).toBe(true);
    });

    test("infers SHOW with no mutation flags", () => {
      expect(inferOperation("projects", {})).toBe("show");
    });

  });

  describe("project", () => {
    test("valid input parses", () => {
      const result = projectInput.safeParse({"name":"test-value"});
      expect(result.success).toBe(true);
    });

    test("rejects missing required flags", () => {
      const result = projectInput.safeParse({});
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
      const result = cycleInput.safeParse({"team":"test-value"});
      expect(result.success).toBe(true);
    });

    test("rejects missing required flags", () => {
      const result = cycleInput.safeParse({});
      expect(result.success).toBe(false);
    });

  });

});

describe("docs", () => {
  describe("docs", () => {
    test("valid input parses", () => {
      const result = listDocsInput.safeParse({});
      expect(result.success).toBe(true);
    });

    test("infers SHOW with no mutation flags", () => {
      expect(inferOperation("docs", {})).toBe("show");
    });

  });

  describe("doc", () => {
    test("valid input parses", () => {
      const result = docInput.safeParse({"id":"test-value"});
      expect(result.success).toBe(true);
    });

    test("rejects missing required flags", () => {
      const result = docInput.safeParse({});
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
      const result = listLabelsInput.safeParse({});
      expect(result.success).toBe(true);
    });

    test("infers SHOW with no mutation flags", () => {
      expect(inferOperation("labels", {})).toBe("show");
    });

  });

  describe("label", () => {
    test("valid input parses", () => {
      const result = labelInput.safeParse({"id":"test-value"});
      expect(result.success).toBe(true);
    });

    test("rejects missing required flags", () => {
      const result = labelInput.safeParse({});
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
      const result = listIssuesInput.safeParse({});
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
      const result = issueInput.safeParse({"idOrNew":"test-value"});
      expect(result.success).toBe(true);
    });

    test("rejects missing required flags", () => {
      const result = issueInput.safeParse({});
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
