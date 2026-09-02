/**
 * Lightweight Shared Access Protection & Session Management.
 * Master Milestone 8 — Phase 11 Security Gate.
 *
 * Implements:
 * 1. Constant-time password comparison via cryptographic digests.
 * 2. Signed, tamper-proof HttpOnly session tokens (HMAC-SHA256).
 * 3. Zero plaintext password leakage or logging.
 */

import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "ohmni_session";
export const DEFAULT_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Constant-time comparison of two strings using SHA-256 digests
 * to prevent timing attacks regardless of string length.
 */
export function verifyPassword(entered: string, correct: string): boolean {
  if (typeof entered !== "string" || typeof correct !== "string") {
    return false;
  }
  const enteredHash = createHash("sha256").update(entered).digest();
  const correctHash = createHash("sha256").update(correct).digest();
  return timingSafeEqual(enteredHash, correctHash);
}

/**
 * Generates a signed session token: timestamp.signature
 */
export function createSessionToken(
  secret: string,
  timestamp: number = Date.now()
): string {
  const effectiveSecret = secret.trim() || "ohmni-default-auth-secret-fallback";
  const payload = String(timestamp);
  const signature = createHmac("sha256", effectiveSecret)
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

/**
 * Validates a signed session token, ensuring signature match and max age.
 */
export function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  maxAgeMs: number = DEFAULT_SESSION_MAX_AGE_MS,
  now: number = Date.now()
): boolean {
  if (!token || typeof token !== "string") {
    return false;
  }
  const parts = token.split(".");
  if (parts.length !== 2) {
    return false;
  }
  const [timestampStr, providedSignature] = parts;
  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return false;
  }

  // Check expiration
  if (now - timestamp > maxAgeMs || timestamp > now + 60_000) {
    return false;
  }

  const effectiveSecret = secret.trim() || "ohmni-default-auth-secret-fallback";
  const expectedSignature = createHmac("sha256", effectiveSecret)
    .update(timestampStr)
    .digest("hex");

  try {
    const providedBuf = Buffer.from(providedSignature, "hex");
    const expectedBuf = Buffer.from(expectedSignature, "hex");
    if (providedBuf.length !== expectedBuf.length) {
      return false;
    }
    return timingSafeEqual(providedBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Extracts a cookie value from a Cookie header string.
 */
export function extractCookie(cookieHeader: string | null | undefined, cookieName: string): string | undefined {
  if (!cookieHeader) return undefined;
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split("=");
    if (name === cookieName) {
      return rest.join("=");
    }
  }
  return undefined;
}

/**
 * Formats a Set-Cookie header for the session token.
 */
export function formatSessionCookie(
  token: string,
  options: { isProduction?: boolean; maxAgeSeconds?: number } = {}
): string {
  const maxAge = options.maxAgeSeconds ?? 86400;
  const secure = options.isProduction ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
