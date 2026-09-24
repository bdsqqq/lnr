import { describe, test, expect } from "bun:test";
import { priorityFromString } from "./issues";

describe("issues utilities", () => {
  test("priorityFromString converts priority names", () => {
    expect(priorityFromString("urgent")).toBe(1);
    expect(priorityFromString("high")).toBe(2);
    expect(priorityFromString("medium")).toBe(3);
    expect(priorityFromString("low")).toBe(4);
    expect(priorityFromString("none")).toBe(0);
  });

  test("priorityFromString is case-insensitive", () => {
    expect(priorityFromString("URGENT")).toBe(1);
    expect(priorityFromString("High")).toBe(2);
    expect(priorityFromString("MeDiUm")).toBe(3);
  });

  test("numeric spellings preserve all five values", () => {
    for (const value of [0, 1, 2, 3, 4]) expect(priorityFromString(String(value))).toBe(value);
  });

  test("invalid spellings never silently clear priority", () => {
    for (const value of ["unknown", "normal", "", " ", "\t\n", " high ",
      "-1", "5", "01", "+1", "1.0", "1e0", "0x1", "NaN", "Infinity"]) {
      expect(() => priorityFromString(value)).toThrow("invalid priority");
    }
  });
});
