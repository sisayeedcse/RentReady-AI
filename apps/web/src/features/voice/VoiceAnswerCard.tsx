import { formatBdt } from "@rentready/shared";
import { AlertCircle, CheckCircle2, Info, Receipt, Wallet, X } from "lucide-react";
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
      <div className="animate-scale-in mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-left text-slate-900 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-amber-700">
            <Info className="h-4 w-4 shrink-0" />
            <span className="text-xs font-bold">
              {locale === "bn" ? "নির্দেশনাটি পরিষ্কারভাবে বোঝা যায়নি" : "Could not understand command"}
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          {reason ||
            (locale === "bn"
              ? "অনুগ্রহ করে ফ্ল্যাট নম্বর বা ভাড়াটিয়ার নাম এবং টাকার পরিমাণ স্পষ্টভাবে বলুন।"
              : "Please specify the unit/tenant name and amount clearly.")}
        </p>
      </div>
    );
  }

  if (intent === "get_outstanding_rent") {
    const items = (Array.isArray(data) ? data : []) as OutstandingItem[];
    const totalPaisa = items.reduce((sum, item) => sum + Number(item.outstanding_paisa ?? 0), 0);

    return (
      <div className="animate-scale-in mt-4 rounded-2xl border border-emerald-200 bg-white p-4 text-left text-slate-900 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                items.length === 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {items.length === 0 ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">
                {locale === "bn" ? "বকেয়া ভাড়ার হিসাব" : "Outstanding Rent Summary"}
              </p>
              <p className="text-sm font-extrabold text-slate-900">
                {items.length === 0
                  ? locale === "bn"
                    ? "অভিনন্দন! এই মুহূর্তে কোনো ভাড়া বাকি নেই।"
                    : "Great news! There is no outstanding rent right now."
                  : locale === "bn"
                    ? `মোট ${items.length} জনের কাছে ${formatBdt(totalPaisa, "bn")} ভাড়া বাকি আছে।`
                    : `Total ${formatBdt(totalPaisa, "en")} is due across ${items.length} unit(s).`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        {items.length > 0 && (
          <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/70 px-3">
            {items.map((item) => (
              <div key={item.obligation_id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-900">
                    {item.tenant_name}{" "}
                    <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      {locale === "bn" ? `ফ্ল্যাট ${item.unit_code}` : `Unit ${item.unit_code}`}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {item.billing_month.slice(0, 7)} •{" "}
                    {locale === "bn"
                      ? `পরিশোধিত ${formatBdt(item.allocated_paisa, "bn")} / মোট ${formatBdt(item.amount_due_paisa, "bn")}`
                      : `Paid ${formatBdt(item.allocated_paisa, "en")} of ${formatBdt(item.amount_due_paisa, "en")}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-extrabold text-amber-700">
                    {formatBdt(item.outstanding_paisa, locale)}
                  </p>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      item.derived_status === "partial"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {item.derived_status === "partial"
                      ? locale === "bn"
                        ? "আংশিক"
                        : "Partial"
                      : locale === "bn"
                        ? "বকেয়া"
                        : "Unpaid"}
                  </span>
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
      <div className="animate-scale-in mt-4 rounded-2xl border border-emerald-200 bg-white p-4 text-left text-slate-900 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">
                {locale === "bn" ? "মাসিক আয় ও সম্পত্তির সারাংশ" : "Monthly Collection & Summary"}
              </p>
              <p className="text-sm font-extrabold text-slate-900">
                {locale === "bn"
                  ? `মোট প্রত্যাশিত ${formatBdt(expected, "bn")} এর মধ্যে ${formatBdt(collected, "bn")} আদায় হয়েছে।`
                  : `Collected ${formatBdt(collected, "en")} out of ${formatBdt(expected, "en")} expected this month.`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-emerald-50 p-2.5">
            <p className="text-[10px] font-semibold text-emerald-800">
              {locale === "bn" ? "আদায়" : "Collected"}
            </p>
            <p className="mt-0.5 text-xs font-extrabold text-emerald-700 sm:text-sm">
              {formatBdt(collected, locale)}
            </p>
          </div>
          <div className="rounded-xl bg-amber-50 p-2.5">
            <p className="text-[10px] font-semibold text-amber-800">
              {locale === "bn" ? "বকেয়া" : "Outstanding"}
            </p>
            <p className="mt-0.5 text-xs font-extrabold text-amber-700 sm:text-sm">
              {formatBdt(outstanding, locale)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-100 p-2.5">
            <p className="text-[10px] font-semibold text-slate-600">
              {locale === "bn" ? "নিট আয়" : "Net Result"}
            </p>
            <p className="mt-0.5 text-xs font-extrabold text-slate-900 sm:text-sm">
              {formatBdt(net, locale)}
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {locale === "bn"
            ? `দখলকৃত ফ্ল্যাট: ${s.occupied_units ?? 0}/${s.total_units ?? 0} • মাসিক খরচ: ${formatBdt(expenses, "bn")} • চলমান মেরামত: ${s.open_maintenance_count ?? 0}`
            : `Occupied Units: ${s.occupied_units ?? 0}/${s.total_units ?? 0} • Expenses: ${formatBdt(expenses, "en")} • Open Maintenance: ${s.open_maintenance_count ?? 0}`}
        </p>
      </div>
    );
  }

  if (intent === "get_payment_history") {
    const items = (Array.isArray(data) ? data : []) as PaymentItem[];
    return (
      <div className="animate-scale-in mt-4 rounded-2xl border border-emerald-200 bg-white p-4 text-left text-slate-900 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">
                {locale === "bn" ? "পেমেন্ট ইতিহাস" : "Payment History"}
              </p>
              <p className="text-sm font-extrabold text-slate-900">
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
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        {items.length > 0 && (
          <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/70 px-3">
            {items.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 text-xs">
                <div>
                  <p className="font-semibold text-slate-800">
                    {p.payment_method.toUpperCase()}{" "}
                    {p.is_reversal && (
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                        REVERSAL
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {new Date(p.paid_at).toLocaleDateString()} {p.notes ? `• ${p.notes}` : ""}
                  </p>
                </div>
                <span className={`font-extrabold ${p.is_reversal ? "text-rose-600" : "text-emerald-700"}`}>
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
