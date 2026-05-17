import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("getAppBaseUrl prefers an explicit app url and normalizes the trailing slash", async () => {
  vi.stubEnv("VITE_APP_URL", "https://campusxchange.app");
  vi.stubGlobal("window", {
    location: {
      hostname: "campusxchange.app",
    },
  });

  const { getAppBaseUrl } = await import("./appUrl");

  expect(getAppBaseUrl()).toBe("https://campusxchange.app/");
});

test("getAppBaseUrl falls back to the auth redirect url when provided", async () => {
  vi.stubEnv("VITE_AUTH_REDIRECT_URL", "https://auth.campusxchange.app/reset");
  vi.stubGlobal("window", {
    location: {
      hostname: "campusxchange.app",
    },
  });

  const { getAppBaseUrl } = await import("./appUrl");

  expect(getAppBaseUrl()).toBe("https://auth.campusxchange.app/reset/");
});

test("getAppBaseUrl uses the active browser host over a legacy site url", async () => {
  vi.stubEnv("VITE_SITE_URL", "https://nayan-m15.github.io/Campus-Marketplace/");
  vi.stubGlobal("window", {
    location: {
      origin: "https://campus-marketplace.azurestaticapps.net",
      hostname: "campus-marketplace.azurestaticapps.net",
    },
  });

  const { getAppBaseUrl } = await import("./appUrl");

  expect(getAppBaseUrl()).toBe("https://campus-marketplace.azurestaticapps.net/");
});

test("getAppBaseUrl keeps the legacy site url as a non-browser fallback", async () => {
  vi.stubEnv("VITE_SITE_URL", "https://nayan-m15.github.io/Campus-Marketplace/");
  vi.stubGlobal("window", undefined);

  const { getAppBaseUrl } = await import("./appUrl");

  expect(getAppBaseUrl()).toBe("https://nayan-m15.github.io/Campus-Marketplace/");
});

test("getAppBaseUrl prefers localhost over configured deployed urls while developing", async () => {
  vi.stubEnv("BASE_URL", "/Campus-Marketplace/");
  vi.stubEnv("VITE_SITE_URL", "https://nayan-m15.github.io/Campus-Marketplace/");

  const { getAppBaseUrl } = await import("./appUrl");

  expect(getAppBaseUrl()).toBe("http://localhost:3000/Campus-Marketplace/");
});

test("getAppBaseUrl builds from the current window origin and base path otherwise", async () => {
  vi.stubEnv("VITE_APP_URL", "");
  vi.stubEnv("VITE_AUTH_REDIRECT_URL", "");
  vi.stubEnv("VITE_SITE_URL", "");
  vi.stubEnv("BASE_URL", "/Campus-Marketplace/");

  const { getAppBaseUrl } = await import("./appUrl");

  expect(getAppBaseUrl()).toBe("http://localhost:3000/Campus-Marketplace/");
});

test("getCurrentAppBaseUrl ignores deployed url config and uses the active browser host", async () => {
  vi.stubEnv("BASE_URL", "/");
  vi.stubEnv("VITE_SITE_URL", "https://nayan-m15.github.io/Campus-Marketplace/");
  vi.stubGlobal("window", {
    location: {
      origin: "https://campus-marketplace.azurestaticapps.net",
      hostname: "campus-marketplace.azurestaticapps.net",
    },
  });

  const { getCurrentAppBaseUrl } = await import("./appUrl");

  expect(getCurrentAppBaseUrl()).toBe("https://campus-marketplace.azurestaticapps.net/");
});

test("getPasswordRecoveryRedirectUrl prefers localhost while developing", async () => {
  vi.stubEnv("BASE_URL", "/Campus-Marketplace/");
  vi.stubEnv("VITE_SITE_URL", "https://nayan-m15.github.io/Campus-Marketplace/");

  const { getPasswordRecoveryRedirectUrl } = await import("./appUrl");

  expect(getPasswordRecoveryRedirectUrl()).toBe(
    "http://localhost:3000/Campus-Marketplace/?type=recovery"
  );
});

test("getPasswordRecoveryRedirectUrl uses the active deployed app outside localhost", async () => {
  vi.stubEnv("BASE_URL", "/Campus-Marketplace/");
  vi.stubEnv("VITE_SITE_URL", "https://nayan-m15.github.io/Campus-Marketplace/");
  vi.stubGlobal("window", {
    location: {
      origin: "https://campus-marketplace.azurestaticapps.net",
      hostname: "campus-marketplace.azurestaticapps.net",
    },
  });

  const { getPasswordRecoveryRedirectUrl } = await import("./appUrl");

  expect(getPasswordRecoveryRedirectUrl()).toBe(
    "https://campus-marketplace.azurestaticapps.net/Campus-Marketplace/?type=recovery"
  );
});
