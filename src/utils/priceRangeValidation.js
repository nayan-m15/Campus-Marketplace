const PRICE_INPUT_PATTERN = /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/;
export const PRICE_INTEGER_DIGIT_LIMIT = 10;
export const PRICE_INPUT_LENGTH_LIMIT = PRICE_INTEGER_DIGIT_LIMIT + 3;

/*This function limits the price input.*/
export function limitPriceInput(value) {
  const text = String(value ?? "");
  const [integerPart = "", ...decimalParts] = text.split(".");
  const limitedInteger = integerPart.slice(0, PRICE_INTEGER_DIGIT_LIMIT);

  if (decimalParts.length === 0) {
    return limitedInteger;
  }

  return `${limitedInteger}.${decimalParts.join("").slice(0, 2)}`;
}

/*This function returns the price input error message.*/
export function getPriceInputError(value, label = "Price") {
  const text = String(value ?? "").trim();
  if (!text) return "";

  if (text.startsWith("-")) {
    return `${label} cannot be negative.`;
  }

  const integerDigits = text.split(".")[0].replace(/\D/g, "").length;
  if (integerDigits > PRICE_INTEGER_DIGIT_LIMIT) {
    return `${label} cannot be more than ${PRICE_INTEGER_DIGIT_LIMIT} digits.`;
  }

  if (!PRICE_INPUT_PATTERN.test(text)) {
    return `${label} must be a valid amount with up to two decimals.`;
  }

  return "";
}

/*This function validates the price range.*/
export function validatePriceRange(range = {}) {
  const min = String(range.min ?? "").trim();
  const max = String(range.max ?? "").trim();
  const errors = {
    min: getPriceInputError(min, "Minimum price"),
    max: getPriceInputError(max, "Maximum price"),
    range: "",
  };

  if (!errors.min && !errors.max && min && max && Number(min) > Number(max)) {
    errors.range = "Minimum price cannot be greater than maximum price.";
  }

  return errors;
}

/*This function returns whether price range errors.*/
export function hasPriceRangeErrors(range = {}) {
  const errors = validatePriceRange(range);
  return Boolean(errors.min || errors.max || errors.range);
}

/*This function returns the valid price range.*/
export function getValidPriceRange(range = {}) {
  if (hasPriceRangeErrors(range)) {
    return { min: "", max: "" };
  }

  return {
    min: String(range.min ?? "").trim(),
    max: String(range.max ?? "").trim(),
  };
}
