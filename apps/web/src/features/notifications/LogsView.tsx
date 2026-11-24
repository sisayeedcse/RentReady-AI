import { CheckCircle2, FileText, RefreshCw, Send, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import {
  AlertBanner,
  EmptyState,
  PageHeader,
  SearchInput,
  SkeletonRows
} from "../../components/ui/States";
import { FilterPills, SegmentedTabs } from "../../components/ui/Tabs";
import { apiFetch } from "../../lib/api";
import { formatDhakaDateTime } from "../../lib/format";
import { toFriendlyError } from "../../lib/friendlyError";
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smsFilter, setSmsFilter] = useState<"all" | "delivered" | "failed">("all");
  const [auditSourceFilter, setAuditSourceFilter] = useState<"all" | "voice" | "ui">("all");
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  const load = useCallback(
    async (isManual = false) => {
      try {
        if (isManual) setRefreshing(true);
        setError(null);
        const [nRes, aRes] = await Promise.all([
          apiFetch<{ data: NotificationRow[] }>("/api/notifications", accessToken),
          apiFetch<{ data: AuditRow[] }>("/api/audit-logs", accessToken)
        ]);
        setNotifs(nRes.data);
        setAudits(aRes.data);
      } catch (err) {
        setError(toFriendlyError(err, locale));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, locale]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const friendlyAuditAction = useCallback(
    (action: string) => {
      if (locale === "bn") {
        if (action === "record_payment") return "ভাড়া জমা হয়েছে";
        if (action === "reverse_payment") return "পেমেন্ট সংশোধন (রিভার্স)";
        if (action === "record_expense") return "বাড়ির খরচ যুক্ত হয়েছে";
        if (action === "create_maintenance_request") return "মেরামতের অনুরোধ যুক্ত হয়েছে";
        if (action === "send_sms") return "নিশ্চিতকৃত SMS পাঠানো হয়েছে";
        return action;
      }
      if (action === "record_payment") return "Rent Payment Recorded";
      if (action === "reverse_payment") return "Payment Reversed";
      if (action === "record_expense") return "Expense Recorded";
      if (action === "create_maintenance_request") return "Maintenance Ticket Created";
      if (action === "send_sms") return "Confirmed SMS Dispatched";
      return action;
    },
    [locale]
  );

  const filteredNotifs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notifs.filter((n) => {
      const ok = n.notification_logs?.[0]?.provider_status_code === "S1000";
      if (smsFilter === "delivered" && !ok) return false;
      if (smsFilter === "failed" && ok) return false;
      if (!q) return true;
      return (
        (n.tenants?.full_name ?? "").toLowerCase().includes(q) ||
        n.recipient_phone_e164.includes(q) ||
        n.message_body.toLowerCase().includes(q)
      );
    });
  }, [notifs, smsFilter, search]);

  const filteredAudits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return audits.filter((a) => {
      if (auditSourceFilter === "voice" && a.source !== "voice") return false;
      if (auditSourceFilter === "ui" && a.source === "voice") return false;
      if (!q) return true;
      return (
        friendlyAuditAction(a.action).toLowerCase().includes(q) ||
        a.entity_type.toLowerCase().includes(q)
      );
    });
  }, [audits, auditSourceFilter, search, friendlyAuditAction]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={locale === "bn" ? "SMS রিপোর্ট ও হিসাবের অডিট" : "SMS Delivery & Audit Trail"}
        subtitle={
          locale === "bn"
            ? "পাঠানো প্রতিটি SMS রসিদ (AppLink কোডসহ) এবং আর্থিক লেনদেনের স্থায়ী রেকর্ড"
            : "Permanent delivery status for every AppLink SMS and append-only ledger audit trail"
        }
        actions={
          <Button variant="secondary" size="sm" loading={refreshing} onClick={() => void load(true)}>
            {!refreshing && <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            <span>{locale === "bn" ? "রিফ্রেশ" : "Refresh"}</span>
          </Button>
        }
      />

      {error && (
        <AlertBanner
          tone="error"
          message={error}
          onRetry={() => void load(true)}
          onDismiss={() => setError(null)}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs
          ariaLabel={locale === "bn" ? "লগ বিভাগ" : "Log views"}
          value={subTab}
          onChange={(next) => {
            startTransition(() => {
              setSubTab(next);
              setSearch("");
            });
          }}
          options={[
            {
              id: "sms",
              label: locale === "bn" ? "SMS রিপোর্ট" : "SMS History",
              count: notifs.length,
              icon: <Send className="h-3.5 w-3.5" aria-hidden="true" />
            },
            {
              id: "audit",
              label: locale === "bn" ? "অডিট খাতা" : "Audit Trail",
              count: audits.length,
              icon: <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            }
          ]}
        />

        <SearchInput
          value={search}
          onChange={(v) => startTransition(() => setSearch(v))}
          placeholder={
            subTab === "sms"
              ? locale === "bn"
                ? "প্রাপক, নম্বর বা বার্তা খুঁজুন..."
                : "Search recipient, phone, or message..."
              : locale === "bn"
                ? "কার্যক্রম খুঁজুন..."
                : "Search audit actions..."
          }
          ariaLabel={locale === "bn" ? "রেকর্ড খুঁজুন" : "Search logs"}
          className="sm:w-64"
        />
      </div>

      {subTab === "sms" ? (
        <FilterPills
          ariaLabel={locale === "bn" ? "SMS অবস্থা ফিল্টার" : "Filter SMS status"}
          value={smsFilter}
          onChange={(v) => startTransition(() => setSmsFilter(v))}
          options={[
            { id: "all", label: t(locale, "all") },
            { id: "delivered", label: locale === "bn" ? "সফল (S1000)" : "Delivered (S1000)" },
            { id: "failed", label: locale === "bn" ? "ব্যর্থ" : "Failed" }
          ]}
        />
      ) : (
        <FilterPills
          ariaLabel={locale === "bn" ? "উৎস ফিল্টার" : "Filter audit source"}
          value={auditSourceFilter}
          onChange={(v) => startTransition(() => setAuditSourceFilter(v))}
          options={[
            { id: "all", label: t(locale, "all") },
            { id: "voice", label: locale === "bn" ? "ভয়েস এন্ট্রি" : "Voice" },
            { id: "ui", label: locale === "bn" ? "অ্যাপ UI" : "App UI" }
          ]}
        />
      )}

      {loading ? (
        <SkeletonRows count={5} />
      ) : subTab === "sms" ? (
        filteredNotifs.length === 0 ? (
          <EmptyState icon={<Send className="h-5 w-5" aria-hidden="true" />} title={t(locale, "noData")} />
        ) : (
          <Card className="divide-y divide-[var(--border-subtle)]">
            {filteredNotifs.map((n) => {
              const log = n.notification_logs?.[0];
              const ok = log?.provider_status_code === "S1000";
              return (
                <div key={n.id} className="space-y-1.5 px-4 py-3.5 text-xs sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[var(--ink-primary)]">
                        {n.tenants?.full_name ?? "—"}
                      </span>
                      <span className="tabular-nums font-mono text-[11px] text-[var(--ink-muted)]">
                        {n.recipient_phone_e164}
                      </span>
                    </div>
                    <Badge tone={ok ? "emerald" : "rose"}>
                      {ok ? (
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-3 w-3" aria-hidden="true" />
                      )}
                      {ok
                        ? locale === "bn"
                          ? "সফল (S1000)"
                          : "Delivered (S1000)"
                        : log?.provider_status_code ?? n.status}
                    </Badge>
                  </div>
                  <p className="leading-relaxed text-[var(--ink-secondary)]">{n.message_body}</p>
                  <p className="tabular-nums font-mono text-[11px] text-[var(--ink-muted)]">
                    {formatDhakaDateTime(n.created_at, locale)}
                    {log?.provider_request_id ? ` · Ref: ${log.provider_request_id}` : ""}
                  </p>
                </div>
              );
            })}
          </Card>
        )
      ) : filteredAudits.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" aria-hidden="true" />} title={t(locale, "noData")} />
      ) : (
        <Card className="divide-y divide-[var(--border-subtle)]">
          {filteredAudits.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 px-4 py-3.5 text-xs transition-colors hover:bg-[var(--bg-hover)] sm:px-5"
            >
              <div className="min-w-0">
                <p className="font-bold text-[var(--ink-primary)]">
                  {friendlyAuditAction(a.action)}
                </p>
                <p className="tabular-nums mt-0.5 text-[11px] text-[var(--ink-muted)]">
                  {formatDhakaDateTime(a.created_at, locale)}
                </p>
              </div>
              <Badge tone={a.source === "voice" ? "emerald" : "neutral"}>
                {a.source === "voice"
                  ? locale === "bn"
                    ? "ভয়েস"
                    : "Voice"
                  : locale === "bn"
                    ? "অ্যাপ"
                    : "App"}
              </Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
