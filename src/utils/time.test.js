import { describe, expect, it } from "vitest";
import { isValidTimeFormat, normalizeTime } from "./time";

describe("time utils", () => {
  it("normalizes common database and UI time formats to HH:mm", () => {
    expect(normalizeTime("09:00:00")).toBe("09:00");
    expect(normalizeTime("9:00")).toBe("09:00");
    expect(normalizeTime("05:30:00 PM")).toBe("17:30");
    expect(normalizeTime("(12:15:00 AM)")).toBe("00:15");
  });

  it("returns the fallback for empty values", () => {
    expect(normalizeTime("", "09:00")).toBe("09:00");
    expect(normalizeTime(null, "17:00")).toBe("17:00");
  });

  it("validates strict HH:mm values", () => {
    expect(isValidTimeFormat("09:00")).toBe(true);
    expect(isValidTimeFormat("23:59")).toBe(true);
    expect(isValidTimeFormat("9:00")).toBe(false);
    expect(isValidTimeFormat("24:00")).toBe(false);
  });
});
