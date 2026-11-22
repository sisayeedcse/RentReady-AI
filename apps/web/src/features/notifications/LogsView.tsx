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
  after_data: Record<string, unknown> | null;
}

export function LogsView({ accessToken, locale }: { accessToken: string; locale: Locale }) {
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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <Send className="h-4 w-4 text-emerald-600" />
          Banglalink AppLink SMS Provider Logs
        </h3>
        <div className="mt-3 divide-y divide-slate-100">
          {notifs.length === 0 ? (
            <p className="py-4 text-xs text-slate-500">{t(locale, "noData")}</p>
          ) : (
            notifs.map((n) => {
              const log = n.notification_logs?.[0];
              const ok = log?.provider_status_code === "S1000";
              return (
                <div key={n.id} className="py-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {n.tenants?.full_name} ({n.recipient_phone_e164})
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono font-bold ${
                        ok ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {log?.provider_status_code ?? n.status}
                    </span>
                  </div>
                  <p className="text-slate-600">{n.message_body}</p>
                  {log && (
                    <p className="font-mono text-[11px] text-slate-500">
                      Request ID: {log.provider_request_id ?? "N/A"} • HTTP {log.http_status} •{" "}
                      {log.provider_status_detail}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <FileText className="h-4 w-4 text-slate-700" />
          Append-Only Financial Audit Log
        </h3>
        <div className="mt-3 divide-y divide-slate-100">
          {audits.length === 0 ? (
            <p className="py-4 text-xs text-slate-500">{t(locale, "noData")}</p>
          ) : (
            audits.map((a) => (
              <div key={a.id} className="py-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    {a.action} <span className="font-normal text-slate-500">({a.entity_type})</span>
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase">
                    {a.source}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
