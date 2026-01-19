import { describe, test, expect } from "bun:test";
import type { Label } from "./labels";
import {
  listLabels,
  getLabel,
  createLabel,
  updateLabel,
  deleteLabel,
} from "./labels";

describe("labels", () => {
  test("Label interface has expected shape", () => {
    const label: Label = {
      id: "label-123",
      name: "bug",
      color: "#ff0000",
      description: "Something is broken",
    };

    expect(label.id).toBe("label-123");
    expect(label.name).toBe("bug");
    expect(label.color).toBe("#ff0000");
    expect(label.description).toBe("Something is broken");
  });

  test("Label allows null description", () => {
    const label: Label = {
      id: "label-456",
      name: "feature",
      color: "#00ff00",
      description: null,
    };

    expect(label.description).toBeNull();
  });

  test("exports API functions", () => {
    expect(typeof listLabels).toBe("function");
    expect(typeof getLabel).toBe("function");
    expect(typeof createLabel).toBe("function");
    expect(typeof updateLabel).toBe("function");
    expect(typeof deleteLabel).toBe("function");
  });
});
