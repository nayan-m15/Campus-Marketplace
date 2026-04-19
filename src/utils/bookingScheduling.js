export const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function formatBookingDate(dateStr) {
  if (!dateStr) return "TBD";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-ZA", {
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
  });
}

export function formatSlotLabel(slot) {
  const [hour, minute] = slot.split(":").map(Number);
  const nextHour = (hour + 1) % 24;
  const toLabel = (value) => {
    const suffix = value >= 12 ? "pm" : "am";
    const display = value % 12 === 0 ? 12 : value % 12;
    return `${display}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${suffix}`;
  };
  return `${toLabel(hour)} - ${toLabel(nextHour)}`;
}

export function generateTimeSlots(startTime, endTime) {
  if (!startTime || !endTime) return [];
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const startTotal = startHour * 60 + (startMinute || 0);
  const endTotal = endHour * 60 + (endMinute || 0);
  const slots = [];

  for (let minutes = startTotal; minutes < endTotal; minutes += 60) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    slots.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
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

export function mapHoursByDay(hours = []) {
  return new Map(hours.map((entry) => [entry.day, entry]));
}

export function isTransactionParty(transaction, userId) {
  return transaction?.seller_id === userId || transaction?.buyer_id === userId;
}
