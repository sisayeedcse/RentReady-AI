import { bdtToPaisa, formatBdt } from "@rentready/shared";
import { Building2, Home, MapPin, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { toFriendlyError } from "../../lib/friendlyError";
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

export function PropertiesView({
  accessToken,
  locale,
  onToast
}: {
  accessToken: string;
  locale: Locale;
  onToast?: (msg: string) => void;
}) {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [filter, setFilter] = useState<"all" | "occupied" | "vacant">("all");
  const [openForm, setOpenForm] = useState<"none" | "property" | "unit">("none");
  const [propName, setPropName] = useState("");
  const [propAddress, setPropAddress] = useState("");
  const [selectedPropId, setSelectedPropId] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [floorLabel, setFloorLabel] = useState("");
  const [unitRentBdt, setUnitRentBdt] = useState("12000");
  const [saving, setSaving] = useState(false);
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
      setError(toFriendlyError(err, locale));
    }
  }, [accessToken, locale, selectedPropId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addProperty(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/properties", accessToken, {
        method: "POST",
        body: JSON.stringify({ name: propName, address: propAddress, city: "Dhaka" })
      });
      setPropName("");
      setPropAddress("");
      setOpenForm("none");
      onToast?.(locale === "bn" ? "নতুন বাড়ি যুক্ত হয়েছে!" : "Property added!");
      await load();
    } catch (err) {
      setError(toFriendlyError(err, locale));
    } finally {
      setSaving(false);
    }
  }

  async function addUnit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/units", accessToken, {
        method: "POST",
        body: JSON.stringify({
          property_id: selectedPropId,
          unit_code: unitCode,
          floor_label: floorLabel || undefined,
          default_rent_paisa: bdtToPaisa(unitRentBdt)
        })
      });
      setUnitCode("");
      setFloorLabel("");
      setOpenForm("none");
      onToast?.(locale === "bn" ? "নতুন ফ্ল্যাট যুক্ত হয়েছে!" : "Unit added!");
      await load();
    } catch (err) {
      setError(toFriendlyError(err, locale));
    } finally {
      setSaving(false);
    }
  }

  const occupiedCount = units.filter((u) => u.status === "occupied").length;
  const vacantCount = units.filter((u) => u.status === "vacant").length;
  const filteredUnits = units.filter((u) => (filter === "all" ? true : u.status === filter));

  return (
    <div className="space-y-5">
      {/* Header + Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            {locale === "bn" ? "বাড়ি ও ফ্ল্যাট তালিকা" : "Properties & Units"}
          </h2>
          <p className="text-xs text-slate-500">
            {locale === "bn"
              ? `${properties.length}টি বাড়ি • ${units.length}টি ফ্ল্যাট (${occupiedCount}টি ভাড়া, ${vacantCount}টি খালি)`
              : `${properties.length} properties • ${units.length} units (${occupiedCount} occupied, ${vacantCount} vacant)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenForm(openForm === "property" ? "none" : "property")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-slate-50 active:scale-95"
          >
            <Plus className="h-4 w-4 text-emerald-600" />
            {locale === "bn" ? "নতুন বাড়ি" : "Add Property"}
          </button>
          <button
            type="button"
            onClick={() => setOpenForm(openForm === "unit" ? "none" : "unit")}
            disabled={properties.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {locale === "bn" ? "নতুন ফ্ল্যাট" : "Add Unit"}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="animate-scale-in rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {/* Collapsible Add Property Form */}
      {openForm === "property" && (
        <form
          onSubmit={addProperty}
          className="animate-scale-in rounded-2xl border border-emerald-200 bg-white p-5 shadow-md space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <Building2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              {locale === "bn" ? "নতুন বাড়ির তথ্য দিন" : "New Property Details"}
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
              aria-label={locale === "bn" ? "বাড়ির নাম" : "Property name"}
              value={propName}
              onChange={(e) => setPropName(e.target.value)}
              placeholder={locale === "bn" ? "বাড়ির নাম (যেমন: শান্তি নিবাস)" : "Property name (e.g. Shanti Nibash)"}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <input
              required
              aria-label={locale === "bn" ? "বাড়ির ঠিকানা" : "Property address"}
              value={propAddress}
              onChange={(e) => setPropAddress(e.target.value)}
              placeholder={locale === "bn" ? "ঠিকানা (যেমন: ধানমন্ডি ৯/এ, ঢাকা)" : "Address (e.g. Dhanmondi 9/A, Dhaka)"}
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
              {saving ? "..." : locale === "bn" ? "বাড়ি সেভ করুন" : "Save Property"}
            </button>
          </div>
        </form>
      )}

      {/* Collapsible Add Unit Form */}
      {openForm === "unit" && (
        <form
          onSubmit={addUnit}
          className="animate-scale-in rounded-2xl border border-emerald-200 bg-white p-5 shadow-md space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <Home className="h-4 w-4 text-emerald-600" />
              {locale === "bn" ? "নতুন ফ্ল্যাট / ইউনিট যোগ করুন" : "Add New Unit / Flat"}
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select
              required
              aria-label={locale === "bn" ? "বাড়ি নির্বাচন করুন" : "Select property"}
              value={selectedPropId}
              onChange={(e) => setSelectedPropId(e.target.value)}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">{locale === "bn" ? "বাড়ি বাছাই করুন" : "Select property"}</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              required
              aria-label={locale === "bn" ? "ফ্ল্যাট নম্বর" : "Unit code"}
              value={unitCode}
              onChange={(e) => setUnitCode(e.target.value)}
              placeholder={locale === "bn" ? "ফ্ল্যাট নং (যেমন: 3B)" : "Unit code (e.g. 3B)"}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <input
              aria-label={locale === "bn" ? "তলা (ঐচ্ছিক)" : "Floor label (optional)"}
              value={floorLabel}
              onChange={(e) => setFloorLabel(e.target.value)}
              placeholder={locale === "bn" ? "তলা (যেমন: ৩য় তলা)" : "Floor (optional)"}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <input
              required
              aria-label={locale === "bn" ? "মাসিক ভাড়া (টাকা)" : "Monthly rent (BDT)"}
              type="number"
              min="1"
              step="0.01"
              value={unitRentBdt}
              onChange={(e) => setUnitRentBdt(e.target.value)}
              placeholder={locale === "bn" ? "মাসিক ভাড়া (টাকা)" : "Monthly Rent (BDT)"}
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
              disabled={saving || !selectedPropId}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              {saving ? "..." : locale === "bn" ? "ফ্ল্যাট সেভ করুন" : "Save Unit"}
            </button>
          </div>
        </form>
      )}

      {/* Properties Strip */}
      {properties.length > 0 && (
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
          {properties.map((p) => (
            <div
              key={p.id}
              className="min-w-[220px] rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{p.name}</p>
                  <p className="flex items-center gap-1 truncate text-[11px] text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {p.address}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Pills */}
      <div className="flex items-center gap-2">
        {(
          [
            ["all", `${t(locale, "all")} (${units.length})`],
            ["occupied", `${t(locale, "occupied")} (${occupiedCount})`],
            ["vacant", `${t(locale, "vacant")} (${vacantCount})`]
          ] as const
        ).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setFilter(val)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition active:scale-95 ${
              filter === val
                ? "bg-slate-900 text-white shadow-xs"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Units Card Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredUnits.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center text-xs text-slate-500">
            {t(locale, "noData")}
          </div>
        ) : (
          filteredUnits.map((u) => (
            <div
              key={u.id}
              className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-base font-extrabold text-slate-900">
                    {locale === "bn" ? `ফ্ল্যাট ${u.unit_code}` : `Unit ${u.unit_code}`}
                  </span>
                  <p className="text-xs text-slate-500">
                    {u.properties?.name} {u.floor_label ? `• ${u.floor_label}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    u.status === "occupied"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {u.status === "occupied" ? t(locale, "occupied") : t(locale, "vacant")}
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3">
                <span className="text-[11px] font-medium text-slate-500">
                  {locale === "bn" ? "মাসিক ভাড়া" : "Monthly Rent"}
                </span>
                <span className="text-base font-extrabold text-emerald-700">
                  {formatBdt(u.default_rent_paisa, locale)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
