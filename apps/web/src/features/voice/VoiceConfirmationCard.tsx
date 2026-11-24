import { bdtToPaisa, formatBdt } from "@rentready/shared/money";
import {
  AlertTriangle,
  Building2,
  Check,
  Receipt,
  Send,
  ShieldCheck,
  Wallet,
  Wrench,
  X
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Input";
import { formatPaymentMethodLabel } from "../../lib/format";
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

function getFriendlyIntentMeta(
  intent: string,
  locale: Locale
): {
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
            : "Confirming will post this payment to your rent ledger",
        icon: <Wallet className="h-4 w-4 text-[#046c4e]" aria-hidden="true" />
      };
    case "record_expense":
      return {
        title: locale === "bn" ? "বাড়ির খরচ যুক্ত করুন" : "Record Property Expense",
        subtitle:
          locale === "bn"
            ? "নিশ্চিত করলে এই খরচটি মাসিক হিসাবে যুক্ত হবে"
            : "Confirming will add this expense to your monthly accounts",
        icon: <Receipt className="h-4 w-4 text-rose-700" aria-hidden="true" />
      };
    case "create_maintenance_request":
      return {
        title: locale === "bn" ? "মেরামতের অনুরোধ তৈরি করুন" : "Create Maintenance Request",
        subtitle:
          locale === "bn"
            ? "নিশ্চিত করলে এটি মেরামতের তালিকায় যুক্ত হবে"
            : "Confirming will log this issue in your maintenance queue",
        icon: <Wrench className="h-4 w-4 text-amber-700" aria-hidden="true" />
      };
    case "prepare_rent_reminder":
      return {
        title: locale === "bn" ? "ভাড়ার SMS রিমাইন্ডার পাঠান" : "Send Rent Reminder SMS",
        subtitle:
          locale === "bn"
            ? "নিশ্চিত করলে Banglalink AppLink দিয়ে SMS পাঠানো হবে"
            : "Confirming will dispatch this SMS via Banglalink AppLink",
        icon: <Send className="h-4 w-4 text-[#046c4e]" aria-hidden="true" />
      };
    default:
      return {
        title: t(locale, "confirmationRequired"),
        subtitle: "",
        icon: <ShieldCheck className="h-4 w-4 text-amber-700" aria-hidden="true" />
      };
  }
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
    <div className="animate-scale-in mt-4 overflow-hidden rounded-xl border border-[var(--border-default)] border-l-4 border-l-amber-500 bg-white text-left text-[var(--ink-primary)] shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 ring-1 ring-amber-200/80">
            {meta.icon}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-[var(--ink-primary)]">{meta.title}</p>
              <Badge tone="amber" dot>
                {locale === "bn" ? "এখনো সেভ হয়নি" : "Pending confirmation"}
              </Badge>
            </div>
            {meta.subtitle && (
              <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{meta.subtitle}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onReject}
          aria-label={locale === "bn" ? "বাতিল ও বন্ধ করুন" : "Cancel and close"}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-3.5 p-4">
        {/* Case 1: Entity Not Found */}
        {isNotFound && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
            <p className="font-bold">
              {locale === "bn"
                ? "সঠিক ফ্ল্যাট বা ভাড়াটিয়া খুঁজে পাওয়া যায়নি"
                : "Could not find a matching unit, tenant, or property"}
            </p>
            <p className="mt-1 leading-relaxed">
              {locale === "bn"
                ? "অনুগ্রহ করে আগে বাড়ি/ফ্ল্যাট ও ভাড়াটিয়া যোগ করুন অথবা ফ্ল্যাট নম্বরটি (যেমন: 3B) পরিষ্কার করে আবার বলুন।"
                : "Please check that the property, unit, and active tenant exist, or repeat with the exact unit code (e.g. Unit 3B)."}
            </p>
          </div>
        )}

        {/* Case 2: Ambiguous Entity Picker */}
        {isAmbiguous && (
          <fieldset className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5">
            <legend className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t(locale, "disambiguationTitle")}
            </legend>
            <div className="mt-2.5 space-y-1.5">
              {candidates.map((cand) => {
                const id = cand.tenancy_id ?? cand.property_id ?? "";
                const isTenancy = Boolean(cand.tenancy_id);
                const checked = isTenancy ? selectedTenancyId === id : selectedPropertyId === id;
                return (
                  <label
                    key={id}
                    className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      checked
                        ? "border-[#046c4e] bg-emerald-50 text-emerald-950"
                        : "border-amber-200/80 bg-white text-[var(--ink-primary)] hover:bg-amber-50/50"
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
                      className="h-4 w-4 accent-[#046c4e]"
                    />
                    <span>
                      {isTenancy
                        ? locale === "bn"
                          ? `${cand.tenant_name} — ফ্ল্যাট ${cand.unit_code}`
                          : `${cand.tenant_name} — Unit ${cand.unit_code}`
                        : cand.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {/* Case 3: Structured Financial / Operational Draft */}
        {!isNotFound && (
          <dl className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-rail)] px-3.5 text-xs">
            {result.intent === "record_rent_payment" && (
              <>
                {resolved.tenancy && (
                  <div className="flex items-center justify-between gap-2 py-2.5">
                    <dt className="text-[var(--ink-muted)]">
                      {locale === "bn" ? "ভাড়াটিয়া ও ফ্ল্যাট" : "Tenant & Unit"}
                    </dt>
                    <dd className="font-bold text-[var(--ink-primary)]">
                      {resolved.tenancy.tenant_name} ({resolved.tenancy.unit_code})
                    </dd>
                  </div>
                )}
                {amountPaisa !== null && (
                  <div className="flex items-center justify-between gap-2 py-2.5">
                    <dt className="text-[var(--ink-muted)]">
                      {locale === "bn" ? "জমার পরিমাণ" : "Payment Amount"}
                    </dt>
                    <dd className="tabular-nums text-base font-extrabold text-[#046c4e]">
                      {formatBdt(amountPaisa, locale)}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 py-2.5">
                  <dt className="text-[var(--ink-muted)]">
                    {locale === "bn" ? "মাধ্যম" : "Payment Method"}
                  </dt>
                  <dd className="font-semibold text-[var(--ink-primary)]">
                    {formatPaymentMethodLabel(String(payload.payment_method ?? "cash"), locale)}
                  </dd>
                </div>
                {remainingAfter !== null && (
                  <div className="flex items-center justify-between gap-2 py-2.5">
                    <dt className="text-[var(--ink-muted)]">
                      {locale === "bn" ? "জমার পর বাকি থাকবে" : "Remaining Due After Payment"}
                    </dt>
                    <dd
                      className={`tabular-nums font-bold ${
                        remainingAfter > 0 ? "text-amber-800" : "text-[#046c4e]"
                      }`}
                    >
                      {formatBdt(remainingAfter, locale)}
                    </dd>
                  </div>
                )}
              </>
            )}

            {result.intent === "record_expense" && (
              <>
                {resolved.property && (
                  <div className="flex items-center justify-between gap-2 py-2.5">
                    <dt className="inline-flex items-center gap-1 text-[var(--ink-muted)]">
                      <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {locale === "bn" ? "বাড়ি" : "Property"}
                    </dt>
                    <dd className="font-bold text-[var(--ink-primary)]">
                      {resolved.property.name}
                    </dd>
                  </div>
                )}
                {amountPaisa !== null && (
                  <div className="flex items-center justify-between gap-2 py-2.5">
                    <dt className="text-[var(--ink-muted)]">
                      {locale === "bn" ? "খরচের পরিমাণ" : "Expense Amount"}
                    </dt>
                    <dd className="tabular-nums text-base font-extrabold text-rose-700">
                      {formatBdt(amountPaisa, locale)}
                    </dd>
                  </div>
                )}
                {typeof payload.category_query === "string" && (
                  <div className="flex items-center justify-between gap-2 py-2.5">
                    <dt className="text-[var(--ink-muted)]">
                      {locale === "bn" ? "খাত / ক্যাটাগরি" : "Category"}
                    </dt>
                    <dd className="font-semibold text-[var(--ink-primary)]">
                      {payload.category_query}
                    </dd>
                  </div>
                )}
                {typeof payload.description === "string" && (
                  <div className="py-2.5">
                    <dt className="text-[var(--ink-muted)]">
                      {locale === "bn" ? "বিবরণ" : "Description"}
                    </dt>
                    <dd className="mt-0.5 font-semibold text-[var(--ink-primary)]">
                      {payload.description}
                    </dd>
                  </div>
                )}
              </>
            )}

            {result.intent === "create_maintenance_request" && (
              <>
                {resolved.property && (
                  <div className="flex items-center justify-between gap-2 py-2.5">
                    <dt className="text-[var(--ink-muted)]">
                      {locale === "bn" ? "বাড়ি" : "Property"}
                    </dt>
                    <dd className="font-bold text-[var(--ink-primary)]">
                      {resolved.property.name}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 py-2.5">
                  <dt className="text-[var(--ink-muted)]">
                    {locale === "bn" ? "সমস্যা" : "Issue"}
                  </dt>
                  <dd className="font-bold text-[var(--ink-primary)]">
                    {String(payload.title ?? "")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2 py-2.5">
                  <dt className="text-[var(--ink-muted)]">
                    {locale === "bn" ? "অগ্রাধিকার" : "Priority"}
                  </dt>
                  <dd>
                    <Badge tone="amber">
                      {formatPriority(String(payload.priority ?? "medium"), locale)}
                    </Badge>
                  </dd>
                </div>
                {typeof payload.description === "string" && (
                  <div className="py-2.5">
                    <dd className="text-[var(--ink-secondary)]">{payload.description}</dd>
                  </div>
                )}
              </>
            )}

            {result.intent === "prepare_rent_reminder" && (
              <>
                {resolved.tenancy && (
                  <div className="flex items-center justify-between gap-2 py-2.5">
                    <dt className="text-[var(--ink-muted)]">
                      {locale === "bn" ? "প্রাপক" : "Recipient"}
                    </dt>
                    <dd className="tabular-nums font-bold text-[var(--ink-primary)]">
                      {resolved.tenancy.tenant_name} ({resolved.tenancy.tenant_phone})
                    </dd>
                  </div>
                )}
                {currentDue !== null && (
                  <div className="flex items-center justify-between gap-2 py-2.5">
                    <dt className="text-[var(--ink-muted)]">
                      {locale === "bn" ? "বর্তমান বকেয়া" : "Current Due"}
                    </dt>
                    <dd className="tabular-nums font-bold text-amber-800">
                      {formatBdt(currentDue, locale)}
                    </dd>
                  </div>
                )}
                <div className="py-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="voice-sms-preview"
                      className="text-[11px] font-semibold text-[var(--ink-secondary)]"
                    >
                      {locale === "bn"
                        ? "SMS বার্তা (প্রয়োজনে বদলে নিন)"
                        : "SMS Preview (Editable)"}
                    </label>
                    <span className="tabular-nums text-[11px] text-[var(--ink-muted)]">
                      {editedSms.length}/480
                    </span>
                  </div>
                  <Textarea
                    id="voice-sms-preview"
                    rows={3}
                    maxLength={480}
                    value={editedSms}
                    onChange={(e) => onChangeSms(e.target.value)}
                    className="text-xs!"
                  />
                </div>
              </>
            )}
          </dl>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onReject}>
            {t(locale, "cancel")}
          </Button>
          {!isNotFound && (
            <Button
              variant="primary"
              size="sm"
              loading={confirming}
              disabled={isAmbiguous && !selectedTenancyId && !selectedPropertyId}
              onClick={onConfirm}
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {t(locale, "confirmAction")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
