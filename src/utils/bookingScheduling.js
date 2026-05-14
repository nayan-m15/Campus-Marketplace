import { normalizeTime, isValidTimeFormat } from "./time";

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

/*This function formats a booking date string into a readable full date label.*/
export function formatBookingDate(dateStr) {
  if (!dateStr) return "TBD";

  return new Date(`${dateStr}T00:00`).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/*This function formats a timestamp into a short date label for booking views.*/
export function formatTimestampDate(timestamp) {
  if (!timestamp) return "TBD";

  return new Date(timestamp).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/*This function formats a timestamp into a 24-hour time label for booking views.*/
export function formatTimestampTime(timestamp) {
  if (!timestamp) return "TBD";

  return new Date(timestamp).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false, // FIXED: forces 24-hour format
  });
}

/*This function converts a slot start time into a readable one-hour time range label.*/
export function formatSlotLabel(slot) {
  if (!slot) return "";

  const [hour, minute] = slot.split(":").map(Number);
  /*This function calculates the ending hour for the displayed slot range.*/
  const nextHour = (hour + 1) % 24;

  /*This function formats a numeric hour value into a compact 12-hour label.*/
  const toLabel = (value) => {
    const suffix = value >= 12 ? "pm" : "am";
    const display = value % 12 === 0 ? 12 : value % 12;

    return `${display}${
      minute ? `:${String(minute).padStart(2, "0")}` : ""
    }${suffix}`;
  };

  return `${toLabel(hour)} - ${toLabel(nextHour)}`;
}

/*This function builds hourly booking slots between the provided opening and closing times.*/
export function generateTimeSlots(startTime, endTime) {
  if (!startTime || !endTime) return [];

  const normalizedStart = normalizeTime(startTime);
  const normalizedEnd = normalizeTime(endTime);

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

/*This function returns the weekday name for a date input value.*/
export function getDateDayName(dateStr) {
  if (!dateStr) return "";

  return DAYS[new Date(`${dateStr}T00:00:00`).getDay()];
}

/*This function converts a Date into a local YYYY-MM-DD value for date inputs.*/
export function toDateInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);

  return local.toISOString().slice(0, 10);
}

/*This function builds a simple booking identifier with the provided prefix.*/
export function buildBookingId(prefix = "BK") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

/*This function normalizes facility day labels so different aliases map to the same day name.*/
export function normalizeFacilityDay(day) {
  if (!day) return "";

  return (
    DAY_ALIASES[String(day).trim().toLowerCase()] ||
    String(day).trim()
  );
}

/*This function groups facility hour records into a map keyed by normalized day names.*/
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

/*This function checks whether a user is the buyer or seller on a transaction.*/
export function isTransactionParty(transaction, userId) {
  return (
    transaction?.seller_id === userId ||
    transaction?.buyer_id === userId
  );
}

/*This function exposes the shared time normalizer for booking-related inputs.*/
export const normalizeTimeValue = normalizeTime;
