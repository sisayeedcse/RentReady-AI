/**
 * Asia/Dhaka (UTC+06:00, no DST) deterministic date & billing month helpers.
 * Used across both frontend and API so financial dates never drift around midnight BST.
 */

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

export function getDhakaDateString(now: Date = new Date()): string {
  const d = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDhakaBillingMonthString(now: Date = new Date()): string {
  const d = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

/**
 * Validates that a YYYY-MM-DD string represents an actual calendar date (e.g. rejects 2026-02-31).
 */
export function isValidIsoCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}
