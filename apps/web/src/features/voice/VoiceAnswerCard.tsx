import { formatBdt } from "@rentready/shared/money";
import { AlertCircle, CheckCircle2, Info, Receipt, Wallet, X } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { formatBillingMonth, formatDhakaDate, formatPaymentMethodLabel } from "../../lib/format";
import type { Locale } from "../../lib/i18n";

interface OutstandingItem {
  obligation_id: string;
  unit_code: string;
  property_name?: string;
  tenant_name: string;
  billing_month: string;
  amount_due_paisa: number;
  allocated_paisa: number;
  outstanding_paisa: number;
  derived_status: string;
}

interface SummaryData {
  total_units?: number;
  occupied_units?: number;
  expected_rent_paisa?: number;
  collected_rent_paisa?: number;
  total_outstanding_paisa?: number;
  monthly_expenses_paisa?: number;
  net_operating_result_paisa?: number;
  open_maintenance_count?: number;
}

interface PaymentItem {
  id: string;
  amount_paisa: number;
  payment_method: string;
  paid_at: string;
  is_reversal?: boolean;
  notes?: string | null;
}

export function VoiceAnswerCard({
  intent,
  data,
  reason,
  locale,
  onClose
}: {
  intent: string;
  data?: unknown;
  reason?: string;
  locale: Locale;
  onClose: () => void;
}) {
  if (intent === "unknown") {
    return (
      <div className="animate-scale-in mt-4 rounded-xl border border-amber-200 bg-white p-4 text-left text-[var(--ink-primary)] shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-amber-800">
            <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-xs font-bold">
              {locale === "bn"
                ? "নির্দেশনাটি পরিষ্কারভাবে বোঝা যায়নি"
                : "Could not understand command"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={locale === "bn" ? "বন্ধ করুন" : "Dismiss"}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
          {reason ||
            (locale === "bn"
              ? "অনুগ্রহ করে ফ্ল্যাট নম্বর বা ভাড়াটিয়ার নাম এবং টাকার পরিমাণ স্পষ্টভাবে বলুন।"
              : "Please specify the unit or tenant name and amount clearly.")}
        </p>
      </div>
    );
  }

  if (intent === "get_outstanding_rent") {
    const items = (Array.isArray(data) ? data : []) as OutstandingItem[];
    const totalPaisa = items.reduce((sum, item) => sum + Number(item.outstanding_paisa ?? 0), 0);

    return (
      <div className="animate-scale-in mt-4 rounded-xl border border-[var(--border-default)] bg-white p-4 text-left text-[var(--ink-primary)] shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                items.length === 0
                  ? "bg-emerald-50 text-[#046c4e]"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {items.length === 0 ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[var(--ink-muted)]">
                {locale === "bn" ? "বকেয়া ভাড়ার হিসাব" : "Outstanding Rent Summary"}
              </p>
              <p className="tabular-nums text-sm font-bold text-[var(--ink-primary)]">
                {items.length === 0
                  ? locale === "bn"
                    ? "অভিনন্দন! এই মুহূর্তে কোনো ভাড়া বাকি নেই।"
                    : "All clear — there is no outstanding rent right now."
                  : locale === "bn"
                    ? `মোট ${items.length} জনের কাছে ${formatBdt(totalPaisa, "bn")} ভাড়া বাকি আছে।`
                    : `Total ${formatBdt(totalPaisa, "en")} due across ${items.length} unit(s).`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={locale === "bn" ? "বন্ধ করুন" : "Dismiss"}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {items.length > 0 && (
          <div className="mt-3 divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-rail)] px-3">
            {items.map((item) => (
              <div key={item.obligation_id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-bold text-[var(--ink-primary)]">
                      {item.tenant_name}
                    </p>
                    <Badge tone="neutral">
                      {locale === "bn" ? `ফ্ল্যাট ${item.unit_code}` : `Unit ${item.unit_code}`}
                    </Badge>
                  </div>
                  <p className="tabular-nums mt-0.5 text-[11px] text-[var(--ink-muted)]">
                    {formatBillingMonth(item.billing_month, locale)} ·{" "}
                    {locale === "bn"
                      ? `পরিশোধিত ${formatBdt(item.allocated_paisa, "bn")} / ${formatBdt(item.amount_due_paisa, "bn")}`
                      : `Paid ${formatBdt(item.allocated_paisa, "en")} of ${formatBdt(item.amount_due_paisa, "en")}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular-nums text-sm font-bold text-amber-800">
                    {formatBdt(item.outstanding_paisa, locale)}
                  </p>
                  <Badge tone={item.derived_status === "partial" ? "amber" : "rose"}>
                    {item.derived_status === "partial"
                      ? locale === "bn"
                        ? "আংশিক"
                        : "Partial"
                      : locale === "bn"
                        ? "বকেয়া"
                        : "Unpaid"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (intent === "get_monthly_collection" || intent === "get_property_summary") {
    const s = (data ?? {}) as SummaryData;
    const expected = Number(s.expected_rent_paisa ?? 0);
    const collected = Number(s.collected_rent_paisa ?? 0);
    const outstanding = Number(s.total_outstanding_paisa ?? 0);
    const expenses = Number(s.monthly_expenses_paisa ?? 0);
    const net = Number(s.net_operating_result_paisa ?? 0);

    return (
      <div className="animate-scale-in mt-4 rounded-xl border border-[var(--border-default)] bg-white p-4 text-left text-[var(--ink-primary)] shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#046c4e]">
              <Wallet className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[var(--ink-muted)]">
                {locale === "bn" ? "মাসিক আয় ও সম্পত্তির সারাংশ" : "Monthly Collection & Summary"}
              </p>
              <p className="tabular-nums text-sm font-bold text-[var(--ink-primary)]">
                {locale === "bn"
                  ? `মোট প্রত্যাশিত ${formatBdt(expected, "bn")}-এর মধ্যে ${formatBdt(collected, "bn")} আদায় হয়েছে।`
                  : `Collected ${formatBdt(collected, "en")} out of ${formatBdt(expected, "en")} expected.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={locale === "bn" ? "বন্ধ করুন" : "Dismiss"}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/70 p-2.5">
            <p className="text-[11px] font-semibold text-emerald-900">
              {locale === "bn" ? "আদায়" : "Collected"}
            </p>
            <p className="tabular-nums mt-0.5 text-xs font-bold text-[#046c4e] sm:text-sm">
              {formatBdt(collected, locale)}
            </p>
          </div>
          <div className="rounded-lg border border-amber-200/70 bg-amber-50/70 p-2.5">
            <p className="text-[11px] font-semibold text-amber-900">
              {locale === "bn" ? "বকেয়া" : "Outstanding"}
            </p>
            <p className="tabular-nums mt-0.5 text-xs font-bold text-amber-800 sm:text-sm">
              {formatBdt(outstanding, locale)}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-rail)] p-2.5">
            <p className="text-[11px] font-semibold text-[var(--ink-secondary)]">
              {locale === "bn" ? "নিট আয়" : "Net Income"}
            </p>
            <p className="tabular-nums mt-0.5 text-xs font-bold text-[var(--ink-primary)] sm:text-sm">
              {formatBdt(net, locale)}
            </p>
          </div>
        </div>
        <p className="tabular-nums mt-2.5 text-[11px] text-[var(--ink-muted)]">
          {locale === "bn"
            ? `দখলকৃত ফ্ল্যাট: ${s.occupied_units ?? 0}/${s.total_units ?? 0} · মাসিক খরচ: ${formatBdt(expenses, "bn")} · চলমান মেরামত: ${s.open_maintenance_count ?? 0}`
            : `Occupied Units: ${s.occupied_units ?? 0}/${s.total_units ?? 0} · Expenses: ${formatBdt(expenses, "en")} · Open Repairs: ${s.open_maintenance_count ?? 0}`}
        </p>
      </div>
    );
  }

  if (intent === "get_payment_history") {
    const items = (Array.isArray(data) ? data : []) as PaymentItem[];
    return (
      <div className="animate-scale-in mt-4 rounded-xl border border-[var(--border-default)] bg-white p-4 text-left text-[var(--ink-primary)] shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#046c4e]">
              <Receipt className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[var(--ink-muted)]">
                {locale === "bn" ? "পেমেন্ট ইতিহাস" : "Payment History"}
              </p>
              <p className="text-sm font-bold text-[var(--ink-primary)]">
                {items.length === 0
                  ? locale === "bn"
                    ? "কোনো পেমেন্ট রেকর্ড পাওয়া যায়নি।"
                    : "No payment records found."
                  : locale === "bn"
                    ? `সাম্প্রতিক ${items.length}টি পেমেন্ট পাওয়া গেছে।`
                    : `Found ${items.length} recent payment record(s).`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={locale === "bn" ? "বন্ধ করুন" : "Dismiss"}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {items.length > 0 && (
          <div className="mt-3 divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-rail)] px-3">
            {items.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[var(--ink-primary)]">
                      {formatPaymentMethodLabel(p.payment_method, locale)}
                    </span>
                    {p.is_reversal && (
                      <Badge tone="rose">{locale === "bn" ? "সংশোধন" : "Reversal"}</Badge>
                    )}
                  </div>
                  <p className="tabular-nums mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">
                    {formatDhakaDate(p.paid_at, locale)} {p.notes ? `· ${p.notes}` : ""}
                  </p>
                </div>
                <span
                  className={`tabular-nums shrink-0 font-bold ${
                    p.is_reversal ? "text-rose-700" : "text-[#046c4e]"
                  }`}
                >
                  {formatBdt(p.amount_paisa, locale)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}
