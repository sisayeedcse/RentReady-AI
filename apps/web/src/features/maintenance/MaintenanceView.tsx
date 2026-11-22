import { Plus, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
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

export function MaintenanceView({ accessToken, locale }: { accessToken: string; locale: Locale }) {
  const [items, setItems] = useState<MaintenanceRow[]>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [propertyId, setPropertyId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");

  const load = useCallback(async () => {
    const [mRes, pRes] = await Promise.all([
      apiFetch<{ data: MaintenanceRow[] }>("/api/maintenance", accessToken),
      apiFetch<{ data: Array<{ id: string; name: string }> }>("/api/properties", accessToken)
    ]);
    setItems(mRes.data);
    setProperties(pRes.data);
    if (pRes.data[0] && !propertyId) setPropertyId(pRes.data[0].id);
  }, [accessToken, propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch("/api/maintenance", accessToken, {
      method: "POST",
      body: JSON.stringify({ property_id: propertyId, title, description, priority })
    });
    setTitle("");
    setDescription("");
    await load();
  }

  async function updateStatus(id: string, status: string) {
    await apiFetch(`/api/maintenance/${id}`, accessToken, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createItem} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <Wrench className="h-4 w-4 text-emerald-600" />
          {locale === "bn" ? "নতুন মেরামতের অনুরোধ" : "Log Maintenance Request"}
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            required
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as typeof priority)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={locale === "bn" ? "সমস্যার শিরোনাম (যেমন: পানির কল লিক)" : "Issue title (e.g. Water tap leaking)"}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <textarea
          required
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={locale === "bn" ? "বিস্তারিত বিবরণ..." : "Description..."}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!propertyId}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          {locale === "bn" ? "অনুরোধ যোগ করুন" : "Create Request"}
        </button>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900">
          {locale === "bn" ? "মেরামতের তালিকা" : "Maintenance Queue"} ({items.length})
        </h3>
        <div className="mt-3 divide-y divide-slate-100">
          {items.length === 0 ? (
            <p className="py-4 text-xs text-slate-500">{t(locale, "noData")}</p>
          ) : (
            items.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{m.title}</p>
                  <p className="text-xs text-slate-500">
                    {m.properties?.name} • {m.description}
                  </p>
                </div>
                <select
                  value={m.status}
                  onChange={(e) => void updateStatus(m.id, e.target.value)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
