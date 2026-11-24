import { Plus, Wrench, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { toFriendlyError } from "../../lib/friendlyError";
import { type Locale, t } from "../../lib/i18n";

interface MaintenanceRow {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  properties: { name: string } | null;
  units: { unit_code: string } | null;
}

export function MaintenanceView({
  accessToken,
  locale,
  onToast
}: {
  accessToken: string;
  locale: Locale;
  onToast?: (msg: string) => void;
}) {
  const [items, setItems] = useState<MaintenanceRow[]>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in_progress" | "resolved">("all");
  const [showForm, setShowForm] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [mRes, pRes] = await Promise.all([
        apiFetch<{ data: MaintenanceRow[] }>("/api/maintenance", accessToken),
        apiFetch<{ data: Array<{ id: string; name: string }> }>("/api/properties", accessToken)
      ]);
      setItems(mRes.data);
      setProperties(pRes.data);
      if (pRes.data[0] && !propertyId) setPropertyId(pRes.data[0].id);
    } catch (err) {
      setError(toFriendlyError(err, locale));
    }
  }, [accessToken, locale, propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/maintenance", accessToken, {
        method: "POST",
        body: JSON.stringify({ property_id: propertyId, title, description, priority })
      });
      setTitle("");
      setDescription("");
      setShowForm(false);
      onToast?.(locale === "bn" ? "মেরামতের অনুরোধ যুক্ত হয়েছে!" : "Maintenance request added!");
      await load();
    } catch (err) {
      setError(toFriendlyError(err, locale));
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await apiFetch(`/api/maintenance/${id}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      onToast?.(locale === "bn" ? "অবস্থা আপডেট হয়েছে!" : "Status updated!");
      await load();
    } catch (err) {
      setError(toFriendlyError(err, locale));
    }
  }

  const priorityLabel = (p: string) => {
    if (locale === "bn") {
      if (p === "urgent") return "অত্যন্ত জরুরি";
      if (p === "high") return "জরুরি";
      if (p === "medium") return "মাঝারি";
      return "সাধারণ";
    }
    return p.toUpperCase();
  };

  const priorityColor = (p: string) => {
    if (p === "urgent" || p === "high") return "bg-rose-100 text-rose-800";
    if (p === "medium") return "bg-amber-100 text-amber-800";
    return "bg-slate-100 text-slate-700";
  };

  const filtered = items.filter((m) => (statusFilter === "all" ? true : m.status === statusFilter));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            {locale === "bn" ? "মেরামত ও রক্ষণাবেক্ষণ" : "Maintenance & Repairs"}
          </h2>
          <p className="text-xs text-slate-500">
            {locale === "bn"
              ? `মোট ${items.length}টি মেরামতের কাজ`
              : `${items.length} maintenance ticket(s)`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          {locale === "bn" ? "নতুন অনুরোধ" : "Log Issue"}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={createItem}
          className="animate-scale-in rounded-2xl border border-emerald-200 bg-white p-5 shadow-md space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <Wrench className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              {locale === "bn" ? "নতুন মেরামতের বিবরণ" : "New Maintenance Request"}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              aria-label={locale === "bn" ? "ফর্ম বন্ধ করুন" : "Close form"}
              className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <select
              required
              aria-label={locale === "bn" ? "বাড়ি নির্বাচন করুন" : "Select property"}
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              aria-label={locale === "bn" ? "অগ্রাধিকার নির্বাচন করুন" : "Select priority"}
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="low">{priorityLabel("low")}</option>
              <option value="medium">{priorityLabel("medium")}</option>
              <option value="high">{priorityLabel("high")}</option>
              <option value="urgent">{priorityLabel("urgent")}</option>
            </select>
          </div>
          <input
            required
            aria-label={locale === "bn" ? "সমস্যার শিরোনাম" : "Issue title"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={locale === "bn" ? "সমস্যার শিরোনাম (যেমন: পানির কল লিক)" : "Issue title (e.g. Water tap leaking)"}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
          />
          <textarea
            required
            aria-label={locale === "bn" ? "সমস্যার বিস্তারিত বিবরণ" : "Issue description"}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={locale === "bn" ? "বিস্তারিত লিখুন..." : "Details..."}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              {t(locale, "cancel")}
            </button>
            <button
              type="submit"
              disabled={!propertyId}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              {locale === "bn" ? "অনুরোধ সেভ করুন" : "Save Request"}
            </button>
          </div>
        </form>
      )}

      {/* Status Filter Pills */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {(
          [
            ["all", t(locale, "all")],
            ["open", locale === "bn" ? "খোলা" : "Open"],
            ["in_progress", locale === "bn" ? "চলমান" : "In Progress"],
            ["resolved", locale === "bn" ? "সমাধান" : "Resolved"]
          ] as const
        ).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setStatusFilter(val)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              statusFilter === val
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tickets List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center text-xs text-slate-500">
            {t(locale, "noData")}
          </div>
        ) : (
          filtered.map((m) => (
            <div
              key={m.id}
              className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold text-slate-900">{m.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {m.properties?.name}
                    {m.units?.unit_code ? ` • ${m.units.unit_code}` : ""} — {m.description}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${priorityColor(m.priority)}`}>
                  {priorityLabel(m.priority)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                {(
                  [
                    ["open", locale === "bn" ? "খোলা" : "Open"],
                    ["in_progress", locale === "bn" ? "কাজ চলছে" : "In Progress"],
                    ["resolved", locale === "bn" ? "সমাধান হয়েছে" : "Resolved"]
                  ] as const
                ).map(([st, label]) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => void updateStatus(m.id, st)}
                    className={`rounded-xl px-3 py-1.5 text-[11px] font-bold transition active:scale-95 ${
                      m.status === st
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
