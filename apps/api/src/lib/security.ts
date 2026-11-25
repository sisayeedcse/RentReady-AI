import type { Context, MiddlewareHandler } from "hono";
import type { EnvBindings } from "../app.js";

export interface SecurityVariables {
  requestId: string;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "video/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/flac"
]);

/**
 * Strips CR/LF and ASCII control characters to prevent log injection.
 */
export function sanitizeLogValue(value: string, maxLen = 200): string {
  return value.replace(/[\r\n\t\x00-\x1f\x7f]/g, " ").trim().slice(0, maxLen);
}

/**
 * Emits structured JSON security & operational logs.
 * NEVER pass passwords, JWTs, API keys, or sensitive tenant PII in meta.
 */
export function logSecurityEvent(
  level: "info" | "warn" | "error",
  event: string,
  meta: Record<string, unknown>
): void {
  const safeMeta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (/password|secret|token|authorization|apikey|api_key/i.test(k)) {
      safeMeta[k] = "[REDACTED]";
    } else if (typeof v === "string") {
      safeMeta[k] = sanitizeLogValue(v);
    } else {
      safeMeta[k] = v;
    }
  }

  const line = JSON.stringify({
    ts: new Date().toISOString(),
    service: "rentready-api",
    level,
    event,
    ...safeMeta
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function getClientIp(c: Context): string {
  return (
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Escapes PostgreSQL LIKE/ILIKE metacharacters (%, _, \).
 */
export function escapeIlikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Validates BOTH declared MIME type AND binary magic bytes of uploaded audio.
 * Prevents uploading disguised HTML, scripts, executables, or arbitrary binary files.
 */
export function validateAudioUpload(
  rawMimeType: string,
  buffer: ArrayBufferLike
): { ok: true; normalizedMimeType: string } | { ok: false; error: string } {
  const baseMime = (rawMimeType || "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (baseMime && !ALLOWED_AUDIO_MIME_TYPES.has(baseMime)) {
    return { ok: false, error: "Unsupported audio format. Please record or upload WebM, Ogg, MP4/M4A, MP3, or WAV audio." };
  }

  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) {
    return { ok: false, error: "Audio file is too short or corrupted." };
  }

  // WebM / Matroska EBML header: 1A 45 DF A3
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { ok: true, normalizedMimeType: "audio/webm" };
  }
  // Ogg container: "OggS"
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return { ok: true, normalizedMimeType: "audio/ogg" };
  }
  // WAV / RIFF: "RIFF" .... "WAVE"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  ) {
    return { ok: true, normalizedMimeType: "audio/wav" };
  }
  // MP4 / M4A ISO BMFF: "ftyp" at offset 4
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return { ok: true, normalizedMimeType: "audio/mp4" };
  }
  // MP3 with ID3 tag: "ID3"
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return { ok: true, normalizedMimeType: "audio/mpeg" };
  }
  // FLAC: "fLaC"
  if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return { ok: true, normalizedMimeType: "audio/flac" };
  }
  // ADTS AAC or raw MPEG audio frame sync: 0xFF 0xE0+
  if (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) {
    const isAdts = (bytes[1]! & 0xf6) === 0xf0;
    return { ok: true, normalizedMimeType: isAdts ? "audio/aac" : "audio/mpeg" };
  }

  return { ok: false, error: "File contents do not match a valid audio format." };
}

/**
 * Attaches a unique X-Request-Id header to every API request/response.
 */
export function requestIdMiddleware(): MiddlewareHandler<{
  Bindings: EnvBindings;
  Variables: SecurityVariables;
}> {
  return async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    await next();
    c.header("X-Request-Id", requestId);
  };
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Strict CORS & Origin verification middleware:
 * - Never emits wildcard '*' with credentials.
 * - Allows same-origin, explicit ALLOWED_ORIGINS env allowlist, and localhost dev origins only when serving locally.
 * - Rejects untrusted cross-origin preflights and state-changing requests with 403.
 */
export function corsAndOriginMiddleware(): MiddlewareHandler<{
  Bindings: EnvBindings;
  Variables: SecurityVariables;
}> {
  return async (c, next) => {
    const origin = c.req.header("origin");
    if (!origin) {
      await next();
      return;
    }

    let requestOrigin = "";
    try {
      requestOrigin = new URL(c.req.url).origin;
    } catch {
      requestOrigin = "";
    }

    const configured = (c.env?.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const isAllowed =
      origin === requestOrigin ||
      configured.includes(origin) ||
      (isLocalhostOrigin(requestOrigin) && isLocalhostOrigin(origin));

    c.header("Vary", "Origin");

    if (!isAllowed) {
      if (c.req.method === "OPTIONS" || MUTATING_METHODS.has(c.req.method)) {
        logSecurityEvent("warn", "cors_origin_rejected", {
          request_id: c.get("requestId"),
          origin,
          method: c.req.method,
          path: c.req.path,
          client_ip: getClientIp(c)
        });
        return c.json({ error: "Cross-origin request forbidden" }, 403);
      }
      await next();
      return;
    }

    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
    c.header("Access-Control-Max-Age", "600");

    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }

    await next();
  };
}

/**
 * Enforces strict JSON request body size cap (multipart audio route handles its own 5MB cap).
 */
export function jsonBodyLimitMiddleware(maxBytes = 128 * 1024): MiddlewareHandler {
  return async (c, next) => {
    if (!MUTATING_METHODS.has(c.req.method)) {
      await next();
      return;
    }
    const contentType = (c.req.header("content-type") ?? "").toLowerCase();
    if (contentType.includes("multipart/form-data")) {
      await next();
      return;
    }

    const cl = c.req.header("content-length");
    if (cl && Number(cl) > maxBytes) {
      return c.json({ error: "Request payload too large" }, 413);
    }

    // Clone check when content-length is omitted (chunked encoding)
    if (!cl) {
      const cloned = c.req.raw.clone();
      const buf = await cloned.arrayBuffer().catch(() => null);
      if (buf && buf.byteLength > maxBytes) {
        return c.json({ error: "Request payload too large" }, 413);
      }
    }

    await next();
  };
}

export interface RateLimitConfig {
  bucketName: string;
  maxRequests: number;
  windowMs: number;
  keyBy?: "user_or_ip" | "ip";
  nowMs?: () => number;
}

/**
 * In-isolate sliding-window rate limiter.
 * Returns 429 with Retry-After and X-RateLimit-* headers.
 * Note: For multi-POP global enforcement in production, pair with Cloudflare Dashboard WAF Rate Limiting rules.
 */
export function createRateLimiter(config: RateLimitConfig): MiddlewareHandler {
  const store = new Map<string, number[]>();

  return async (c, next) => {
    const now = config.nowMs?.() ?? Date.now();
    const userId = config.keyBy === "ip" ? undefined : (c.get("userId" as never) as string | undefined);
    const key = `${config.bucketName}:${userId ?? getClientIp(c)}`;

    // Periodic pruning to bound memory in long-lived isolates
    if (store.size > 2000) {
      for (const [k, stamps] of store.entries()) {
        const fresh = stamps.filter((t) => now - t < config.windowMs);
        if (fresh.length === 0) store.delete(k);
        else store.set(k, fresh);
      }
    }

    const recent = (store.get(key) ?? []).filter((t) => now - t < config.windowMs);
    if (recent.length >= config.maxRequests) {
      const oldest = recent[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((config.windowMs - (now - oldest)) / 1000));
      logSecurityEvent("warn", "rate_limit_exceeded", {
        request_id: c.get("requestId" as never),
        bucket: config.bucketName,
        actor: userId ? "authenticated_user" : getClientIp(c),
        path: c.req.path
      });
      c.header("Retry-After", String(retryAfterSec));
      c.header("X-RateLimit-Limit", String(config.maxRequests));
      c.header("X-RateLimit-Remaining", "0");
      return c.json({ error: "Too many requests. Please try again shortly." }, 429);
    }

    recent.push(now);
    store.set(key, recent);
    c.header("X-RateLimit-Limit", String(config.maxRequests));
    c.header("X-RateLimit-Remaining", String(Math.max(0, config.maxRequests - recent.length)));

    await next();
  };
}

/**
 * Sanitizes database/PostgREST errors before returning them to clients.
 * Full details are logged server-side with request_id for troubleshooting without exposing SQL internals.
 */
export function mapSafeDbError(
  err: { code?: string; message?: string } | null | undefined,
  context: string,
  requestId?: string
): { status: 400 | 404 | 409 | 500; message: string } {
  const code = err?.code ?? "";
  const raw = err?.message ?? "";

  logSecurityEvent("warn", "db_operation_failed", {
    request_id: requestId,
    context,
    pg_code: code || "none",
    detail: raw.slice(0, 160)
  });

  if (raw.includes("uq_tenancies_one_active_per_unit")) {
    return { status: 409, message: "This unit already has an active tenant assigned." };
  }
  if (code === "23505") {
    return { status: 409, message: "A record with these unique details already exists." };
  }
  if (code === "23503") {
    return { status: 400, message: "Referenced property, unit, tenant, or record was not found." };
  }
  if (code === "22P02") {
    return { status: 400, message: "Invalid identifier or data format." };
  }
  if (code === "23514") {
    return { status: 400, message: "Submitted values failed data integrity constraints." };
  }
  if (raw.includes("Tenancy not found")) {
    return { status: 404, message: "Tenancy not found or access denied." };
  }
  if (raw.includes("Original payment not found")) {
    return { status: 404, message: "Payment not found or access denied." };
  }
  if (raw.includes("Cannot reverse a reversal row")) {
    return { status: 400, message: "Cannot reverse a reversal entry." };
  }
  if (raw.includes("Payment has already been reversed")) {
    return { status: 409, message: "This payment has already been reversed." };
  }
  if (raw.includes("Target obligation not found")) {
    return { status: 400, message: "Selected rent bill does not belong to this tenancy." };
  }
  if (code === "PGRST116") {
    return { status: 404, message: "Requested record was not found." };
  }
  if (code === "PGRST201") {
    return { status: 500, message: "Database schema relationship conflict. Please apply Migration 005." };
  }

  return { status: 500, message: "Unable to complete the request right now. Please try again." };
}

/**
 * Runs a PostgREST query using clean unqualified embeds first; if the database currently has
 * Migration 004 applied without Migration 005 (causing PostgREST PGRST201 ambiguous relationship),
 * transparently retries with explicit Migration 004 composite FK hints so production stays up with zero downtime.
 */
export async function runWithPgrst201Fallback<T extends { error: { code?: string } | null }>(
  primary: () => PromiseLike<T>,
  fallbackWithFkHints: () => PromiseLike<T>
): Promise<T> {
  const res = await primary();
  if (res.error?.code === "PGRST201") {
    return await fallbackWithFkHints();
  }
  return res;
}
