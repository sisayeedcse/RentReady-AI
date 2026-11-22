import { bdtToPaisa, formatBdt } from "@rentready/shared";
import { Plus, UserCheck, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
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

export function TenantsView({ accessToken, locale }: { accessToken: string; locale: Locale }) {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [tenancies, setTenancies] = useState<TenancyRow[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [unitId, setUnitId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [monthlyRentBdt, setMonthlyRentBdt] = useState("12000");
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
      setError(err instanceof Error ? err.message : "Failed to load tenants");
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addTenant(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/tenants", accessToken, {
        method: "POST",
        body: JSON.stringify({ full_name: fullName, phone })
      });
      setFullName("");
      setPhone("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add tenant");
    }
  }

  async function assignTenancy(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/tenancies", accessToken, {
        method: "POST",
        body: JSON.stringify({
          unit_id: unitId,
          tenant_id: tenantId,
          start_date: new Date().toISOString().slice(0, 10),
          monthly_rent_paisa: bdtToPaisa(monthlyRentBdt),
          rent_due_day: 5
        })
      });
      setUnitId("");
      setTenantId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign tenancy");
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={addTenant} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Users className="h-4 w-4 text-emerald-600" />
            {locale === "bn" ? "নতুন ভাড়াটিয়া যোগ করুন" : "Add Tenant"}
          </h3>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={locale === "bn" ? "ভাড়াটিয়ার নাম (যেমন: রহিম উদ্দিন)" : "Tenant full name"}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="019XXXXXXXX (Banglalink for AppLink SMS)"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            {locale === "bn" ? "ভাড়াটিয়া সেভ করুন" : "Save Tenant"}
          </button>
        </form>

        <form onSubmit={assignTenancy} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            {locale === "bn" ? "ফ্ল্যাটে ভাড়াটিয়া বরাদ্দ করুন" : "Assign Tenant to Unit"}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <select
              required
              value={unitId}
              onChange={(e) => {
                setUnitId(e.target.value);
                const found = units.find((u) => u.id === e.target.value);
                if (found) setMonthlyRentBdt(String(found.default_rent_paisa / 100));
              }}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">{locale === "bn" ? "খালি ফ্ল্যাট" : "Vacant Unit"}</option>
              {units
                .filter((u) => u.status === "vacant")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    Unit {u.unit_code}
                  </option>
                ))}
            </select>

            <select
              required
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">{locale === "bn" ? "ভাড়াটিয়া" : "Select Tenant"}</option>
              {tenants.map((tn) => (
                <option key={tn.id} value={tn.id}>
                  {tn.full_name} ({tn.phone_e164})
                </option>
              ))}
            </select>
          </div>
          <input
            required
            type="number"
            min="1"
            value={monthlyRentBdt}
            onChange={(e) => setMonthlyRentBdt(e.target.value)}
            placeholder="Monthly Rent (BDT)"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!unitId || !tenantId}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {locale === "bn" ? "ভাড়া চুক্তি চালু করুন" : "Start Active Tenancy"}
          </button>
        </form>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900">
          {locale === "bn" ? "সক্রিয় ভাড়াটিয়া তালিকা" : "Active Tenancies"} ({tenancies.length})
        </h3>
        <div className="mt-3 divide-y divide-slate-100">
          {tenancies.length === 0 ? (
            <p className="py-4 text-xs text-slate-500">{t(locale, "noData")}</p>
          ) : (
            tenancies.map((row) => (
              <div key={row.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">
                    {row.tenants?.full_name} — Unit {row.units?.unit_code}
                  </p>
                  <p className="text-xs text-slate-500">
                    {row.tenants?.phone_e164} • {row.units?.properties?.name}
                  </p>
                </div>
                <span className="font-bold text-emerald-700">
                  {formatBdt(row.monthly_rent_paisa, locale)}/mo
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
