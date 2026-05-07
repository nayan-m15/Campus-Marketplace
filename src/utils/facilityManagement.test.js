import { describe, expect, it } from "vitest";
import {
  buildFacilityHoursPayload,
  buildFacilityPayload,
  DEFAULT_SESSION_DURATION,
  emptyHours,
  serializeSupabaseError,
} from "./facilityManagement";

describe("facility management utils", () => {
  it("builds a normalized facility payload for Supabase", () => {
    const payload = buildFacilityPayload({
      name: "  Main Library  ",
      description: "  Quiet study space  ",
      location: "  Building A  ",
      image_url: "  https://example.com/library.jpg  ",
      capacity: "25",
      session_duration_minutes: "90",
      status: "ACTIVE",
    });

    expect(payload).toEqual({
      name: "Main Library",
      description: "Quiet study space",
      location: "Building A",
      image_url: "https://example.com/library.jpg",
      capacity: 25,
      session_duration_minutes: 90,
      status: "active",
    });
  });

  it("converts blank optional fields to null and defaults duration when needed", () => {
    const payload = buildFacilityPayload({
      name: "Computer Lab",
      description: " ",
      location: "",
      image_url: null,
      capacity: 12,
      session_duration_minutes: DEFAULT_SESSION_DURATION,
      status: "inactive",
    });

    expect(payload.description).toBeNull();
    expect(payload.location).toBeNull();
    expect(payload.image_url).toBeNull();
    expect(payload.session_duration_minutes).toBe(DEFAULT_SESSION_DURATION);
  });

  it("builds one normalized hours row per day", () => {
    const hours = emptyHours();
    hours.Monday = { open: true, start: "9:00", end: "05:00:00 PM" };

    const payload = buildFacilityHoursPayload(42, hours);
    const monday = payload.find((row) => row.day === "Monday");

    expect(payload).toHaveLength(7);
    expect(monday).toEqual({
      facility_id: 42,
      day: "Monday",
      open: true,
      start_time: "09:00",
      end_time: "17:00",
    });
  });

  it("throws for invalid open-day time ranges", () => {
    const hours = emptyHours();
    hours.Tuesday = { open: true, start: "18:00", end: "09:00" };

    expect(() => buildFacilityHoursPayload(10, hours)).toThrow(
      "Closing time must be after opening time for Tuesday."
    );
  });

  it("serializes Supabase errors for structured logging", () => {
    expect(
      serializeSupabaseError({
        code: "23505",
        message: "duplicate key value violates unique constraint",
        details: "Key (name)=(Library) already exists.",
        hint: null,
      })
    ).toEqual({
      code: "23505",
      message: "duplicate key value violates unique constraint",
      details: "Key (name)=(Library) already exists.",
      hint: null,
    });
  });
});
