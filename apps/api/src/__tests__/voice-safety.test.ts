import { describe, expect, it, vi } from "vitest";
import { createApiApp } from "../app.js";
import { signRelayPayloadWebCrypto } from "../lib/hmac.js";
import { buildPaymentReceiptSms, buildRentReminderSms } from "../modules/notifications/applink.js";
import { extractVoiceIntent } from "../modules/voice/extractor.js";
import {
  resolvePropertyEntity,
  resolveTenancyEntity,
  type TenancyCandidate
} from "../modules/voice/resolver.js";

const SAMPLE_TENANCIES: TenancyCandidate[] = [
  {
    tenancy_id: "11111111-1111-1111-1111-111111111111",
    tenant_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    tenant_name: "Rahim Uddin",
    tenant_phone: "+8801900000001",
    unit_id: "u1",
    unit_code: "3B",
    property_id: "p1",
    property_name: "Shanti Nibash",
    monthly_rent_paisa: 1_200_000
  },
  {
    tenancy_id: "22222222-2222-2222-2222-222222222222",
    tenant_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    tenant_name: "Rahim Mia",
    tenant_phone: "+8801900000002",
    unit_id: "u2",
    unit_code: "4A",
    property_id: "p1",
    property_name: "Shanti Nibash",
    monthly_rent_paisa: 1_500_000
  },
  {
    tenancy_id: "33333333-3333-3333-3333-333333333333",
    tenant_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    tenant_name: "Karim Hossain",
    tenant_phone: "+8801700000003",
    unit_id: "u3",
    unit_code: "2A",
    property_id: "p1",
    property_name: "Shanti Nibash",
    monthly_rent_paisa: 1_400_000
  }
];

describe("Deterministic Entity Resolution (AI Safety Gate)", () => {
  it("resolves exact unit + tenant name unambiguously", () => {
    const res = resolveTenancyEntity(SAMPLE_TENANCIES, {
      tenant_name_query: "Rahim bhai",
      unit_code_query: "Flat 3B"
    });
    expect(res.status).toBe("resolved");
    if (res.status === "resolved") {
      expect(res.match.tenancy_id).toBe("11111111-1111-1111-1111-111111111111");
    }
  });

  it("NEVER guesses when two tenants match 'Rahim' without a unit code", () => {
    const res = resolveTenancyEntity(SAMPLE_TENANCIES, {
      tenant_name_query: "Rahim"
    });
    expect(res.status).toBe("ambiguous");
    if (res.status === "ambiguous") {
      expect(res.candidates).toHaveLength(2);
    }
  });

  it("returns not_found for nonexistent tenant/unit", () => {
    const res = resolveTenancyEntity(SAMPLE_TENANCIES, {
      unit_code_query: "9Z"
    });
    expect(res.status).toBe("not_found");
  });

  it("auto-selects single property or returns ambiguous for multiple properties", () => {
    const single = resolvePropertyEntity([{ property_id: "p1", name: "Shanti Nibash" }]);
    expect(single.status).toBe("resolved");

    const multi = resolvePropertyEntity([
      { property_id: "p1", name: "Shanti Nibash" },
      { property_id: "p2", name: "Green View" }
    ]);
    expect(multi.status).toBe("ambiguous");
  });
});

describe("OpenRouter Structured Intent Extractor", () => {
  it("parses valid JSON fenced response into typed record_rent_payment", async () => {
    const mockFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '```json\n{"intent":"record_rent_payment","amount_bdt":8000,"tenant_name_query":"Rahim","unit_code_query":"3B","payment_method":"bkash"}\n```'
                }
              }
            ]
          }),
          { status: 200 }
        )
    ) as unknown as typeof fetch;

    const { payload } = await extractVoiceIntent({
      transcript: "Flat 3B er Rahim bhai 8000 taka bKash korse",
      apiKey: "test-key",
      fetchImpl: mockFetch
    });

    expect(payload.intent).toBe("record_rent_payment");
    if (payload.intent === "record_rent_payment") {
      expect(payload.amount_bdt).toBe(8000);
      expect(payload.payment_method).toBe("bkash");
    }
  });

  it("rejects negative amounts cleanly via Zod -> returns unknown intent", async () => {
    const mockFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intent: "record_rent_payment",
                    amount_bdt: -500,
                    unit_code_query: "3B"
                  })
                }
              }
            ]
          }),
          { status: 200 }
        )
    ) as unknown as typeof fetch;

    const { payload } = await extractVoiceIntent({
      transcript: "invalid",
      apiKey: "test-key",
      fetchImpl: mockFetch
    });

    expect(payload.intent).toBe("unknown");
  });
});

describe("Web Crypto HMAC & SMS Builders", () => {
  it("produces valid 64-char hex SHA-256 HMAC signature", async () => {
    const sig = await signRelayPayloadWebCrypto("my-secret", "1763812800", '{"hello":"world"}');
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it("formats Bangla & English SMS receipts and reminders with exact BDT", () => {
    const receiptBn = buildPaymentReceiptSms({
      tenantName: "Rahim Uddin",
      unitCode: "3B",
      paidPaisa: 800_000,
      remainingPaisa: 400_000,
      billingMonth: "2026-11",
      language: "bn"
    });
    expect(receiptBn).toContain("3B");
    expect(receiptBn).toContain("৳");

    const reminderEn = buildRentReminderSms({
      tenantName: "Rahim Uddin",
      unitCode: "3B",
      outstandingPaisa: 400_000,
      billingMonth: "2026-11",
      language: "en"
    });
    expect(reminderEn).toContain("৳4,000");
  });
});

describe("Protected API Auth Enforcement", () => {
  it("rejects unauthenticated requests to domain & voice routes with 401", async () => {
    const app = createApiApp();
    const endpoints = [
      ["GET", "/api/dashboard"],
      ["GET", "/api/properties"],
      ["POST", "/api/payments"],
      ["POST", "/api/notifications/send"],
      ["POST", "/api/voice/interpret"]
    ] as const;

    for (const [method, path] of endpoints) {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
    }
  });
});
