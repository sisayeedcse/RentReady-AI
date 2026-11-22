import { isBanglalinkPrefix } from "@rentready/shared";
import { AlertTriangle, CheckCircle2, Copy, Send, X } from "lucide-react";
import { useState } from "react";
import { apiFetch, generateIdempotencyKey } from "../../lib/api";
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
  onSent?: () => void;
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
        detail: res.provider_log?.provider_status_detail ?? "Sent"
      });
      onSent?.();
    } catch (err) {
      setResult({
        ok: false,
        statusCode: "ERROR",
        requestId: null,
        detail: err instanceof Error ? err.message : "Failed to send SMS"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {draft.templateType === "payment_receipt"
                ? locale === "bn"
                  ? "Banglalink AppLink SMS রসিদ নিশ্চিত করুন"
                  : "Confirm Banglalink AppLink SMS Receipt"
                : locale === "bn"
                  ? "Banglalink AppLink SMS রিমাইন্ডার নিশ্চিত করুন"
                  : "Confirm Banglalink AppLink SMS Reminder"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-600">
              {draft.tenantName} • <span className="font-mono">{draft.phoneE164}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4">
          {isBl ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Banglalink prefix detected (+88019 / +88014) — eligible for AppLink SMS
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Non-Banglalink prefix detected. AppLink natively serves Banglalink subscribers; you
                can copy the receipt text below to send via WhatsApp/SMS.
              </span>
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            {locale === "bn" ? "SMS বার্তা (পাঠানোর আগে সম্পাদনা করা যাবে)" : "SMS Message (Editable)"}
          </label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {result && (
          <div
            className={`mt-4 rounded-xl border p-3 text-xs ${
              result.ok
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-red-300 bg-red-50 text-red-900"
            }`}
          >
            <p className="font-bold">
              AppLink Status: <span className="font-mono">{result.statusCode}</span>
              {result.requestId && (
                <>
                  {" "}
                  • Request ID: <span className="font-mono">{result.requestId}</span>
                </>
              )}
            </p>
            <p className="mt-0.5">{result.detail}</p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied!" : "Copy Text"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t(locale, "cancel")}
          </button>
          <button
            type="button"
            disabled={sending || Boolean(result?.ok)}
            onClick={handleConfirmSend}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? "Sending..." : t(locale, "confirmAction")}
          </button>
        </div>
      </div>
    </div>
  );
}
