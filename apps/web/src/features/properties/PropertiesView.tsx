import { bdtToPaisa, formatBdt } from "@rentready/shared";
import { Building2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { type Locale, t } from "../../lib/i18n";

interface PropertyRow {
  id: string;
  name: string;
  address: string;
  city: string;
}

interface UnitRow {
  id: string;
  property_id: string;
  unit_code: string;
  floor_label: string | null;
  default_rent_paisa: number;
  status: string;
  properties: { name: string } | null;
}

export function PropertiesView({ accessToken, locale }: { accessToken: string; locale: Locale }) {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [propName, setPropName] = useState("");
  const [propAddress, setPropAddress] = useState("");
  const [selectedPropId, setSelectedPropId] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [unitRentBdt, setUnitRentBdt] = useState("12000");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [pRes, uRes] = await Promise.all([
        apiFetch<{ data: PropertyRow[] }>("/api/properties", accessToken),
        apiFetch<{ data: UnitRow[] }>("/api/units", accessToken)
      ]);
      setProperties(pRes.data);
      setUnits(uRes.data);
      if (pRes.data[0] && !selectedPropId) setSelectedPropId(pRes.data[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load properties");
    }
  }, [accessToken, selectedPropId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addProperty(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/properties", accessToken, {
        method: "POST",
        body: JSON.stringify({ name: propName, address: propAddress, city: "Dhaka" })
      });
      setPropName("");
      setPropAddress("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add property");
    }
  }

  async function addUnit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/units", accessToken, {
        method: "POST",
        body: JSON.stringify({
          property_id: selectedPropId,
          unit_code: unitCode,
          default_rent_paisa: bdtToPaisa(unitRentBdt)
        })
      });
      setUnitCode("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add unit");
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={addProperty} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Building2 className="h-4 w-4 text-emerald-600" />
            {locale === "bn" ? "নতুন বাড়ি যোগ করুন" : "Add Property"}
          </h3>
          <input
            required
            value={propName}
            onChange={(e) => setPropName(e.target.value)}
            placeholder={locale === "bn" ? "বাড়ির নাম (যেমন: শান্তি নিবাস)" : "Property name (e.g. Shanti Nibash)"}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            value={propAddress}
            onChange={(e) => setPropAddress(e.target.value)}
            placeholder={locale === "bn" ? "ঠিকানা (যেমন: ধানমন্ডি ৯/এ, ঢাকা)" : "Address (e.g. Dhanmondi 9/A, Dhaka)"}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            {locale === "bn" ? "বাড়ি সেভ করুন" : "Save Property"}
          </button>
        </form>

        <form onSubmit={addUnit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900">
            {locale === "bn" ? "নতুন ফ্ল্যাট / ইউনিট যোগ করুন" : "Add Unit / Flat"}
          </h3>
          <select
            required
            value={selectedPropId}
            onChange={(e) => setSelectedPropId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">{locale === "bn" ? "বাড়ি নির্বাচন করুন" : "Select property"}</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              value={unitCode}
              onChange={(e) => setUnitCode(e.target.value)}
              placeholder={locale === "bn" ? "ফ্ল্যাট নং (যেমন: 3B)" : "Unit code (e.g. 3B)"}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              min="1"
              value={unitRentBdt}
              onChange={(e) => setUnitRentBdt(e.target.value)}
              placeholder="Rent (BDT)"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!selectedPropId}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {locale === "bn" ? "ইউনিট সেভ করুন" : "Save Unit"}
          </button>
        </form>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900">
          {locale === "bn" ? "সকল ফ্ল্যাট ও ইউনিট" : "All Units"} ({units.length})
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {units.length === 0 ? (
            <p className="text-xs text-slate-500">{t(locale, "noData")}</p>
          ) : (
            units.map((u) => (
              <div key={u.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Unit {u.unit_code}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      u.status === "occupied"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {u.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{u.properties?.name}</p>
                <p className="mt-2 text-sm font-bold text-emerald-700">
                  {formatBdt(u.default_rent_paisa, locale)} / mo
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
