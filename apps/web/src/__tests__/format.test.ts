import { describe, expect, it } from "vitest";
import {
  formatBillingMonth,
  formatDhakaDate,
  formatPaymentMethodLabel
} from "../lib/format";

describe("Asia/Dhaka display formatters", () => {
  it("formats UTC ISO timestamps in Asia/Dhaka (+06:00) calendar day", () => {
    // 2026-11-24T20:00:00Z is 2026-11-25 02:00 AM in Asia/Dhaka (UTC+06:00)
    const formatted = formatDhakaDate("2026-11-24T20:00:00.000Z", "en");
    expect(formatted).toContain("25");
    expect(formatted).toContain("2026");
  });

  it("formats billing month strings cleanly for en and bn locales", () => {
    expect(formatBillingMonth("2026-11-01", "en")).toContain("Nov");
    expect(formatBillingMonth("2026-11-01", "en")).toContain("2026");
    expect(formatBillingMonth("2026-11-01", "bn").length).toBeGreaterThan(3);
  });

  it("returns localized payment method labels", () => {
    expect(formatPaymentMethodLabel("bkash", "bn")).toBe("বিকাশ");
    expect(formatPaymentMethodLabel("bkash", "en")).toBe("bKash");
    expect(formatPaymentMethodLabel("cash", "en")).toBe("Cash");
    expect(formatPaymentMethodLabel("bank", "bn")).toBe("ব্যাংক");
  });
});
