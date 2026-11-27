/**
 * Manual Banglalink AppLink Relay Smoke Test (for whitelisted test numbers ONLY).
 * NEVER run in automated CI tests. NEVER logs APPLINK_PASSWORD or RELAY_SHARED_SECRET.
 *
 * Usage (PowerShell):
 *   node scripts/test-applink-relay.mjs +88019XXXXXXXX
 *   # Or against deployed HTTPS relay:
 *   $env:APPLINK_RELAY_URL="https://relay.yourdomain.com"
 *   node scripts/test-applink-relay.mjs +88019XXXXXXXX
 */

import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvFile(filePath) {
  const out = {};
  if (!existsSync(filePath)) return out;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    out[key] = val;
  }
  return out;
}

const rawPhone = process.argv[2]?.trim();
if (!rawPhone) {
  console.error("Usage: node scripts/test-applink-relay.mjs +88019XXXXXXXX");
  process.exit(1);
}

const cleaned = rawPhone.replace(/[\s\-()]/g, "");
const normalized = cleaned.startsWith("01")
  ? `+880${cleaned.slice(1)}`
  : cleaned.startsWith("8801")
    ? `+${cleaned}`
    : cleaned;

if (!/^\+8801[3-9]\d{8}$/.test(normalized)) {
  console.error(`Invalid Bangladesh phone number: ${rawPhone}`);
  process.exit(1);
}

const apiVars = parseEnvFile(resolve(process.cwd(), "apps/api/.dev.vars"));
const relayUrl = (process.env.APPLINK_RELAY_URL || apiVars.APPLINK_RELAY_URL || "http://127.0.0.1:8788").replace(/\/+$/, "");
const sharedSecret = process.env.RELAY_SHARED_SECRET || apiVars.RELAY_SHARED_SECRET;

if (!sharedSecret) {
  console.error("Missing RELAY_SHARED_SECRET in environment or apps/api/.dev.vars");
  process.exit(1);
}

const payload = {
  message: "RentReady Test SMS (APP_019181): AppLink integration verified.",
  destinationAddresses: [`tel:${normalized}`],
  deliveryStatusRequest: "1"
};

const rawBody = JSON.stringify(payload);
const timestampSec = String(Math.floor(Date.now() / 1000));
const nonce = randomUUID();
const signature = createHmac("sha256", sharedSecret)
  .update(`${timestampSec}.${nonce}.${rawBody}`)
  .digest("hex");

console.log(`Sending signed test SMS via ${relayUrl}/relay/applink/sms/send -> tel:${normalized.slice(0, 8)}****`);

const res = await fetch(`${relayUrl}/relay/applink/sms/send`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-relay-timestamp": timestampSec,
    "x-relay-nonce": nonce,
    "x-relay-signature": signature
  },
  body: rawBody
});

const data = await res.json().catch(() => null);
console.log("HTTP Status:", res.status);
console.log("Sanitized Response:", JSON.stringify(data, null, 2));

if (data?.ok === true && data?.statusCode === "S1000") {
  console.log("\nSUCCESS: AppLink accepted the SMS (statusCode: S1000)!");
  process.exit(0);
}

if (data?.statusCode === "E1303") {
  console.error("\nACTION NEEDED (E1303): Your current outbound IPv4 is not whitelisted in AppLink. Whitelist your static IPv4 (or DigitalOcean Droplet IPv4) in user.applink.com.bd.");
} else if (data?.statusCode === "E1313") {
  console.error("\nACTION NEEDED (E1313): Authentication failed. Double-check APPLINK_APPLICATION_ID=APP_019181 and APPLINK_PASSWORD (the API Key from your approval email) in services/applink-relay/.env.");
}
process.exit(1);
