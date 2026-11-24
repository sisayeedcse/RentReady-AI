import { CheckCircle2, Loader2, Mic, Send, ShieldCheck, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { AlertBanner } from "../../components/ui/States";
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
  variant = "compact",
  externalCommand = null,
  onActionExecuted,
  onToast
}: {
  accessToken: string;
  locale: Locale;
  variant?: "compact" | "studio";
  externalCommand?: { text: string; seq: number } | null;
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
  const [result, setResult] = useState<VoiceActionResult | null>(null);
  const [selectedTenancyId, setSelectedTenancyId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [editedSms, setEditedSms] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastExternalSeqRef = useRef<number>(0);

  const runInterpret = useCallback(
    async (textToAnalyze: string, sid?: string) => {
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
    },
    [accessToken, locale, sessionId]
  );

  useEffect(() => {
    if (!externalCommand || externalCommand.seq === lastExternalSeqRef.current) return;
    lastExternalSeqRef.current = externalCommand.seq;
    setTranscript(externalCommand.text);
    void runInterpret(externalCommand.text);
  }, [externalCommand, runInterpret]);

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
      setError(toFriendlyError(err, locale));
    }
  }

  async function transcribeAndShow(blob: Blob) {
    setTranscribing(true);
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

  const busy = transcribing || analyzing;

  const statusHeadline = recording
    ? locale === "bn"
      ? `শুনছি... (${seconds} সেকেন্ড)`
      : `Listening... (0:${String(seconds).padStart(2, "0")})`
    : transcribing
      ? locale === "bn"
        ? "আপনার কথা লেখা হচ্ছে..."
        : "Transcribing voice..."
      : analyzing
        ? locale === "bn"
          ? "হিসাব যাচাই করা হচ্ছে..."
          : "Preparing ledger draft..."
        : t(locale, "voicePromptTitle");

  if (variant === "studio") {
    const stepIndex = result ? 3 : busy || transcript.trim() ? 2 : 1;

    return (
      <section className="overflow-hidden rounded-2xl border border-[#163a2e] bg-[#0c231c] bg-ledger-grid p-5 text-white shadow-sm sm:p-7">
        {/* 3-Step Safety Pipeline Indicator */}
        <ol className="mx-auto mb-5 flex max-w-lg items-center justify-center gap-2 text-[11px] font-semibold">
          {(
            [
              [1, locale === "bn" ? "১. বলুন বা লিখুন" : "1. Speak or Type"],
              [2, locale === "bn" ? "২. খসড়া যাচাই" : "2. Review Draft"],
              [3, locale === "bn" ? "৩. নিশ্চিত ও সেভ" : "3. Confirm & Save"]
            ] as const
          ).map(([step, label], idx) => (
            <li key={step} className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 transition-colors ${
                  stepIndex >= step
                    ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40"
                    : "bg-white/5 text-white/55"
                }`}
              >
                {label}
              </span>
              {idx < 2 && <span className="text-white/25" aria-hidden="true">→</span>}
            </li>
          ))}
        </ol>

        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{statusHeadline}</h2>
          <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-emerald-100/75 sm:text-sm">
            {locale === "bn"
              ? "ভাড়া জমা, খরচ, মেরামত বা বকেয়া জানতে মুখে বলুন অথবা নিচে লিখুন — আপনার অনুমতি ছাড়া কোনো তথ্য সেভ হয় না।"
              : "Log rent, expenses, repairs, or query dues in Bangla or English — nothing writes to your ledger until you confirm."}
          </p>

          {/* Tactile Studio Mic Button — Ripples ONLY when actively recording */}
          <div className="relative my-6 flex items-center justify-center">
            {recording && (
              <>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute h-20 w-20 rounded-full bg-rose-400/40 animate-mic-ripple"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute h-20 w-20 rounded-full bg-rose-400/25 animate-mic-ripple-delayed"
                />
              </>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleMic()}
              aria-label={recording ? t(locale, "stopRecording") : t(locale, "startRecording")}
              className={`relative z-10 flex h-20 w-20 cursor-pointer items-center justify-center rounded-full shadow-lg ring-4 transition-all duration-150 active:scale-95 disabled:opacity-75 ${
                recording
                  ? "bg-rose-600 text-white ring-rose-400/50 hover:bg-rose-700"
                  : "bg-white text-[#046c4e] ring-emerald-400/30 hover:bg-emerald-50"
              }`}
            >
              {busy ? (
                <Loader2 className="h-8 w-8 animate-spin text-[#046c4e]" aria-hidden="true" />
              ) : recording ? (
                <Square className="h-7 w-7 fill-white text-white" aria-hidden="true" />
              ) : (
                <Mic className="h-8 w-8" aria-hidden="true" />
              )}
            </button>
          </div>

          {recording && (
            <div className="mb-4 flex h-5 items-center gap-1.5" aria-hidden="true">
              <span className="h-full w-1 rounded-full bg-white animate-wave-1" />
              <span className="h-full w-1 rounded-full bg-emerald-300 animate-wave-2" />
              <span className="h-full w-1 rounded-full bg-white animate-wave-3" />
              <span className="h-full w-1 rounded-full bg-emerald-300 animate-wave-4" />
              <span className="h-full w-1 rounded-full bg-white animate-wave-2" />
            </div>
          )}

          {/* Always-Accessible Command Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runInterpret(transcript);
            }}
            className="flex w-full gap-2 rounded-xl border border-white/15 bg-white p-1.5 text-[var(--ink-primary)] shadow-md"
          >
            <input
              type="text"
              aria-label={
                locale === "bn" ? "ভয়েস বা টেক্সট কমান্ড লিখুন" : "Enter voice or text command"
              }
              maxLength={600}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={
                locale === "bn"
                  ? "যেমন: ফ্ল্যাট 3B রহিম ভাই ৮০০০ টাকা বিকাশ করেছে..."
                  : "e.g. Flat 3B Rahim paid 8000 via bKash..."
              }
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:outline-none"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={analyzing}
              disabled={!transcript.trim()}
            >
              {!analyzing && <Send className="h-3.5 w-3.5" aria-hidden="true" />}
              <span>{t(locale, "analyzeCommand")}</span>
            </Button>
          </form>

          {/* Quick Prompt Chips */}
          <div className="mt-3.5 flex flex-wrap justify-center gap-1.5">
            {QUICK_CHIPS[locale].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  setTranscript(chip);
                  void runInterpret(chip);
                }}
                className="cursor-pointer rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-medium text-emerald-50 transition-colors hover:bg-white/16"
              >
                “{chip}”
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-2xl">
          {error && (
            <div className="mt-4">
              <AlertBanner tone="error" message={error} onDismiss={() => setError(null)} />
            </div>
          )}
          {banner && (
            <div
              role="status"
              className="animate-scale-in mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-xs font-bold text-[#046c4e] shadow-sm"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{banner}</span>
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
        </div>
      </section>
    );
  }

  // COMPACT WORKSPACE COMMAND BAR (Dashboard — keeps KPIs above the fold!)
  return (
    <section
      aria-label={locale === "bn" ? "দ্রুত ভয়েস ও টেক্সট কমান্ড" : "Quick Voice & Text Command"}
      className="surface-card overflow-hidden rounded-xl border-t-2 border-t-[#046c4e]"
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#ecfdf5] text-[#046c4e]">
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <h3 className="text-sm font-bold text-[var(--ink-primary)]">{statusHeadline}</h3>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--ink-muted)]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#046c4e]" aria-hidden="true" />
            {locale === "bn" ? "নিশ্চিতকরণ ছাড়া সেভ হয় না" : "Review before saving"}
          </span>
        </div>

        {/* Unified Tactile Mic + Text Command Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runInterpret(transcript);
          }}
          className="mt-3 flex items-center gap-2"
        >
          <div className="relative shrink-0">
            {recording && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-xl bg-rose-400/45 animate-mic-ripple"
              />
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleMic()}
              aria-label={recording ? t(locale, "stopRecording") : t(locale, "startRecording")}
              className={`relative z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl transition-colors duration-150 active:scale-95 disabled:opacity-70 ${
                recording
                  ? "bg-rose-600 text-white hover:bg-rose-700"
                  : "bg-[#046c4e] text-white hover:bg-[#03543f]"
              }`}
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : recording ? (
                <Square className="h-4 w-4 fill-white" aria-hidden="true" />
              ) : (
                <Mic className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-rail)] p-1 transition-colors focus-within:border-[#046c4e] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#046c4e]/15">
            <input
              type="text"
              aria-label={
                locale === "bn" ? "ভয়েস বা টেক্সট কমান্ড লিখুন" : "Enter voice or text command"
              }
              maxLength={600}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={
                locale === "bn"
                  ? "বলুন বা লিখুন: ফ্ল্যাট 3B রহিম ৮০০০ টাকা বিকাশ করেছে..."
                  : "Speak or type: Flat 3B Rahim paid 8000 via bKash..."
              }
              className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)]/80 focus:outline-none"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={analyzing}
              disabled={!transcript.trim()}
            >
              {!analyzing && <Send className="h-3.5 w-3.5" aria-hidden="true" />}
              <span className="hidden sm:inline">{locale === "bn" ? "যাচাই" : "Check"}</span>
            </Button>
          </div>
        </form>

        {/* Live Recording Waveform */}
        {recording && (
          <div className="mt-2.5 flex items-center gap-2 text-xs font-semibold text-rose-700">
            <div className="flex h-4 items-center gap-1" aria-hidden="true">
              <span className="h-full w-0.5 rounded-full bg-rose-600 animate-wave-1" />
              <span className="h-full w-0.5 rounded-full bg-rose-400 animate-wave-2" />
              <span className="h-full w-0.5 rounded-full bg-rose-600 animate-wave-3" />
              <span className="h-full w-0.5 rounded-full bg-rose-400 animate-wave-4" />
            </div>
            <span className="tabular-nums">
              {locale === "bn"
                ? `রেকর্ডিং চলছে (${seconds}/৩০ সেকেন্ড) — শেষ হলে লাল বোতামে চাপুন`
                : `Recording (0:${String(seconds).padStart(2, "0")} / 0:30) — tap stop when finished`}
            </span>
          </div>
        )}

        {/* Clickable Prompt Suggestions */}
        <div className="no-scrollbar mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {QUICK_CHIPS[locale].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                setTranscript(chip);
                void runInterpret(chip);
              }}
              className="shrink-0 cursor-pointer rounded-full border border-[var(--border-default)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--ink-secondary)] transition-colors hover:border-[#a7f3d0] hover:bg-[#ecfdf5] hover:text-[#046c4e]"
            >
              “{chip}”
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-3">
            <AlertBanner tone="error" message={error} onDismiss={() => setError(null)} />
          </div>
        )}
        {banner && (
          <div
            role="status"
            className="animate-scale-in mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-[#046c4e]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{banner}</span>
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
      </div>
    </section>
  );
}
