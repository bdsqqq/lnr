import { describe, test, expect } from "bun:test";
import { priorityFromString } from "./issues";

describe("issues utilities", () => {
  test("priorityFromString converts priority names", () => {
    expect(priorityFromString("urgent")).toBe(1);
    expect(priorityFromString("high")).toBe(2);
    expect(priorityFromString("medium")).toBe(3);
    expect(priorityFromString("low")).toBe(4);
    expect(priorityFromString("none")).toBe(0);
    expect(priorityFromString("unknown")).toBe(0);
  });

  test("priorityFromString is case-insensitive", () => {
    expect(priorityFromString("URGENT")).toBe(1);
    expect(priorityFromString("High")).toBe(2);
    expect(priorityFromString("MeDiUm")).toBe(3);
  });
});
