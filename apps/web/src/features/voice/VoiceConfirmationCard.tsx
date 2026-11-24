import { bdtToPaisa, formatBdt } from "@rentready/shared";
import {
  AlertTriangle,
  Building2,
  Receipt,
  Send,
  ShieldCheck,
  Wallet,
  Wrench,
  X
} from "lucide-react";
import { type Locale, t } from "../../lib/i18n";

export interface VoiceActionResult {
  action_id?: string;
  status: "proposed" | "needs_clarification" | "answered" | "unknown";
  intent: string;
  reason?: string;
  data?: unknown;
  extracted_payload?: Record<string, unknown>;
  resolved_entities?: {
    tenancy?: {
      tenancy_id: string;
      tenant_name: string;
      unit_code: string;
      tenant_phone: string;
    };
    property?: { property_id: string; name: string };
    total_outstanding_paisa?: number;
    is_banglalink?: boolean;
    sms_preview?: string | null;
    resolution?: {
      status: string;
      candidates?: Array<{
        tenancy_id?: string;
        property_id?: string;
        tenant_name?: string;
        unit_code?: string;
        name?: string;
      }>;
    };
  };
}

function getFriendlyIntentMeta(intent: string, locale: Locale): {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
} {
  switch (intent) {
    case "record_rent_payment":
      return {
        title: locale === "bn" ? "ভাড়ার পেমেন্ট যুক্ত করুন" : "Record Rent Payment",
        subtitle:
          locale === "bn"
            ? "নিশ্চিত করলে এটি ভাড়ার লেজারে সেভ হবে"
            : "Confirming will save this payment to the rent ledger",
        icon: <Wallet className="h-4 w-4 text-emerald-700" />
      };
    case "record_expense":
      return {
        title: locale === "bn" ? "বাড়ির খরচ যুক্ত করুন" : "Record Property Expense",
        subtitle:
          locale === "bn"
            ? "নিশ্চিত করলে এই খরচটি মাসিক হিসাবে যুক্ত হবে"
            : "Confirming will add this expense to your monthly accounts",
        icon: <Receipt className="h-4 w-4 text-rose-700" />
      };
    case "create_maintenance_request":
      return {
        title: locale === "bn" ? "মেরামতের অনুরোধ তৈরি করুন" : "Create Maintenance Request",
        subtitle:
          locale === "bn"
            ? "নিশ্চিত করলে এটি মেরামতের তালিকায় যুক্ত হবে"
            : "Confirming will log this issue in your maintenance queue",
        icon: <Wrench className="h-4 w-4 text-amber-700" />
      };
    case "prepare_rent_reminder":
      return {
        title: locale === "bn" ? "ভাড়ার SMS রিমাইন্ডার পাঠান" : "Send Rent Reminder SMS",
        subtitle:
          locale === "bn"
            ? "নিশ্চিত করলে Banglalink AppLink দিয়ে SMS পাঠানো হবে"
            : "Confirming will send this SMS via Banglalink AppLink",
        icon: <Send className="h-4 w-4 text-emerald-700" />
      };
    default:
      return {
        title: t(locale, "confirmationRequired"),
        subtitle: "",
        icon: <ShieldCheck className="h-4 w-4 text-amber-700" />
      };
  }
}

function formatPaymentMethod(method: string, locale: Locale): string {
  const m = method.toLowerCase();
  if (locale === "bn") {
    if (m === "bkash") return "বিকাশ (bKash)";
    if (m === "nagad") return "নগদ (Nagad)";
    if (m === "cash") return "নগদ টাকা (Cash)";
    if (m === "bank") return "ব্যাংক ট্রান্সফার";
    return "অন্যান্য";
  }
  if (m === "bkash") return "bKash";
  if (m === "nagad") return "Nagad";
  if (m === "cash") return "Cash";
  if (m === "bank") return "Bank Transfer";
  return "Other";
}

function formatPriority(priority: string, locale: Locale): string {
  const p = priority.toLowerCase();
  if (locale === "bn") {
    if (p === "urgent") return "অত্যন্ত জরুরি";
    if (p === "high") return "জরুরি";
    if (p === "medium") return "মাঝারি";
    return "সাধারণ";
  }
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function VoiceConfirmationCard({
  result,
  locale,
  selectedTenancyId,
  selectedPropertyId,
  editedSms,
  confirming,
  onSelectTenancy,
  onSelectProperty,
  onChangeSms,
  onConfirm,
  onReject
}: {
  result: VoiceActionResult;
  locale: Locale;
  selectedTenancyId: string;
  selectedPropertyId: string;
  editedSms: string;
  confirming: boolean;
  onSelectTenancy: (id: string) => void;
  onSelectProperty: (id: string) => void;
  onChangeSms: (text: string) => void;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const meta = getFriendlyIntentMeta(result.intent, locale);
  const payload = result.extracted_payload ?? {};
  const resolved = result.resolved_entities ?? {};
  const candidates = resolved.resolution?.candidates ?? [];
  const isNotFound = result.status === "needs_clarification" && candidates.length === 0;
  const isAmbiguous = result.status === "needs_clarification" && candidates.length > 0;

  const amountBdt = typeof payload.amount_bdt === "number" ? payload.amount_bdt : null;
  const amountPaisa = (() => {
    if (amountBdt === null) return null;
    try {
      return bdtToPaisa(amountBdt);
    } catch {
      return null;
    }
  })();
  const currentDue =
    typeof resolved.total_outstanding_paisa === "number" ? resolved.total_outstanding_paisa : null;
  const remainingAfter =
    currentDue !== null && amountPaisa !== null ? Math.max(0, currentDue - amountPaisa) : null;

  return (
    <div className="animate-scale-in mt-4 rounded-2xl border-2 border-amber-300 bg-white p-4 text-left text-slate-900 shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
            {meta.icon}
          </div>
          <div>
            <p className="text-sm font-extrabold text-slate-900">{meta.title}</p>
            <p className="text-[11px] text-slate-500">{meta.subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReject}
          aria-label={locale === "bn" ? "বাতিল ও বন্ধ করুন" : "Cancel and close"}
          className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Case 1: Entity Not Found (Friendly guidance instead of dead button) */}
      {isNotFound && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <p className="font-bold">
            {locale === "bn"
              ? "সঠিক ফ্ল্যাট বা ভাড়াটিয়া খুঁজে পাওয়া যায়নি"
              : "Could not find a matching unit, tenant, or property"}
          </p>
          <p className="mt-1">
            {locale === "bn"
              ? "অনুগ্রহ করে আগে বাড়ি/ফ্ল্যাট ও ভাড়াটিয়া যোগ করুন অথবা ফ্ল্যাট নম্বরটি (যেমন: 3B) পরিষ্কার করে আবার বলুন।"
              : "Please check that the property, unit, and active tenant exist, or repeat with the exact unit number (e.g. Unit 3B)."}
          </p>
        </div>
      )}

      {/* Case 2: Ambiguous Entity Picker (Multiple Matches) */}
      {isAmbiguous && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {t(locale, "disambiguationTitle")}
          </p>
          <div className="mt-2 space-y-1.5">
            {candidates.map((cand) => {
              const id = cand.tenancy_id ?? cand.property_id ?? "";
              const isTenancy = Boolean(cand.tenancy_id);
              const checked = isTenancy ? selectedTenancyId === id : selectedPropertyId === id;
              return (
                <label
                  key={id}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                    checked
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                      : "border-amber-200 bg-white text-slate-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="voice-clarify-option"
                    value={id}
                    checked={checked}
                    onChange={() =>
                      isTenancy ? onSelectTenancy(id) : onSelectProperty(id)
                    }
                  />
                  <span>
                    {isTenancy ? `${cand.tenant_name} — ফ্ল্যাট ${cand.unit_code}` : cand.name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Case 3: Rich Human-Readable Summary Body by Intent */}
      {!isNotFound && (
        <div className="mt-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs">
          {/* Rent Payment Details */}
          {result.intent === "record_rent_payment" && (
            <>
              {resolved.tenancy && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{locale === "bn" ? "ভাড়াটিয়া ও ফ্ল্যাট" : "Tenant & Unit"}</span>
                  <span className="font-bold text-slate-900">
                    {resolved.tenancy.tenant_name} ({resolved.tenancy.unit_code})
                  </span>
                </div>
              )}
              {amountPaisa !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{locale === "bn" ? "জমার পরিমাণ" : "Payment Amount"}</span>
                  <span className="text-base font-extrabold text-emerald-700">
                    {formatBdt(amountPaisa, locale)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{locale === "bn" ? "মাধ্যম" : "Method"}</span>
                <span className="font-semibold text-slate-800">
                  {formatPaymentMethod(String(payload.payment_method ?? "cash"), locale)}
                </span>
              </div>
              {remainingAfter !== null && (
                <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">
                    {locale === "bn" ? "জমার পর বাকি থাকবে" : "Remaining Due After Payment"}
                  </span>
                  <span className="font-bold text-amber-700">
                    {formatBdt(remainingAfter, locale)}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Expense Details */}
          {result.intent === "record_expense" && (
            <>
              {resolved.property && (
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Building2 className="h-3.5 w-3.5" />
                    {locale === "bn" ? "বাড়ি" : "Property"}
                  </span>
                  <span className="font-bold text-slate-900">{resolved.property.name}</span>
                </div>
              )}
              {amountPaisa !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{locale === "bn" ? "খরচের পরিমাণ" : "Expense Amount"}</span>
                  <span className="text-base font-extrabold text-rose-700">
                    {formatBdt(amountPaisa, locale)}
                  </span>
                </div>
              )}
              {typeof payload.category_query === "string" && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{locale === "bn" ? "খাত / ক্যাটাগরি" : "Category"}</span>
                  <span className="font-semibold text-slate-800">{payload.category_query}</span>
                </div>
              )}
              {typeof payload.description === "string" && (
                <div className="border-t border-slate-200 pt-2">
                  <span className="block text-slate-500">{locale === "bn" ? "বিবরণ" : "Description"}</span>
                  <span className="mt-0.5 block font-semibold text-slate-900">
                    {payload.description}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Maintenance Request Details */}
          {result.intent === "create_maintenance_request" && (
            <>
              {resolved.property && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{locale === "bn" ? "বাড়ি" : "Property"}</span>
                  <span className="font-bold text-slate-900">{resolved.property.name}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{locale === "bn" ? "সমস্যা" : "Issue"}</span>
                <span className="font-bold text-slate-900">{String(payload.title ?? "")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{locale === "bn" ? "অগ্রাধিকার" : "Priority"}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  {formatPriority(String(payload.priority ?? "medium"), locale)}
                </span>
              </div>
              {typeof payload.description === "string" && (
                <p className="border-t border-slate-200 pt-2 text-slate-700">
                  {payload.description}
                </p>
              )}
            </>
          )}

          {/* Rent Reminder SMS Details */}
          {result.intent === "prepare_rent_reminder" && (
            <>
              {resolved.tenancy && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{locale === "bn" ? "প্রাপক" : "Recipient"}</span>
                  <span className="font-bold text-slate-900">
                    {resolved.tenancy.tenant_name} ({resolved.tenancy.tenant_phone})
                  </span>
                </div>
              )}
              {currentDue !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{locale === "bn" ? "বর্তমান বকেয়া" : "Current Due"}</span>
                  <span className="font-extrabold text-amber-700">
                    {formatBdt(currentDue, locale)}
                  </span>
                </div>
              )}
              <div className="pt-1">
                <label htmlFor="voice-sms-preview" className="mb-1 block text-[11px] font-semibold text-slate-600">
                  {locale === "bn" ? "SMS বার্তা (প্রয়োজনে বদলে নিন)" : "SMS Preview (Editable)"}
                </label>
                <textarea
                  id="voice-sms-preview"
                  rows={3}
                  maxLength={480}
                  value={editedSms}
                  onChange={(e) => onChangeSms(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onReject}
          className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
        >
          {t(locale, "cancel")}
        </button>
        {!isNotFound && (
          <button
            type="button"
            disabled={
              confirming ||
              (isAmbiguous && !selectedTenancyId && !selectedPropertyId)
            }
            onClick={onConfirm}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
          >
            {confirming
              ? locale === "bn"
                ? "সেভ হচ্ছে..."
                : "Saving..."
              : t(locale, "confirmAction")}
          </button>
        )}
      </div>
    </div>
  );
}
