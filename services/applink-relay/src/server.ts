import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { createRelayApp } from "./app.js";

// Load local .env automatically on Node 22+ if present (Docker passes --env-file directly)
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

const sharedSecret = process.env.RELAY_SHARED_SECRET;
const applicationId = process.env.APPLINK_APPLICATION_ID;
const password = process.env.APPLINK_PASSWORD;
const port = Number(process.env.PORT ?? "8788");
const hostname = process.env.RELAY_HOST ?? "0.0.0.0";
const isProd = process.env.NODE_ENV === "production";

if (!sharedSecret || !applicationId || !password) {
  console.error(
    "Missing required environment variables: RELAY_SHARED_SECRET, APPLINK_APPLICATION_ID, APPLINK_PASSWORD"
  );
  console.error("Tip: Copy services/applink-relay/.env.example to services/applink-relay/.env");
  process.exit(1);
}

if (sharedSecret.length < 32 || /replace-with|changeme|secret/i.test(sharedSecret)) {
  const msg = "RELAY_SHARED_SECRET must be a random string of at least 32 characters (not a placeholder).";
  if (isProd) {
    console.error(`[FATAL] ${msg}`);
    process.exit(1);
  }
  console.warn(`[WARN] ${msg}`);
}

if (/replace-with|APP_000000/i.test(password) || /APP_000000/i.test(applicationId)) {
  const msg = "APPLINK_APPLICATION_ID or APPLINK_PASSWORD still contains placeholder values.";
  if (isProd) {
    console.error(`[FATAL] ${msg}`);
    process.exit(1);
  }
  console.warn(`[WARN] ${msg}`);
}

const app = createRelayApp({ sharedSecret, applicationId, password });

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`RentReady AppLink Relay listening on http://${hostname}:${info.port}`);
});
