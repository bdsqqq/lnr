import { describe, test, expect } from "bun:test";
import { createReaction, deleteReaction } from "./reactions";

describe("reactions", () => {
  test("exports createReaction function", () => {
    expect(typeof createReaction).toBe("function");
  });

  test("exports deleteReaction function", () => {
    expect(typeof deleteReaction).toBe("function");
  });
});
