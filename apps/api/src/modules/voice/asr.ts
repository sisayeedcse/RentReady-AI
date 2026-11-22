/**
 * Replaceable Bangla/Banglish Speech-to-Text (ASR) provider interface.
 * Implementation: Google Gemini Native Multimodal Audio Understanding (Free Tier via Google AI Studio).
 * Audio is processed in-memory and NEVER persisted to disk or database.
 */

import { DEFAULT_GEMINI_MODEL, PINNED_GEMINI_MODELS } from "./extractor.js";

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
  if (["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/aac"].includes(base)) {
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
    let lastError = "Gemini audio transcription failed";

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
      const res = await doFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        })
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        lastError = `Gemini ${model} ASR failed (HTTP ${res.status}): ${errText.slice(0, 200)}`;
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
        throw new Error("Gemini ASR returned an empty transcript");
      }

      return {
        transcript,
        provider: `gemini_audio:${model}`
      };
    }

    throw new Error(lastError);
  }
}
