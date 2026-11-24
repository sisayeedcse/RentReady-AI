import { bdtToPaisa, formatBdt } from "@rentready/shared";
import { CalendarPlus, Plus, RotateCcw, Send, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, generateIdempotencyKey } from "../../lib/api";
import { toFriendlyError } from "../../lib/friendlyError";
import { type Locale, t } from "../../lib/i18n";
import type { SmsDraft } from "../notifications/SmsModal";

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

export function FinanceView({
  accessToken,
  locale,
  onOpenSms,
  onToast
}: {
  accessToken: string;
  locale: Locale;
  onOpenSms: (draft: SmsDraft) => void;
  onToast?: (msg: string) => void;
}) {
  const [subTab, setSubTab] = useState<"bills" | "payments" | "expenses">("bills");
  const [billFilter, setBillFilter] = useState<"all" | "unpaid" | "partial" | "paid">("all");
  const [obligations, setObligations] = useState<ObligationRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);

  // Payment Sheet state
  const [selectedObl, setSelectedObl] = useState<ObligationRow | null>(null);
  const [payAmountBdt, setPayAmountBdt] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "bkash" | "nagad" | "bank" | "other">("bkash");
  const [submittingPay, setSubmittingPay] = useState(false);

  // In-app Reversal Sheet state (replaces ugly window.prompt)
  const [reversingPayment, setReversingPayment] = useState<PaymentRow | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [submittingRev, setSubmittingRev] = useState(false);

  // Expense Form state
  const [expPropId, setExpPropId] = useState("");
  const [expCategory, setExpCategory] = useState(
    locale === "bn" ? "প্লাম্বিং ও ইলেকট্রিক্যাল মেরামত" : "Plumbing & Electrical Repair"
  );
  const [expAmountBdt, setExpAmountBdt] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [savingExp, setSavingExp] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
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
      if (propRes.data[0] && !expPropId) setExpPropId(propRes.data[0].id);
    } catch (err) {
      setError(toFriendlyError(err, locale));
    }
  }, [accessToken, expPropId, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generateBills() {
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
          incurred_on: new Date().toISOString().slice(0, 10),
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

  const filteredBills = obligations.filter((o) =>
    billFilter === "all" ? true : o.derived_status === billFilter
  );

  const statusBadge = (status: string) => {
    if (status === "paid")
      return {
        cls: "bg-emerald-100 text-emerald-800",
        label: t(locale, "paid")
      };
    if (status === "partial")
      return {
        cls: "bg-amber-100 text-amber-800",
        label: t(locale, "partial")
      };
    return {
      cls: "bg-rose-100 text-rose-800",
      label: t(locale, "unpaid")
    };
  };

  return (
    <div className="space-y-5">
      {/* Top Header + Segmented Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-slate-900">
          {locale === "bn" ? "ভাড়া ও খরচের খাতা" : "Rent Ledger & Expenses"}
        </h2>
        <button
          type="button"
          onClick={() => void generateBills()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95"
        >
          <CalendarPlus className="h-4 w-4" />
          {t(locale, "generateBills")}
        </button>
      </div>

      {/* 3-Tab Switcher */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-2xs">
        {(
          [
            ["bills", locale === "bn" ? "ভাড়ার বিল" : "Rent Bills"],
            ["payments", locale === "bn" ? "পেমেন্ট খাতা" : "Payments"],
            ["expenses", locale === "bn" ? "বাড়ির খরচ" : "Expenses"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`rounded-xl py-2.5 text-xs font-bold transition ${
              subTab === id
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="animate-scale-in rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {/* SUB-TAB 1: MONTHLY RENT BILLS (Mobile Cards + Clean Filters) */}
      {subTab === "bills" && (
        <div className="space-y-4">
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {(
              [
                ["all", t(locale, "all")],
                ["unpaid", t(locale, "unpaid")],
                ["partial", t(locale, "partial")],
                ["paid", t(locale, "paid")]
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setBillFilter(val)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition active:scale-95 ${
                  billFilter === val
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {filteredBills.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center text-xs text-slate-500">
                {t(locale, "noData")}
              </div>
            ) : (
              filteredBills.map((o) => {
                const badge = statusBadge(o.derived_status);
                const pct =
                  o.amount_due_paisa > 0
                    ? Math.min(100, Math.round((o.allocated_paisa / o.amount_due_paisa) * 100))
                    : 0;
                return (
                  <div
                    key={o.obligation_id}
                    className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">
                          {o.tenant_name}{" "}
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                            {locale === "bn" ? `ফ্ল্যাট ${o.unit_code}` : `Unit ${o.unit_code}`}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {o.billing_month.slice(0, 7)} •{" "}
                          {locale === "bn" ? "মোট বিল" : "Total"}:{" "}
                          {formatBdt(o.amount_due_paisa, locale)}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Visual Payment Progress Bar */}
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-slate-500">
                          {locale === "bn" ? "বাকি আছে: " : "Due: "}
                        </span>
                        <span
                          className={`text-sm font-extrabold ${
                            o.outstanding_paisa > 0 ? "text-amber-700" : "text-emerald-700"
                          }`}
                        >
                          {formatBdt(o.outstanding_paisa, locale)}
                        </span>
                      </div>

                      {o.outstanding_paisa > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedObl(o);
                            setPayAmountBdt(String(o.outstanding_paisa / 100));
                          }}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700 active:scale-95"
                        >
                          {t(locale, "recordPayment")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: IMMUTABLE PAYMENT LEDGER */}
      {subTab === "payments" && (
        <section className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
          <div className="divide-y divide-slate-100">
            {payments.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">{t(locale, "noData")}</p>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 py-3 text-xs">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {p.tenants?.full_name}{" "}
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                        {p.payment_method}
                      </span>
                      {p.is_reversal && (
                        <span className="ml-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                          {locale === "bn" ? "সংশোধন" : "REVERSAL"}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {p.notes || new Date(p.paid_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={`text-sm font-extrabold ${
                        p.is_reversal ? "text-rose-600" : "text-emerald-700"
                      }`}
                    >
                      {formatBdt(p.amount_paisa, locale)}
                    </span>
                    {!p.is_reversal && p.tenants?.phone_e164 && (
                      <button
                        type="button"
                        title={t(locale, "sendReceipt")}
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
                        className="rounded-xl bg-emerald-50 p-2 text-emerald-700 transition hover:bg-emerald-100 active:scale-90"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!p.is_reversal && (
                      <button
                        type="button"
                        title={t(locale, "reversePayment")}
                        onClick={() => {
                          setReversingPayment(p);
                          setReversalReason("");
                        }}
                        className="rounded-xl bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 active:scale-90"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* SUB-TAB 3: PROPERTY EXPENSES */}
      {subTab === "expenses" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <form
            onSubmit={addExpense}
            className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3"
          >
            <h3 className="text-sm font-bold text-slate-900">
              {locale === "bn" ? "নতুন খরচ লিখুন" : "Log New Expense"}
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <select
                required
                value={expPropId}
                onChange={(e) => setExpPropId(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                required
                type="number"
                min="1"
                value={expAmountBdt}
                onChange={(e) => setExpAmountBdt(e.target.value)}
                placeholder={locale === "bn" ? "টাকার পরিমাণ" : "Amount (BDT)"}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>
            <input
              required
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value)}
              placeholder={locale === "bn" ? "খরচের খাত" : "Category"}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
            <input
              required
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              placeholder={
                locale === "bn"
                  ? "খরচের বিবরণ (যেমন: পানির পাম্প মেরামত)"
                  : "Description (e.g. Water pump repair)"
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={savingExp || !expPropId}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              {savingExp ? "..." : locale === "bn" ? "খরচ সেভ করুন" : "Save Expense"}
            </button>
          </form>

          <section className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">
              {locale === "bn" ? "সাম্প্রতিক খরচের তালিকা" : "Recent Expenses"}
            </h3>
            <div className="mt-3 divide-y divide-slate-100">
              {expenses.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">{t(locale, "noData")}</p>
              ) : (
                expenses.map((ex) => (
                  <div key={ex.id} className="flex items-center justify-between py-2.5 text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{ex.description}</p>
                      <p className="text-slate-500">
                        {ex.category_name} • {ex.incurred_on}
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-rose-700">
                      {formatBdt(ex.amount_paisa, locale)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* IN-APP BOTTOM-SHEET PAYMENT MODAL */}
      {selectedObl && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setSelectedObl(null)}
        >
          <form
            onSubmit={submitPayment}
            onClick={(e) => e.stopPropagation()}
            className="animate-sheet-up w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 shadow-2xl sm:rounded-3xl sm:p-6 space-y-4"
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {t(locale, "recordPayment")}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedObl.tenant_name} •{" "}
                  {locale === "bn" ? `ফ্ল্যাট ${selectedObl.unit_code}` : `Unit ${selectedObl.unit_code}`}{" "}
                  • {locale === "bn" ? "বকেয়া" : "Due"}:{" "}
                  <strong className="text-amber-700">
                    {formatBdt(selectedObl.outstanding_paisa, locale)}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedObl(null)}
                className="rounded-xl bg-slate-100 p-1.5 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                {locale === "bn" ? "জমার পরিমাণ (পূর্ণ বা আংশিক টাকা)" : "Amount Received (BDT — Full or Partial)"}
              </label>
              <input
                required
                type="number"
                min="1"
                step="0.01"
                value={payAmountBdt}
                onChange={(e) => setPayAmountBdt(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-bold text-emerald-700 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                {locale === "bn" ? "পেমেন্ট মাধ্যম" : "Payment Method"}
              </label>
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
                    onClick={() => setPayMethod(m)}
                    className={`rounded-xl border py-2 text-xs font-bold transition ${
                      payMethod === m
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedObl(null)}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-xs font-bold text-slate-700"
              >
                {t(locale, "cancel")}
              </button>
              <button
                type="submit"
                disabled={submittingPay}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95"
              >
                {submittingPay
                  ? "..."
                  : locale === "bn"
                    ? "সেভ ও SMS রসিদ"
                    : "Save & Receipt"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* IN-APP REVERSAL BOTTOM SHEET (NO window.prompt!) */}
      {reversingPayment && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setReversingPayment(null)}
        >
          <form
            onSubmit={submitReversal}
            onClick={(e) => e.stopPropagation()}
            className="animate-sheet-up w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 shadow-2xl sm:rounded-3xl sm:p-6 space-y-4"
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-extrabold text-rose-700">
                  {locale === "bn" ? "পেমেন্ট সংশোধন (রিভার্স)" : "Reverse Payment Entry"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {reversingPayment.tenants?.full_name} •{" "}
                  {formatBdt(reversingPayment.amount_paisa, locale)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReversingPayment(null)}
                className="rounded-xl bg-slate-100 p-1.5 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              required
              minLength={3}
              rows={3}
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder={
                locale === "bn"
                  ? "সংশোধন করার কারণ লিখুন (যেমন: ভুল অঙ্ক লেখা হয়েছিল)..."
                  : "Reason for reversal (e.g. entered wrong amount)..."
              }
              className="w-full rounded-2xl border border-slate-300 p-3 text-sm focus:border-rose-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReversingPayment(null)}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-xs font-bold text-slate-700"
              >
                {t(locale, "cancel")}
              </button>
              <button
                type="submit"
                disabled={submittingRev || reversalReason.trim().length < 3}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {submittingRev ? "..." : t(locale, "reversePayment")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
