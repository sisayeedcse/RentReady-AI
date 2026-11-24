import { formatBdt } from "@rentready/shared/money";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Phone,
  Receipt,
  RefreshCw,
  Send,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Wrench
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { NavigateOptions, TabId } from "../../App";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { AlertBanner, EmptyState, PageHeader, SkeletonCards } from "../../components/ui/States";
import { apiFetch } from "../../lib/api";
import { formatBillingMonth, formatDhakaDate, formatPaymentMethodLabel } from "../../lib/format";
import { toFriendlyError } from "../../lib/friendlyError";
import { getCurrentDhakaMonthLabel, type Locale, t } from "../../lib/i18n";
import type { SmsDraft } from "../notifications/SmsModal";
import { HeroVoiceLauncher } from "../voice/HeroVoiceLauncher";

interface DashboardResponse {
  summary: {
    total_properties: number;
    total_units: number;
    occupied_units: number;
    expected_rent_paisa: number;
    collected_rent_paisa: number;
    total_outstanding_paisa: number;
    monthly_expenses_paisa: number;
    net_operating_result_paisa: number;
    overdue_obligations_count: number;
    open_maintenance_count: number;
  } | null;
  overdue_obligations: Array<{
    obligation_id: string;
    tenant_id: string;
    tenant_name: string;
    tenant_phone: string;
    unit_code: string;
    billing_month: string;
    outstanding_paisa: number;
  }>;
  recent_payments: Array<{
    id: string;
    amount_paisa: number;
    payment_method: string;
    paid_at: string;
    is_reversal: boolean;
    tenants: { full_name: string } | null;
  }>;
  open_maintenance: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    units: { unit_code: string } | null;
  }>;
}

export function DashboardView({
  accessToken,
  locale,
  userName,
  onOpenSms,
  onNavigate,
  onToast
}: {
  accessToken: string;
  locale: Locale;
  userName?: string;
  onOpenSms: (draft: SmsDraft) => void;
  onNavigate: (tab: TabId, opts?: NavigateOptions) => void;
  onToast?: (msg: string) => void;
}) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isManual = false) => {
      try {
        if (isManual) setRefreshing(true);
        setError(null);
        const res = await apiFetch<DashboardResponse>("/api/dashboard", accessToken);
        setData(res);
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

  const s = data?.summary;
  const occPct = s && s.total_units > 0 ? Math.round((s.occupied_units / s.total_units) * 100) : 0;
  const collectedPct =
    s && s.expected_rent_paisa > 0
      ? Math.min(100, Math.round((s.collected_rent_paisa / s.expected_rent_paisa) * 100))
      : 0;
  const monthLabel = getCurrentDhakaMonthLabel(locale);

  const expectedPaisa = s?.expected_rent_paisa ?? 0;
  const collectedPaisa = s?.collected_rent_paisa ?? 0;
  const outstandingPaisa = s?.total_outstanding_paisa ?? 0;
  const expensesPaisa = s?.monthly_expenses_paisa ?? 0;
  const netPaisa = s?.net_operating_result_paisa ?? 0;

  // Real proportional breakdown for the lightweight native cashflow bar
  const totalVolume = Math.max(1, collectedPaisa + outstandingPaisa + expensesPaisa);
  const collectedShare = Math.round((collectedPaisa / totalVolume) * 100);
  const dueShare = Math.round((outstandingPaisa / totalVolume) * 100);
  const expenseShare = Math.max(0, 100 - collectedShare - dueShare);

  // SVG Occupancy ring geometry
  const ringRadius = 22;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference * (1 - occPct / 100);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        eyebrow={t(locale, "greeting")}
        title={userName || (locale === "bn" ? "বাড়িওয়ালা ড্যাশবোর্ড" : "Property Overview")}
        subtitle={
          locale === "bn"
            ? `${monthLabel} — আপনার সম্পত্তি, আদায় ও বকেয়ার সারসংক্ষেপ`
            : `${monthLabel} — Live financial summary and pending actions`
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void load(true)}
              loading={refreshing}
              aria-label={locale === "bn" ? "রিফ্রেশ করুন" : "Refresh dashboard"}
            >
              {!refreshing && <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
              <span className="hidden sm:inline">{locale === "bn" ? "রিফ্রেশ" : "Refresh"}</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate("finance", { financeSubTab: "bills" })}
            >
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
              {t(locale, "recordPayment")}
            </Button>
          </>
        }
      />

      {/* Compact Command-First Bangla Voice Bar (Keeps KPIs Above the Fold) */}
      <HeroVoiceLauncher
        accessToken={accessToken}
        locale={locale}
        variant="compact"
        onActionExecuted={() => void load(true)}
        onToast={onToast}
      />

      {error && (
        <AlertBanner
          tone="error"
          message={error}
          onRetry={() => void load(true)}
          retryLabel={locale === "bn" ? "আবার চেষ্টা করুন" : "Retry"}
        />
      )}

      {/* Primary Financial KPI Row */}
      {loading ? (
        <SkeletonCards count={4} cols="grid-cols-2 lg:grid-cols-4" />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            label={t(locale, "collectedRent")}
            value={formatBdt(collectedPaisa, locale)}
            accent="emerald"
            meta={`${collectedPct}% ${locale === "bn" ? "আদায়" : "collected"}`}
            icon={<TrendingUp className="h-4 w-4 text-[#046c4e]" aria-hidden="true" />}
          />
          <KpiTile
            label={t(locale, "outstandingRent")}
            value={formatBdt(outstandingPaisa, locale)}
            accent={outstandingPaisa > 0 ? "amber" : "neutral"}
            meta={
              (s?.overdue_obligations_count ?? 0) > 0
                ? locale === "bn"
                  ? `${s?.overdue_obligations_count}টি বকেয়া বিল`
                  : `${s?.overdue_obligations_count} pending bill(s)`
                : locale === "bn"
                  ? "সব পরিশোধিত"
                  : "All settled"
            }
            icon={<AlertCircle className="h-4 w-4 text-amber-700" aria-hidden="true" />}
          />
          <KpiTile
            label={t(locale, "monthlyExpenses")}
            value={formatBdt(expensesPaisa, locale)}
            accent="rose"
            meta={
              locale === "bn"
                ? `মোট বিল ${formatBdt(expectedPaisa, "bn")}`
                : `Billed ${formatBdt(expectedPaisa, "en")}`
            }
            icon={<TrendingDown className="h-4 w-4 text-rose-700" aria-hidden="true" />}
          />
          <KpiTile
            label={t(locale, "netResult")}
            value={formatBdt(netPaisa, locale)}
            accent={netPaisa >= 0 ? "emerald" : "rose"}
            meta={locale === "bn" ? "আদায় − খরচ" : "Collected − Expenses"}
            icon={<Wallet className="h-4 w-4 text-[#046c4e]" aria-hidden="true" />}
          />
        </div>
      )}

      {/* Collection Progress + Occupancy & Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader
            title={
              locale === "bn"
                ? `${monthLabel} — আদায় ও নগদ প্রবাহ`
                : `${monthLabel} Collection & Cashflow`
            }
            badge={
              <Badge tone={collectedPct >= 80 ? "emerald" : collectedPct > 0 ? "amber" : "neutral"}>
                <span className="tabular-nums">{collectedPct}%</span>
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            {/* Primary Collection Progress Bar */}
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-xs">
                <span className="font-medium text-[var(--ink-secondary)]">
                  {locale === "bn" ? "মোট বিলের বিপরীতে আদায়" : "Collected against billed rent"}
                </span>
                <span className="tabular-nums font-bold text-[var(--ink-primary)]">
                  {formatBdt(collectedPaisa, locale)}{" "}
                  <span className="font-normal text-[var(--ink-muted)]">
                    / {formatBdt(expectedPaisa, locale)}
                  </span>
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={collectedPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={
                  locale === "bn"
                    ? `মাসিক ভাড়া আদায় ${collectedPct}%`
                    : `Monthly rent collection ${collectedPct}%`
                }
                className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]"
              >
                <div
                  className="h-full rounded-full bg-[#046c4e] transition-all duration-500 ease-out"
                  style={{ width: `${collectedPct}%` }}
                />
              </div>
            </div>

            {/* Real Cashflow Distribution Bar (Zero Fake Data) */}
            <div className="border-t border-[var(--border-subtle)] pt-3.5">
              <p className="mb-2 text-[11px] font-semibold text-[var(--ink-muted)]">
                {locale === "bn"
                  ? "আর্থিক অনুপাত (আদায় · বকেয়া · খরচ)"
                  : "Ledger Breakdown (Collected · Due · Expenses)"}
              </p>
              <div
                className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]"
                role="img"
                aria-label={
                  locale === "bn"
                    ? `আদায় ${collectedShare}%, বকেয়া ${dueShare}%, খরচ ${expenseShare}%`
                    : `Collected ${collectedShare}%, Due ${dueShare}%, Expenses ${expenseShare}%`
                }
              >
                {collectedPaisa > 0 && (
                  <div className="bg-[#046c4e]" style={{ width: `${collectedShare}%` }} />
                )}
                {outstandingPaisa > 0 && (
                  <div className="bg-amber-500" style={{ width: `${dueShare}%` }} />
                )}
                {expensesPaisa > 0 && (
                  <div className="bg-rose-500" style={{ width: `${expenseShare}%` }} />
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-[var(--ink-secondary)]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#046c4e]" aria-hidden="true" />
                  {t(locale, "collectedRent")}:{" "}
                  <strong className="tabular-nums text-[var(--ink-primary)]">
                    {formatBdt(collectedPaisa, locale)}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                  {t(locale, "outstandingRent")}:{" "}
                  <strong className="tabular-nums text-[var(--ink-primary)]">
                    {formatBdt(outstandingPaisa, locale)}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
                  {t(locale, "monthlyExpenses")}:{" "}
                  <strong className="tabular-nums text-[var(--ink-primary)]">
                    {formatBdt(expensesPaisa, locale)}
                  </strong>
                </span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Occupancy Ring + 4 Direct Quick Actions */}
        <Card className="lg:col-span-5">
          <CardBody className="flex h-full flex-col justify-between gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                  <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
                    <circle
                      cx="28"
                      cy="28"
                      r={ringRadius}
                      fill="none"
                      stroke="#ebeeea"
                      strokeWidth="5"
                    />
                    <circle
                      cx="28"
                      cy="28"
                      r={ringRadius}
                      fill="none"
                      stroke="#046c4e"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringDashOffset}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <span className="tabular-nums absolute text-xs font-extrabold text-[var(--ink-primary)]">
                    {occPct}%
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--ink-muted)]">
                    {t(locale, "occupancy")}
                  </p>
                  <p className="tabular-nums text-base font-bold text-[var(--ink-primary)]">
                    {s?.occupied_units ?? 0}/{s?.total_units ?? 0}{" "}
                    <span className="text-xs font-medium text-[var(--ink-muted)]">
                      {locale === "bn" ? "টি ফ্ল্যাট" : "units"}
                    </span>
                  </p>
                  <p className="text-[11px] text-[var(--ink-muted)]">
                    {locale === "bn"
                      ? `${s?.total_properties ?? 0}টি বাড়ি সক্রিয়`
                      : `${s?.total_properties ?? 0} active properties`}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("properties")}>
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>

            {/* 4 Direct Functional Quick Actions (Add Expense opens Expenses sub-tab directly!) */}
            <div className="grid grid-cols-2 gap-2 border-t border-[var(--border-subtle)] pt-3.5">
              <QuickActionButton
                icon={<Wallet className="h-4 w-4 text-[#046c4e]" aria-hidden="true" />}
                label={t(locale, "quickTakeRent")}
                onClick={() => onNavigate("finance", { financeSubTab: "bills" })}
              />
              <QuickActionButton
                icon={<Receipt className="h-4 w-4 text-rose-700" aria-hidden="true" />}
                label={t(locale, "quickExpense")}
                onClick={() => onNavigate("finance", { financeSubTab: "expenses" })}
              />
              <QuickActionButton
                icon={<Users className="h-4 w-4 text-blue-700" aria-hidden="true" />}
                label={t(locale, "quickTenant")}
                onClick={() => onNavigate("tenants")}
              />
              <QuickActionButton
                icon={<Wrench className="h-4 w-4 text-amber-700" aria-hidden="true" />}
                label={t(locale, "quickMaintenance")}
                onClick={() => onNavigate("maintenance")}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Actionable Operations Grid: Pending Dues + Recent Collections & Repairs */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Pending Rent Dues */}
        <Card className="lg:col-span-7">
          <CardHeader
            title={t(locale, "overdueList")}
            badge={
              <Badge tone={(data?.overdue_obligations ?? []).length > 0 ? "amber" : "emerald"}>
                <span className="tabular-nums">{(data?.overdue_obligations ?? []).length}</span>
              </Badge>
            }
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate("finance", { financeSubTab: "bills" })}
              >
                <span>{locale === "bn" ? "সব বিল" : "All Bills"}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            }
          />
          <div className="divide-y divide-[var(--border-subtle)]">
            {(data?.overdue_obligations ?? []).length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<CheckCircle2 className="h-5 w-5 text-[#046c4e]" aria-hidden="true" />}
                  title={locale === "bn" ? "কোনো বকেয়া ভাড়া নেই" : "No pending rent dues"}
                  description={
                    locale === "bn"
                      ? "বর্তমান সময়ের সকল ভাড়ার বিল পরিশোধিত রয়েছে।"
                      : "All current monthly rent obligations have been settled."
                  }
                />
              </div>
            ) : (
              data?.overdue_obligations.map((o) => (
                <div
                  key={o.obligation_id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--bg-hover)] sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-bold text-[var(--ink-primary)]">
                        {o.tenant_name}
                      </p>
                      <Badge tone="neutral">
                        {locale === "bn" ? `ফ্ল্যাট ${o.unit_code}` : `Unit ${o.unit_code}`}
                      </Badge>
                    </div>
                    <p className="tabular-nums mt-0.5 text-xs text-[var(--ink-muted)]">
                      <strong className="font-bold text-amber-800">
                        {formatBdt(o.outstanding_paisa, locale)}
                      </strong>{" "}
                      · {formatBillingMonth(o.billing_month, locale)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <a
                      href={`tel:${o.tenant_phone}`}
                      aria-label={
                        locale === "bn" ? `${o.tenant_name}-কে কল করুন` : `Call ${o.tenant_name}`
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-default)] bg-white text-[var(--ink-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onNavigate("finance", { financeSubTab: "bills" })}
                    >
                      {t(locale, "recordPayment")}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        onOpenSms({
                          tenantId: o.tenant_id,
                          tenantName: o.tenant_name,
                          phoneE164: o.tenant_phone,
                          templateType: "rent_reminder",
                          initialMessage:
                            locale === "bn"
                              ? `আসসালামু আলাইকুম ${o.tenant_name} (ফ্ল্যাট ${o.unit_code}), ${o.billing_month.slice(0, 7)} মাসের বকেয়া ভাড়া ${formatBdt(o.outstanding_paisa, "bn")}। অনুগ্রহ করে দ্রুত পরিশোধ করবেন। ধন্যবাদ।`
                              : `Hello ${o.tenant_name} (Unit ${o.unit_code}), your outstanding rent for ${o.billing_month.slice(0, 7)} is ${formatBdt(o.outstanding_paisa, "en")}. Please settle at your convenience.`
                        })
                      }
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">{t(locale, "sendReminder")}</span>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Recent Collections + Open Maintenance */}
        <div className="space-y-5 lg:col-span-5">
          <Card>
            <CardHeader
              title={t(locale, "recentPayments")}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate("finance", { financeSubTab: "payments" })}
                >
                  <span>{locale === "bn" ? "সব দেখুন" : "View all"}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              }
            />
            <div className="divide-y divide-[var(--border-subtle)]">
              {(data?.recent_payments ?? []).length === 0 ? (
                <p className="px-5 py-7 text-center text-xs text-[var(--ink-muted)]">
                  {t(locale, "noData")}
                </p>
              ) : (
                data?.recent_payments.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 px-4 py-3 text-sm sm:px-5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-bold text-[var(--ink-primary)] sm:text-[13px]">
                          {p.tenants?.full_name ?? (locale === "bn" ? "ভাড়াটিয়া" : "Tenant")}
                        </p>
                        {p.is_reversal && (
                          <Badge tone="rose">{locale === "bn" ? "সংশোধন" : "Reversal"}</Badge>
                        )}
                      </div>
                      <p className="tabular-nums mt-0.5 text-[11px] text-[var(--ink-muted)]">
                        {formatPaymentMethodLabel(p.payment_method, locale)} ·{" "}
                        {formatDhakaDate(p.paid_at, locale)}
                      </p>
                    </div>
                    <span
                      className={`tabular-nums shrink-0 text-sm font-bold ${
                        p.is_reversal ? "text-rose-700" : "text-[#046c4e]"
                      }`}
                    >
                      {formatBdt(p.amount_paisa, locale)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title={t(locale, "openMaintenance")}
              badge={
                <Badge tone={(s?.open_maintenance_count ?? 0) > 0 ? "amber" : "neutral"}>
                  <span className="tabular-nums">{s?.open_maintenance_count ?? 0}</span>
                </Badge>
              }
              action={
                <Button variant="ghost" size="sm" onClick={() => onNavigate("maintenance")}>
                  <span>{locale === "bn" ? "পরিচালনা" : "Manage"}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              }
            />
            <div className="divide-y divide-[var(--border-subtle)]">
              {(data?.open_maintenance ?? []).length === 0 ? (
                <p className="px-5 py-6 text-center text-xs text-[var(--ink-muted)]">
                  {t(locale, "noData")}
                </p>
              ) : (
                (data?.open_maintenance ?? []).slice(0, 4).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 px-4 py-3 text-xs sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--ink-primary)]">{m.title}</p>
                      {m.units?.unit_code && (
                        <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
                          {locale === "bn"
                            ? `ফ্ল্যাট ${m.units.unit_code}`
                            : `Unit ${m.units.unit_code}`}
                        </p>
                      )}
                    </div>
                    <Badge
                      tone={
                        m.priority === "urgent" || m.priority === "high"
                          ? "rose"
                          : m.priority === "medium"
                            ? "amber"
                            : "neutral"
                      }
                    >
                      {m.priority.toUpperCase()}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({
  icon,
  label,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-rail)] px-3 py-2 text-left text-xs font-semibold text-[var(--ink-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-white active:scale-[0.98]"
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function KpiTile({
  label,
  value,
  meta,
  icon,
  accent = "neutral"
}: {
  label: string;
  value: string;
  meta: string;
  icon: React.ReactNode;
  accent?: "neutral" | "emerald" | "amber" | "rose";
}) {
  const valueClass =
    accent === "emerald"
      ? "text-[#046c4e]"
      : accent === "amber"
        ? "text-amber-800"
        : accent === "rose"
          ? "text-rose-700"
          : "text-[var(--ink-primary)]";

  return (
    <div className="surface-card rounded-xl p-4 transition-colors hover:border-[var(--border-strong)]">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-[var(--ink-muted)]">{label}</span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-subtle)]">
          {icon}
        </span>
      </div>
      <p className={`tabular-nums mt-2 text-xl font-extrabold tracking-tight sm:text-2xl ${valueClass}`}>
        {value}
      </p>
      <p className="tabular-nums mt-1 truncate text-[11px] font-medium text-[var(--ink-muted)]">
        {meta}
      </p>
    </div>
  );
}
