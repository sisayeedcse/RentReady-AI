import { formatBdt } from "@rentready/shared";
import { AlertTriangle, CheckCircle2, Mic, ShieldCheck, Sparkles, Square, X } from "lucide-react";
import { useRef, useState } from "react";
import { apiFetch, generateIdempotencyKey } from "../../lib/api";
import { type Locale, t } from "../../lib/i18n";

interface InterpretResponse {
  action_id?: string;
  status: "proposed" | "needs_clarification" | "answered" | "unknown";
  requires_confirmation?: boolean;
  intent: string;
  reason?: string;
  model?: string;
  data?: unknown;
  extracted_payload?: Record<string, unknown>;
  resolved_entities?: {
    tenancy?: {
      tenancy_id: string;
      tenant_name: string;
      unit_code: string;
      tenant_phone: string;
    };
    property?: { property_id: string; name: string };
    total_outstanding_paisa?: number;
    is_banglalink?: boolean;
    sms_preview?: string | null;
    resolution?: {
      status: string;
      candidates?: Array<{
        tenancy_id?: string;
        property_id?: string;
        tenant_name?: string;
        unit_code?: string;
        name?: string;
      }>;
    };
  };
}

const EXAMPLE_UTTERANCES = [
  "Flat 3B er Rahim bhai 8000 taka bKash korse",
  "এই মাসে কত ভাড়া বাকি আছে?",
  "পানির পাম্প মেরামতে ১৫০০ টাকা খরচ হয়েছে",
  "Flat 3B er Rahim bhai ke rent reminder pathao"
];

export function VoiceCopilotView({ accessToken, locale }: { accessToken: string; locale: Locale }) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<InterpretResponse | null>(null);
  const [selectedTenancyId, setSelectedTenancyId] = useState<string>("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [editedSms, setEditedSms] = useState<string>("");
  const [execBanner, setExecBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        await uploadAudioForTranscription(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Microphone error: ${err.message}. You can type directly below.`
          : "Microphone access denied. Use text fallback below."
      );
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function uploadAudioForTranscription(blob: Blob) {
    setTranscribing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("audio", blob, "command.webm");
      const res = await apiFetch<{ session_id: string; transcript: string; provider: string }>(
        "/api/voice/transcribe",
        accessToken,
        { method: "POST", body: form }
      );
      setSessionId(res.session_id);
      setTranscript(res.transcript);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!transcript.trim()) return;
    setAnalyzing(true);
    setError(null);
    setExecBanner(null);
    setResult(null);
    setSelectedTenancyId("");
    setSelectedPropertyId("");

    try {
      const res = await apiFetch<InterpretResponse>("/api/voice/interpret", accessToken, {
        method: "POST",
        body: JSON.stringify({ transcript: transcript.trim(), session_id: sessionId })
      });
      setResult(res);
      if (res.resolved_entities?.sms_preview) {
        setEditedSms(res.resolved_entities.sms_preview);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Intent extraction failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleConfirm() {
    if (!result?.action_id) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await apiFetch<{ status: string; provider?: { statusCode: string; requestId: string | null } }>(
        `/api/voice/actions/${result.action_id}/confirm`,
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            idempotency_key: generateIdempotencyKey("voice"),
            selected_tenancy_id: selectedTenancyId || undefined,
            selected_property_id: selectedPropertyId || undefined,
            edited_message: editedSms || undefined
          })
        }
      );
      const extra = res.provider
        ? ` (AppLink ${res.provider.statusCode}${res.provider.requestId ? ` • ${res.provider.requestId}` : ""})`
        : "";
      setExecBanner(`Action confirmed & executed safely${extra}.`);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setConfirming(false);
    }
  }

  async function handleReject() {
    if (result?.action_id) {
      await apiFetch(`/api/voice/actions/${result.action_id}/reject`, accessToken, {
        method: "POST"
      }).catch(() => {});
    }
    setResult(null);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              {t(locale, "voicePromptTitle")}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Google Gemini Native Bangla ASR → Editable Transcript → Gemini Structured JSON + Zod →
              Deterministic Confirmation Gate
            </p>
          </div>

          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xs transition ${
              recording
                ? "animate-pulse bg-rose-600 hover:bg-rose-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {transcribing
              ? "Transcribing Bangla..."
              : recording
                ? t(locale, "stopRecording")
                : t(locale, "startRecording")}
          </button>
        </div>

        <form onSubmit={handleAnalyze} className="mt-4 space-y-3">
          <textarea
            rows={3}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={
              locale === "bn"
                ? "যেমন: ফ্ল্যাট ৩বি এর রহিম ভাই ৮০০০ টাকা বিকাশ করেছে..."
                : "e.g. Flat 3B er Rahim bhai 8000 taka bKash korse..."
            }
            className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-emerald-500 focus:outline-none"
          />

          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_UTTERANCES.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setTranscript(sample)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
              >
                {sample}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={analyzing || !transcript.trim()}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {analyzing ? "Analyzing..." : t(locale, "analyzeCommand")}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}
        {execBanner && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {execBanner}
          </div>
        )}
      </section>

      {result && result.status === "answered" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            DB-Verified Answer • {result.intent}
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-emerald-300">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </section>
      )}

      {result && (result.status === "proposed" || result.status === "needs_clarification") && (
        <section className="rounded-2xl border-2 border-amber-400 bg-amber-50/60 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-700" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {t(locale, "confirmationRequired")}
                </h4>
                <p className="text-xs text-slate-600">
                  Intent: <span className="font-mono font-semibold">{result.intent}</span>
                </p>
              </div>
            </div>
            <button type="button" onClick={handleReject} className="text-slate-500 hover:text-slate-900">
              <X className="h-5 w-5" />
            </button>
          </div>

          {result.status === "needs_clarification" &&
            result.resolved_entities?.resolution?.candidates && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-white p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  {t(locale, "disambiguationTitle")}
                </p>
                <div className="mt-2 space-y-1.5">
                  {result.resolved_entities.resolution.candidates.map((cand) => {
                    const id = cand.tenancy_id ?? cand.property_id ?? "";
                    const isTenancy = Boolean(cand.tenancy_id);
                    return (
                      <label
                        key={id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-2 text-xs hover:bg-slate-50"
                      >
                        <input
                          type="radio"
                          name="clarify"
                          value={id}
                          onChange={() =>
                            isTenancy ? setSelectedTenancyId(id) : setSelectedPropertyId(id)
                          }
                        />
                        <span>
                          {isTenancy
                            ? `${cand.tenant_name} — Unit ${cand.unit_code}`
                            : cand.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

          {result.resolved_entities?.tenancy && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-1">
              <p>
                <span className="font-semibold">Tenant:</span>{" "}
                {result.resolved_entities.tenancy.tenant_name} (Unit{" "}
                {result.resolved_entities.tenancy.unit_code})
              </p>
              {typeof result.extracted_payload?.amount_bdt === "number" && (
                <p className="text-sm font-bold text-emerald-700">
                  Amount: {formatBdt(Math.round(result.extracted_payload.amount_bdt * 100), locale)}{" "}
                  ({String(result.extracted_payload.payment_method ?? "cash")})
                </p>
              )}
              {typeof result.resolved_entities.total_outstanding_paisa === "number" && (
                <p className="text-slate-600">
                  Current DB Outstanding:{" "}
                  {formatBdt(result.resolved_entities.total_outstanding_paisa, locale)}
                </p>
              )}
            </div>
          )}

          {result.intent === "prepare_rent_reminder" && (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                AppLink SMS Preview (Editable)
              </label>
              <textarea
                rows={3}
                value={editedSms}
                onChange={(e) => setEditedSms(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs"
              />
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleReject}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            >
              {t(locale, "cancel")}
            </button>
            <button
              type="button"
              disabled={
                confirming ||
                (result.status === "needs_clarification" &&
                  !selectedTenancyId &&
                  !selectedPropertyId)
              }
              onClick={handleConfirm}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {confirming ? "Executing..." : t(locale, "confirmAction")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
