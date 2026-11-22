/**
 * Deterministic DB Entity Resolution for RentReady AI Voice Copilot.
 * NEVER guesses when multiple tenants or units match — returns status: "ambiguous".
 */

export interface TenancyCandidate {
  tenancy_id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_phone: string;
  unit_id: string;
  unit_code: string;
  property_id: string;
  property_name: string;
  monthly_rent_paisa: number;
}

export interface PropertyCandidate {
  property_id: string;
  name: string;
}

export type ResolutionResult<T> =
  | { status: "resolved"; match: T }
  | { status: "ambiguous"; candidates: T[] }
  | { status: "not_found"; candidates: [] };

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^(flat|unit|ফ্ল্যাট|ইউনিট)\s*/i, "")
    .replace(/[\s\-_]+/g, "");
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b(bhai|vai|saheb|shaheb|uncle|aunty|ভাই|সাহেব|আঙ্কেল)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveTenancyEntity(
  candidates: TenancyCandidate[],
  query: { tenant_name_query?: string; unit_code_query?: string }
): ResolutionResult<TenancyCandidate> {
  const unitQ = query.unit_code_query ? normalizeToken(query.unit_code_query) : "";
  const nameQ = query.tenant_name_query ? normalizeName(query.tenant_name_query) : "";

  let filtered = candidates;

  if (unitQ) {
    const unitMatches = filtered.filter((c) => normalizeToken(c.unit_code) === unitQ);
    if (unitMatches.length === 1 && !nameQ) {
      return { status: "resolved", match: unitMatches[0]! };
    }
    if (unitMatches.length > 0) {
      filtered = unitMatches;
    } else if (!nameQ) {
      return { status: "not_found", candidates: [] };
    }
  }

  if (nameQ) {
    const exactName = filtered.filter((c) => normalizeName(c.tenant_name) === nameQ);
    if (exactName.length === 1) {
      return { status: "resolved", match: exactName[0]! };
    }
    const partialName = filtered.filter((c) => normalizeName(c.tenant_name).includes(nameQ));
    if (partialName.length === 1) {
      return { status: "resolved", match: partialName[0]! };
    }
    if (partialName.length > 1) {
      return { status: "ambiguous", candidates: partialName };
    }
    return { status: "not_found", candidates: [] };
  }

  if (filtered.length === 1) {
    return { status: "resolved", match: filtered[0]! };
  }
  if (filtered.length > 1) {
    return { status: "ambiguous", candidates: filtered };
  }
  return { status: "not_found", candidates: [] };
}

export function resolvePropertyEntity(
  properties: PropertyCandidate[],
  propertyNameQuery?: string
): ResolutionResult<PropertyCandidate> {
  if (properties.length === 0) {
    return { status: "not_found", candidates: [] };
  }
  if (!propertyNameQuery) {
    if (properties.length === 1) {
      return { status: "resolved", match: properties[0]! };
    }
    return { status: "ambiguous", candidates: properties };
  }

  const q = propertyNameQuery.trim().toLowerCase();
  const exact = properties.filter((p) => p.name.trim().toLowerCase() === q);
  if (exact.length === 1) return { status: "resolved", match: exact[0]! };

  const partial = properties.filter((p) => p.name.trim().toLowerCase().includes(q));
  if (partial.length === 1) return { status: "resolved", match: partial[0]! };
  if (partial.length > 1) return { status: "ambiguous", candidates: partial };

  return { status: "not_found", candidates: [] };
}
