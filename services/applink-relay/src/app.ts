import { Hono } from "hono";
import { z } from "zod";
import { sendApplinkSms } from "./applink.js";
import { verifyRelaySignature } from "./hmac.js";

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
}

export function createRelayApp(config: RelayConfig): Hono {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      service: "rentready-applink-relay",
      timestamp: new Date().toISOString()
    });
  });

  app.post("/relay/applink/sms/send", async (c) => {
    const rawBody = await c.req.text();
    const sigCheck = verifyRelaySignature({
      secret: config.sharedSecret,
      timestampHeader: c.req.header("x-relay-timestamp"),
      signatureHeader: c.req.header("x-relay-signature"),
      rawBody,
      nowMs: config.nowMs?.()
    });

    if (!sigCheck.ok) {
      return c.json({ ok: false, error: sigCheck.error }, 401);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return c.json({ ok: false, error: "Invalid JSON body" }, 400);
    }

    const validated = RelaySmsBodySchema.safeParse(parsedJson);
    if (!validated.success) {
      return c.json(
        { ok: false, error: "Validation failed", details: validated.error.flatten() },
        400
      );
    }

    const result = await sendApplinkSms({
      applicationId: config.applicationId,
      password: config.password,
      payload: validated.data,
      fetchImpl: config.fetchImpl
    });

    // Return sanitized provider status (NEVER echoes credentials)
    return c.json(result, result.ok ? 200 : 502);
  });

  return app;
}
