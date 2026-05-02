import { expect, test, vi } from "vitest";
import {
  DAYS,
  buildBookingId,
  formatBookingDate,
  formatSlotLabel,
  formatTimestampDate,
  formatTimestampTime,
  generateTimeSlots,
  getDateDayName,
  isTransactionParty,
  mapHoursByDay,
  normalizeFacilityDay,
  toDateInputValue,
} from "./bookingScheduling";

test("formats booking and timestamp helpers with fallbacks", () => {
  expect(formatBookingDate("")).toBe("TBD");
  expect(formatTimestampDate("")).toBe("TBD");
  expect(formatTimestampTime("")).toBe("TBD");

  expect(formatBookingDate("2026-05-04")).toMatch(/2026/);
  expect(formatTimestampDate("2026-05-04T09:00:00.000Z")).toMatch(/2026/);
  expect(formatTimestampTime("2026-05-04T09:00:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
});

test("formats slot labels and generates hourly time slots", () => {
  expect(formatSlotLabel("09:00")).toBe("9am - 10am");
  expect(formatSlotLabel("13:30")).toBe("1:30pm - 2:30pm");
  expect(generateTimeSlots("", "")).toEqual([]);
  expect(generateTimeSlots("09:00", "12:00")).toEqual(["09:00", "10:00", "11:00"]);
});

test("date and id helpers normalize correctly", () => {
  vi.spyOn(Date, "now").mockReturnValue(123456789);

  expect(buildBookingId("DO")).toBe(`DO-${(123456789).toString(36).toUpperCase()}`);
  expect(getDateDayName("2026-05-04")).toBe("Monday");
  expect(toDateInputValue(new Date("2026-05-04T10:00:00.000Z"))).toBe("2026-05-04");
  expect(DAYS).toContain("Sunday");

  Date.now.mockRestore();
});

test("facility day normalization and hour mapping support aliases", () => {
  expect(normalizeFacilityDay(" tues ")).toBe("Tuesday");
  expect(normalizeFacilityDay("Friday")).toBe("Friday");
  expect(normalizeFacilityDay("")).toBe("");

  const mapped = mapHoursByDay([
    { day: "mon", open: true, start_time: "09:00", end_time: "17:00" },
    { day: "thurs", open: false, start_time: "09:00", end_time: "17:00" },
  ]);

  expect(mapped.get("Monday")).toMatchObject({ day: "Monday", open: true });
  expect(mapped.get("Thursday")).toMatchObject({ day: "Thursday", open: false });
});

test("isTransactionParty checks both seller and buyer ids", () => {
  const transaction = { seller_id: "seller-1", buyer_id: "buyer-1" };

  expect(isTransactionParty(transaction, "seller-1")).toBe(true);
  expect(isTransactionParty(transaction, "buyer-1")).toBe(true);
  expect(isTransactionParty(transaction, "other-user")).toBe(false);
});
