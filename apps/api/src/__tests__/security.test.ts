import { describe, expect, it, vi } from "vitest";
import { createApiApp } from "../app.js";
import { signRelayPayloadWebCrypto } from "../lib/hmac.js";
import {
  escapeIlikePattern,
  mapSafeDbError,
  runWithPgrst201Fallback,
  sanitizeLogValue,
  validateAudioUpload
} from "../lib/security.js";
import { dispatchApplinkSmsViaRelay, isAllowedRelayUrl } from "../modules/notifications/applink.js";
import { GeminiAudioAsrProvider } from "../modules/voice/asr.js";
import { extractVoiceIntent } from "../modules/voice/extractor.js";

describe("API Security Controls (Headers, CORS, Rate Limit, Body Size)", () => {
  it("sets complete security headers and HSTS over HTTPS", async () => {
    const app = createApiApp();
    const res = await app.request("https://rentready.workers.dev/api/health");

    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("permissions-policy")).toContain("microphone=()");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=31536000");
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("rejects untrusted cross-origin preflight and mutating requests with 403", async () => {
    const app = createApiApp();
    const preflight = await app.request("https://rentready.workers.dev/api/payments", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example" }
    });
    expect(preflight.status).toBe(403);
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();

    const post = await app.request("https://rentready.workers.dev/api/payments", {
      method: "POST",
      headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
      body: "{}"
    });
    expect(post.status).toBe(403);
  });

  it("allows same-origin and explicitly configured ALLOWED_ORIGINS", async () => {
    const app = createApiApp();
    const sameOrigin = await app.request("https://rentready.workers.dev/api/payments", {
      method: "OPTIONS",
      headers: { Origin: "https://rentready.workers.dev" }
    });
    expect(sameOrigin.status).toBe(204);
    expect(sameOrigin.headers.get("access-control-allow-origin")).toBe("https://rentready.workers.dev");

    const configuredOrigin = await app.request(
      "https://rentready.workers.dev/api/payments",
      {
        method: "OPTIONS",
        headers: { Origin: "https://app.rentready.bd" }
      },
      { ALLOWED_ORIGINS: "https://app.rentready.bd" }
    );
    expect(configuredOrigin.status).toBe(204);
    expect(configuredOrigin.headers.get("access-control-allow-origin")).toBe("https://app.rentready.bd");
  });

  it("enforces sliding-window rate limits with 429 and Retry-After", async () => {
    const app = createApiApp({ generalRateLimitMax: 2 });
    const r1 = await app.request("/api/health", { headers: { "cf-connecting-ip": "203.0.113.10" } });
    const r2 = await app.request("/api/health", { headers: { "cf-connecting-ip": "203.0.113.10" } });
    const r3 = await app.request("/api/health", { headers: { "cf-connecting-ip": "203.0.113.10" } });

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
    expect(Number(r3.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    expect(r3.headers.get("x-ratelimit-remaining")).toBe("0");
  });

  it("rejects oversized JSON request payloads with 413", async () => {
    const app = createApiApp();
    const oversized = JSON.stringify({ data: "A".repeat(140_000) });
    const res = await app.request("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: oversized
    });
    expect(res.status).toBe(413);
  });
});

describe("Audio File Magic-Byte & MIME Validation", () => {
  it("accepts genuine WebM, Ogg, WAV, and MP3 binary headers", () => {
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x00, 0x00, 0x00]).buffer;
    expect(validateAudioUpload("audio/webm;codecs=opus", webm)).toEqual({
      ok: true,
      normalizedMimeType: "audio/webm"
    });

    const ogg = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]).buffer;
    expect(validateAudioUpload("audio/ogg", ogg)).toEqual({
      ok: true,
      normalizedMimeType: "audio/ogg"
    });

    const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]).buffer;
    expect(validateAudioUpload("audio/wav", wav)).toEqual({
      ok: true,
      normalizedMimeType: "audio/wav"
    });
  });

  it("rejects disguised HTML, executables, and unsupported MIME types", () => {
    const htmlPayload = new TextEncoder().encode("<html><script>alert(1)</script></html>").buffer;
    expect(validateAudioUpload("audio/webm", htmlPayload).ok).toBe(false);
    expect(validateAudioUpload("text/html", htmlPayload).ok).toBe(false);

    const exePayload = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]).buffer;
    expect(validateAudioUpload("audio/mpeg", exePayload).ok).toBe(false);
  });
});

describe("Credential & Transport Hardening (Gemini Headers & Relay HTTPS/Nonce)", () => {
  it("sends Gemini API key exclusively via x-goog-api-key header, NEVER in URL query string", async () => {
    const mockFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: '{"intent":"get_property_summary"}' }] } }]
          }),
          { status: 200 }
        )
    ) as unknown as typeof fetch;

    await extractVoiceIntent({
      transcript: "Summary dao",
      apiKey: "SECRET_GEMINI_KEY_123",
      fetchImpl: mockFetch
    });

    const [calledUrl, init] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).not.toContain("SECRET_GEMINI_KEY_123");
    expect(calledUrl).not.toContain("?key=");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("SECRET_GEMINI_KEY_123");

    const asrFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "রহিম ৮০০০ টাকা দিয়েছে" }] } }]
          }),
          { status: 200 }
        )
    ) as unknown as typeof fetch;

    const asr = new GeminiAudioAsrProvider("SECRET_ASR_KEY_456", "gemini-3.5-flash-lite", asrFetch);
    await asr.transcribe({
      audio: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]).buffer,
      filename: "voice.webm",
      mimeType: "audio/webm"
    });

    const [asrUrl, asrInit] = (asrFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(asrUrl).not.toContain("SECRET_ASR_KEY_456");
    expect(asrUrl).not.toContain("?key=");
    expect((asrInit.headers as Record<string, string>)["x-goog-api-key"]).toBe("SECRET_ASR_KEY_456");
  });

  it("enforces HTTPS for remote AppLink relay URLs and signs requests with nonce", async () => {
    expect(isAllowedRelayUrl("https://relay.rentready.bd")).toBe(true);
    expect(isAllowedRelayUrl("http://127.0.0.1:8788")).toBe(true);
    expect(isAllowedRelayUrl("http://159.89.10.20:8788")).toBe(false);

    const blocked = await dispatchApplinkSmsViaRelay({
      relayUrl: "http://159.89.10.20:8788",
      sharedSecret: "a".repeat(64),
      phoneE164: "+8801900000001",
      message: "Test reminder"
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.statusCode).toBe("INSECURE_RELAY_URL");

    const mockFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ ok: true, httpStatus: 200, statusCode: "S1000", statusDetail: "Success", requestId: "R1", errorCategory: "none" }),
          { status: 200 }
        )
    ) as unknown as typeof fetch;

    const secret = "b".repeat(64);
    const okRes = await dispatchApplinkSmsViaRelay({
      relayUrl: "https://relay.rentready.bd",
      sharedSecret: secret,
      phoneE164: "+8801900000001",
      message: "RentReady receipt",
      fetchImpl: mockFetch
    });
    expect(okRes.ok).toBe(true);

    const [, init] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["x-relay-nonce"]).toBeTruthy();
    const expectedSig = await signRelayPayloadWebCrypto(
      secret,
      headers["x-relay-timestamp"]!,
      String(init.body),
      headers["x-relay-nonce"]
    );
    expect(headers["x-relay-signature"]).toBe(expectedSig);
  });
});

describe("Safe DB Error Mapping, ILIKE Escaping & Log Injection Prevention", () => {
  it("escapes PostgreSQL ILIKE wildcards and prevents log newline injection", () => {
    expect(escapeIlikePattern("100%_flat\\A")).toBe("100\\%\\_flat\\\\A");
    expect(sanitizeLogValue("normal\r\nFAKE_LOG_ENTRY")).toBe("normal  FAKE_LOG_ENTRY");
  });

  it("masks raw PostgreSQL schema details on unexpected errors", () => {
    const safe = mapSafeDbError(
      { code: "42P01", message: 'relation "public.secret_internal_table" does not exist' },
      "test",
      "req-1"
    );
    expect(safe.status).toBe(500);
    expect(safe.message).not.toContain("secret_internal_table");

    const dup = mapSafeDbError(
      { code: "23505", message: "duplicate key value violates unique constraint uq_tenancies_one_active_per_unit" },
      "test",
      "req-2"
    );
    expect(dup.status).toBe(409);
    expect(dup.message).toContain("active tenant");
  });

  it("retries PostgREST PGRST201 ambiguous relationship errors via explicit FK fallback", async () => {
    type QueryRes = { data: Array<{ id: string }> | null; error: { code?: string; message?: string } | null };
    const fallbackFn = vi.fn(async (): Promise<QueryRes> => ({ data: [{ id: "1" }], error: null }));
    const res = await runWithPgrst201Fallback<QueryRes>(
      async () => ({
        data: null,
        error: { code: "PGRST201", message: "Could not embed because more than one relationship was found" }
      }),
      fallbackFn
    );
    expect(fallbackFn).toHaveBeenCalledTimes(1);
    expect(res.error).toBeNull();
    expect(res.data).toEqual([{ id: "1" }]);

    const unusedFallback = vi.fn(async (): Promise<QueryRes> => ({ data: [], error: null }));
    const okRes = await runWithPgrst201Fallback<QueryRes>(
      async () => ({ data: [{ id: "2" }], error: null }),
      unusedFallback
    );
    expect(unusedFallback).not.toHaveBeenCalled();
    expect(okRes.data).toEqual([{ id: "2" }]);
  });
});
