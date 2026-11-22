import { describe, expect, it } from "vitest";
import { createApiApp } from "../app.js";

describe("RentReady API health & security headers", () => {
  it("returns ok payload with security headers on GET /api/health", async () => {
    const app = createApiApp();
    const res = await app.request("/api/health");

    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");

    const body = (await res.json()) as {
      status: string;
      service: string;
      timezone: string;
      timestamp: string;
    };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("rentready-api");
    expect(body.timezone).toBe("Asia/Dhaka");
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it("fails closed with 401 for unauthenticated requests to non-health /api/* routes", async () => {
    const app = createApiApp();
    const res = await app.request("/api/does-not-exist");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Authorization");
  });
});
