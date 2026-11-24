import type { Locale } from "./i18n";

const DHAKA_TZ = "Asia/Dhaka";

/**
 * Formats an ISO timestamp in Asia/Dhaka timezone (UTC+06:00) per ledger invariants.
 */
export function formatDhakaDate(iso: string, locale: Locale): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: DHAKA_TZ
  }).format(dt);
}

/**
 * Formats an ISO timestamp with date & time in Asia/Dhaka timezone.
 */
export function formatDhakaDateTime(iso: string, locale: Locale): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: DHAKA_TZ
  }).format(dt);
}

/**
 * Formats a billing month ("YYYY-MM-01" or "YYYY-MM") into a localized month-year label.
 */
export function formatBillingMonth(billingMonth: string, locale: Locale): string {
  const match = /^(\d{4})-(\d{2})/.exec(billingMonth);
  if (!match) return billingMonth;
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const utcDate = new Date(Date.UTC(year, monthIdx, 15));
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(utcDate);
}

/**
 * Formats a localized payment method label cleanly.
 */
export function formatPaymentMethodLabel(method: string, locale: Locale): string {
  const m = method.toLowerCase();
  if (locale === "bn") {
    if (m === "bkash") return "বিকাশ";
    if (m === "nagad") return "নগদ";
    if (m === "cash") return "নগদ টাকা";
    if (m === "bank") return "ব্যাংক";
    return "অন্যান্য";
  }
  if (m === "bkash") return "bKash";
  if (m === "nagad") return "Nagad";
  if (m === "cash") return "Cash";
  if (m === "bank") return "Bank";
  return "Other";
}
