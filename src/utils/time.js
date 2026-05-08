const TWELVE_HOUR_TIME_REGEX = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i;
const TWENTY_FOUR_HOUR_TIME_REGEX = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const NORMALIZED_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function normalizeTime(timeValue, fallback = "") {
  if (timeValue === null || timeValue === undefined || timeValue === "") {
    return fallback;
  }

  const clean = String(timeValue)
    .replace(/[()]/g, "")
    .trim();

  const amPmMatch = clean.match(TWELVE_HOUR_TIME_REGEX);
  if (amPmMatch) {
    let [, hour, minute, modifier] = amPmMatch;
    let normalizedHour = Number.parseInt(hour, 10);

    if (Number.isNaN(normalizedHour) || normalizedHour < 1 || normalizedHour > 12) {
      return clean;
    }

    if (modifier.toUpperCase() === "PM" && normalizedHour !== 12) {
      normalizedHour += 12;
    }

    if (modifier.toUpperCase() === "AM" && normalizedHour === 12) {
      normalizedHour = 0;
    }

    return `${String(normalizedHour).padStart(2, "0")}:${minute}`;
  }

  const militaryMatch = clean.match(TWENTY_FOUR_HOUR_TIME_REGEX);
  if (militaryMatch) {
    const [, hour, minute] = militaryMatch;
    const normalizedHour = String(Number.parseInt(hour, 10)).padStart(2, "0");
    const normalizedTime = `${normalizedHour}:${minute}`;

    return isValidTimeFormat(normalizedTime) ? normalizedTime : clean;
  }

  return clean;
}

export function isValidTimeFormat(timeValue) {
  return NORMALIZED_TIME_REGEX.test(String(timeValue ?? ""));
}
