/**
 * Replaceable Bangla/Banglish Speech-to-Text (ASR) provider interface.
 * Implementation: Google Gemini Native Multimodal Audio Understanding (Free Tier via Google AI Studio).
 * Audio is processed in-memory and NEVER persisted to disk or database.
 * API key is sent strictly via the x-goog-api-key header (NEVER in URL query strings).
 */

import { DEFAULT_GEMINI_MODEL, PINNED_GEMINI_MODELS } from "./extractor.js";

const ASR_TIMEOUT_MS = 18_000;

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

const TRANSCRIPTION_PROMPT =
  "Transcribe this spoken Bangladeshi rental property command verbatim. " +
  "Preserve natural Bangla (বাংলা) and Banglish words (such as Flat, Unit, bKash, Nagad, taka, baki, rent, reminder). " +
  "Return ONLY the raw transcript text with no markdown, no labels, and no commentary.";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function normalizeAudioMimeType(raw: string): string {
  const base = (raw || "audio/webm").split(";")[0]?.trim().toLowerCase() ?? "audio/webm";
  if (["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/aac", "audio/flac"].includes(base)) {
    return base;
  }
  return "audio/webm";
}

export class GeminiAudioAsrProvider implements SpeechToTextProvider {
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly primaryModel: string = DEFAULT_GEMINI_MODEL,
    private readonly fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args)
  ) {
    this.name = `gemini_audio:${primaryModel}`;
  }

  async transcribe(input: SpeechToTextInput): Promise<SpeechToTextResult> {
    const base64Audio = arrayBufferToBase64(input.audio);
    const mimeType = normalizeAudioMimeType(input.mimeType);
    const models = [
      this.primaryModel,
      ...PINNED_GEMINI_MODELS.filter((m) => m !== this.primaryModel)
    ];

    const doFetch = this.fetchImpl;
    let lastError = "Audio transcription failed";

    for (const model of models) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ASR_TIMEOUT_MS);

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        const res = await doFetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: input.promptHint ?? TRANSCRIPTION_PROMPT },
                  { inlineData: { mimeType, data: base64Audio } }
                ]
              }
            ],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 300
            }
          }),
          signal: controller.signal
        });

        if (!res.ok) {
          lastError = `ASR provider error (HTTP ${res.status})`;
          if ([404, 429, 500, 502, 503, 504].includes(res.status)) {
            continue;
          }
          throw new Error(lastError);
        }

        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const transcript = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
        if (!transcript) {
          throw new Error("ASR returned an empty transcript");
        }

        return {
          transcript,
          provider: `gemini_audio:${model}`
        };
      } catch (err) {
        if (err instanceof Error && err.message === "ASR returned an empty transcript") {
          throw err;
        }
        lastError = err instanceof Error && err.name === "AbortError"
          ? "ASR provider timed out"
          : "Audio transcription service unavailable";
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error(lastError);
  }
}
