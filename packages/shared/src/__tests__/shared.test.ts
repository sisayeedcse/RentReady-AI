import { describe, expect, it } from "vitest";
import { getDhakaBillingMonthString, getDhakaDateString, isValidIsoCalendarDate } from "../date.js";
import {
  addPaisa,
  bdtToPaisa,
  deriveObligationStatus,
  formatBdt,
  paisaToBdtString,
  subtractPaisa
} from "../money.js";
import { isBanglalinkPrefix, normalizeBdPhone, toApplinkAddress } from "../phone.js";
import { requiresConfirmation, VoiceActionPayloadSchema } from "../schemas/actions.js";
import {
  CreateExpenseRequestSchema,
  GenerateObligationsSchema,
  MAX_SAFE_AMOUNT_PAISA,
  RecordPaymentRequestSchema
} from "../schemas/domain.js";

describe("money helpers (exact integer paisa)", () => {
  it("converts BDT strings and numbers to exact paisa with zero float drift", () => {
    expect(bdtToPaisa("12000")).toBe(1_200_000);
    expect(bdtToPaisa("12,500.50")).toBe(1_250_050);
    expect(bdtToPaisa("0.1")).toBe(10);
    expect(bdtToPaisa(19.99)).toBe(1_999);
    expect(bdtToPaisa("-500.25")).toBe(-50_025);
  });

  it("rejects >2 decimals or invalid amounts", () => {
    expect(() => bdtToPaisa("100.123")).toThrow(RangeError);
    expect(() => bdtToPaisa(100.123)).toThrow(RangeError);
    expect(() => bdtToPaisa(Number.NaN)).toThrow(RangeError);
    expect(() => bdtToPaisa("abc")).toThrow(RangeError);
  });

  it("adds, subtracts, formats, and derives obligation status deterministically", () => {
    const due = bdtToPaisa(12000);
    const partial = bdtToPaisa(7500);
    const remaining = subtractPaisa(due, partial);
    expect(remaining).toBe(450_000);
    expect(addPaisa(partial, remaining)).toBe(due);
    expect(paisaToBdtString(remaining)).toBe("4500.00");
    expect(formatBdt(1_200_000, "en")).toBe("৳12,000");
    expect(deriveObligationStatus(due, 0)).toBe("unpaid");
    expect(deriveObligationStatus(due, partial)).toBe("partial");
    expect(deriveObligationStatus(due, due)).toBe("paid");
    expect(deriveObligationStatus(due, addPaisa(due, 100))).toBe("overpaid");
  });
});

describe("BD phone & AppLink helpers", () => {
  it("normalizes local and international BD numbers", () => {
    expect(normalizeBdPhone("01959979376")).toBe("+8801959979376");
    expect(normalizeBdPhone("8801400112233")).toBe("+8801400112233");
    expect(normalizeBdPhone("+880 1711-000111")).toBe("+8801711000111");
    expect(toApplinkAddress("01959979376")).toBe("tel:+8801959979376");
  });

  it("detects Banglalink prefixes accurately", () => {
    expect(isBanglalinkPrefix("01959979376")).toBe(true);
    expect(isBanglalinkPrefix("+8801400112233")).toBe(true);
    expect(isBanglalinkPrefix("01711000111")).toBe(false);
  });

  it("rejects invalid phone numbers", () => {
    expect(() => normalizeBdPhone("01212345678")).toThrow(RangeError);
    expect(() => normalizeBdPhone("12345")).toThrow(RangeError);
  });
});

describe("AI Voice Action Contracts", () => {
  it("validates record_rent_payment and enforces confirmation", () => {
    const parsed = VoiceActionPayloadSchema.parse({
      intent: "record_rent_payment",
      amount_bdt: 8000,
      tenant_name_query: "Rahim",
      unit_code_query: "3B",
      payment_method: "bkash"
    });
    expect(parsed.intent).toBe("record_rent_payment");
    expect(requiresConfirmation(parsed.intent)).toBe(true);
  });

  it("rejects record_rent_payment missing both tenant and unit", () => {
    const result = VoiceActionPayloadSchema.safeParse({
      intent: "record_rent_payment",
      amount_bdt: 8000
    });
    expect(result.success).toBe(false);
  });

  it("marks read-only queries as not requiring confirmation", () => {
    expect(requiresConfirmation("get_outstanding_rent")).toBe(false);
    expect(requiresConfirmation("get_monthly_collection")).toBe(false);
    expect(requiresConfirmation("prepare_rent_reminder")).toBe(true);
  });
});

describe("Asia/Dhaka date helpers & strict domain schema bounds", () => {
  it("computes Asia/Dhaka date correctly across UTC midnight boundary", () => {
    // 2026-11-30T19:30:00Z is 2026-12-01T01:30:00+06:00 in Asia/Dhaka
    const utcLateEvening = new Date("2026-11-30T19:30:00Z");
    expect(getDhakaDateString(utcLateEvening)).toBe("2026-12-01");
    expect(getDhakaBillingMonthString(utcLateEvening)).toBe("2026-12-01");
  });

  it("rejects impossible calendar dates, excessive paisa values, and malformed billing months", () => {
    expect(isValidIsoCalendarDate("2026-02-28")).toBe(true);
    expect(isValidIsoCalendarDate("2026-02-30")).toBe(false);
    expect(isValidIsoCalendarDate("2026-13-01")).toBe(false);

    expect(
      CreateExpenseRequestSchema.safeParse({
        property_id: "11111111-1111-4111-8111-111111111111",
        category_name: "Repair",
        amount_paisa: 1000,
        incurred_on: "2026-02-31",
        description: "Test",
        idempotency_key: "exp-key-12345"
      }).success
    ).toBe(false);

    expect(
      RecordPaymentRequestSchema.safeParse({
        tenancy_id: "11111111-1111-4111-8111-111111111111",
        amount_paisa: MAX_SAFE_AMOUNT_PAISA + 1,
        payment_method: "bkash",
        idempotency_key: "pay-key-12345"
      }).success
    ).toBe(false);

    expect(GenerateObligationsSchema.safeParse({ billing_month: "2026-11" }).success).toBe(true);
    expect(GenerateObligationsSchema.safeParse({ billing_month: "invalid" }).success).toBe(false);
  });
});
