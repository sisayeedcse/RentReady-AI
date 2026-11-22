/**
 * Cloudflare Workers-compatible Web Crypto HMAC-SHA256 signer
 * for authenticating requests to services/applink-relay.
 */

export async function signRelayPayloadWebCrypto(
  secret: string,
  timestampSec: string,
  rawBody: string
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`${timestampSec}.${rawBody}`)
  );
  return [...new Uint8Array(sigBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
