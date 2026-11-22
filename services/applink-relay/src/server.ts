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

if (!sharedSecret || !applicationId || !password) {
  console.error(
    "Missing required environment variables: RELAY_SHARED_SECRET, APPLINK_APPLICATION_ID, APPLINK_PASSWORD"
  );
  console.error("Tip: Copy services/applink-relay/.env.example to services/applink-relay/.env");
  process.exit(1);
}

const app = createRelayApp({ sharedSecret, applicationId, password });

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`RentReady AppLink Relay listening on http://0.0.0.0:${info.port}`);
});
