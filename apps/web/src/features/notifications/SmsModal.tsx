import { isBanglalinkPrefix } from "@rentready/shared";
import { AlertTriangle, CheckCircle2, Copy, MessageCircle, Send, X } from "lucide-react";
import { useState } from "react";
import { apiFetch, generateIdempotencyKey } from "../../lib/api";
import { toFriendlyError } from "../../lib/friendlyError";
import { type Locale, t } from "../../lib/i18n";

export interface SmsDraft {
  tenantId: string;
  tenantName: string;
  phoneE164: string;
  templateType: "rent_reminder" | "payment_receipt";
  initialMessage: string;
}

export function SmsModal({
  draft,
  accessToken,
  locale,
  onClose,
  onSent
}: {
  draft: SmsDraft;
  accessToken: string;
  locale: Locale;
  onClose: () => void;
  onSent?: (msg: string) => void;
}) {
  const [message, setMessage] = useState(draft.initialMessage);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    statusCode: string;
    requestId: string | null;
    detail: string;
  } | null>(null);

  const isBl = (() => {
    try {
      return isBanglalinkPrefix(draft.phoneE164);
    } catch {
      return false;
    }
  })();

  const whatsappUrl = `https://wa.me/${draft.phoneE164.replace("+", "")}?text=${encodeURIComponent(message)}`;

  async function handleConfirmSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await apiFetch<{
        ok: boolean;
        provider_log?: {
          provider_status_code: string;
          provider_request_id: string | null;
          provider_status_detail: string;
        };
      }>("/api/notifications/send", accessToken, {
        method: "POST",
        body: JSON.stringify({
          tenant_id: draft.tenantId,
          template_type: draft.templateType,
          message_body: message,
          confirmed: true,
          idempotency_key: generateIdempotencyKey("sms")
        })
      });

      setResult({
        ok: res.ok,
        statusCode: res.provider_log?.provider_status_code ?? "S1000",
        requestId: res.provider_log?.provider_request_id ?? null,
        detail:
          res.ok
            ? locale === "bn"
              ? "SMS সফলভাবে পাঠানো হয়েছে!"
              : "SMS delivered successfully!"
            : res.provider_log?.provider_status_detail ?? "Could not send SMS"
      });
      if (res.ok) {
        onSent?.(locale === "bn" ? "SMS সফলভাবে পাঠানো হয়েছে!" : "SMS sent successfully!");
      }
    } catch (err) {
      setResult({
        ok: false,
        statusCode: "FAILED",
        requestId: null,
        detail: toFriendlyError(err, locale)
      });
    } finally {
      setSending(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="animate-sheet-up w-full max-w-lg rounded-t-3xl border border-slate-200 bg-white p-5 pb-8 shadow-2xl sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              {draft.templateType === "payment_receipt"
                ? locale === "bn"
                  ? "SMS পেমেন্ট রসিদ পাঠান"
                  : "Send SMS Payment Receipt"
                : locale === "bn"
                  ? "ভাড়ার তাগাদা SMS পাঠান"
                  : "Send Rent Reminder SMS"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {draft.tenantName} • <span className="font-mono font-semibold">{draft.phoneE164}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          {isBl ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {locale === "bn"
                ? "বাংলালিংক নম্বর — সরাসরি SMS পাঠানোর জন্য প্রস্তুত"
                : "Banglalink number — ready for direct SMS delivery"}
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {locale === "bn"
                  ? "এটি অন্য অপারেটরের নম্বর। সরাসরি WhatsApp অথবা কপি করে পাঠাতে পারেন।"
                  : "Non-Banglalink number detected. You can send instantly via WhatsApp or copy the text below."}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-bold text-slate-700">
            {locale === "bn" ? "বার্তা (প্রয়োজনে বদলে নিন)" : "Message (Editable)"}
          </label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 p-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
          />
        </div>

        {result && (
          <div
            className={`animate-scale-in mt-4 rounded-2xl border p-3 text-xs ${
              result.ok
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            <p className="font-bold">{result.detail}</p>
            {result.requestId && (
              <p className="mt-0.5 font-mono text-[11px] opacity-80">
                Ref: {result.statusCode} • {result.requestId}
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 active:scale-95"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </a>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 active:scale-95"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied
                ? locale === "bn"
                  ? "কপি হয়েছে!"
                  : "Copied!"
                : locale === "bn"
                  ? "কপি"
                  : "Copy"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700"
            >
              {t(locale, "cancel")}
            </button>
            <button
              type="button"
              disabled={sending || Boolean(result?.ok)}
              onClick={() => void handleConfirmSend()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {sending
                ? locale === "bn"
                  ? "পাঠানো হচ্ছে..."
                  : "Sending..."
                : locale === "bn"
                  ? "SMS পাঠান"
                  : "Send SMS"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
