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

test("getAppBaseUrl falls back to the site url when provided", async () => {
  vi.stubEnv("VITE_SITE_URL", "https://nayan-m15.github.io/Campus-Marketplace/");

  const { getAppBaseUrl } = await import("./appUrl");

  expect(getAppBaseUrl()).toBe("https://nayan-m15.github.io/Campus-Marketplace/");
});

test("getAppBaseUrl builds from the current window origin and base path otherwise", async () => {
  vi.stubEnv("VITE_APP_URL", "");
  vi.stubEnv("VITE_AUTH_REDIRECT_URL", "");
  vi.stubEnv("VITE_SITE_URL", "");
  vi.stubEnv("BASE_URL", "/Campus-Marketplace/");

  const { getAppBaseUrl } = await import("./appUrl");

  expect(getAppBaseUrl()).toBe("http://localhost:3000/Campus-Marketplace/");
});

test("getPasswordRecoveryRedirectUrl returns to the configured app with recovery mode", async () => {
  vi.stubEnv("BASE_URL", "/Campus-Marketplace/");
  vi.stubEnv("VITE_SITE_URL", "https://nayan-m15.github.io/Campus-Marketplace/");

  const { getPasswordRecoveryRedirectUrl } = await import("./appUrl");

  expect(getPasswordRecoveryRedirectUrl()).toBe(
    "https://nayan-m15.github.io/Campus-Marketplace/?type=recovery"
  );
});
