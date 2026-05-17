import { describe, expect, test } from "vitest";
import {
  PRICE_INPUT_LENGTH_LIMIT,
  PRICE_INTEGER_DIGIT_LIMIT,
  getPriceInputError,
  getValidPriceRange,
  hasPriceRangeErrors,
  limitPriceInput,
  validatePriceRange,
} from "./priceRangeValidation";

describe("priceRangeValidation", () => {
  test("limits integer and decimal digits without dropping the decimal point", () => {
    expect(PRICE_INPUT_LENGTH_LIMIT).toBe(PRICE_INTEGER_DIGIT_LIMIT + 3);
    expect(limitPriceInput("1234567890123.9876")).toBe("1234567890.98");
    expect(limitPriceInput("42")).toBe("42");
    expect(limitPriceInput(null)).toBe("");
  });

  test("returns field-specific input errors", () => {
    expect(getPriceInputError("", "Maximum price")).toBe("");
    expect(getPriceInputError("-1", "Minimum price")).toBe("Minimum price cannot be negative.");
    expect(getPriceInputError("12345678901", "Price")).toBe("Price cannot be more than 10 digits.");
    expect(getPriceInputError("12.345", "Price")).toBe("Price must be a valid amount with up to two decimals.");
    expect(getPriceInputError(".5", "Price")).toBe("");
  });

  test("validates range ordering only after each field is valid", () => {
    expect(validatePriceRange({ min: "20", max: "10" })).toEqual({
      min: "",
      max: "",
      range: "Minimum price cannot be greater than maximum price.",
    });
    expect(validatePriceRange({ min: "-20", max: "10" }).range).toBe("");
    expect(hasPriceRangeErrors({ min: "10", max: "20" })).toBe(false);
    expect(hasPriceRangeErrors({ min: "20", max: "10" })).toBe(true);
  });

  test("returns trimmed valid ranges and blanks invalid ranges", () => {
    expect(getValidPriceRange({ min: " 10.50 ", max: " 30 " })).toEqual({
      min: "10.50",
      max: "30",
    });
    expect(getValidPriceRange({ min: "50", max: "30" })).toEqual({ min: "", max: "" });
  });
});
