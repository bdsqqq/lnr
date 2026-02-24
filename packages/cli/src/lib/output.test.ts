import { describe, expect, test } from "bun:test";
import {
  truncate,
  formatDate,
  formatPriority,
  formatRelativeTime,
} from "./output";
import {
  shortcodeToEmoji,
  formatReactions,
  wrapText,
  buildChildMap,
} from "./renderers/comments";
import type { Comment } from "@bdsqqq/lnr-core";

describe("truncate", () => {
  test("shorter than max → unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  test("at exact max → unchanged", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  test("longer → truncated with …", () => {
    expect(truncate("hello world", 6)).toBe("hello…");
  });
});

describe("formatDate", () => {
  test("null → -", () => {
    expect(formatDate(null)).toBe("-");
  });

  test("undefined → -", () => {
    expect(formatDate(undefined)).toBe("-");
  });

  test("Date → YYYY-MM-DD", () => {
    expect(formatDate(new Date("2024-03-15T12:00:00Z"))).toBe("2024-03-15");
  });

  test("ISO string → YYYY-MM-DD", () => {
    expect(formatDate("2024-03-15T12:00:00Z")).toBe("2024-03-15");
  });
});

describe("formatPriority", () => {
  test("0 → -", () => expect(formatPriority(0)).toBe("-"));
  test("1 → urgent", () => expect(formatPriority(1)).toBe("urgent"));
  test("2 → high", () => expect(formatPriority(2)).toBe("high"));
  test("3 → medium", () => expect(formatPriority(3)).toBe("medium"));
  test("4 → low", () => expect(formatPriority(4)).toBe("low"));
  test("undefined → -", () => expect(formatPriority(undefined)).toBe("-"));
});

describe("formatRelativeTime", () => {
  test("< 1 min → just now", () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe("just now");
  });

  test("minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinAgo)).toBe("5m ago");
  });

  test("hours ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeHoursAgo)).toBe("3h ago");
  });

  test("days ago", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoDaysAgo)).toBe("2d ago");
  });

  test("weeks ago", () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoWeeksAgo)).toBe("2w ago");
  });
});

describe("shortcodeToEmoji", () => {
  test("known → emoji", () => {
    expect(shortcodeToEmoji("+1")).toBe("👍");
    expect(shortcodeToEmoji("fire")).toBe("🔥");
    expect(shortcodeToEmoji("heart")).toBe("❤️");
  });

  test("unknown → :shortcode:", () => {
    expect(shortcodeToEmoji("not_a_real_emoji")).toBe(":not_a_real_emoji:");
  });
});

describe("formatReactions", () => {
  test("empty → empty string", () => {
    expect(formatReactions([])).toBe("");
  });

  test("count 1 → just emoji", () => {
    expect(formatReactions([{ emoji: "+1", count: 1 }])).toBe("👍");
  });

  test("count > 1 → emoji + count", () => {
    expect(formatReactions([{ emoji: "+1", count: 3 }])).toBe("👍3");
  });

  test("multiple reactions", () => {
    expect(
      formatReactions([
        { emoji: "+1", count: 2 },
        { emoji: "fire", count: 1 },
      ])
    ).toBe("👍2 🔥");
  });
});

describe("wrapText", () => {
  test("short text → single line", () => {
    expect(wrapText("hello", 20, "")).toEqual(["hello"]);
  });

  test("long text wraps", () => {
    const result = wrapText("hello world foo bar", 12, "");
    expect(result).toEqual(["hello world", "foo bar"]);
  });

  test("preserves paragraph breaks", () => {
    const result = wrapText("hello\n\nworld", 20, "");
    expect(result).toEqual(["hello", "", "world"]);
  });

  test("applies indent", () => {
    const result = wrapText("hello", 20, "  ");
    expect(result).toEqual(["  hello"]);
  });
});

describe("buildChildMap", () => {
  const makeComment = (
    id: string,
    parentId: string | null,
    createdAt: Date
  ): Comment => ({
    id,
    body: "test",
    user: "user",
    externalUser: null,
    botActor: null,
    url: "https://example.com",
    createdAt,
    updatedAt: createdAt,
    parentId,
    reactions: [],
    syncedWith: [],
  });

  test("roots go under null key", () => {
    const comments = [makeComment("a", null, new Date("2024-01-01"))];
    const map = buildChildMap(comments);
    expect(map.get(null)?.map((c) => c.id)).toEqual(["a"]);
  });

  test("children under parent id", () => {
    const comments = [
      makeComment("a", null, new Date("2024-01-01")),
      makeComment("b", "a", new Date("2024-01-02")),
    ];
    const map = buildChildMap(comments);
    expect(map.get("a")?.map((c) => c.id)).toEqual(["b"]);
  });

  test("sorted by createdAt", () => {
    const comments = [
      makeComment("c", null, new Date("2024-01-03")),
      makeComment("a", null, new Date("2024-01-01")),
      makeComment("b", null, new Date("2024-01-02")),
    ];
    const map = buildChildMap(comments);
    expect(map.get(null)?.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
});
