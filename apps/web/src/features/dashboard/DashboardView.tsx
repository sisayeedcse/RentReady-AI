import { formatBdt } from "@rentready/shared";
import {
  AlertCircle,
  Building2,
  Send,
  TrendingDown,
  TrendingUp,
  Wallet,
  Wrench
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { type Locale, t } from "../../lib/i18n";
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
  onOpenSms
}: {
  accessToken: string;
  locale: Locale;
  onOpenSms: (draft: SmsDraft) => void;
}) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await apiFetch<DashboardResponse>("/api/dashboard", accessToken);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const s = data?.summary;
  const occPct = s && s.total_units > 0 ? Math.round((s.occupied_units / s.total_units) * 100) : 0;
  const collectedPct =
    s && s.expected_rent_paisa > 0
      ? Math.min(100, Math.round((s.collected_rent_paisa / s.expected_rent_paisa) * 100))
      : 0;

  return (
    <div className="space-y-5">
      {/* MOBILE-FIRST LAUNCH HERO: BIG VOICE MIC BUTTON */}
      <HeroVoiceLauncher
        accessToken={accessToken}
        locale={locale}
        onActionExecuted={() => void load()}
      />

      {error && (
        <div className="animate-scale-in rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Monthly Collection Progress Bar */}
      <div className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-600">
            {locale === "bn" ? "চলতি মাসের ভাড়া আদায়ের হার" : "Monthly Rent Collection Progress"}
          </span>
          <span className="font-bold text-emerald-700">{collectedPct}%</span>
        </div>
        <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700 ease-out"
            style={{ width: `${collectedPct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            {t(locale, "collectedRent")}:{" "}
            <strong className="text-emerald-700">
              {formatBdt(s?.collected_rent_paisa ?? 0, locale)}
            </strong>
          </span>
          <span>
            {t(locale, "expectedRent")}:{" "}
            <strong className="text-slate-800">
              {formatBdt(s?.expected_rent_paisa ?? 0, locale)}
            </strong>
          </span>
        </div>
      </div>

      {/* KPI Grid (Skeleton while loading) */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-24 animate-pulse rounded-2xl border border-slate-200/70 bg-white p-4"
            >
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="mt-4 h-6 w-28 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KpiCard
            label={t(locale, "expectedRent")}
            value={formatBdt(s?.expected_rent_paisa ?? 0, locale)}
            icon={<Wallet className="h-4 w-4 text-slate-500" />}
          />
          <KpiCard
            label={t(locale, "collectedRent")}
            value={formatBdt(s?.collected_rent_paisa ?? 0, locale)}
            accent="emerald"
            icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
          />
          <KpiCard
            label={t(locale, "outstandingRent")}
            value={formatBdt(s?.total_outstanding_paisa ?? 0, locale)}
            accent={(s?.total_outstanding_paisa ?? 0) > 0 ? "amber" : "slate"}
            icon={<AlertCircle className="h-4 w-4 text-amber-600" />}
          />
          <KpiCard
            label={t(locale, "monthlyExpenses")}
            value={formatBdt(s?.monthly_expenses_paisa ?? 0, locale)}
            icon={<TrendingDown className="h-4 w-4 text-rose-500" />}
          />
          <KpiCard
            label={t(locale, "netResult")}
            value={formatBdt(s?.net_operating_result_paisa ?? 0, locale)}
            accent="emerald"
            icon={<Wallet className="h-4 w-4 text-emerald-700" />}
          />
          <KpiCard
            label={t(locale, "occupancy")}
            value={`${s?.occupied_units ?? 0}/${s?.total_units ?? 0} (${occPct}%)`}
            icon={<Building2 className="h-4 w-4 text-slate-500" />}
          />
        </div>
      )}

      {/* Overdue & Activity Cards */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">{t(locale, "overdueList")}</h3>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
              {(data?.overdue_obligations ?? []).length}
            </span>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {(data?.overdue_obligations ?? []).length === 0 ? (
              <p className="py-5 text-center text-xs text-slate-500">{t(locale, "noData")}</p>
            ) : (
              data?.overdue_obligations.map((o) => (
                <div
                  key={o.obligation_id}
                  className="flex items-center justify-between gap-2 py-3 transition hover:bg-slate-50/70"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {o.tenant_name}{" "}
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {o.unit_code}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-amber-700">
                      {o.billing_month.slice(0, 7)} • {formatBdt(o.outstanding_paisa, locale)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenSms({
                        tenantId: o.tenant_id,
                        tenantName: o.tenant_name,
                        phoneE164: o.tenant_phone,
                        templateType: "rent_reminder",
                        initialMessage:
                          locale === "bn"
                            ? `RentReady রিমাইন্ডার: প্রিয় ${o.tenant_name} (ফ্ল্যাট ${o.unit_code}), ${o.billing_month.slice(0, 7)} এর বকেয়া ভাড়া ${formatBdt(o.outstanding_paisa, "bn")}। অনুগ্রহ করে দ্রুত পরিশোধ করুন।`
                            : `RentReady Reminder: Dear ${o.tenant_name} (Unit ${o.unit_code}), your outstanding rent for ${o.billing_month.slice(0, 7)} is ${formatBdt(o.outstanding_paisa, "en")}.`
                      })
                    }
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 active:scale-95"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {t(locale, "sendReminder")}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900">{t(locale, "recentPayments")}</h3>
          <div className="mt-3 divide-y divide-slate-100">
            {(data?.recent_payments ?? []).length === 0 ? (
              <p className="py-5 text-center text-xs text-slate-500">{t(locale, "noData")}</p>
            ) : (
              data?.recent_payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {p.tenants?.full_name ?? "Tenant"}{" "}
                      {p.is_reversal && (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                          REVERSAL
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {p.payment_method.toUpperCase()} • {new Date(p.paid_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`font-bold ${p.is_reversal ? "text-rose-600" : "text-emerald-700"}`}
                  >
                    {formatBdt(p.amount_paisa, locale)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Wrench className="h-3.5 w-3.5 text-emerald-600" />
              {t(locale, "openMaintenance")} ({s?.open_maintenance_count ?? 0})
            </h4>
            <div className="mt-2 space-y-1.5">
              {(data?.open_maintenance ?? []).slice(0, 4).map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs text-slate-600">
                  <span className="truncate">
                    {m.title} {m.units?.unit_code ? `(${m.units.unit_code})` : ""}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase">
                    {m.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent = "slate"
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: "slate" | "emerald" | "amber";
}) {
  const valueClass =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "amber"
        ? "text-amber-700"
        : "text-slate-900";
  return (
    <div className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
        <span className="truncate">{label}</span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50">
          {icon}
        </span>
      </div>
      <p className={`mt-2 text-lg font-extrabold tracking-tight sm:text-2xl ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}
