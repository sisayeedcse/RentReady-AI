import { VoiceActionPayloadSchema, type VoiceActionPayload } from "@rentready/shared";

export const DEFAULT_INTENT_MODEL = "google/gemma-4-26b-a4b-it:free";

const SYSTEM_PROMPT = `You are the structured intent extractor for RentReady AI, a Bangladeshi residential rental management SaaS.
You receive a Bangla, English, or mixed Banglish landlord utterance.
Return ONLY a single raw JSON object (no markdown, no explanation) matching one of these intents:

1. record_rent_payment:
   { "intent": "record_rent_payment", "amount_bdt": number (>0), "tenant_name_query"?: string, "unit_code_query"?: string, "billing_month"?: "YYYY-MM", "payment_method": "cash"|"bkash"|"nagad"|"bank"|"other", "reference_no"?: string, "notes"?: string }
2. record_expense:
   { "intent": "record_expense", "amount_bdt": number (>0), "category_query": string, "description": string, "property_name_query"?: string, "unit_code_query"?: string, "incurred_on"?: "YYYY-MM-DD" }
3. get_outstanding_rent:
   { "intent": "get_outstanding_rent", "tenant_name_query"?: string, "unit_code_query"?: string, "property_name_query"?: string, "billing_month"?: "YYYY-MM" }
4. get_monthly_collection:
   { "intent": "get_monthly_collection", "billing_month"?: "YYYY-MM", "property_name_query"?: string }
5. get_payment_history:
   { "intent": "get_payment_history", "tenant_name_query"?: string, "unit_code_query"?: string, "limit"?: number }
6. create_maintenance_request:
   { "intent": "create_maintenance_request", "title": string, "description": string, "unit_code_query"?: string, "property_name_query"?: string, "priority": "low"|"medium"|"high"|"urgent" }
7. prepare_rent_reminder:
   { "intent": "prepare_rent_reminder", "tenant_name_query"?: string, "unit_code_query"?: string, "billing_month"?: "YYYY-MM", "language": "bn"|"en" }
8. get_property_summary:
   { "intent": "get_property_summary", "property_name_query"?: string }
9. unknown:
   { "intent": "unknown", "reason": string }

STRICT RULES:
- NEVER invent amounts, dates, or tenant names that are not in the utterance.
- Convert Bangla digits (০১২৩৪৫৬৭৮৯) and spoken numbers ("আট হাজার" -> 8000, "সাড়ে বারো হাজার" -> 12500) to standard JSON numbers.
- If the utterance is ambiguous or lacks required fields (e.g. missing payment amount), return { "intent": "unknown", "reason": "..." }.
- Output ONLY valid JSON.`;

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model output did not contain a JSON object");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function extractVoiceIntent(params: {
  transcript: string;
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ payload: VoiceActionPayload; modelUsed: string }> {
  const { transcript, apiKey, model = DEFAULT_INTENT_MODEL, fetchImpl = fetch } = params;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://rentready.app",
        "X-Title": "RentReady AI"
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 400,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: transcript }
        ]
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenRouter error (HTTP ${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter returned empty completion");
    }

    const parsedJson = extractJsonObject(content);
    const validated = VoiceActionPayloadSchema.safeParse(parsedJson);
    if (!validated.success) {
      return {
        payload: {
          intent: "unknown",
          reason: `Validation failed: ${validated.error.issues[0]?.message ?? "invalid structure"}`
        },
        modelUsed: model
      };
    }

    return { payload: validated.data, modelUsed: model };
  } finally {
    clearTimeout(timeout);
  }
}
