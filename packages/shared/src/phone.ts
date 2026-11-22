/**
 * Bangladesh MSISDN normalization & Banglalink AppLink address helpers.
 */

const BD_LOCAL_PATTERN = /^0(1[3-9]\d{8})$/;
const BD_INTL_PATTERN = /^\+?880(1[3-9]\d{8})$/;

/**
 * Normalize a Bangladeshi mobile number to E.164 format (+8801XXXXXXXXX).
 * Accepts "01912345678", "+8801912345678", "8801912345678", with optional spaces/dashes.
 */
export function normalizeBdPhone(raw: string): string {
  const cleaned = raw.trim().replace(/[\s\-()]/g, "");
  const localMatch = BD_LOCAL_PATTERN.exec(cleaned);
  if (localMatch?.[1]) {
    return `+880${localMatch[1]}`;
  }
  const intlMatch = BD_INTL_PATTERN.exec(cleaned);
  if (intlMatch?.[1]) {
    return `+880${intlMatch[1]}`;
  }
  throw new RangeError(`Invalid Bangladesh mobile number: "${raw}"`);
}

/**
 * Returns true if the normalized number uses a Banglalink prefix (+88019 or +88014).
 * Note: Mobile Number Portability (MNP) can move numbers between operators, so this is
 * an advisory check — authoritative delivery status comes from AppLink statusCode.
 */
export function isBanglalinkPrefix(phoneE164: string): boolean {
  const normalized = normalizeBdPhone(phoneE164);
  return normalized.startsWith("+88019") || normalized.startsWith("+88014");
}

/**
 * Format an E.164 Bangladesh number for AppLink destinationAddresses ("tel:+88019XXXXXXXX").
 */
export function toApplinkAddress(phone: string): string {
  return `tel:${normalizeBdPhone(phone)}`;
}
