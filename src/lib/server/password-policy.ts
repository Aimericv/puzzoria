import { ApiError } from "./http";

// Small local blocklist; this is not a claim to detect all leaked passwords.
const common = new Set([
  "password", "password123", "password1234", "password12345", "password123456",
  "qwerty", "qwertyuiop", "qwertyuiop123", "qwerty123456", "azertyuiop123",
  "123456789012", "1234567890123", "12345678901234", "123456789012345",
  "1234567890123456", "1234567890", "111111111111", "000000000000",
  "motdepasse", "motdepasse123", "motdepasse1234", "letmein123456",
  "admin12345678", "administrator", "iloveyou12345", "welcome12345",
]);
export function validateNewPassword(value: unknown): asserts value is string {
  if(typeof value !== "string" || value.length < 12 || value.length > 128) throw new ApiError("accountInvalid");
  const normalized=value.toLowerCase();
  if(common.has(normalized) || /^(.)\1+$/us.test(value) || /^(1234567890|qwerty|azerty|password|motdepasse)+$/i.test(value)) throw new ApiError("passwordWeak");
}
