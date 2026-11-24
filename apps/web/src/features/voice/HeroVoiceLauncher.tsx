import { CheckCircle2, Loader2, Mic, Send, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch, generateIdempotencyKey } from "../../lib/api";
import { toFriendlyError } from "../../lib/friendlyError";
import { type Locale, t } from "../../lib/i18n";
import { VoiceAnswerCard } from "./VoiceAnswerCard";
import { type VoiceActionResult, VoiceConfirmationCard } from "./VoiceConfirmationCard";

const QUICK_CHIPS = {
  bn: [
    "ফ্ল্যাট 3B এর রহিম ভাই ৮০০০ টাকা বিকাশ করেছে",
    "এই মাসে কত ভাড়া বাকি আছে?",
    "পানির পাম্প মেরামতে ১৫০০ টাকা খরচ হয়েছে"
  ],
  en: [
    "Flat 3B Rahim paid 8000 taka via bKash",
    "How much rent is due this month?",
    "Spent 1500 taka on water pump repair"
  ]
} as const;

export function HeroVoiceLauncher({
  accessToken,
  locale,
  onActionExecuted,
  onToast
}: {
  accessToken: string;
  locale: Locale;
  onActionExecuted?: () => void;
  onToast?: (msg: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [transcript, setTranscript] = useState("");
  const [showTextBox, setShowTextBox] = useState(false);
  const [result, setResult] = useState<VoiceActionResult | null>(null);
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
      setError(toFriendlyError(err, locale));
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
      await runInterpret(res.transcript, res.session_id);
    } catch (err) {
      setError(toFriendlyError(err, locale));
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
      const res = await apiFetch<VoiceActionResult>("/api/voice/interpret", accessToken, {
        method: "POST",
        body: JSON.stringify({ transcript: textToAnalyze.trim(), session_id: sid ?? sessionId })
      });
      setResult(res);
      if (res.resolved_entities?.sms_preview) {
        setEditedSms(res.resolved_entities.sms_preview);
      }
    } catch (err) {
      setError(toFriendlyError(err, locale));
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
      const okMsg =
        locale === "bn"
          ? "সফলভাবে আপনার খাতায় যুক্ত হয়েছে!"
          : "Saved to your ledger successfully!";
      setBanner(okMsg);
      onToast?.(okMsg);
      setResult(null);
      setTranscript("");
      onActionExecuted?.();
    } catch (err) {
      setError(toFriendlyError(err, locale));
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
    <section className="animate-fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-5 text-white shadow-xl shadow-emerald-950/15 sm:p-7">
      <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-teal-300/15 blur-3xl" />

      <div className="relative flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-50 backdrop-blur-xs">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          {locale === "bn" ? "বাংলা ভয়েস হিসাবরক্ষক" : "Smart Voice Assistant"}
        </span>

        <h2 className="mt-2.5 text-xl font-extrabold tracking-tight sm:text-2xl">
          {recording
            ? locale === "bn"
              ? `শুনছি... (${seconds} সেকেন্ড)`
              : `Listening... (${seconds}s)`
            : transcribing
              ? locale === "bn"
                ? "আপনার কথা লেখা হচ্ছে..."
                : "Understanding your voice..."
              : locale === "bn"
                ? "ট্যাপ করে বাংলায় হিসাব বলুন"
                : "Tap & Say Your Rent Update"}
        </h2>
        <p className="mt-1 max-w-md text-xs text-emerald-100/90 sm:text-sm">
          {locale === "bn"
            ? "ভাড়া জমা, খরচ বা বকেয়া জানতে মুখে বলুন — আপনার অনুমতি ছাড়া কিছুই সেভ হবে না।"
            : "Record rent, add expenses, or check dues by voice — nothing saves until you confirm."}
        </p>

        {/* BIG TACTILE MIC LAUNCH BUTTON */}
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
            className={`relative z-10 flex h-24 w-24 cursor-pointer items-center justify-center rounded-full shadow-2xl ring-4 transition-all duration-200 active:scale-90 disabled:opacity-75 ${
              recording
                ? "bg-gradient-to-br from-rose-500 to-red-600 ring-rose-300/60"
                : "bg-white text-emerald-700 ring-white/30 hover:scale-105"
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

        {recording && (
          <div className="mb-3 flex h-6 items-center gap-1.5">
            <span className="h-full w-1 rounded-full bg-white animate-wave-1" />
            <span className="h-full w-1 rounded-full bg-emerald-200 animate-wave-2" />
            <span className="h-full w-1 rounded-full bg-white animate-wave-3" />
            <span className="h-full w-1 rounded-full bg-emerald-200 animate-wave-4" />
            <span className="h-full w-1 rounded-full bg-white animate-wave-2" />
          </div>
        )}

        {/* Tap-to-Try Chips + Text Fallback */}
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
              className="rounded-full bg-white/14 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-xs transition hover:bg-white/24 active:scale-95"
            >
              “{chip}”
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowTextBox((v) => !v)}
            className="rounded-full border border-white/35 px-3 py-1.5 text-[11px] font-bold text-emerald-50 transition hover:bg-white/15"
          >
            {locale === "bn" ? "অথবা লিখে দিন" : "Or type here"}
          </button>
        </div>
      </div>

      {/* Inline Editable Transcript Bar */}
      {showTextBox && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runInterpret(transcript);
          }}
          className="animate-scale-in relative mt-5 flex gap-2 rounded-2xl bg-white p-2 text-slate-900 shadow-lg"
        >
          <input
            type="text"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={
              locale === "bn"
                ? "যেমন: ফ্ল্যাট 3B রহিম ৮০০০ টাকা বিকাশ করেছে..."
                : "e.g. Flat 3B Rahim paid 8000 via bKash..."
            }
            className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={analyzing || !transcript.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {locale === "bn" ? "যাচাই" : "Check"}
          </button>
        </form>
      )}

      {error && (
        <div className="animate-scale-in mt-4 rounded-2xl bg-rose-950/60 px-4 py-2.5 text-xs font-medium text-rose-100 ring-1 ring-rose-400/40">
          {error}
        </div>
      )}
      {banner && (
        <div className="animate-scale-in mt-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-emerald-800 shadow-md">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {banner}
        </div>
      )}

      {result && (result.status === "answered" || result.status === "unknown") && (
        <VoiceAnswerCard
          intent={result.intent}
          data={result.data}
          reason={result.reason}
          locale={locale}
          onClose={() => setResult(null)}
        />
      )}

      {result && (result.status === "proposed" || result.status === "needs_clarification") && (
        <VoiceConfirmationCard
          result={result}
          locale={locale}
          selectedTenancyId={selectedTenancyId}
          selectedPropertyId={selectedPropertyId}
          editedSms={editedSms}
          confirming={confirming}
          onSelectTenancy={setSelectedTenancyId}
          onSelectProperty={setSelectedPropertyId}
          onChangeSms={setEditedSms}
          onConfirm={() => void handleConfirm()}
          onReject={() => void handleReject()}
        />
      )}
    </section>
  );
}
