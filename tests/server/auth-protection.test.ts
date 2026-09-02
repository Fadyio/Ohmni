import { describe, expect, it } from "bun:test";
import {
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  formatSessionCookie,
  extractCookie,
  SESSION_COOKIE_NAME,
} from "../../server/bench-agent/auth";
import { createBenchAgentHandler } from "../../server/bench-agent/handler";

describe("Shared Access Protection & Auth Tests (Phase 11)", () => {
  const SECRET = "test-secret-key-12345";
  const PASSWORD = "SuperSecurePassword99!";

  describe("Password Verification (Constant-Time)", () => {
    it("accepts identical password and rejects incorrect password", () => {
      expect(verifyPassword(PASSWORD, PASSWORD)).toBe(true);
      expect(verifyPassword("WrongPassword", PASSWORD)).toBe(false);
      expect(verifyPassword("", PASSWORD)).toBe(false);
      expect(verifyPassword(PASSWORD, "")).toBe(false);
    });

    it("handles special characters and long passwords safely", () => {
      const complex = "Ω≈ç√∫˜µ≤≥÷#$@!%^&*()_+{}[]|:;<>?,./~`";
      expect(verifyPassword(complex, complex)).toBe(true);
      expect(verifyPassword(complex, complex + "1")).toBe(false);
    });
  });

  describe("Signed Session Tokens (HMAC-SHA256)", () => {
    it("generates a signed session token that verifies correctly", () => {
      const now = Date.now();
      const token = createSessionToken(SECRET, now);
      expect(verifySessionToken(token, SECRET, 3600_000, now + 100)).toBe(true);
    });

    it("rejects token with invalid signature or wrong secret", () => {
      const now = Date.now();
      const token = createSessionToken(SECRET, now);
      expect(verifySessionToken(token, "wrong-secret", 3600_000, now + 100)).toBe(false);
    });

    it("rejects expired session token", () => {
      const now = Date.now();
      const token = createSessionToken(SECRET, now - 5000);
      // Max age 1000ms -> expired
      expect(verifySessionToken(token, SECRET, 1000, now)).toBe(false);
    });

    it("rejects malformed or tampered tokens", () => {
      expect(verifySessionToken("invalid-token", SECRET)).toBe(false);
      expect(verifySessionToken("12345.tampered_signature", SECRET)).toBe(false);
      expect(verifySessionToken("", SECRET)).toBe(false);
      expect(verifySessionToken(null as unknown as string, SECRET)).toBe(false);
    });
  });

  describe("Cookie Formatting & Extraction", () => {
    it("formats session cookie with HttpOnly and SameSite=Lax", () => {
      const cookie = formatSessionCookie("token123", { isProduction: false });
      expect(cookie).toContain("ohmni_session=token123");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).not.toContain("Secure");
    });

    it("includes Secure flag in production", () => {
      const cookie = formatSessionCookie("token123", { isProduction: true });
      expect(cookie).toContain("Secure");
    });

    it("extracts session cookie from Cookie header", () => {
      const header = "theme=dark; ohmni_session=abc.123; user_id=42";
      expect(extractCookie(header, SESSION_COOKIE_NAME)).toBe("abc.123");
      expect(extractCookie(header, "nonexistent")).toBeUndefined();
      expect(extractCookie(null, SESSION_COOKIE_NAME)).toBeUndefined();
    });
  });

  describe("Handler Auth Protection Gate", () => {
    it("works normally without session when OHMNI_ACCESS_PASSWORD is not set (Public Mode)", async () => {
      const handler = createBenchAgentHandler({
        env: {
          GEMINI_API_KEY: "test-key",
        },
        provider: {
          turn: async () => ({
            interactionId: "int-1",
            functionCalls: [],
            text: "Public response",
          }),
        },
      });

      const req = new Request("http://localhost/api/bench-agent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "x-bench-agent-session": "session-1",
        },
        body: JSON.stringify({ input: "Hello", tools: [] }),
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.text).toBe("Public response");
    });

    it("rejects unauthorized requests with 401 when OHMNI_ACCESS_PASSWORD is set", async () => {
      const handler = createBenchAgentHandler({
        env: {
          GEMINI_API_KEY: "test-key",
          OHMNI_ACCESS_PASSWORD: PASSWORD,
          OHMNI_AUTH_SECRET: SECRET,
        },
        provider: {
          turn: async () => ({
            interactionId: "int-1",
            functionCalls: [],
            text: "Secret response",
          }),
        },
      });

      const req = new Request("http://localhost/api/bench-agent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "x-bench-agent-session": "session-1",
        },
        body: JSON.stringify({ input: "Hello", tools: [] }),
      });

      const res = await handler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("UNAUTHORIZED");
    });

    it("accepts requests with valid session cookie when auth is enabled", async () => {
      const handler = createBenchAgentHandler({
        env: {
          GEMINI_API_KEY: "test-key",
          OHMNI_ACCESS_PASSWORD: PASSWORD,
          OHMNI_AUTH_SECRET: SECRET,
        },
        provider: {
          turn: async () => ({
            interactionId: "int-1",
            functionCalls: [],
            text: "Authorized response",
          }),
        },
      });

      const validToken = createSessionToken(SECRET);

      const req = new Request("http://localhost/api/bench-agent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "x-bench-agent-session": "session-1",
          cookie: `ohmni_session=${validToken}`,
        },
        body: JSON.stringify({ input: "Hello", tools: [] }),
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.text).toBe("Authorized response");
    });

    it("handles login route POST /api/auth/login and issues session cookie on correct password", async () => {
      const handler = createBenchAgentHandler({
        env: {
          GEMINI_API_KEY: "test-key",
          OHMNI_ACCESS_PASSWORD: PASSWORD,
          OHMNI_AUTH_SECRET: SECRET,
        },
      });

      // 1. Wrong password -> 401
      const wrongReq = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "Wrong" }),
      });
      const wrongRes = await handler(wrongReq);
      expect(wrongRes.status).toBe(401);

      // 2. Correct password -> 200 with Set-Cookie
      const correctReq = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: PASSWORD }),
      });
      const correctRes = await handler(correctReq);
      expect(correctRes.status).toBe(200);
      const setCookie = correctRes.headers.get("set-cookie");
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain("ohmni_session=");
      expect(setCookie).toContain("HttpOnly");
    });
  });
});
