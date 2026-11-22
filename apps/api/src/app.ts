import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { createDomainRoutes } from "./routes/domain.js";
import { createVoiceRoutes } from "./routes/voice.js";

export interface EnvBindings {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_INTENT_MODEL?: string;
  GROQ_API_KEY?: string;
  APPLINK_RELAY_URL?: string;
  RELAY_SHARED_SECRET?: string;
  ASSETS?: Fetcher;
}

export function createApiApp(): Hono<{ Bindings: EnvBindings }> {
  const app = new Hono<{ Bindings: EnvBindings }>();

  app.use(
    "/api/*",
    secureHeaders({
      xContentTypeOptions: "nosniff",
      xFrameOptions: "DENY",
      referrerPolicy: "strict-origin-when-cross-origin"
    })
  );

  app.get("/api/health", (c) => {
    return c.json({
      status: "ok",
      service: "rentready-api",
      version: "0.2.0",
      timezone: "Asia/Dhaka",
      timestamp: new Date().toISOString()
    });
  });

  app.route("/api", createDomainRoutes());
  app.route("/api/voice", createVoiceRoutes());

  app.notFound((c) => {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ error: "Not Found", path: c.req.path }, 404);
    }
    return c.text("Not Found", 404);
  });

  app.onError((err, c) => {
    console.error("[rentready-api] unhandled error:", err.message);
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}
