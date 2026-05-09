function normalizeUrl(url) {
  return url.endsWith("/") ? url : `${url}/`;
}

export function getAppBaseUrl() {
  const explicitUrl =
    import.meta.env.VITE_APP_URL ||
    import.meta.env.VITE_AUTH_REDIRECT_URL ||
    import.meta.env.VITE_SITE_URL;

  if (explicitUrl) {
    return normalizeUrl(explicitUrl);
  }

  if (typeof window !== "undefined") {
    return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
  }

  return import.meta.env.BASE_URL || "/";
}

export function getCurrentAppBaseUrl() {
  if (typeof window !== "undefined") {
    return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
  }

  return getAppBaseUrl();
}

export function getPasswordRecoveryRedirectUrl() {
  const url = new URL(getAppBaseUrl());
  url.searchParams.set("type", "recovery");
  return url.toString();
}
