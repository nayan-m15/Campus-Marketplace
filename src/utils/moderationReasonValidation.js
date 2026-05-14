export const MODERATION_REASON_MAX_LENGTH = 300;
export const MODERATION_REASON_MIN_LENGTH = 10;

const URL_PATTERN = /(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}(?:\/|\b))/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?\d[\s().-]*){8,}/;
const LETTER_PATTERN = /[a-z]/i;
const REPEATED_CHARACTER_PATTERN = /(.)\1{9,}/;

/*This function limits the moderation reason.*/
export function limitModerationReason(value) {
  return String(value ?? "").slice(0, MODERATION_REASON_MAX_LENGTH);
}

/*This function normalizes the moderation reason.*/
export function normalizeModerationReason(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

/*This function returns the moderation reason error message.*/
export function getModerationReasonError(value) {
  const reason = normalizeModerationReason(value);

  if (!reason) {
    return "Please enter a reason before flagging this listing.";
  }

  if (reason.length < MODERATION_REASON_MIN_LENGTH) {
    return `Flag reason must be at least ${MODERATION_REASON_MIN_LENGTH} characters.`;
  }

  if (reason.length > MODERATION_REASON_MAX_LENGTH) {
    return `Flag reason must be ${MODERATION_REASON_MAX_LENGTH} characters or fewer.`;
  }

  if (!LETTER_PATTERN.test(reason)) {
    return "Flag reason must include a clear written explanation.";
  }

  if (URL_PATTERN.test(reason) || EMAIL_PATTERN.test(reason) || PHONE_PATTERN.test(reason)) {
    return "Flag reason cannot include links, email addresses, or phone numbers.";
  }

  if (REPEATED_CHARACTER_PATTERN.test(reason)) {
    return "Flag reason cannot contain repeated filler characters.";
  }

  const lettersAndNumbers = reason.replace(/[^a-z0-9]/gi, "").length;
  if (lettersAndNumbers < Math.ceil(reason.length * 0.45)) {
    return "Flag reason must use mostly readable words.";
  }

  return "";
}
