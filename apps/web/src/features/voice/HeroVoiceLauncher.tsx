import { formatBdt } from "@rentready/shared";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mic,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch, generateIdempotencyKey } from "../../lib/api";
import { type Locale, t } from "../../lib/i18n";

interface InterpretResponse {
  action_id?: string;
  status: "proposed" | "needs_clarification" | "answered" | "unknown";
  intent: string;
  reason?: string;
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

const QUICK_CHIPS = {
  bn: [
    "ফ্ল্যাট 3B এর রহিম ভাই ৮০০০ টাকা বিকাশ করেছে",
    "এই মাসে কত ভাড়া বাকি আছে?",
    "পানির পাম্প মেরামতে ১৫০০ টাকা খরচ হয়েছে"
  ],
  en: [
    "Flat 3B er Rahim bhai 8000 taka bKash korse",
    "How much rent is outstanding this month?",
    "Spent 1500 taka on water pump repair"
  ]
} as const;

export function HeroVoiceLauncher({
  accessToken,
  locale,
  onActionExecuted
}: {
  accessToken: string;
  locale: Locale;
  onActionExecuted?: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [transcript, setTranscript] = useState("");
  const [showTextBox, setShowTextBox] = useState(false);
  const [result, setResult] = useState<InterpretResponse | null>(null);
  const [selectedTenancyId, setSelectedTenancyId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [editedSms, setEditedSms] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!recording) {
      setSeconds(0);
      return;
    }
    const id = window.setInterval(() => {
      setSeconds((s) => {
        if (s >= 29) {
          recorderRef.current?.stop();
          setRecording(false);
          return 30;
        }
        return s + 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  async function toggleMic() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    setError(null);
    setBanner(null);
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
        await transcribeAndShow(blob);
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      setShowTextBox(true);
      setError(
        err instanceof Error
          ? `${err.message} — ${locale === "bn" ? "নিচে লিখে আপডেট দিন।" : "Type your update below."}`
          : "Microphone unavailable. Type below."
      );
    }
  }

  async function transcribeAndShow(blob: Blob) {
    setTranscribing(true);
    setShowTextBox(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("audio", blob, "voice.webm");
      const res = await apiFetch<{ session_id: string; transcript: string }>(
        "/api/voice/transcribe",
        accessToken,
        { method: "POST", body: form }
      );
      setSessionId(res.session_id);
      setTranscript(res.transcript);
      // Automatically run safe interpretation (NEVER writes without confirmation!)
      await runInterpret(res.transcript, res.session_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }

  async function runInterpret(textToAnalyze: string, sid?: string) {
    if (!textToAnalyze.trim()) return;
    setAnalyzing(true);
    setError(null);
    setBanner(null);
    setResult(null);
    setSelectedTenancyId("");
    setSelectedPropertyId("");

    try {
      const res = await apiFetch<InterpretResponse>("/api/voice/interpret", accessToken, {
        method: "POST",
        body: JSON.stringify({ transcript: textToAnalyze.trim(), session_id: sid ?? sessionId })
      });
      setResult(res);
      if (res.resolved_entities?.sms_preview) {
        setEditedSms(res.resolved_entities.sms_preview);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze command");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleConfirm() {
    if (!result?.action_id) return;
    setConfirming(true);
    setError(null);
    try {
      await apiFetch(`/api/voice/actions/${result.action_id}/confirm`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: generateIdempotencyKey("hero-voice"),
          selected_tenancy_id: selectedTenancyId || undefined,
          selected_property_id: selectedPropertyId || undefined,
          edited_message: editedSms || undefined
        })
      });
      setBanner(
        locale === "bn"
          ? "আপডেট সফলভাবে লেজারে যুক্ত হয়েছে!"
          : "Update confirmed and saved to ledger!"
      );
      setResult(null);
      setTranscript("");
      onActionExecuted?.();
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
    <section className="animate-fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-5 text-white shadow-lg shadow-emerald-900/15 sm:p-7">
      {/* Decorative soft glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-52 w-52 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-teal-300/15 blur-3xl" />

      <div className="relative flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-50 backdrop-blur-xs">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          {locale === "bn" ? "বাংলা ভয়েস অ্যাসিস্ট্যান্ট" : "Bangla Voice Assistant"}
        </span>

        <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">
          {recording
            ? locale === "bn"
              ? `শুনছি... (${seconds} সেকেন্ড)`
              : `Listening... (${seconds}s)`
            : transcribing
              ? locale === "bn"
                ? "বাংলা কথা লেখা হচ্ছে..."
                : "Transcribing Bangla..."
              : locale === "bn"
                ? "ট্যাপ করুন এবং ভাড়ার আপডেট বলুন"
                : "Tap & Say Your Rent Update"}
        </h2>
        <p className="mt-1 max-w-md text-xs text-emerald-100/90 sm:text-sm">
          {locale === "bn"
            ? "যেমন: “ফ্ল্যাট ৩বি এর রহিম ভাই ৮০০০ টাকা বিকাশ করেছে” — নিশ্চিত করার আগে কিছু সেভ হবে না।"
            : "e.g. “Flat 3B er Rahim bhai 8000 taka bKash korse” — nothing saves until you confirm."}
        </p>

        {/* BIG INTERACTIVE VOICE MIC BUTTON */}
        <div className="relative my-6 flex items-center justify-center">
          {(recording || !transcribing) && (
            <>
              <span
                className={`pointer-events-none absolute h-24 w-24 rounded-full ${
                  recording ? "bg-rose-400/45 animate-mic-ripple" : "bg-white/25 animate-mic-ripple"
                }`}
              />
              <span
                className={`pointer-events-none absolute h-24 w-24 rounded-full ${
                  recording
                    ? "bg-rose-400/35 animate-mic-ripple-delayed"
                    : "bg-white/15 animate-mic-ripple-delayed"
                }`}
              />
            </>
          )}

          <button
            type="button"
            disabled={transcribing || analyzing}
            onClick={() => void toggleMic()}
            aria-label={recording ? t(locale, "stopRecording") : t(locale, "startRecording")}
            className={`relative z-10 flex h-24 w-24 cursor-pointer items-center justify-center rounded-full shadow-2xl ring-4 transition-all duration-200 active:scale-90 disabled:opacity-70 ${
              recording
                ? "bg-gradient-to-br from-rose-500 to-red-600 ring-rose-300/60"
                : "bg-white text-emerald-700 ring-white/30 hover:scale-105 hover:shadow-emerald-950/30"
            }`}
          >
            {transcribing || analyzing ? (
              <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
            ) : recording ? (
              <Square className="h-9 w-9 fill-white text-white" />
            ) : (
              <Mic className="h-11 w-11 text-emerald-600" />
            )}
          </button>
        </div>

        {/* Live waveform bars when recording */}
        {recording && (
          <div className="mb-3 flex h-6 items-center gap-1.5">
            <span className="h-full w-1 rounded-full bg-white animate-wave-1" />
            <span className="h-full w-1 rounded-full bg-emerald-200 animate-wave-2" />
            <span className="h-full w-1 rounded-full bg-white animate-wave-3" />
            <span className="h-full w-1 rounded-full bg-emerald-200 animate-wave-4" />
            <span className="h-full w-1 rounded-full bg-white animate-wave-2" />
          </div>
        )}

        {/* Quick example chips + Type fallback toggle */}
        <div className="flex flex-wrap justify-center gap-1.5">
          {QUICK_CHIPS[locale].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                setTranscript(chip);
                setShowTextBox(true);
                void runInterpret(chip);
              }}
              className="rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-xs transition hover:bg-white/22 active:scale-95"
            >
              “{chip}”
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowTextBox((v) => !v)}
            className="rounded-full border border-white/30 px-3 py-1.5 text-[11px] font-semibold text-emerald-50 transition hover:bg-white/15"
          >
            {locale === "bn" ? "অথবা লিখে বলুন" : "Or type instead"}
          </button>
        </div>
      </div>

      {/* Editable Transcript Bar */}
      {showTextBox && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runInterpret(transcript);
          }}
          className="animate-scale-in relative mt-5 flex gap-2 rounded-2xl bg-white/95 p-2 text-slate-900 shadow-md"
        >
          <input
            type="text"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={
              locale === "bn"
                ? "বাংলা বা বাংলিশে লিখুন (যেমন: 3B Rahim 8000 taka bkash)"
                : "Edit transcript or type command..."
            }
            className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={analyzing || !transcript.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {locale === "bn" ? "যাচাই" : "Go"}
          </button>
        </form>
      )}

      {/* Feedback banners */}
      {error && (
        <div className="animate-scale-in mt-4 rounded-2xl bg-rose-950/60 px-4 py-2.5 text-xs text-rose-100 ring-1 ring-rose-400/40">
          {error}
        </div>
      )}
      {banner && (
        <div className="animate-scale-in mt-4 flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-3 text-xs font-bold text-emerald-800 shadow-md">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {banner}
        </div>
      )}

      {/* Read-only DB Answer */}
      {result && result.status === "answered" && (
        <div className="animate-scale-in mt-4 rounded-2xl bg-white p-4 text-left text-slate-900 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              {result.intent}
            </span>
            <button type="button" onClick={() => setResult(null)} className="text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
          <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] text-emerald-300">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}

      {/* Explicit Confirmation / Disambiguation Card */}
      {result && (result.status === "proposed" || result.status === "needs_clarification") && (
        <div className="animate-scale-in mt-4 rounded-2xl border-2 border-amber-300 bg-white p-4 text-left text-slate-900 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">{t(locale, "confirmationRequired")}</p>
                <p className="font-mono text-[11px] text-slate-500">{result.intent}</p>
              </div>
            </div>
            <button type="button" onClick={() => void handleReject()} className="text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>

          {result.status === "needs_clarification" &&
            result.resolved_entities?.resolution?.candidates && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
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
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200 bg-white p-2 text-xs font-medium"
                      >
                        <input
                          type="radio"
                          name="hero-clarify"
                          value={id}
                          onChange={() =>
                            isTenancy ? setSelectedTenancyId(id) : setSelectedPropertyId(id)
                          }
                        />
                        <span>
                          {isTenancy ? `${cand.tenant_name} — Unit ${cand.unit_code}` : cand.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

          {result.resolved_entities?.tenancy && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs space-y-1">
              <p className="font-semibold text-slate-900">
                {result.resolved_entities.tenancy.tenant_name} • Unit{" "}
                {result.resolved_entities.tenancy.unit_code}
              </p>
              {typeof result.extracted_payload?.amount_bdt === "number" && (
                <p className="text-base font-extrabold text-emerald-700">
                  {formatBdt(Math.round(result.extracted_payload.amount_bdt * 100), locale)}{" "}
                  <span className="text-xs font-semibold uppercase text-slate-500">
                    ({String(result.extracted_payload.payment_method ?? "cash")})
                  </span>
                </p>
              )}
            </div>
          )}

          {result.intent === "prepare_rent_reminder" && (
            <textarea
              rows={2}
              value={editedSms}
              onChange={(e) => setEditedSms(e.target.value)}
              className="mt-3 w-full rounded-xl border border-slate-300 p-2.5 text-xs"
            />
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => void handleReject()}
              className="rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 active:scale-95"
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
              onClick={() => void handleConfirm()}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
            >
              {confirming ? "..." : t(locale, "confirmAction")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
