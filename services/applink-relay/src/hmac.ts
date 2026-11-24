import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_TIMESTAMP_SKEW_SECONDS = 60;

export function signRelayPayload(
  secret: string,
  timestampSec: string,
  rawBody: string,
  nonce?: string
): string {
  const canonical = nonce ? `${timestampSec}.${nonce}.${rawBody}` : `${timestampSec}.${rawBody}`;
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

export function verifyRelaySignature(params: {
  secret: string;
  timestampHeader: string | undefined;
  signatureHeader: string | undefined;
  nonceHeader?: string | undefined;
  rawBody: string;
  nowMs?: number;
}): { ok: true; replayKey: string } | { ok: false; error: string } {
  const {
    secret,
    timestampHeader,
    signatureHeader,
    nonceHeader,
    rawBody,
    nowMs = Date.now()
  } = params;

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

  const trimmedNonce = nonceHeader?.trim();
  if (trimmedNonce !== undefined && trimmedNonce.length > 0) {
    if (!/^[A-Za-z0-9._-]{8,128}$/.test(trimmedNonce)) {
      return { ok: false, error: "Invalid X-Relay-Nonce header" };
    }
  }

  const expectedHex = signRelayPayload(
    secret,
    timestampHeader,
    rawBody,
    trimmedNonce || undefined
  );
  const providedHex = signatureHeader.trim().toLowerCase();
  const expectedBuf = Buffer.from(expectedHex, "utf8");
  const providedBuf = Buffer.from(providedHex, "utf8");

  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    return { ok: false, error: "Invalid HMAC signature" };
  }

  const replayKey = trimmedNonce ? `nonce:${trimmedNonce}` : `sig:${providedHex}`;
  return { ok: true, replayKey };
}
