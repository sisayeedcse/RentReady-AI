import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import { sendApplinkSms } from "./applink.js";
import { MAX_TIMESTAMP_SKEW_SECONDS, verifyRelaySignature } from "./hmac.js";

const MAX_RELAY_BODY_BYTES = 16 * 1024; // 16 KB
const REPLAY_TTL_MS = MAX_TIMESTAMP_SKEW_SECONDS * 2 * 1000;
const RATE_WINDOW_MS = 60_000;

const RelaySmsBodySchema = z.object({
  message: z.string().trim().min(1).max(480),
  destinationAddresses: z
    .array(z.string().regex(/^tel:\+8801[3-9]\d{8}$/, "Must be tel:+8801XXXXXXXXX"))
    .min(1)
    .max(10),
  deliveryStatusRequest: z.enum(["0", "1"]).optional().default("1")
});

export interface RelayConfig {
  sharedSecret: string;
  applicationId: string;
  password: string;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
  maxRequestsPerMinute?: number;
}

function logRelayEvent(level: "info" | "warn" | "error", event: string, meta: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    service: "rentready-applink-relay",
    level,
    event,
    ...meta
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function createRelayApp(config: RelayConfig): Hono {
  const app = new Hono();
  const seenSignatures = new Map<string, number>();
  const rateBuckets = new Map<string, number[]>();
  const maxPerMinute = config.maxRequestsPerMinute ?? 60;

  const getNow = () => config.nowMs?.() ?? Date.now();

  app.use(
    "*",
    secureHeaders({
      xContentTypeOptions: "nosniff",
      xFrameOptions: "DENY",
      referrerPolicy: "no-referrer"
    })
  );

  app.use("*", async (c, next) => {
    await next();
    c.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    c.header("Cache-Control", "no-store");
  });

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      service: "rentready-applink-relay",
      timestamp: new Date().toISOString()
    });
  });

  app.post("/relay/applink/sms/send", async (c) => {
    const now = getNow();

    // Sliding-window rate limit
    const clientIp =
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const bucket = (rateBuckets.get(clientIp) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    if (bucket.length >= maxPerMinute) {
      logRelayEvent("warn", "relay_rate_limited", { client_ip: clientIp });
      c.header("Retry-After", "60");
      return c.json({ ok: false, error: "Too many relay requests" }, 429);
    }
    bucket.push(now);
    rateBuckets.set(clientIp, bucket);

    // Body size limit check before reading full payload
    const contentLengthHeader = c.req.header("content-length");
    if (contentLengthHeader && Number(contentLengthHeader) > MAX_RELAY_BODY_BYTES) {
      return c.json({ ok: false, error: "Payload too large" }, 413);
    }

    const rawBody = await c.req.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_RELAY_BODY_BYTES) {
      return c.json({ ok: false, error: "Payload too large" }, 413);
    }

    const sigCheck = verifyRelaySignature({
      secret: config.sharedSecret,
      timestampHeader: c.req.header("x-relay-timestamp"),
      signatureHeader: c.req.header("x-relay-signature"),
      nonceHeader: c.req.header("x-relay-nonce"),
      rawBody,
      nowMs: now
    });

    if (!sigCheck.ok) {
      logRelayEvent("warn", "relay_auth_failed", { reason: sigCheck.error, client_ip: clientIp });
      return c.json({ ok: false, error: sigCheck.error }, 401);
    }

    // Prune expired replay entries and reject replayed requests within window
    for (const [key, exp] of seenSignatures.entries()) {
      if (exp <= now) seenSignatures.delete(key);
    }
    if (seenSignatures.has(sigCheck.replayKey)) {
      logRelayEvent("warn", "relay_replay_rejected", { client_ip: clientIp });
      return c.json({ ok: false, error: "Replayed relay request rejected" }, 401);
    }
    seenSignatures.set(sigCheck.replayKey, now + REPLAY_TTL_MS);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return c.json({ ok: false, error: "Invalid JSON body" }, 400);
    }

    const validated = RelaySmsBodySchema.safeParse(parsedJson);
    if (!validated.success) {
      return c.json(
        { ok: false, error: "Validation failed", details: z.flattenError(validated.error) },
        400
      );
    }

    const result = await sendApplinkSms({
      applicationId: config.applicationId,
      password: config.password,
      payload: validated.data,
      fetchImpl: config.fetchImpl
    });

    logRelayEvent(result.ok ? "info" : "warn", "applink_sms_dispatched", {
      ok: result.ok,
      status_code: result.statusCode,
      error_category: result.errorCategory,
      request_id: result.requestId,
      recipient_count: validated.data.destinationAddresses.length
    });

    // Return sanitized provider status (NEVER echoes credentials)
    return c.json(result, result.ok ? 200 : 502);
  });

  app.notFound((c) => c.json({ ok: false, error: "Not Found" }, 404));

  app.onError((err, c) => {
    logRelayEvent("error", "relay_unhandled_error", { message: err.message });
    return c.json({ ok: false, error: "Internal Server Error" }, 500);
  });

  return app;
}
