/** Turn API / validation noise into short user-facing messages. */

export function friendlyErrorMessage(raw: unknown, fallback = "Something went wrong"): string {
  const text =
    typeof raw === "string"
      ? raw
      : raw instanceof Error
        ? raw.message
        : fallback;

  const lower = text.toLowerCase();

  if (lower.includes("special-use") || lower.includes("reserved name")) {
    return "That email domain can’t be used. Try a normal address like name@company.com";
  }
  if (lower.includes("not a valid email") || lower.includes("email address")) {
    return "Please enter a valid email address (example: name@company.com)";
  }
  if (lower.includes("invalid credentials")) {
    return "Incorrect email or password. Please try again.";
  }
  if (lower.includes("already registered")) {
    return "This email is already registered. Sign in instead.";
  }
  if (lower.includes("not authenticated") || lower.includes("invalid token")) {
    return "Your session expired. Please sign in again.";
  }
  if (lower.includes("account is inactive")) {
    return "This account is disabled. Contact support.";
  }

  // Strip pydantic prefix when present
  const cleaned = text.replace(/^value is not a valid email address:\s*/i, "").trim();
  if (cleaned.length > 0 && cleaned.length < 160) return cleaned;
  return fallback;
}

export function isValidEmailFormat(email: string): boolean {
  const value = email.trim();
  if (!value) return false;
  // Practical client check (not full RFC)
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  if (!ok) return false;
  const domain = value.split("@")[1]?.toLowerCase() || "";
  const reserved = ["local", "localhost", "test", "invalid", "example"];
  const last = domain.split(".").pop() || "";
  if (reserved.includes(last) || reserved.includes(domain)) return false;
  return true;
}
