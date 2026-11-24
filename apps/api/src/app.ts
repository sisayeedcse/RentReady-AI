import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import {
  corsAndOriginMiddleware,
  createRateLimiter,
  jsonBodyLimitMiddleware,
  logSecurityEvent,
  requestIdMiddleware,
  type SecurityVariables
} from "./lib/security.js";
import { createDomainRoutes } from "./routes/domain.js";
import { createVoiceRoutes } from "./routes/voice.js";

export interface EnvBindings {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  APPLINK_RELAY_URL?: string;
  RELAY_SHARED_SECRET?: string;
  ALLOWED_ORIGINS?: string;
  ALLOW_INSECURE_LOCAL_RELAY?: string;
  ASSETS?: Fetcher;
}

export interface ApiAppOptions {
  generalRateLimitMax?: number;
  smsRateLimitMax?: number;
  voiceRateLimitMax?: number;
}

export function createApiApp(
  options: ApiAppOptions = {}
): Hono<{ Bindings: EnvBindings; Variables: SecurityVariables }> {
  const app = new Hono<{ Bindings: EnvBindings; Variables: SecurityVariables }>();

  app.use("/api/*", requestIdMiddleware());
  app.use("/api/*", corsAndOriginMiddleware());

  app.use(
    "/api/*",
    secureHeaders({
      xContentTypeOptions: "nosniff",
      xFrameOptions: "DENY",
      referrerPolicy: "strict-origin-when-cross-origin",
      strictTransportSecurity: false
    })
  );

  app.use("/api/*", async (c, next) => {
    await next();
    c.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=()");
    c.header("Cache-Control", "no-store");
    if (c.req.url.startsWith("https://")) {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
  });

  app.use("/api/*", jsonBodyLimitMiddleware(128 * 1024));

  app.use(
    "/api/*",
    createRateLimiter({
      bucketName: "api_general",
      maxRequests: options.generalRateLimitMax ?? 120,
      windowMs: 60_000,
      keyBy: "ip"
    })
  );

  app.get("/api/health", (c) => {
    return c.json({
      status: "ok",
      service: "rentready-api",
      version: "0.3.0",
      timezone: "Asia/Dhaka",
      timestamp: new Date().toISOString()
    });
  });

  app.route("/api", createDomainRoutes({ smsRateLimitMax: options.smsRateLimitMax }));
  app.route("/api/voice", createVoiceRoutes({ voiceRateLimitMax: options.voiceRateLimitMax }));

  app.notFound((c) => {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ error: "Not Found" }, 404);
    }
    return c.text("Not Found", 404);
  });

  app.onError((err, c) => {
    const requestId = c.get("requestId");
    logSecurityEvent("error", "unhandled_api_error", {
      request_id: requestId,
      path: c.req.path,
      message: err.message
    });
    return c.json({ error: "Internal Server Error", request_id: requestId }, 500);
  });

  return app;
}
