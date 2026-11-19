export const DEFAULT_AUTH_REDIRECT = "/dashboard";

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.codePointAt(index);

    if (code !== undefined && (code <= 31 || code === 127)) {
      return true;
    }
  }

  return false;
}

function isLoginRoute(value: string): boolean {
  return (
    value === "/login" ||
    value.startsWith("/login?") ||
    value.startsWith("/login/") ||
    value.startsWith("/login#")
  );
}

/**
 * Validates post-login redirect targets to prevent open redirects and
 * self-targeting login loops. Only same-origin relative paths starting with a
 * single forward slash (rejecting protocol-relative `//`, backslash-normalized
 * `/\`, control characters, and `/login`) are allowed.
 */
export function sanitizeAuthRedirect(value?: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_AUTH_REDIRECT;
  }

  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    hasControlCharacter(value) ||
    isLoginRoute(value)
  ) {
    return DEFAULT_AUTH_REDIRECT;
  }

  return value;
}
