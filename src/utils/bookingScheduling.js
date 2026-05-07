export const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DAY_ALIASES = {
  sun: "Sunday",
  sunday: "Sunday",
  mon: "Monday",
  monday: "Monday",
  tue: "Tuesday",
  tues: "Tuesday",
  tuesday: "Tuesday",
  wed: "Wednesday",
  wednesday: "Wednesday",
  thu: "Thursday",
  thur: "Thursday",
  thurs: "Thursday",
  thursday: "Thursday",
  fri: "Friday",
  friday: "Friday",
  sat: "Saturday",
  saturday: "Saturday",
};

export function formatBookingDate(dateStr) {
  if (!dateStr) return "TBD";

  return new Date(`${dateStr}T00:00`).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatTimestampDate(timestamp) {
  if (!timestamp) return "TBD";

  return new Date(timestamp).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTimestampTime(timestamp) {
  if (!timestamp) return "TBD";

  return new Date(timestamp).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false, // FIXED: forces 24-hour format
  });
}

export function formatSlotLabel(slot) {
  if (!slot) return "";

  const [hour, minute] = slot.split(":").map(Number);
  const nextHour = (hour + 1) % 24;

  const toLabel = (value) => {
    const suffix = value >= 12 ? "pm" : "am";
    const display = value % 12 === 0 ? 12 : value % 12;

    return `${display}${
      minute ? `:${String(minute).padStart(2, "0")}` : ""
    }${suffix}`;
  };

  return `${toLabel(hour)} - ${toLabel(nextHour)}`;
}

export function generateTimeSlots(startTime, endTime) {
  if (!startTime || !endTime) return [];

  const normalizedStart = normalizeTimeValue(startTime);
  const normalizedEnd = normalizeTimeValue(endTime);

  const [startHour, startMinute] = normalizedStart.split(":").map(Number);
  const [endHour, endMinute] = normalizedEnd.split(":").map(Number);

  const startTotal = startHour * 60 + (startMinute || 0);
  const endTotal = endHour * 60 + (endMinute || 0);

  const slots = [];

  for (let minutes = startTotal; minutes < endTotal; minutes += 60) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;

    slots.push(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    );
  }

  return slots;
}

export function getDateDayName(dateStr) {
  if (!dateStr) return "";

  return DAYS[new Date(`${dateStr}T00:00:00`).getDay()];
}

export function toDateInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);

  return local.toISOString().slice(0, 10);
}

export function buildBookingId(prefix = "BK") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export function normalizeFacilityDay(day) {
  if (!day) return "";

  return (
    DAY_ALIASES[String(day).trim().toLowerCase()] ||
    String(day).trim()
  );
}

export function mapHoursByDay(hours = []) {
  return new Map(
    hours.map((entry) => [
      normalizeFacilityDay(entry.day),
      {
        ...entry,
        day: normalizeFacilityDay(entry.day),
      },
    ])
  );
}

export function isTransactionParty(transaction, userId) {
  return (
    transaction?.seller_id === userId ||
    transaction?.buyer_id === userId
  );
}

/**
 * NEW: Normalize any time input into strict HH:mm format
 * Examples:
 * "09:00:00 AM" -> "09:00"
 * "05:00:00 PM" -> "17:00"
 * "(09:00:00 AM)" -> "09:00"
 * "17:00:00" -> "17:00"
 */
export function normalizeTimeValue(time) {
  if (!time) return "";

  let clean = String(time)
    .replace(/[()]/g, "")
    .trim();

  // Match 12-hour format with AM/PM
  const amPmMatch = clean.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i
  );

  if (amPmMatch) {
    let [, hour, minute, modifier] = amPmMatch;

    hour = parseInt(hour, 10);

    if (modifier.toUpperCase() === "PM" && hour !== 12) {
      hour += 12;
    }

    if (modifier.toUpperCase() === "AM" && hour === 12) {
      hour = 0;
    }

    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  // Match 24-hour format with optional seconds
  const militaryMatch = clean.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);

  if (militaryMatch) {
    return `${militaryMatch[1]}:${militaryMatch[2]}`;
  }

  return clean;
}

/**
 * NEW: Validate HH:mm format
 */
export function isValidTimeFormat(time) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}