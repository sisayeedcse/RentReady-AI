import { bdtToPaisa, formatBdt, getDhakaDateString, paisaToBdtString } from "@rentready/shared";
import { Phone, Plus, Search, UserCheck, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { toFriendlyError } from "../../lib/friendlyError";
import { type Locale, t } from "../../lib/i18n";

interface TenantRow {
  id: string;
  full_name: string;
  phone_e164: string;
  is_banglalink: boolean;
}

interface UnitRow {
  id: string;
  unit_code: string;
  default_rent_paisa: number;
  status: string;
}

interface TenancyRow {
  id: string;
  monthly_rent_paisa: number;
  start_date: string;
  status: string;
  tenants: { full_name: string; phone_e164: string } | null;
  units: { unit_code: string; properties: { name: string } | null } | null;
}

export function TenantsView({
  accessToken,
  locale,
  onToast
}: {
  accessToken: string;
  locale: Locale;
  onToast?: (msg: string) => void;
}) {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [tenancies, setTenancies] = useState<TenancyRow[]>([]);
  const [search, setSearch] = useState("");
  const [openForm, setOpenForm] = useState<"none" | "tenant" | "assign">("none");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [unitId, setUnitId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [monthlyRentBdt, setMonthlyRentBdt] = useState("12000");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [tRes, uRes, tnRes] = await Promise.all([
        apiFetch<{ data: TenantRow[] }>("/api/tenants", accessToken),
        apiFetch<{ data: UnitRow[] }>("/api/units", accessToken),
        apiFetch<{ data: TenancyRow[] }>("/api/tenancies", accessToken)
      ]);
      setTenants(tRes.data);
      setUnits(uRes.data);
      setTenancies(tnRes.data);
    } catch (err) {
      setError(toFriendlyError(err, locale));
    }
  }, [accessToken, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addTenant(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/tenants", accessToken, {
        method: "POST",
        body: JSON.stringify({ full_name: fullName, phone })
      });
      setFullName("");
      setPhone("");
      setOpenForm("none");
      onToast?.(locale === "bn" ? "নতুন ভাড়াটিয়া যুক্ত হয়েছে!" : "Tenant added!");
      await load();
    } catch (err) {
      setError(toFriendlyError(err, locale));
    } finally {
      setSaving(false);
    }
  }

  async function assignTenancy(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/tenancies", accessToken, {
        method: "POST",
        body: JSON.stringify({
          unit_id: unitId,
          tenant_id: tenantId,
          start_date: getDhakaDateString(),
          monthly_rent_paisa: bdtToPaisa(monthlyRentBdt),
          rent_due_day: 5
        })
      });
      setUnitId("");
      setTenantId("");
      setOpenForm("none");
      onToast?.(locale === "bn" ? "ফ্ল্যাটে ভাড়াটিয়া বরাদ্দ হয়েছে!" : "Tenant assigned to unit!");
      await load();
    } catch (err) {
      setError(toFriendlyError(err, locale));
    } finally {
      setSaving(false);
    }
  }

  const q = search.trim().toLowerCase();
  const filteredTenancies = tenancies.filter((row) => {
    if (!q) return true;
    return (
      (row.tenants?.full_name ?? "").toLowerCase().includes(q) ||
      (row.tenants?.phone_e164 ?? "").includes(q) ||
      (row.units?.unit_code ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            {locale === "bn" ? "ভাড়াটিয়া ব্যবস্থাপনা" : "Tenants & Leases"}
          </h2>
          <p className="text-xs text-slate-500">
            {locale === "bn"
              ? `মোট ${tenants.length} জন ভাড়াটিয়া • ${tenancies.length}টি সক্রিয় ফ্ল্যাট বরাদ্দ`
              : `${tenants.length} total tenants • ${tenancies.length} active leases`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenForm(openForm === "tenant" ? "none" : "tenant")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            {locale === "bn" ? "নতুন ভাড়াটিয়া" : "Add Tenant"}
          </button>
          <button
            type="button"
            onClick={() => setOpenForm(openForm === "assign" ? "none" : "assign")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-slate-50 active:scale-95"
          >
            <UserCheck className="h-4 w-4 text-emerald-600" />
            {locale === "bn" ? "ফ্ল্যাট বরাদ্দ" : "Assign Unit"}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="animate-scale-in rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {openForm === "tenant" && (
        <form
          onSubmit={addTenant}
          className="animate-scale-in rounded-2xl border border-emerald-200 bg-white p-5 shadow-md space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <Users className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              {locale === "bn" ? "নতুন ভাড়াটিয়ার তথ্য" : "New Tenant Profile"}
            </h3>
            <button
              type="button"
              onClick={() => setOpenForm("none")}
              aria-label={locale === "bn" ? "ফর্ম বন্ধ করুন" : "Close form"}
              className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              aria-label={locale === "bn" ? "ভাড়াটিয়ার পূর্ণ নাম" : "Tenant full name"}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={locale === "bn" ? "ভাড়াটিয়ার নাম (যেমন: রহিম উদ্দিন)" : "Tenant full name"}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <input
              required
              type="tel"
              aria-label={locale === "bn" ? "ভাড়াটিয়ার মোবাইল নম্বর" : "Tenant mobile number"}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={locale === "bn" ? "মোবাইল নম্বর (যেমন: 019XXXXXXXX)" : "Mobile number (e.g. 019XXXXXXXX)"}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpenForm("none")}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              {t(locale, "cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              {saving ? "..." : locale === "bn" ? "ভাড়াটিয়া সেভ করুন" : "Save Tenant"}
            </button>
          </div>
        </form>
      )}

      {openForm === "assign" && (
        <form
          onSubmit={assignTenancy}
          className="animate-scale-in rounded-2xl border border-emerald-200 bg-white p-5 shadow-md space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <UserCheck className="h-4 w-4 text-emerald-600" />
              {locale === "bn" ? "খালি ফ্ল্যাটে ভাড়াটিয়া বরাদ্দ করুন" : "Assign Tenant to Vacant Unit"}
            </h3>
            <button
              type="button"
              onClick={() => setOpenForm("none")}
              aria-label={locale === "bn" ? "ফর্ম বন্ধ করুন" : "Close form"}
              className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              required
              aria-label={locale === "bn" ? "খালি ফ্ল্যাট বাছাই করুন" : "Select vacant unit"}
              value={unitId}
              onChange={(e) => {
                setUnitId(e.target.value);
                const found = units.find((u) => u.id === e.target.value);
                if (found) setMonthlyRentBdt(paisaToBdtString(found.default_rent_paisa));
              }}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
            >
              <option value="">{locale === "bn" ? "খালি ফ্ল্যাট বাছাই করুন" : "Select Vacant Unit"}</option>
              {units
                .filter((u) => u.status === "vacant")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {locale === "bn" ? `ফ্ল্যাট ${u.unit_code}` : `Unit ${u.unit_code}`}
                  </option>
                ))}
            </select>
            <select
              required
              aria-label={locale === "bn" ? "ভাড়াটিয়া বাছাই করুন" : "Select tenant"}
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
            >
              <option value="">{locale === "bn" ? "ভাড়াটিয়া বাছাই করুন" : "Select Tenant"}</option>
              {tenants.map((tn) => (
                <option key={tn.id} value={tn.id}>
                  {tn.full_name} ({tn.phone_e164})
                </option>
              ))}
            </select>
            <input
              required
              aria-label={locale === "bn" ? "মাসিক ভাড়া (টাকা)" : "Monthly rent (BDT)"}
              type="number"
              min="1"
              step="0.01"
              value={monthlyRentBdt}
              onChange={(e) => setMonthlyRentBdt(e.target.value)}
              placeholder={locale === "bn" ? "মাসিক ভাড়া (টাকা)" : "Monthly Rent (BDT)"}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpenForm("none")}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              {t(locale, "cancel")}
            </button>
            <button
              type="submit"
              disabled={saving || !unitId || !tenantId}
              className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "..." : locale === "bn" ? "চুক্তি চালু করুন" : "Start Lease"}
            </button>
          </div>
        </form>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-500" aria-hidden="true" />
        <input
          type="search"
          aria-label={locale === "bn" ? "ভাড়াটিয়া খুঁজুন" : "Search tenants"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            locale === "bn"
              ? "নাম, ফ্ল্যাট নম্বর বা মোবাইল দিয়ে খুঁজুন..."
              : "Search by tenant name, unit, or phone..."
          }
          className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm shadow-2xs focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {/* Active Tenancies Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {filteredTenancies.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center text-xs text-slate-500">
            {t(locale, "noData")}
          </div>
        ) : (
          filteredTenancies.map((row) => (
            <div
              key={row.id}
              className="animate-fade-up flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:shadow-md"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-extrabold text-slate-900">
                    {row.tenants?.full_name}
                  </span>
                  <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    {locale === "bn"
                      ? `ফ্ল্যাট ${row.units?.unit_code}`
                      : `Unit ${row.units?.unit_code}`}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {row.units?.properties?.name} • {row.tenants?.phone_e164}
                </p>
                <p className="mt-1.5 text-sm font-extrabold text-emerald-700">
                  {formatBdt(row.monthly_rent_paisa, locale)}
                  <span className="text-[11px] font-normal text-slate-500">
                    {locale === "bn" ? " / মাস" : " / month"}
                  </span>
                </p>
              </div>
              {row.tenants?.phone_e164 && (
                <a
                  href={`tel:${row.tenants.phone_e164}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 active:scale-90"
                  aria-label="Call Tenant"
                >
                  <Phone className="h-4 w-4" />
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
