import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_TIMESTAMP_SKEW_SECONDS = 60;

export function signRelayPayload(secret: string, timestampSec: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestampSec}.${rawBody}`).digest("hex");
}

export function verifyRelaySignature(params: {
  secret: string;
  timestampHeader: string | undefined;
  signatureHeader: string | undefined;
  rawBody: string;
  nowMs?: number;
}): { ok: true } | { ok: false; error: string } {
  const { secret, timestampHeader, signatureHeader, rawBody, nowMs = Date.now() } = params;

  if (!timestampHeader || !signatureHeader) {
    return { ok: false, error: "Missing X-Relay-Timestamp or X-Relay-Signature header" };
  }

  const tsNum = Number(timestampHeader);
  if (!Number.isInteger(tsNum)) {
    return { ok: false, error: "Invalid X-Relay-Timestamp header" };
  }

  const nowSec = Math.floor(nowMs / 1000);
  if (Math.abs(nowSec - tsNum) > MAX_TIMESTAMP_SKEW_SECONDS) {
    return { ok: false, error: "Relay request timestamp expired (>60s skew)" };
  }

  const expectedHex = signRelayPayload(secret, timestampHeader, rawBody);
  const expectedBuf = Buffer.from(expectedHex, "utf8");
  const providedBuf = Buffer.from(signatureHeader.trim().toLowerCase(), "utf8");

  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    return { ok: false, error: "Invalid HMAC signature" };
  }

  return { ok: true };
}
