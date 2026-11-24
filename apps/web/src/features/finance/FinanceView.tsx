import { getDhakaDateString } from "@rentready/shared/date";
import {
  addPaisa,
  bdtToPaisa,
  formatBdt,
  paisaToBdtString
} from "@rentready/shared/money";
import {
  ArrowUpDown,
  CalendarPlus,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  Wallet
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import {
  AlertBanner,
  EmptyState,
  PageHeader,
  SearchInput,
  SkeletonRows
} from "../../components/ui/States";
import { FilterPills, SegmentedTabs } from "../../components/ui/Tabs";
import { apiFetch, generateIdempotencyKey } from "../../lib/api";
import {
  formatBillingMonth,
  formatDhakaDateTime,
  formatPaymentMethodLabel
} from "../../lib/format";
import { toFriendlyError } from "../../lib/friendlyError";
import { type Locale, t } from "../../lib/i18n";
import type { SmsDraft } from "../notifications/SmsModal";

export type FinanceSubTab = "bills" | "payments" | "expenses";

interface ObligationRow {
  obligation_id: string;
  tenancy_id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_phone: string;
  unit_code: string;
  billing_month: string;
  amount_due_paisa: number;
  allocated_paisa: number;
  outstanding_paisa: number;
  derived_status: string;
}

interface PaymentRow {
  id: string;
  amount_paisa: number;
  payment_method: string;
  paid_at: string;
  is_reversal: boolean;
  notes: string | null;
  tenant_id: string;
  tenants: { full_name: string; phone_e164: string } | null;
  tenancies: { units: { unit_code: string } | null } | null;
}

interface ExpenseRow {
  id: string;
  category_name: string;
  amount_paisa: number;
  incurred_on: string;
  description: string;
  properties: { name: string } | null;
}

const EXPENSE_PRESETS = {
  bn: [
    "প্লাম্বিং ও ইলেকট্রিক্যাল মেরামত",
    "বিদ্যুৎ ও গ্যাস বিল",
    "কেয়ারটেকার ও নিরাপত্তা",
    "পরিষ্কার-পরিচ্ছন্নতা"
  ],
  en: [
    "Plumbing & Electrical Repair",
    "Utilities & Generator",
    "Caretaker & Security",
    "Cleaning & Upkeep"
  ]
} as const;

export function FinanceView({
  accessToken,
  locale,
  initialSubTab = "bills",
  onOpenSms,
  onToast
}: {
  accessToken: string;
  locale: Locale;
  initialSubTab?: FinanceSubTab;
  onOpenSms: (draft: SmsDraft) => void;
  onToast?: (msg: string) => void;
}) {
  const [subTab, setSubTab] = useState<FinanceSubTab>(initialSubTab);
  const [billFilter, setBillFilter] = useState<"all" | "unpaid" | "partial" | "paid">("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [billSearch, setBillSearch] = useState("");
  const [billSort, setBillSort] = useState<"due_desc" | "unit_asc" | "month_desc">("due_desc");
  const [payMethodFilter, setPayMethodFilter] = useState<string>("all");
  const [paySearch, setPaySearch] = useState("");
  const [expSearch, setExpSearch] = useState("");
  const [, startTransition] = useTransition();

  const [obligations, setObligations] = useState<ObligationRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingBills, setGeneratingBills] = useState(false);

  // Payment Modal state
  const [selectedObl, setSelectedObl] = useState<ObligationRow | null>(null);
  const [payAmountBdt, setPayAmountBdt] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "bkash" | "nagad" | "bank" | "other">("bkash");
  const [submittingPay, setSubmittingPay] = useState(false);

  // Reversal Modal state
  const [reversingPayment, setReversingPayment] = useState<PaymentRow | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [submittingRev, setSubmittingRev] = useState(false);

  // Expense Form state
  const [expPropId, setExpPropId] = useState("");
  const [expCategory, setExpCategory] = useState<string>(EXPENSE_PRESETS[locale][0]);
  const [expAmountBdt, setExpAmountBdt] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [savingExp, setSavingExp] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isManual = false) => {
      try {
        if (isManual) setRefreshing(true);
        setError(null);
        const [oRes, pRes, eRes, propRes] = await Promise.all([
          apiFetch<{ data: ObligationRow[] }>("/api/obligations", accessToken),
          apiFetch<{ data: PaymentRow[] }>("/api/payments", accessToken),
          apiFetch<{ data: ExpenseRow[] }>("/api/expenses", accessToken),
          apiFetch<{ data: Array<{ id: string; name: string }> }>("/api/properties", accessToken)
        ]);
        setObligations(oRes.data);
        setPayments(pRes.data);
        setExpenses(eRes.data);
        setProperties(propRes.data);
        const firstPropId = propRes.data[0]?.id ?? "";
        if (firstPropId) {
          setExpPropId((prev) => prev || firstPropId);
        }
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

  async function generateBills() {
    setGeneratingBills(true);
    setError(null);
    try {
      const res = await apiFetch<{ billing_month: string; generated_count: number }>(
        "/api/obligations/generate",
        accessToken,
        { method: "POST", body: JSON.stringify({}) }
      );
      onToast?.(
        locale === "bn"
          ? `${res.generated_count}টি নতুন মাসের বিল তৈরি হয়েছে।`
          : `Generated ${res.generated_count} monthly rent bill(s).`
      );
      await load();
    } catch (err) {
      setError(toFriendlyError(err, locale));
    } finally {
      setGeneratingBills(false);
    }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedObl) return;
    setSubmittingPay(true);
    setError(null);
    try {
      const amountPaisa = bdtToPaisa(payAmountBdt);
      await apiFetch("/api/payments", accessToken, {
        method: "POST",
        body: JSON.stringify({
          tenancy_id: selectedObl.tenancy_id,
          obligation_id: selectedObl.obligation_id,
          amount_paisa: amountPaisa,
          payment_method: payMethod,
          idempotency_key: generateIdempotencyKey("pay")
        })
      });
      const remainingAfter = Math.max(0, selectedObl.outstanding_paisa - amountPaisa);
      const oblSnap = selectedObl;
      setSelectedObl(null);
      setPayAmountBdt("");
      onToast?.(locale === "bn" ? "ভাড়া সফলভাবে জমা হয়েছে!" : "Rent payment recorded!");
      await load();

      onOpenSms({
        tenantId: oblSnap.tenant_id,
        tenantName: oblSnap.tenant_name,
        phoneE164: oblSnap.tenant_phone,
        templateType: "payment_receipt",
        initialMessage:
          locale === "bn"
            ? `RentReady রসিদ: ${oblSnap.tenant_name} (ফ্ল্যাট ${oblSnap.unit_code}), ${oblSnap.billing_month.slice(0, 7)} এর ভাড়া বাবদ ${formatBdt(amountPaisa, "bn")} (${payMethod}) গৃহীত হয়েছে। বকেয়া: ${formatBdt(remainingAfter, "bn")}। ধন্যবাদ।`
            : `RentReady Receipt: ${formatBdt(amountPaisa, "en")} (${payMethod}) received from ${oblSnap.tenant_name} (Unit ${oblSnap.unit_code}) for ${oblSnap.billing_month.slice(0, 7)}. Remaining due: ${formatBdt(remainingAfter, "en")}.`
      });
    } catch (err) {
      setError(toFriendlyError(err, locale));
    } finally {
      setSubmittingPay(false);
    }
  }

  async function submitReversal(e: React.FormEvent) {
    e.preventDefault();
    if (!reversingPayment || reversalReason.trim().length < 3) return;
    setSubmittingRev(true);
    setError(null);
    try {
      await apiFetch(`/api/payments/${reversingPayment.id}/reverse`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          reason: reversalReason.trim(),
          idempotency_key: generateIdempotencyKey("rev")
        })
      });
      setReversingPayment(null);
      setReversalReason("");
      onToast?.(
        locale === "bn"
          ? "পেমেন্ট সংশোধন (রিভার্স) হয়েছে এবং বকেয়া আপডেট হয়েছে।"
          : "Payment reversed and balance restored."
      );
      await load();
    } catch (err) {
      setError(toFriendlyError(err, locale));
    } finally {
      setSubmittingRev(false);
    }
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setSavingExp(true);
    setError(null);
    try {
      await apiFetch("/api/expenses", accessToken, {
        method: "POST",
        body: JSON.stringify({
          property_id: expPropId,
          category_name: expCategory,
          amount_paisa: bdtToPaisa(expAmountBdt),
          incurred_on: getDhakaDateString(),
          description: expDesc,
          idempotency_key: generateIdempotencyKey("exp")
        })
      });
      setExpAmountBdt("");
      setExpDesc("");
      onToast?.(locale === "bn" ? "খরচ খাতায় যুক্ত হয়েছে!" : "Expense saved!");
      await load();
    } catch (err) {
      setError(toFriendlyError(err, locale));
    } finally {
      setSavingExp(false);
    }
  }

  const availableMonths = useMemo(() => {
    const unique = Array.from(new Set(obligations.map((o) => o.billing_month.slice(0, 7))));
    return unique.sort((a, b) => b.localeCompare(a));
  }, [obligations]);

  const billCounts = useMemo(
    () => ({
      all: obligations.length,
      unpaid: obligations.filter((o) => o.derived_status === "unpaid").length,
      partial: obligations.filter((o) => o.derived_status === "partial").length,
      paid: obligations.filter((o) => o.derived_status === "paid").length
    }),
    [obligations]
  );

  const filteredBills = useMemo(() => {
    const q = billSearch.trim().toLowerCase();
    const list = obligations.filter((o) => {
      if (billFilter !== "all" && o.derived_status !== billFilter) return false;
      if (monthFilter !== "all" && !o.billing_month.startsWith(monthFilter)) return false;
      if (!q) return true;
      return (
        o.tenant_name.toLowerCase().includes(q) ||
        o.unit_code.toLowerCase().includes(q) ||
        o.billing_month.includes(q)
      );
    });
    return [...list].sort((a, b) => {
      if (billSort === "unit_asc") return a.unit_code.localeCompare(b.unit_code);
      if (billSort === "month_desc") return b.billing_month.localeCompare(a.billing_month);
      return b.outstanding_paisa - a.outstanding_paisa;
    });
  }, [obligations, billFilter, monthFilter, billSearch, billSort]);

  const billTotals = useMemo(() => {
    let due = 0;
    let collected = 0;
    let outstanding = 0;
    for (const o of filteredBills) {
      due = addPaisa(due, o.amount_due_paisa);
      collected = addPaisa(collected, o.allocated_paisa);
      outstanding = addPaisa(outstanding, o.outstanding_paisa);
    }
    return { due, collected, outstanding };
  }, [filteredBills]);

  const filteredPayments = useMemo(() => {
    const q = paySearch.trim().toLowerCase();
    return payments.filter((p) => {
      if (payMethodFilter !== "all" && p.payment_method !== payMethodFilter) return false;
      if (!q) return true;
      return (
        (p.tenants?.full_name ?? "").toLowerCase().includes(q) ||
        (p.tenancies?.units?.unit_code ?? "").toLowerCase().includes(q) ||
        (p.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [payments, payMethodFilter, paySearch]);

  const filteredExpenses = useMemo(() => {
    const q = expSearch.trim().toLowerCase();
    return expenses.filter((ex) => {
      if (!q) return true;
      return (
        ex.description.toLowerCase().includes(q) ||
        ex.category_name.toLowerCase().includes(q) ||
        (ex.properties?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [expenses, expSearch]);

  const totalExpensesPaisa = useMemo(() => {
    let total = 0;
    for (const ex of filteredExpenses) {
      total = addPaisa(total, ex.amount_paisa);
    }
    return total;
  }, [filteredExpenses]);

  const statusMeta = (status: string): { tone: "emerald" | "amber" | "rose"; label: string } => {
    if (status === "paid") return { tone: "emerald", label: t(locale, "paid") };
    if (status === "partial") return { tone: "amber", label: t(locale, "partial") };
    return { tone: "rose", label: t(locale, "unpaid") };
  };

  // Exact integer live remaining calculation inside Payment modal
  const liveRemainingAfterPay = useMemo(() => {
    if (!selectedObl || !payAmountBdt.trim()) return null;
    try {
      const enteredPaisa = bdtToPaisa(payAmountBdt);
      if (enteredPaisa <= 0) return null;
      return Math.max(0, selectedObl.outstanding_paisa - enteredPaisa);
    } catch {
      return null;
    }
  }, [selectedObl, payAmountBdt]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={locale === "bn" ? "ভাড়া ও খরচের খাতা" : "Rent Ledger & Expenses"}
        subtitle={
          locale === "bn"
            ? "মাসিক বিল, অপরিবর্তনীয় পেমেন্ট লেজার এবং সম্পত্তির খরচ পরিচালনা করুন"
            : "Track monthly bills, immutable payment allocations, reversals, and expenses"
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              loading={refreshing}
              onClick={() => void load(true)}
            >
              {!refreshing && <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
              <span className="hidden sm:inline">{locale === "bn" ? "রিফ্রেশ" : "Refresh"}</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={generatingBills}
              onClick={() => void generateBills()}
            >
              {!generatingBills && <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />}
              {t(locale, "generateBills")}
            </Button>
          </>
        }
      />

      {/* Primary Segmented Sub-Navigation */}
      <SegmentedTabs
        ariaLabel={locale === "bn" ? "আর্থিক বিভাগ" : "Finance sections"}
        value={subTab}
        onChange={(next) => startTransition(() => setSubTab(next))}
        options={[
          {
            id: "bills",
            label: locale === "bn" ? "ভাড়ার বিল" : "Rent Bills",
            count: obligations.length
          },
          {
            id: "payments",
            label: locale === "bn" ? "পেমেন্ট খাতা" : "Payments",
            count: payments.length
          },
          {
            id: "expenses",
            label: locale === "bn" ? "বাড়ির খরচ" : "Expenses",
            count: expenses.length
          }
        ]}
      />

      {error && (
        <AlertBanner
          tone="error"
          message={error}
          onRetry={() => void load(true)}
          onDismiss={() => setError(null)}
        />
      )}

      {loading ? (
        <SkeletonRows count={5} />
      ) : (
        <>
          {/* SUB-TAB 1: MONTHLY RENT BILLS */}
          {subTab === "bills" && (
            <div className="space-y-4">
              {/* Filtered Ledger Totals Strip */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                <div className="surface-card rounded-xl px-3.5 py-3">
                  <p className="text-[11px] font-semibold text-[var(--ink-muted)]">
                    {t(locale, "expectedRent")}
                  </p>
                  <p className="tabular-nums mt-1 text-base font-bold text-[var(--ink-primary)] sm:text-lg">
                    {formatBdt(billTotals.due, locale)}
                  </p>
                </div>
                <div className="surface-card rounded-xl px-3.5 py-3">
                  <p className="text-[11px] font-semibold text-[var(--ink-muted)]">
                    {t(locale, "collectedRent")}
                  </p>
                  <p className="tabular-nums mt-1 text-base font-bold text-[#046c4e] sm:text-lg">
                    {formatBdt(billTotals.collected, locale)}
                  </p>
                </div>
                <div className="surface-card rounded-xl px-3.5 py-3">
                  <p className="text-[11px] font-semibold text-[var(--ink-muted)]">
                    {t(locale, "outstandingRent")}
                  </p>
                  <p
                    className={`tabular-nums mt-1 text-base font-bold sm:text-lg ${
                      billTotals.outstanding > 0 ? "text-amber-800" : "text-[#046c4e]"
                    }`}
                  >
                    {formatBdt(billTotals.outstanding, locale)}
                  </p>
                </div>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                <FilterPills
                  ariaLabel={locale === "bn" ? "বিলের অবস্থা ফিল্টার" : "Filter bills by status"}
                  value={billFilter}
                  onChange={(next) => startTransition(() => setBillFilter(next))}
                  options={[
                    { id: "all", label: t(locale, "all"), count: billCounts.all },
                    { id: "unpaid", label: t(locale, "unpaid"), count: billCounts.unpaid },
                    { id: "partial", label: t(locale, "partial"), count: billCounts.partial },
                    { id: "paid", label: t(locale, "paid"), count: billCounts.paid }
                  ]}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <SearchInput
                    value={billSearch}
                    onChange={(v) => startTransition(() => setBillSearch(v))}
                    placeholder={
                      locale === "bn" ? "নাম বা ফ্ল্যাট খুঁজুন..." : "Search tenant or unit..."
                    }
                    ariaLabel={locale === "bn" ? "ভাড়ার বিল খুঁজুন" : "Search rent bills"}
                    className="min-w-[180px] flex-1 sm:w-52 sm:flex-initial"
                  />
                  {availableMonths.length > 1 && (
                    <Select
                      aria-label={locale === "bn" ? "মাস বাছাই করুন" : "Filter by billing month"}
                      value={monthFilter}
                      onChange={(e) => setMonthFilter(e.target.value)}
                      className="min-h-9! w-auto! text-xs!"
                    >
                      <option value="all">{locale === "bn" ? "সব মাস" : "All months"}</option>
                      {availableMonths.map((m) => (
                        <option key={m} value={m}>
                          {formatBillingMonth(m, locale)}
                        </option>
                      ))}
                    </Select>
                  )}
                  <Select
                    aria-label={locale === "bn" ? "সাজান" : "Sort bills"}
                    value={billSort}
                    onChange={(e) => setBillSort(e.target.value as typeof billSort)}
                    className="min-h-9! w-auto! text-xs!"
                  >
                    <option value="due_desc">
                      {locale === "bn" ? "সর্বোচ্চ বকেয়া আগে" : "Highest due first"}
                    </option>
                    <option value="unit_asc">
                      {locale === "bn" ? "ফ্ল্যাট নম্বর (A–Z)" : "Unit code (A–Z)"}
                    </option>
                    <option value="month_desc">
                      {locale === "bn" ? "সাম্প্রতিক মাস আগে" : "Newest month"}
                    </option>
                  </Select>
                </div>
              </div>

              {filteredBills.length === 0 ? (
                <EmptyState
                  icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
                  title={t(locale, "noData")}
                  description={
                    obligations.length === 0
                      ? locale === "bn"
                        ? "সক্রিয় ভাড়াটিয়াদের জন্য মাসের বিল তৈরি করতে উপরের বোতামে ক্লিক করুন।"
                        : "Click Generate Monthly Bills above to create obligations for active leases."
                      : locale === "bn"
                        ? "আপনার ফিল্টার বা অনুসন্ধানের সাথে মিলে এমন কোনো বিল নেই।"
                        : "No rent bills match your active filters."
                  }
                />
              ) : (
                <>
                  {/* DESKTOP DATA TABLE (md+) */}
                  <div className="surface-card hidden overflow-hidden rounded-xl md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-[11px] font-semibold text-[var(--ink-secondary)] uppercase">
                            <th className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => setBillSort("unit_asc")}
                                className="inline-flex cursor-pointer items-center gap-1 hover:text-[var(--ink-primary)]"
                              >
                                {locale === "bn" ? "ভাড়াটিয়া ও ফ্ল্যাট" : "Tenant & Unit"}
                                <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                              </button>
                            </th>
                            <th className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => setBillSort("month_desc")}
                                className="inline-flex cursor-pointer items-center gap-1 hover:text-[var(--ink-primary)]"
                              >
                                {locale === "bn" ? "মাস" : "Month"}
                                <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                              </button>
                            </th>
                            <th className="px-4 py-3 text-right">
                              {locale === "bn" ? "মোট বিল" : "Billed"}
                            </th>
                            <th className="px-4 py-3">
                              {locale === "bn" ? "পরিশোধ অগ্রগতি" : "Collection"}
                            </th>
                            <th className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => setBillSort("due_desc")}
                                className="ml-auto inline-flex cursor-pointer items-center gap-1 hover:text-[var(--ink-primary)]"
                              >
                                {locale === "bn" ? "বকেয়া" : "Remaining"}
                                <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                              </button>
                            </th>
                            <th className="px-4 py-3">{locale === "bn" ? "অবস্থা" : "Status"}</th>
                            <th className="px-4 py-3 text-right">
                              {locale === "bn" ? "কার্যক্রম" : "Action"}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)] bg-white">
                          {filteredBills.map((o) => {
                            const badge = statusMeta(o.derived_status);
                            const pct =
                              o.amount_due_paisa > 0
                                ? Math.min(
                                    100,
                                    Math.round((o.allocated_paisa / o.amount_due_paisa) * 100)
                                  )
                                : 0;
                            return (
                              <tr
                                key={o.obligation_id}
                                className="transition-colors hover:bg-[var(--bg-hover)]"
                              >
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-[var(--ink-primary)]">
                                      {o.tenant_name}
                                    </span>
                                    <Badge tone="neutral">{o.unit_code}</Badge>
                                  </div>
                                </td>
                                <td className="tabular-nums px-4 py-3.5 text-[var(--ink-secondary)]">
                                  {formatBillingMonth(o.billing_month, locale)}
                                </td>
                                <td className="tabular-nums px-4 py-3.5 text-right font-semibold text-[var(--ink-primary)]">
                                  {formatBdt(o.amount_due_paisa, locale)}
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="flex w-32 items-center gap-2">
                                    <div
                                      role="progressbar"
                                      aria-valuenow={pct}
                                      aria-valuemin={0}
                                      aria-valuemax={100}
                                      aria-label={`${o.tenant_name} ${pct}%`}
                                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-subtle)]"
                                    >
                                      <div
                                        className="h-full rounded-full bg-[#046c4e]"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="tabular-nums w-8 text-right text-[11px] font-semibold text-[var(--ink-muted)]">
                                      {pct}%
                                    </span>
                                  </div>
                                </td>
                                <td
                                  className={`tabular-nums px-4 py-3.5 text-right text-[13px] font-bold ${
                                    o.outstanding_paisa > 0 ? "text-amber-800" : "text-[#046c4e]"
                                  }`}
                                >
                                  {formatBdt(o.outstanding_paisa, locale)}
                                </td>
                                <td className="px-4 py-3.5">
                                  <Badge tone={badge.tone} dot>
                                    {badge.label}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  {o.outstanding_paisa > 0 ? (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedObl(o);
                                        setPayAmountBdt(paisaToBdtString(o.outstanding_paisa));
                                      }}
                                    >
                                      {t(locale, "recordPayment")}
                                    </Button>
                                  ) : (
                                    <span className="text-[11px] font-semibold text-[#046c4e]">
                                      {locale === "bn" ? "সম্পন্ন" : "Settled"}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* MOBILE CARDS (< md) */}
                  <div className="grid gap-3 md:hidden">
                    {filteredBills.map((o) => {
                      const badge = statusMeta(o.derived_status);
                      const pct =
                        o.amount_due_paisa > 0
                          ? Math.min(
                              100,
                              Math.round((o.allocated_paisa / o.amount_due_paisa) * 100)
                            )
                          : 0;
                      return (
                        <div key={o.obligation_id} className="surface-card rounded-xl p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="truncate text-sm font-bold text-[var(--ink-primary)]">
                                  {o.tenant_name}
                                </p>
                                <Badge tone="neutral">
                                  {locale === "bn" ? `ফ্ল্যাট ${o.unit_code}` : `Unit ${o.unit_code}`}
                                </Badge>
                              </div>
                              <p className="tabular-nums mt-0.5 text-[11px] text-[var(--ink-muted)]">
                                {formatBillingMonth(o.billing_month, locale)} ·{" "}
                                {locale === "bn" ? "মোট বিল" : "Total"}:{" "}
                                {formatBdt(o.amount_due_paisa, locale)}
                              </p>
                            </div>
                            <Badge tone={badge.tone} dot>
                              {badge.label}
                            </Badge>
                          </div>

                          <div
                            role="progressbar"
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={
                              locale === "bn"
                                ? `${o.tenant_name} ভাড়া পরিশোধ ${pct}%`
                                : `${o.tenant_name} rent paid ${pct}%`
                            }
                            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]"
                          >
                            <div
                              className="h-full rounded-full bg-[#046c4e] transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div className="text-xs">
                              <span className="text-[var(--ink-muted)]">
                                {locale === "bn" ? "বাকি আছে: " : "Due: "}
                              </span>
                              <span
                                className={`tabular-nums text-sm font-bold ${
                                  o.outstanding_paisa > 0 ? "text-amber-800" : "text-[#046c4e]"
                                }`}
                              >
                                {formatBdt(o.outstanding_paisa, locale)}
                              </span>
                            </div>

                            {o.outstanding_paisa > 0 && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setSelectedObl(o);
                                  setPayAmountBdt(paisaToBdtString(o.outstanding_paisa));
                                }}
                              >
                                {t(locale, "recordPayment")}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* SUB-TAB 2: IMMUTABLE PAYMENT LEDGER */}
          {subTab === "payments" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <FilterPills
                  ariaLabel={locale === "bn" ? "মাধ্যম ফিল্টার" : "Filter by payment method"}
                  value={payMethodFilter}
                  onChange={(v) => startTransition(() => setPayMethodFilter(v))}
                  options={[
                    { id: "all", label: t(locale, "all") },
                    { id: "bkash", label: "bKash" },
                    { id: "cash", label: locale === "bn" ? "নগদ" : "Cash" },
                    { id: "nagad", label: "Nagad" },
                    { id: "bank", label: locale === "bn" ? "ব্যাংক" : "Bank" }
                  ]}
                />
                <SearchInput
                  value={paySearch}
                  onChange={(v) => startTransition(() => setPaySearch(v))}
                  placeholder={
                    locale === "bn" ? "ভাড়াটিয়া বা নোট খুঁজুন..." : "Search tenant, unit, or note..."
                  }
                  ariaLabel={locale === "bn" ? "পেমেন্ট খুঁজুন" : "Search payments"}
                  className="sm:w-64"
                />
              </div>

              {filteredPayments.length === 0 ? (
                <EmptyState
                  icon={<Receipt className="h-5 w-5" aria-hidden="true" />}
                  title={t(locale, "noData")}
                />
              ) : (
                <Card className="overflow-hidden">
                  {/* Desktop Table */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-[11px] font-semibold text-[var(--ink-secondary)] uppercase">
                          <th className="px-4 py-3">{locale === "bn" ? "ভাড়াটিয়া" : "Tenant"}</th>
                          <th className="px-4 py-3">{locale === "bn" ? "মাধ্যম" : "Method"}</th>
                          <th className="px-4 py-3">{locale === "bn" ? "তারিখ ও বিবরণ" : "Date & Notes"}</th>
                          <th className="px-4 py-3 text-right">{locale === "bn" ? "পরিমাণ" : "Amount"}</th>
                          <th className="px-4 py-3 text-right">{locale === "bn" ? "কার্যক্রম" : "Actions"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)] bg-white">
                        {filteredPayments.map((p) => (
                          <tr key={p.id} className="transition-colors hover:bg-[var(--bg-hover)]">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[var(--ink-primary)]">
                                  {p.tenants?.full_name ?? "—"}
                                </span>
                                {p.tenancies?.units?.unit_code && (
                                  <Badge tone="neutral">{p.tenancies.units.unit_code}</Badge>
                                )}
                                {p.is_reversal && (
                                  <Badge tone="rose">
                                    {locale === "bn" ? "সংশোধন" : "Reversal"}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <Badge tone="neutral">
                                {formatPaymentMethodLabel(p.payment_method, locale)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3.5 text-[var(--ink-muted)]">
                              <p className="tabular-nums font-medium text-[var(--ink-secondary)]">
                                {formatDhakaDateTime(p.paid_at, locale)}
                              </p>
                              {p.notes && (
                                <p className="mt-0.5 max-w-xs truncate text-[11px]">{p.notes}</p>
                              )}
                            </td>
                            <td
                              className={`tabular-nums px-4 py-3.5 text-right text-[13px] font-bold ${
                                p.is_reversal ? "text-rose-700" : "text-[#046c4e]"
                              }`}
                            >
                              {formatBdt(p.amount_paisa, locale)}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-end gap-1.5">
                                {!p.is_reversal && p.tenants?.phone_e164 && (
                                  <Button
                                    variant="subtle"
                                    size="sm"
                                    title={t(locale, "sendReceipt")}
                                    aria-label={`${t(locale, "sendReceipt")} — ${p.tenants.full_name}`}
                                    onClick={() =>
                                      onOpenSms({
                                        tenantId: p.tenant_id,
                                        tenantName: p.tenants!.full_name,
                                        phoneE164: p.tenants!.phone_e164,
                                        templateType: "payment_receipt",
                                        initialMessage:
                                          locale === "bn"
                                            ? `RentReady রসিদ: ${p.tenants!.full_name}, আপনার ${formatBdt(p.amount_paisa, "bn")} (${p.payment_method}) ভাড়া গৃহীত হয়েছে। ধন্যবাদ।`
                                            : `RentReady Receipt: ${formatBdt(p.amount_paisa, "en")} (${p.payment_method}) received from ${p.tenants!.full_name}. Thank you.`
                                      })
                                    }
                                  >
                                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>{locale === "bn" ? "রসিদ" : "Receipt"}</span>
                                  </Button>
                                )}
                                {!p.is_reversal && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title={t(locale, "reversePayment")}
                                    aria-label={`${t(locale, "reversePayment")} — ${p.tenants?.full_name ?? ""}`}
                                    onClick={() => {
                                      setReversingPayment(p);
                                      setReversalReason("");
                                    }}
                                    className="text-rose-700! hover:bg-rose-50!"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Rows */}
                  <div className="divide-y divide-[var(--border-subtle)] md:hidden">
                    {filteredPayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 px-4 py-3.5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-bold text-[var(--ink-primary)]">
                              {p.tenants?.full_name}
                            </p>
                            <Badge tone="neutral">
                              {formatPaymentMethodLabel(p.payment_method, locale)}
                            </Badge>
                            {p.is_reversal && (
                              <Badge tone="rose">{locale === "bn" ? "সংশোধন" : "Reversal"}</Badge>
                            )}
                          </div>
                          <p className="tabular-nums mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">
                            {p.notes || formatDhakaDateTime(p.paid_at, locale)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={`tabular-nums text-sm font-bold ${
                              p.is_reversal ? "text-rose-700" : "text-[#046c4e]"
                            }`}
                          >
                            {formatBdt(p.amount_paisa, locale)}
                          </span>
                          {!p.is_reversal && p.tenants?.phone_e164 && (
                            <Button
                              variant="subtle"
                              size="icon"
                              aria-label={`${t(locale, "sendReceipt")} — ${p.tenants.full_name}`}
                              onClick={() =>
                                onOpenSms({
                                  tenantId: p.tenant_id,
                                  tenantName: p.tenants!.full_name,
                                  phoneE164: p.tenants!.phone_e164,
                                  templateType: "payment_receipt",
                                  initialMessage:
                                    locale === "bn"
                                      ? `RentReady রসিদ: ${p.tenants!.full_name}, আপনার ${formatBdt(p.amount_paisa, "bn")} (${p.payment_method}) ভাড়া গৃহীত হয়েছে। ধন্যবাদ।`
                                      : `RentReady Receipt: ${formatBdt(p.amount_paisa, "en")} (${p.payment_method}) received from ${p.tenants!.full_name}. Thank you.`
                                })
                              }
                            >
                              <Send className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          )}
                          {!p.is_reversal && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`${t(locale, "reversePayment")} — ${p.tenants?.full_name ?? ""}`}
                              onClick={() => {
                                setReversingPayment(p);
                                setReversalReason("");
                              }}
                              className="bg-rose-50! text-rose-700!"
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* SUB-TAB 3: PROPERTY EXPENSES */}
          {subTab === "expenses" && (
            <div className="grid gap-5 lg:grid-cols-12">
              <Card className="h-fit lg:col-span-5">
                <CardHeader
                  title={locale === "bn" ? "নতুন খরচ লিখুন" : "Log New Expense"}
                  subtitle={
                    locale === "bn"
                      ? "খরচটি নিট আয়ের হিসাবে স্বয়ংক্রিয়ভাবে সমন্বয় হবে"
                      : "Automatically deducted from monthly net operating income"
                  }
                />
                <CardBody>
                  <form onSubmit={addExpense} className="space-y-3.5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        id="exp-property"
                        label={locale === "bn" ? "বাড়ি নির্বাচন করুন" : "Property"}
                        required
                      >
                        <Select
                          id="exp-property"
                          required
                          value={expPropId}
                          onChange={(e) => setExpPropId(e.target.value)}
                        >
                          {properties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field
                        id="exp-amount"
                        label={locale === "bn" ? "পরিমাণ (টাকা)" : "Amount (BDT)"}
                        required
                      >
                        <Input
                          id="exp-amount"
                          required
                          type="number"
                          min="1"
                          step="0.01"
                          value={expAmountBdt}
                          onChange={(e) => setExpAmountBdt(e.target.value)}
                          placeholder="1500"
                          className="tabular-nums font-semibold"
                        />
                      </Field>
                    </div>

                    <Field
                      id="exp-category"
                      label={locale === "bn" ? "খরচের খাত" : "Category"}
                      required
                    >
                      <Input
                        id="exp-category"
                        required
                        value={expCategory}
                        onChange={(e) => setExpCategory(e.target.value)}
                        placeholder={locale === "bn" ? "খরচের খাত" : "Category"}
                      />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {EXPENSE_PRESETS[locale].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setExpCategory(preset)}
                            className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                              expCategory === preset
                                ? "border-[#a7f3d0] bg-[#ecfdf5] text-[#046c4e]"
                                : "border-[var(--border-default)] bg-white text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <Field
                      id="exp-desc"
                      label={locale === "bn" ? "খরচের বিবরণ" : "Description"}
                      required
                    >
                      <Input
                        id="exp-desc"
                        required
                        value={expDesc}
                        onChange={(e) => setExpDesc(e.target.value)}
                        placeholder={
                          locale === "bn"
                            ? "যেমন: পানির পাম্প মেরামত"
                            : "e.g. Water pump motor repair"
                        }
                      />
                    </Field>

                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      loading={savingExp}
                      disabled={!expPropId}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {locale === "bn" ? "খরচ সেভ করুন" : "Save Expense"}
                    </Button>
                  </form>
                </CardBody>
              </Card>

              <Card className="lg:col-span-7">
                <CardHeader
                  title={locale === "bn" ? "খরচের তালিকা" : "Recorded Expenses"}
                  badge={
                    <Badge tone="rose">
                      <span className="tabular-nums">{formatBdt(totalExpensesPaisa, locale)}</span>
                    </Badge>
                  }
                  action={
                    <SearchInput
                      value={expSearch}
                      onChange={(v) => startTransition(() => setExpSearch(v))}
                      placeholder={locale === "bn" ? "খরচ খুঁজুন..." : "Search expenses..."}
                      ariaLabel={locale === "bn" ? "খরচ খুঁজুন" : "Search expenses"}
                      className="w-44 sm:w-52"
                    />
                  }
                />
                <div className="divide-y divide-[var(--border-subtle)]">
                  {filteredExpenses.length === 0 ? (
                    <div className="p-5">
                      <EmptyState
                        icon={<Receipt className="h-5 w-5" aria-hidden="true" />}
                        title={t(locale, "noData")}
                      />
                    </div>
                  ) : (
                    filteredExpenses.map((ex) => (
                      <div
                        key={ex.id}
                        className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--bg-hover)] sm:px-5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[var(--ink-primary)] sm:text-[13px]">
                            {ex.description}
                          </p>
                          <p className="tabular-nums mt-0.5 text-[11px] text-[var(--ink-muted)]">
                            {ex.category_name}
                            {ex.properties?.name ? ` · ${ex.properties.name}` : ""} ·{" "}
                            {ex.incurred_on}
                          </p>
                        </div>
                        <span className="tabular-nums shrink-0 text-sm font-bold text-rose-700">
                          {formatBdt(ex.amount_paisa, locale)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* COLLECT RENT MODAL */}
      <Modal
        open={Boolean(selectedObl)}
        onClose={() => setSelectedObl(null)}
        titleId="payment-modal-title"
        maxWidth="max-w-md"
        closeLabel={locale === "bn" ? "বন্ধ করুন" : "Close dialog"}
        title={t(locale, "recordPayment")}
        subtitle={
          selectedObl ? (
            <>
              {selectedObl.tenant_name} ·{" "}
              {locale === "bn"
                ? `ফ্ল্যাট ${selectedObl.unit_code}`
                : `Unit ${selectedObl.unit_code}`}{" "}
              · {locale === "bn" ? "বকেয়া" : "Due"}:{" "}
              <strong className="tabular-nums text-amber-800">
                {formatBdt(selectedObl.outstanding_paisa, locale)}
              </strong>
            </>
          ) : undefined
        }
      >
        {selectedObl && (
          <form onSubmit={submitPayment} className="space-y-4">
            <Field
              id="payment-amount-input"
              label={
                locale === "bn"
                  ? "জমার পরিমাণ (পূর্ণ বা আংশিক টাকা)"
                  : "Amount Received (BDT — Full or Partial)"
              }
              required
              labelAction={
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setPayAmountBdt(paisaToBdtString(selectedObl.outstanding_paisa))
                    }
                    className="cursor-pointer rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-secondary)] hover:bg-[#ecfdf5] hover:text-[#046c4e]"
                  >
                    {locale === "bn" ? "সম্পূর্ণ" : "Full"}
                  </button>
                  {selectedObl.outstanding_paisa >= 200 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPayAmountBdt(
                          paisaToBdtString(Math.floor(selectedObl.outstanding_paisa / 2))
                        )
                      }
                      className="cursor-pointer rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-secondary)] hover:bg-[#ecfdf5] hover:text-[#046c4e]"
                    >
                      50%
                    </button>
                  )}
                </div>
              }
            >
              <Input
                id="payment-amount-input"
                required
                type="number"
                min="1"
                step="0.01"
                value={payAmountBdt}
                onChange={(e) => setPayAmountBdt(e.target.value)}
                className="tabular-nums text-base! font-bold text-[#046c4e]!"
              />
            </Field>

            {liveRemainingAfterPay !== null && (
              <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-rail)] px-3 py-2 text-xs">
                <span className="text-[var(--ink-muted)]">
                  {locale === "bn" ? "জমার পর বাকি থাকবে" : "Remaining balance after payment"}
                </span>
                <span
                  className={`tabular-nums font-bold ${
                    liveRemainingAfterPay > 0 ? "text-amber-800" : "text-[#046c4e]"
                  }`}
                >
                  {formatBdt(liveRemainingAfterPay, locale)}
                </span>
              </div>
            )}

            <div>
              <p className="mb-1.5 text-xs font-semibold text-[var(--ink-secondary)]">
                {locale === "bn" ? "পেমেন্ট মাধ্যম" : "Payment Method"}
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    ["bkash", "bKash"],
                    ["cash", locale === "bn" ? "নগদ" : "Cash"],
                    ["nagad", "Nagad"],
                    ["bank", locale === "bn" ? "ব্যাংক" : "Bank"]
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={payMethod === m}
                    onClick={() => setPayMethod(m)}
                    className={`min-h-9 cursor-pointer rounded-lg border py-2 text-xs font-semibold transition-colors ${
                      payMethod === m
                        ? "border-[#046c4e] bg-[#ecfdf5] text-[#046c4e]"
                        : "border-[var(--border-default)] bg-white text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setSelectedObl(null)}>
                {t(locale, "cancel")}
              </Button>
              <Button type="submit" variant="primary" loading={submittingPay}>
                {locale === "bn" ? "সেভ ও SMS রসিদ" : "Save & SMS Receipt"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* IMMUTABLE REVERSAL MODAL */}
      <Modal
        open={Boolean(reversingPayment)}
        onClose={() => setReversingPayment(null)}
        titleId="reversal-modal-title"
        maxWidth="max-w-md"
        closeLabel={locale === "bn" ? "বন্ধ করুন" : "Close dialog"}
        title={
          <span className="text-rose-800">
            {locale === "bn" ? "পেমেন্ট সংশোধন (রিভার্স)" : "Reverse Payment Entry"}
          </span>
        }
        subtitle={
          reversingPayment ? (
            <>
              {reversingPayment.tenants?.full_name} ·{" "}
              <strong className="tabular-nums">
                {formatBdt(reversingPayment.amount_paisa, locale)}
              </strong>
            </>
          ) : undefined
        }
      >
        {reversingPayment && (
          <form onSubmit={submitReversal} className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
              <p className="leading-relaxed">
                {locale === "bn"
                  ? "আর্থিক স্বচ্ছতার জন্য মূল পেমেন্ট মুছে ফেলা হয় না — এর বিপরীতে একটি স্থায়ী সংশোধন (রিভার্সাল) এন্ট্রি যুক্ত হয় এবং বকেয়া পুনরায় সমন্বয় হয়।"
                  : "For audit integrity, confirmed payments are never deleted. This posts an immutable offsetting reversal row and restores the tenant's balance."}
              </p>
            </div>

            <Field
              id="reversal-reason-input"
              label={locale === "bn" ? "সংশোধনের কারণ" : "Reversal Reason"}
              required
              labelAction={
                <span className="tabular-nums text-[11px] text-[var(--ink-muted)]">
                  {reversalReason.trim().length}/300
                </span>
              }
            >
              <Textarea
                id="reversal-reason-input"
                required
                minLength={3}
                maxLength={300}
                rows={3}
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder={
                  locale === "bn"
                    ? "সংশোধন করার কারণ লিখুন (যেমন: ভুল অঙ্ক লেখা হয়েছিল)..."
                    : "Reason for reversal (e.g. entered wrong amount)..."
                }
              />
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setReversingPayment(null)}>
                {t(locale, "cancel")}
              </Button>
              <Button
                type="submit"
                variant="danger"
                loading={submittingRev}
                disabled={reversalReason.trim().length < 3}
              >
                {t(locale, "reversePayment")}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
