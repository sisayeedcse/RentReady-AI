/**
 * Exact integer minor-unit money helpers for RentReady AI.
 * 1 BDT = 100 paisa.
 * NEVER uses floating-point arithmetic for monetary conversion or math.
 */

const BDT_PATTERN = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Convert a BDT string or safe number (up to 2 decimal places) to integer paisa.
 * Rejects NaN, Infinity, or >2 decimal places to guarantee zero float drift.
 */
export function bdtToPaisa(input: string | number): number {
  const raw = typeof input === "number" ? formatSafeNumberToDecimal(input) : input.trim().replace(/,/g, "");
  const match = BDT_PATTERN.exec(raw);
  if (!match) {
    throw new RangeError(`Invalid BDT amount: "${String(input)}"`);
  }

  const sign = match[1] === "-" ? -1 : 1;
  const wholePart = BigInt(match[2] ?? "0");
  const fracPartRaw = match[3] ?? "";
  const fracPart = BigInt(fracPartRaw.padEnd(2, "0"));

  const paisaBig = BigInt(sign) * (wholePart * 100n + fracPart);
  if (paisaBig > BigInt(Number.MAX_SAFE_INTEGER) || paisaBig < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`BDT amount out of safe integer range: "${String(input)}"`);
  }

  const result = Number(paisaBig);
  return Object.is(result, -0) ? 0 : result;
}

function formatSafeNumberToDecimal(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Non-finite BDT amount: ${value}`);
  }
  // Using toFixed(2) only after verifying decimal precision <= 2 via string inspection
  const asString = String(value);
  if (asString.includes("e") || asString.includes("E")) {
    throw new RangeError(`Scientific notation not supported for BDT amounts: ${value}`);
  }
  const dotIdx = asString.indexOf(".");
  if (dotIdx !== -1 && asString.length - dotIdx - 1 > 2) {
    throw new RangeError(`BDT amount has more than 2 decimal places: ${value}`);
  }
  return asString;
}

export function assertIntegerPaisa(value: number, label = "amount_paisa"): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer (paisa), received: ${value}`);
  }
}

export function addPaisa(a: number, b: number): number {
  assertIntegerPaisa(a, "a");
  assertIntegerPaisa(b, "b");
  const sum = BigInt(a) + BigInt(b);
  if (sum > BigInt(Number.MAX_SAFE_INTEGER) || sum < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError("Paisa addition overflow");
  }
  return Number(sum);
}

export function subtractPaisa(a: number, b: number): number {
  assertIntegerPaisa(a, "a");
  assertIntegerPaisa(b, "b");
  const diff = BigInt(a) - BigInt(b);
  if (diff > BigInt(Number.MAX_SAFE_INTEGER) || diff < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError("Paisa subtraction overflow");
  }
  return Number(diff);
}

/**
 * Convert integer paisa to an exact decimal BDT string (e.g. 1250050 -> "12500.50").
 */
export function paisaToBdtString(paisa: number): string {
  assertIntegerPaisa(paisa);
  const negative = paisa < 0;
  const abs = Math.abs(paisa);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${negative ? "-" : ""}${whole}.${String(frac).padStart(2, "0")}`;
}

/**
 * Format integer paisa for display in Bangla or English with BDT symbol (৳).
 */
export function formatBdt(paisa: number, locale: "en" | "bn" = "en"): string {
  assertIntegerPaisa(paisa);
  const negative = paisa < 0;
  const abs = Math.abs(paisa);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;

  const formattedWhole = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD").format(whole);
  const formattedFrac =
    frac === 0
      ? ""
      : locale === "bn"
        ? `.${String(frac)
            .padStart(2, "0")
            .replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)] ?? d)}`
        : `.${String(frac).padStart(2, "0")}`;

  return `${negative ? "-" : ""}৳${formattedWhole}${formattedFrac}`;
}

export type ObligationStatus = "unpaid" | "partial" | "paid" | "overpaid";

export function deriveObligationStatus(amountDuePaisa: number, allocatedPaisa: number): ObligationStatus {
  assertIntegerPaisa(amountDuePaisa, "amountDuePaisa");
  assertIntegerPaisa(allocatedPaisa, "allocatedPaisa");
  if (allocatedPaisa <= 0) return "unpaid";
  if (allocatedPaisa < amountDuePaisa) return "partial";
  if (allocatedPaisa === amountDuePaisa) return "paid";
  return "overpaid";
}
