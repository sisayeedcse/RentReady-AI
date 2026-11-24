import { CheckCircle2, FileText, Send, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { type Locale, t } from "../../lib/i18n";

interface NotificationRow {
  id: string;
  template_type: string;
  recipient_phone_e164: string;
  message_body: string;
  status: string;
  created_at: string;
  tenants: { full_name: string } | null;
  notification_logs: Array<{
    provider_status_code: string;
    provider_status_detail: string;
    provider_request_id: string | null;
    http_status: number;
  }>;
}

interface AuditRow {
  id: string;
  entity_type: string;
  action: string;
  source: string;
  created_at: string;
}

export function LogsView({ accessToken, locale }: { accessToken: string; locale: Locale }) {
  const [subTab, setSubTab] = useState<"sms" | "audit">("sms");
  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);

  const load = useCallback(async () => {
    const [nRes, aRes] = await Promise.all([
      apiFetch<{ data: NotificationRow[] }>("/api/notifications", accessToken),
      apiFetch<{ data: AuditRow[] }>("/api/audit-logs", accessToken)
    ]);
    setNotifs(nRes.data);
    setAudits(aRes.data);
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const friendlyAuditAction = (action: string) => {
    if (locale === "bn") {
      if (action === "record_payment") return "ভাড়া জমা হয়েছে";
      if (action === "reverse_payment") return "পেমেন্ট সংশোধন (রিভার্স)";
      if (action === "record_expense") return "বাড়ির খরচ যুক্ত হয়েছে";
      return action;
    }
    if (action === "record_payment") return "Rent Payment Recorded";
    if (action === "reverse_payment") return "Payment Reversed";
    if (action === "record_expense") return "Expense Recorded";
    return action;
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold text-slate-900">
          {locale === "bn" ? "SMS রিপোর্ট ও হিসাবের অডিট" : "SMS Delivery & Audit Trail"}
        </h2>
        <p className="text-xs text-slate-500">
          {locale === "bn"
            ? "পাঠানো প্রতিটি SMS রসিদ এবং আর্থিক লেনদেনের স্থায়ী রেকর্ড"
            : "Permanent record of every sent SMS receipt and financial entry"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-2xs">
        <button
          type="button"
          onClick={() => setSubTab("sms")}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
            subTab === "sms" ? "bg-emerald-600 text-white" : "text-slate-600"
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          {locale === "bn" ? `SMS রিপোর্ট (${notifs.length})` : `SMS History (${notifs.length})`}
        </button>
        <button
          type="button"
          onClick={() => setSubTab("audit")}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
            subTab === "audit" ? "bg-emerald-600 text-white" : "text-slate-600"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          {locale === "bn" ? `অডিট খাতা (${audits.length})` : `Audit Log (${audits.length})`}
        </button>
      </div>

      {subTab === "sms" ? (
        <section className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
          <div className="divide-y divide-slate-100">
            {notifs.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">{t(locale, "noData")}</p>
            ) : (
              notifs.map((n) => {
                const log = n.notification_logs?.[0];
                const ok = log?.provider_status_code === "S1000";
                return (
                  <div key={n.id} className="py-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">
                        {n.tenants?.full_name} ({n.recipient_phone_e164})
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          ok ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {ok
                          ? locale === "bn"
                            ? "সফল (S1000)"
                            : "Delivered (S1000)"
                          : log?.provider_status_code ?? n.status}
                      </span>
                    </div>
                    <p className="text-slate-600">{n.message_body}</p>
                    <p className="font-mono text-[10px] text-slate-400">
                      {new Date(n.created_at).toLocaleString()}
                      {log?.provider_request_id ? ` • Ref: ${log.provider_request_id}` : ""}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>
      ) : (
        <section className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
          <div className="divide-y divide-slate-100">
            {audits.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">{t(locale, "noData")}</p>
            ) : (
              audits.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-3 text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{friendlyAuditAction(a.action)}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                    {a.source === "voice"
                      ? locale === "bn"
                        ? "ভয়েস"
                        : "Voice"
                      : locale === "bn"
                        ? "অ্যাপ"
                        : "App"}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
