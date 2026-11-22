import { describe, expect, it, vi } from "vitest";
import { APPLINK_SMS_SEND_URL } from "../applink.js";
import { createRelayApp } from "../app.js";
import { signRelayPayload } from "../hmac.js";

const TEST_SECRET = "test-relay-secret-32-chars-minimum";
const TEST_APP_ID = "APP_TEST_01";
const TEST_PASSWORD = "SUPER_SECRET_PASSWORD_DO_NOT_LEAK";
const FIXED_NOW_MS = 1_763_812_800_000;
const FIXED_TS = String(Math.floor(FIXED_NOW_MS / 1000));

function makeMockFetch(status: number, body: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("AppLink Fixed-IP Relay", () => {
  it("returns 200 on GET /health", async () => {
    const app = createRelayApp({
      sharedSecret: TEST_SECRET,
      applicationId: TEST_APP_ID,
      password: TEST_PASSWORD
    });
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; service: string };
    expect(json.status).toBe("ok");
    expect(json.service).toBe("rentready-applink-relay");
  });

  it("rejects unsigned requests with 401", async () => {
    const app = createRelayApp({
      sharedSecret: TEST_SECRET,
      applicationId: TEST_APP_ID,
      password: TEST_PASSWORD
    });
    const res = await app.request("/relay/applink/sms/send", {
      method: "POST",
      body: JSON.stringify({ message: "hi", destinationAddresses: ["tel:+8801959979376"] })
    });
    expect(res.status).toBe(401);
  });

  it("rejects expired timestamps (>60s skew) with 401", async () => {
    const app = createRelayApp({
      sharedSecret: TEST_SECRET,
      applicationId: TEST_APP_ID,
      password: TEST_PASSWORD,
      nowMs: () => FIXED_NOW_MS
    });
    const staleTs = String(Math.floor(FIXED_NOW_MS / 1000) - 120);
    const rawBody = JSON.stringify({
      message: "Rent reminder",
      destinationAddresses: ["tel:+8801959979376"]
    });
    const sig = signRelayPayload(TEST_SECRET, staleTs, rawBody);

    const res = await app.request("/relay/applink/sms/send", {
      method: "POST",
      headers: { "x-relay-timestamp": staleTs, "x-relay-signature": sig },
      body: rawBody
    });
    expect(res.status).toBe(401);
  });

  it("succeeds ONLY when AppLink returns statusCode S1000 and never leaks password", async () => {
    const mockFetch = makeMockFetch(200, {
      statusCode: "S1000",
      statusDetail: "Success",
      requestId: "MSG_20261122_001"
    });
    const app = createRelayApp({
      sharedSecret: TEST_SECRET,
      applicationId: TEST_APP_ID,
      password: TEST_PASSWORD,
      fetchImpl: mockFetch,
      nowMs: () => FIXED_NOW_MS
    });

    const rawBody = JSON.stringify({
      message: "RentReady: BDT 8,000 received for Unit 3B.",
      destinationAddresses: ["tel:+8801959979376"]
    });
    const sig = signRelayPayload(TEST_SECRET, FIXED_TS, rawBody);

    const res = await app.request("/relay/applink/sms/send", {
      method: "POST",
      headers: { "x-relay-timestamp": FIXED_TS, "x-relay-signature": sig },
      body: rawBody
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(TEST_PASSWORD);
    const json = JSON.parse(text) as { ok: boolean; statusCode: string; requestId: string };
    expect(json.ok).toBe(true);
    expect(json.statusCode).toBe("S1000");
    expect(json.requestId).toBe("MSG_20261122_001");
    expect(mockFetch).toHaveBeenCalledWith(
      APPLINK_SMS_SEND_URL,
      expect.objectContaining({ method: "POST" })
    );
  });

  it("treats HTTP 200 OK with E1303 (unprovisioned IP) as a failure", async () => {
    const mockFetch = makeMockFetch(200, {
      statusCode: "E1303",
      statusDetail: "IP address is not provisioned"
    });
    const app = createRelayApp({
      sharedSecret: TEST_SECRET,
      applicationId: TEST_APP_ID,
      password: TEST_PASSWORD,
      fetchImpl: mockFetch,
      nowMs: () => FIXED_NOW_MS
    });

    const rawBody = JSON.stringify({
      message: "Test SMS",
      destinationAddresses: ["tel:+8801959979376"]
    });
    const sig = signRelayPayload(TEST_SECRET, FIXED_TS, rawBody);

    const res = await app.request("/relay/applink/sms/send", {
      method: "POST",
      headers: { "x-relay-timestamp": FIXED_TS, "x-relay-signature": sig },
      body: rawBody
    });

    expect(res.status).toBe(502);
    const json = (await res.json()) as { ok: boolean; statusCode: string; errorCategory: string };
    expect(json.ok).toBe(false);
    expect(json.statusCode).toBe("E1303");
    expect(json.errorCategory).toBe("ip_not_provisioned");
  });

  it("treats HTTP 200 OK with E1313 (auth failed) as a failure", async () => {
    const mockFetch = makeMockFetch(200, {
      statusCode: "E1313",
      statusDetail: "Authentication failed"
    });
    const app = createRelayApp({
      sharedSecret: TEST_SECRET,
      applicationId: TEST_APP_ID,
      password: TEST_PASSWORD,
      fetchImpl: mockFetch,
      nowMs: () => FIXED_NOW_MS
    });

    const rawBody = JSON.stringify({
      message: "Test SMS",
      destinationAddresses: ["tel:+8801959979376"]
    });
    const sig = signRelayPayload(TEST_SECRET, FIXED_TS, rawBody);

    const res = await app.request("/relay/applink/sms/send", {
      method: "POST",
      headers: { "x-relay-timestamp": FIXED_TS, "x-relay-signature": sig },
      body: rawBody
    });

    expect(res.status).toBe(502);
    const json = (await res.json()) as { ok: boolean; statusCode: string; errorCategory: string };
    expect(json.ok).toBe(false);
    expect(json.statusCode).toBe("E1313");
    expect(json.errorCategory).toBe("auth_failed");
  });
});
