/**
 * Cloudflare Workers-compatible Web Crypto HMAC-SHA256 signer
 * for authenticating requests to services/applink-relay.
 */

export async function signRelayPayloadWebCrypto(
  secret: string,
  timestampSec: string,
  rawBody: string,
  nonce?: string
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const canonical = nonce ? `${timestampSec}.${nonce}.${rawBody}` : `${timestampSec}.${rawBody}`;
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(canonical));
  return [...new Uint8Array(sigBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
