import { expect, test } from "vitest";
import {
  MODERATION_REASON_MAX_LENGTH,
  getModerationReasonError,
  limitModerationReason,
  normalizeModerationReason,
} from "./moderationReasonValidation";

test("normalizes moderation reasons before saving", () => {
  expect(normalizeModerationReason("  suspicious   payment\nrequest  ")).toBe(
    "suspicious payment request"
  );
});

test("limits moderation reasons to the maximum length", () => {
  const value = "a".repeat(MODERATION_REASON_MAX_LENGTH + 20);

  expect(limitModerationReason(value)).toHaveLength(MODERATION_REASON_MAX_LENGTH);
});

test("rejects moderation reasons that are too short or not readable", () => {
  expect(getModerationReasonError("scam")).toMatch(/at least 10 characters/i);
  expect(getModerationReasonError("!!!!!!!!!!!!")).toMatch(/written explanation/i);
});

test("rejects contact information in moderation reasons", () => {
  expect(getModerationReasonError("Seller asks buyers to email test@example.com")).toMatch(
    /cannot include links, email addresses, or phone numbers/i
  );
  expect(getModerationReasonError("Seller asks buyers to visit example.com now")).toMatch(
    /cannot include links, email addresses, or phone numbers/i
  );
});
