/*This function ensures a base URL always ends with a trailing slash.*/
function normalizeUrl(url) {
  return url.endsWith("/") ? url : `${url}/`;
}

/*This function checks whether the current hostname points to a local development environment.*/
function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/*This function returns the app base URL for the current browser location.*/
export function getCurrentAppBaseUrl() {
  if (typeof window !== "undefined") {
    return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
  }

  return import.meta.env.BASE_URL || "/";
}

/*This function resolves the safest base URL for auth redirects and public links.*/
export function getAppBaseUrl() {
  if (typeof window !== "undefined" && isLocalHost(window.location.hostname)) {
    return getCurrentAppBaseUrl();
  }

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

/*This function builds the password recovery redirect URL with the recovery type attached.*/
export function getPasswordRecoveryRedirectUrl() {
  const url = new URL(getAppBaseUrl());
  url.searchParams.set("type", "recovery");
  return url.toString();
}
