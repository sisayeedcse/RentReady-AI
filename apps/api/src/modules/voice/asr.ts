/**
 * Replaceable Bangla/Banglish Speech-to-Text (ASR) provider interface.
 * Primary MVP implementation: Groq Whisper Large V3 Turbo (Free tier: 8 audio hrs/day).
 * Audio is processed in-memory and NEVER persisted to disk or database.
 */

export interface SpeechToTextInput {
  audio: ArrayBuffer;
  filename: string;
  mimeType: string;
  languageHint?: "bn" | "en";
  promptHint?: string;
}

export interface SpeechToTextResult {
  transcript: string;
  provider: string;
  durationMs?: number;
}

export interface SpeechToTextProvider {
  readonly name: string;
  transcribe(input: SpeechToTextInput): Promise<SpeechToTextResult>;
}

const DEFAULT_BANGLA_RENTAL_PROMPT =
  "ভাড়া, ফ্ল্যাট, ইউনিট, বিকাশ, নগদ, বাকি, টাকা, গ্যাস, পানি, বিদ্যুৎ, মেরামত, রসিদ, রিমাইন্ডার, Flat, bKash, Nagad, taka, baki";

export class GroqWhisperProvider implements SpeechToTextProvider {
  readonly name = "groq_whisper_large_v3_turbo";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async transcribe(input: SpeechToTextInput): Promise<SpeechToTextResult> {
    const form = new FormData();
    const blob = new Blob([input.audio], { type: input.mimeType || "audio/webm" });
    form.append("file", blob, input.filename || "voice.webm");
    form.append("model", "whisper-large-v3-turbo");
    form.append("language", input.languageHint ?? "bn");
    form.append("response_format", "verbose_json");
    form.append("prompt", input.promptHint ?? DEFAULT_BANGLA_RENTAL_PROMPT);

    const res = await this.fetchImpl("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`
      },
      body: form
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Groq ASR failed (HTTP ${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as { text?: string; duration?: number };
    const transcript = (data.text ?? "").trim();
    if (!transcript) {
      throw new Error("ASR returned an empty transcript");
    }

    return {
      transcript,
      provider: this.name,
      durationMs: typeof data.duration === "number" ? Math.round(data.duration * 1000) : undefined
    };
  }
}
