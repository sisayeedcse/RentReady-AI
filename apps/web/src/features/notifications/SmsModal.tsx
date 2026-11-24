import { isBanglalinkPrefix } from "@rentready/shared/phone";
import { AlertTriangle, Check, CheckCircle2, Copy, MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Field, Textarea } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
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
  const hasNonAscii = /[^\x20-\x7E\r\n]/.test(message);
  const segmentSize = hasNonAscii ? 70 : 160;
  const segments = Math.max(1, Math.ceil(message.length / segmentSize));

  async function handleConfirmSend() {
    if (message.trim().length < 5) return;
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
        detail: res.ok
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
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable on insecure origins
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      titleId="sms-modal-title"
      maxWidth="max-w-lg"
      closeLabel={locale === "bn" ? "বন্ধ করুন" : "Close dialog"}
      title={
        draft.templateType === "payment_receipt"
          ? locale === "bn"
            ? "SMS পেমেন্ট রসিদ পাঠান"
            : "Send SMS Payment Receipt"
          : locale === "bn"
            ? "ভাড়ার তাগাদা SMS পাঠান"
            : "Send Rent Reminder SMS"
      }
      subtitle={
        <>
          {draft.tenantName} ·{" "}
          <span className="tabular-nums font-mono font-semibold text-[var(--ink-secondary)]">
            {draft.phoneE164}
          </span>
        </>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              WhatsApp
            </a>
            <Button variant="secondary" size="sm" onClick={() => void handleCopy()}>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-[#046c4e]" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {copied
                ? locale === "bn"
                  ? "কপি হয়েছে"
                  : "Copied"
                : locale === "bn"
                  ? "কপি"
                  : "Copy"}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t(locale, "cancel")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={sending}
              disabled={Boolean(result?.ok) || message.trim().length < 5}
              onClick={() => void handleConfirmSend()}
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              {locale === "bn" ? "নিশ্চিত করে SMS পাঠান" : "Confirm & Send SMS"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {isBl ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#046c4e]" aria-hidden="true" />
            <span>
              {locale === "bn"
                ? "বাংলালিংক নম্বর — সরাসরি AppLink SMS পাঠানোর জন্য প্রস্তুত"
                : "Banglalink number — ready for direct AppLink SMS delivery"}
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span className="leading-relaxed">
              {locale === "bn"
                ? "এটি অন্য অপারেটরের নম্বর। সরাসরি WhatsApp অথবা কপি করে পাঠাতে পারেন।"
                : "Non-Banglalink number detected. You can send instantly via WhatsApp or copy the message below."}
            </span>
          </div>
        )}

        <Field
          id="sms-message-input"
          label={locale === "bn" ? "SMS বার্তা (প্রয়োজনে বদলে নিন)" : "SMS Message (Editable)"}
          labelAction={
            <span className="tabular-nums text-[11px] font-medium text-[var(--ink-muted)]">
              {message.length}/480 · {segments}{" "}
              {locale === "bn" ? "SMS অংশ" : segments === 1 ? "part" : "parts"}
            </span>
          }
        >
          <Textarea
            id="sms-message-input"
            rows={4}
            maxLength={480}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>

        {result && (
          <div
            role={result.ok ? "status" : "alert"}
            className={`animate-scale-in rounded-xl border p-3.5 text-xs ${
              result.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            <p className="font-bold">{result.detail}</p>
            {result.requestId && (
              <p className="mt-1 font-mono text-[11px] opacity-85">
                Ref: {result.statusCode} · {result.requestId}
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
