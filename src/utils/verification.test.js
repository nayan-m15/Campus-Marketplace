import { expect, test } from "vitest";
import {
  APPROVED_UNIVERSITY_DOMAINS,
  getUniversityFromEmail,
  getVerificationStatus,
  isUniversityEmail,
} from "./verification";

test("exports the approved university domains list", () => {
  expect(APPROVED_UNIVERSITY_DOMAINS).toContain("@students.wits.ac.za");
  expect(APPROVED_UNIVERSITY_DOMAINS).toContain("@spu.ac.za");
});

test("accepts valid university emails with mixed case and whitespace", () => {
  expect(isUniversityEmail("  Student123@Students.Wits.Ac.Za  ")).toBe(true);
  expect(getUniversityFromEmail("  Student123@Students.Wits.Ac.Za  ")).toBe(
    "University of the Witwatersrand (Wits)",
  );
});

test("rejects missing, malformed, and spoofed domains", () => {
  expect(isUniversityEmail("")).toBe(false);
  expect(isUniversityEmail(null)).toBe(false);
  expect(isUniversityEmail("student")).toBe(false);
  expect(isUniversityEmail("1234@students.wits.ac.za.fake.com")).toBe(false);
  expect(getUniversityFromEmail("1234@students.wits.ac.za.fake.com")).toBeNull();
});

test("prefers backend verification fields when present", () => {
  expect(
    getVerificationStatus({
      email: "student@gmail.com",
      is_verified: false,
      verified_university: null,
    }),
  ).toEqual({
    email: "student@gmail.com",
    isVerified: false,
    verifiedUniversity: null,
  });
});

test("falls back to derived verification for legacy users without stored fields", () => {
  expect(
    getVerificationStatus({
      email: "student@myuct.ac.za",
    }),
  ).toEqual({
    email: "student@myuct.ac.za",
    isVerified: true,
    verifiedUniversity: "University of Cape Town (UCT)",
  });
});
