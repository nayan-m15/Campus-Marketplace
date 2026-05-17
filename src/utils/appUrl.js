function normalizeUrl(url) {
  return url.endsWith("/") ? url : `${url}/`;
}

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function getCurrentAppBaseUrl() {
  if (typeof window !== "undefined") {
    return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
  }

  return import.meta.env.BASE_URL || "/";
}

export function getAppBaseUrl() {
  if (typeof window !== "undefined" && isLocalHost(window.location.hostname)) {
    return getCurrentAppBaseUrl();
  }

  const explicitUrl =
    import.meta.env.VITE_APP_URL ||
    import.meta.env.VITE_AUTH_REDIRECT_URL;

  if (explicitUrl) {
    return normalizeUrl(explicitUrl);
  }

  if (typeof window !== "undefined") {
    return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
  }

  return import.meta.env.VITE_SITE_URL || import.meta.env.BASE_URL || "/";
}

export function getPasswordRecoveryRedirectUrl() {
  const url = new URL(getAppBaseUrl());
  url.searchParams.set("type", "recovery");
  return url.toString();
}
