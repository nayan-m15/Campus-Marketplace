import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test("getAppBaseUrl prefers an explicit app url and normalizes the trailing slash", async () => {
  vi.stubEnv("VITE_APP_URL", "https://campusxchange.app");

  const { getAppBaseUrl } = await import("./appUrl");

  expect(getAppBaseUrl()).toBe("https://campusxchange.app/");
});

test("getAppBaseUrl falls back to the auth redirect url when provided", async () => {
  vi.stubEnv("VITE_AUTH_REDIRECT_URL", "https://auth.campusxchange.app/reset");

  const { getAppBaseUrl } = await import("./appUrl");

  expect(getAppBaseUrl()).toBe("https://auth.campusxchange.app/reset/");
});

test("getAppBaseUrl builds from the current window origin and base path otherwise", async () => {
  vi.stubEnv("BASE_URL", "/Campus-Marketplace/");

  const { getAppBaseUrl } = await import("./appUrl");

  expect(getAppBaseUrl()).toBe("http://localhost:3000/Campus-Marketplace/");
});
