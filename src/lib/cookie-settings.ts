let requested = false;
export function requestCookieSettings() {
  requested = true;
  window.dispatchEvent(new CustomEvent("puzzoria:cookie-settings"));
}
export function consumeCookieSettingsRequest() {
  const pending = requested;
  requested = false;
  return pending;
}
