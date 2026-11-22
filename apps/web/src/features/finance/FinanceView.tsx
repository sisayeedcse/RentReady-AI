import { bdtToPaisa, formatBdt } from "@rentready/shared";
import { CalendarPlus, Plus, RotateCcw, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, generateIdempotencyKey } from "../../lib/api";
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
  onOpenSms
}: {
  accessToken: string;
  locale: Locale;
  onOpenSms: (draft: SmsDraft) => void;
}) {
  const [obligations, setObligations] = useState<ObligationRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedObl, setSelectedObl] = useState<ObligationRow | null>(null);
  const [payAmountBdt, setPayAmountBdt] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "bkash" | "nagad" | "bank" | "other">("bkash");
  const [expPropId, setExpPropId] = useState("");
  const [expCategory, setExpCategory] = useState("Plumbing & Electrical Repair");
  const [expAmountBdt, setExpAmountBdt] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
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
      setError(err instanceof Error ? err.message : "Failed to load ledger");
    }
  }, [accessToken, expPropId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generateBills() {
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch<{ billing_month: string; generated_count: number }>(
        "/api/obligations/generate",
        accessToken,
        { method: "POST", body: JSON.stringify({}) }
      );
      setNotice(`Generated ${res.generated_count} monthly rent obligation(s) for ${res.billing_month.slice(0, 7)}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate obligations");
    }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedObl) return;
    setError(null);
    setNotice(null);
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
      await load();

      // Prompt landlord to confirm AppLink SMS receipt right after payment!
      onOpenSms({
        tenantId: oblSnap.tenant_id,
        tenantName: oblSnap.tenant_name,
        phoneE164: oblSnap.tenant_phone,
        templateType: "payment_receipt",
        initialMessage:
          locale === "bn"
            ? `RentReady: ${oblSnap.tenant_name} (ফ্ল্যাট ${oblSnap.unit_code}), ${oblSnap.billing_month.slice(0, 7)} এর ভাড়া বাবদ ${formatBdt(amountPaisa, "bn")} (${payMethod}) গৃহীত হয়েছে। বকেয়া: ${formatBdt(remainingAfter, "bn")}। ধন্যবাদ।`
            : `RentReady: Payment of ${formatBdt(amountPaisa, "en")} (${payMethod}) received from ${oblSnap.tenant_name} (Unit ${oblSnap.unit_code}) for ${oblSnap.billing_month.slice(0, 7)}. Remaining due: ${formatBdt(remainingAfter, "en")}.`
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    }
  }

  async function reversePayment(paymentId: string) {
    const reason = window.prompt(
      locale === "bn" ? "রিভার্স করার কারণ লিখুন:" : "Enter reason for reversing this payment:"
    );
    if (!reason || reason.trim().length < 3) return;
    setError(null);
    try {
      await apiFetch(`/api/payments/${paymentId}/reverse`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          reason: reason.trim(),
          idempotency_key: generateIdempotencyKey("rev")
        })
      });
      setNotice("Payment reversed immutably. Ledger balances restored.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reversal failed");
    }
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save expense");
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      {notice && <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">
            {locale === "bn" ? "মাসিক ভাড়ার হিসাব (লেজার)" : "Monthly Rent Obligations Ledger"}
          </h3>
          <button
            type="button"
            onClick={generateBills}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <CalendarPlus className="h-4 w-4" />
            {t(locale, "generateBills")}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 pr-3">Unit / Tenant</th>
                <th className="py-2 pr-3">Month</th>
                <th className="py-2 pr-3">Due</th>
                <th className="py-2 pr-3">Paid</th>
                <th className="py-2 pr-3">Outstanding</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {obligations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-5 text-center text-xs text-slate-500">
                    {t(locale, "noData")}
                  </td>
                </tr>
              ) : (
                obligations.map((o) => (
                  <tr key={o.obligation_id}>
                    <td className="py-3 pr-3 font-medium text-slate-900">
                      Unit {o.unit_code} • {o.tenant_name}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{o.billing_month.slice(0, 7)}</td>
                    <td className="py-3 pr-3">{formatBdt(o.amount_due_paisa, locale)}</td>
                    <td className="py-3 pr-3 text-emerald-700">{formatBdt(o.allocated_paisa, locale)}</td>
                    <td className="py-3 pr-3 font-bold text-amber-700">
                      {formatBdt(o.outstanding_paisa, locale)}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                          o.derived_status === "paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : o.derived_status === "partial"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {o.derived_status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {o.outstanding_paisa > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedObl(o);
                            setPayAmountBdt(String(o.outstanding_paisa / 100));
                          }}
                          className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          {t(locale, "recordPayment")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selectedObl && (
          <form
            onSubmit={submitPayment}
            className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3"
          >
            <p className="text-xs font-bold text-emerald-900">
              {t(locale, "recordPayment")}: Unit {selectedObl.unit_code} ({selectedObl.tenant_name}) —
              Outstanding {formatBdt(selectedObl.outstanding_paisa, locale)}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                required
                type="number"
                min="1"
                step="0.01"
                value={payAmountBdt}
                onChange={(e) => setPayAmountBdt(e.target.value)}
                placeholder="Amount (BDT) — full or partial"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="bkash">bKash</option>
                <option value="cash">Cash</option>
                <option value="nagad">Nagad</option>
                <option value="bank">Bank</option>
                <option value="other">Other</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Save & Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedObl(null)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  {t(locale, "cancel")}
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900">
            {locale === "bn" ? "পেমেন্ট ইতিহাস (অপরিবর্তনীয়)" : "Immutable Payment Ledger"}
          </h3>
          <div className="mt-3 divide-y divide-slate-100">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                <div>
                  <p className="font-semibold text-slate-900">
                    {p.tenants?.full_name} • {p.payment_method.toUpperCase()}
                  </p>
                  <p className="text-slate-500">{p.notes ?? new Date(p.paid_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${p.is_reversal ? "text-rose-600" : "text-emerald-700"}`}>
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
                          initialMessage: `RentReady Receipt: ${formatBdt(p.amount_paisa, locale)} received from ${p.tenants!.full_name} (${p.payment_method}). Thank you.`
                        })
                      }
                      className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!p.is_reversal && (
                    <button
                      type="button"
                      title={t(locale, "reversePayment")}
                      onClick={() => void reversePayment(p.id)}
                      className="rounded-lg bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            {locale === "bn" ? "বাড়ির খরচ যোগ করুন" : "Property Expenses"}
          </h3>
          <form onSubmit={addExpense} className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <select
                required
                value={expPropId}
                onChange={(e) => setExpPropId(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
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
                placeholder="Amount (BDT)"
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <input
              required
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value)}
              placeholder="Category"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <input
              required
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              placeholder={locale === "bn" ? "খরচের বিবরণ (যেমন: পানির পাম্প মেরামত)" : "Description (e.g. Water pump repair)"}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <button
              type="submit"
              disabled={!expPropId}
              className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Save Expense
            </button>
          </form>

          <div className="divide-y divide-slate-100">
            {expenses.slice(0, 6).map((ex) => (
              <div key={ex.id} className="flex items-center justify-between py-2 text-xs">
                <div>
                  <p className="font-semibold text-slate-800">{ex.description}</p>
                  <p className="text-slate-500">
                    {ex.category_name} • {ex.incurred_on}
                  </p>
                </div>
                <span className="font-bold text-rose-700">{formatBdt(ex.amount_paisa, locale)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
