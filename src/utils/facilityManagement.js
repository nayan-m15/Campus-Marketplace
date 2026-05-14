import { DAYS, normalizeFacilityDay } from "./bookingScheduling";
import { isValidTimeFormat, normalizeTime } from "./time";

export const FACILITIES_TABLE = "facilities";
export const FACILITY_HOURS_TABLE = "facility_hours";
export const DEFAULT_FACILITY_START_TIME = "09:00";
export const DEFAULT_FACILITY_END_TIME = "17:00";
export const DEFAULT_SESSION_DURATION = 60;
export const FACILITY_STATUS_VALUES = new Set(["active", "inactive"]);

/*This function returns empty hours.*/
export function emptyHours() {
  return DAYS.reduce((acc, day) => {
    acc[day] = {
      open: false,
      start: DEFAULT_FACILITY_START_TIME,
      end: DEFAULT_FACILITY_END_TIME,
    };
    return acc;
  }, {});
}

/*This function normalizes the optional text.*/
export function normalizeOptionalText(value) {
  if (value === null || value === undefined) return null;

  const trimmedValue = String(value).trim();
  return trimmedValue === "" ? null : trimmedValue;
}

/*This function normalizes the required text.*/
export function normalizeRequiredText(value) {
  return String(value ?? "").trim();
}

/*This function normalizes the positive integer.*/
export function normalizePositiveInteger(value, fallback = null) {
  const normalizedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    return fallback;
  }

  return normalizedValue;
}

/*This function serializes the supabase error.*/
export function serializeSupabaseError(error) {
  if (!error) return null;

  return {
    code: error.code ?? null,
    message: error.message ?? "Unknown Supabase error",
    details: error.details ?? null,
    hint: error.hint ?? null,
  };
}

/*This function validates the facility form data.*/
export function validateFacilityFormData(formData) {
  const normalizedName = normalizeRequiredText(formData?.name);
  const normalizedCapacity = normalizePositiveInteger(formData?.capacity);
  const normalizedDuration = normalizePositiveInteger(
    formData?.session_duration_minutes,
    DEFAULT_SESSION_DURATION
  );
  const normalizedStatus = String(formData?.status ?? "").trim().toLowerCase();

  if (!normalizedName) {
    throw new Error("Facility name is required.");
  }

  if (!normalizedCapacity) {
    throw new Error("Capacity must be at least 1.");
  }

  if (!normalizedDuration || normalizedDuration < 15) {
    throw new Error("Session duration must be at least 15 minutes.");
  }

  if (!FACILITY_STATUS_VALUES.has(normalizedStatus)) {
    throw new Error("Facility status must be active or inactive.");
  }
}

/*This function builds the facility payload.*/
export function buildFacilityPayload(formData) {
  validateFacilityFormData(formData);

  return {
    name: normalizeRequiredText(formData.name),
    description: normalizeOptionalText(formData.description),
    location: normalizeOptionalText(formData.location),
    image_url: normalizeOptionalText(formData.image_url),
    capacity: normalizePositiveInteger(formData.capacity),
    session_duration_minutes: normalizePositiveInteger(
      formData.session_duration_minutes,
      DEFAULT_SESSION_DURATION
    ),
    status: String(formData.status).trim().toLowerCase(),
  };
}

/*This function builds the facility hours payload.*/
export function buildFacilityHoursPayload(facilityId, hours) {
  if (!facilityId) {
    throw new Error("A valid facility ID is required for operating hours.");
  }

  if (!hours || typeof hours !== "object") {
    throw new Error("Operating hours are required.");
  }

  const seenDays = new Set();

  return DAYS.map((day) => {
    const currentDayHours = hours[day];

    if (!currentDayHours || typeof currentDayHours !== "object") {
      throw new Error(`Missing operating hours for ${day}.`);
    }

    const normalizedDay = normalizeFacilityDay(day);
    if (!normalizedDay) {
      throw new Error(`Invalid day value for ${day}.`);
    }

    if (seenDays.has(normalizedDay)) {
      throw new Error(`Duplicate operating hours generated for ${normalizedDay}.`);
    }
    seenDays.add(normalizedDay);

    const open = Boolean(currentDayHours.open);
    const startTime = normalizeTime(
      currentDayHours.start,
      DEFAULT_FACILITY_START_TIME
    );
    const endTime = normalizeTime(
      currentDayHours.end,
      DEFAULT_FACILITY_END_TIME
    );

    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
      throw new Error(`Invalid time format for ${day}. Use HH:mm.`);
    }

    if (open && startTime >= endTime) {
      throw new Error(`Closing time must be after opening time for ${day}.`);
    }

    return {
      facility_id: facilityId,
      day: normalizedDay,
      open,
      start_time: startTime,
      end_time: endTime,
    };
  });
}
