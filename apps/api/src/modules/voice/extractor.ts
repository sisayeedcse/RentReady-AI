import { VoiceActionPayloadSchema, type VoiceActionPayload } from "@rentready/shared";

export const DEFAULT_INTENT_MODEL = "google/gemma-4-26b-a4b-it:free";

export const PINNED_OPENROUTER_FALLBACK_MODELS = [
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3.5-lightning:free",
  "google/gemma-4-31b-it:free",
  "recursive/flint-v1.0:free",
  "particle-ai/particle-1:free"
] as const;

export const GROQ_FALLBACK_LLM_MODEL = "llama-3.3-70b-versatile";

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

async function callChatCompletion(params: {
  url: string;
  apiKey: string;
  model: string;
  transcript: string;
  extraHeaders?: Record<string, string>;
  fetchImpl: typeof fetch;
}): Promise<{ ok: true; content: string } | { ok: false; status: number; error: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await params.fetchImpl(params.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
        ...params.extraHeaders
      },
      body: JSON.stringify({
        model: params.model,
        temperature: 0,
        max_tokens: 400,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: params.transcript }
        ]
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: errText.slice(0, 200) };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, status: 502, error: "Empty completion content" };
    }
    return { ok: true, content };
  } catch (err) {
    return {
      ok: false,
      status: 503,
      error: err instanceof Error ? err.message : "Network/timeout error"
    };
  } finally {
    clearTimeout(timeout);
  }
}

export class IntentProviderRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntentProviderRateLimitError";
  }
}

export async function extractVoiceIntent(params: {
  transcript: string;
  apiKey?: string;
  groqApiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ payload: VoiceActionPayload; modelUsed: string }> {
  const {
    transcript,
    apiKey,
    groqApiKey,
    model = DEFAULT_INTENT_MODEL,
    fetchImpl = fetch
  } = params;

  const openRouterModels = [
    model,
    ...PINNED_OPENROUTER_FALLBACK_MODELS.filter((m) => m !== model)
  ];

  let lastStatus = 503;
  let lastError = "No AI provider configured";

  // 1. Try pinned OpenRouter :free model chain (automatically fails over on 429/5xx)
  if (apiKey) {
    for (const candidateModel of openRouterModels) {
      const attempt = await callChatCompletion({
        url: "https://openrouter.ai/api/v1/chat/completions",
        apiKey,
        model: candidateModel,
        transcript,
        extraHeaders: {
          "HTTP-Referer": "https://rentready.app",
          "X-Title": "RentReady AI"
        },
        fetchImpl
      });

      if (attempt.ok) {
        return parseAndValidateContent(attempt.content, `openrouter:${candidateModel}`);
      }

      lastStatus = attempt.status;
      lastError = `${candidateModel} (HTTP ${attempt.status}): ${attempt.error}`;

      // Only fail over on rate-limit, unavailable, or upstream server errors
      if (![429, 500, 502, 503, 504, 404].includes(attempt.status)) {
        break;
      }
    }
  }

  // 2. Free high-availability fallback: Groq Llama 3.3 70B Versatile (reuses GROQ_API_KEY)
  if (groqApiKey) {
    const groqAttempt = await callChatCompletion({
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: groqApiKey,
      model: GROQ_FALLBACK_LLM_MODEL,
      transcript,
      fetchImpl
    });

    if (groqAttempt.ok) {
      return parseAndValidateContent(groqAttempt.content, `groq:${GROQ_FALLBACK_LLM_MODEL}`);
    }

    lastStatus = groqAttempt.status;
    lastError = `groq:${GROQ_FALLBACK_LLM_MODEL} (HTTP ${groqAttempt.status}): ${groqAttempt.error}`;
  }

  if (lastStatus === 429) {
    throw new IntentProviderRateLimitError(
      `All free AI models are temporarily rate-limited upstream. Please retry in a few seconds. (${lastError})`
    );
  }
  throw new Error(`AI intent extraction failed: ${lastError}`);
}

function parseAndValidateContent(
  content: string,
  modelUsed: string
): { payload: VoiceActionPayload; modelUsed: string } {
  const parsedJson = extractJsonObject(content);
  const validated = VoiceActionPayloadSchema.safeParse(parsedJson);
  if (!validated.success) {
    return {
      payload: {
        intent: "unknown",
        reason: `Validation failed: ${validated.error.issues[0]?.message ?? "invalid structure"}`
      },
      modelUsed
    };
  }
  return { payload: validated.data, modelUsed };
}
