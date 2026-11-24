import { Plus, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import {
  AlertBanner,
  EmptyState,
  PageHeader,
  SearchInput,
  SkeletonRows
} from "../../components/ui/States";
import { FilterPills } from "../../components/ui/Tabs";
import { apiFetch } from "../../lib/api";
import { formatDhakaDate } from "../../lib/format";
import { toFriendlyError } from "../../lib/friendlyError";
import { type Locale, t } from "../../lib/i18n";

interface MaintenanceRow {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  created_at?: string;
  properties: { name: string } | null;
  units: { unit_code: string } | null;
  tenants?: { full_name: string } | null;
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
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in_progress" | "resolved">(
    "all"
  );
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [mRes, pRes] = await Promise.all([
        apiFetch<{ data: MaintenanceRow[] }>("/api/maintenance", accessToken),
        apiFetch<{ data: Array<{ id: string; name: string }> }>("/api/properties", accessToken)
      ]);
      setItems(mRes.data);
      setProperties(pRes.data);
      const firstId = pRes.data[0]?.id ?? "";
      if (firstId) {
        setPropertyId((prev) => prev || firstId);
      }
    } catch (err) {
      setError(toFriendlyError(err, locale));
    } finally {
      setLoading(false);
    }
  }, [accessToken, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/maintenance", accessToken, {
        method: "POST",
        body: JSON.stringify({ property_id: propertyId, title, description, priority })
      });
      setTitle("");
      setDescription("");
      setPriority("medium");
      setShowModal(false);
      onToast?.(locale === "bn" ? "মেরামতের অনুরোধ যুক্ত হয়েছে!" : "Maintenance request added!");
      await load();
    } catch (err) {
      setError(toFriendlyError(err, locale));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    setError(null);
    try {
      await apiFetch(`/api/maintenance/${id}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      onToast?.(locale === "bn" ? "অবস্থা আপডেট হয়েছে!" : "Status updated!");
      await load();
    } catch (err) {
      setError(toFriendlyError(err, locale));
    } finally {
      setUpdatingId(null);
    }
  }

  const priorityLabel = (p: string) => {
    if (locale === "bn") {
      if (p === "urgent") return "অত্যন্ত জরুরি";
      if (p === "high") return "জরুরি";
      if (p === "medium") return "মাঝারি";
      return "সাধারণ";
    }
    return p.charAt(0).toUpperCase() + p.slice(1);
  };

  const priorityTone = (p: string): "rose" | "amber" | "neutral" => {
    if (p === "urgent" || p === "high") return "rose";
    if (p === "medium") return "amber";
    return "neutral";
  };

  const counts = useMemo(
    () => ({
      all: items.length,
      open: items.filter((m) => m.status === "open").length,
      in_progress: items.filter((m) => m.status === "in_progress").length,
      resolved: items.filter((m) => m.status === "resolved").length
    }),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        (m.properties?.name ?? "").toLowerCase().includes(q) ||
        (m.units?.unit_code ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, statusFilter, search]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={locale === "bn" ? "মেরামত ও রক্ষণাবেক্ষণ" : "Maintenance & Repairs"}
        subtitle={
          locale === "bn"
            ? `${counts.open}টি খোলা · ${counts.in_progress}টি চলমান · ${counts.resolved}টি সমাধান`
            : `${counts.open} open · ${counts.in_progress} in progress · ${counts.resolved} resolved`
        }
        actions={
          <Button
            variant="primary"
            size="sm"
            disabled={properties.length === 0}
            onClick={() => setShowModal(true)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {locale === "bn" ? "নতুন অনুরোধ" : "Log Issue"}
          </Button>
        }
      />

      {error && (
        <AlertBanner
          tone="error"
          message={error}
          onRetry={() => void load()}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <FilterPills
          ariaLabel={locale === "bn" ? "মেরামত অবস্থা ফিল্টার" : "Filter tickets by status"}
          value={statusFilter}
          onChange={(v) => startTransition(() => setStatusFilter(v))}
          options={[
            { id: "all", label: t(locale, "all"), count: counts.all },
            { id: "open", label: locale === "bn" ? "খোলা" : "Open", count: counts.open },
            {
              id: "in_progress",
              label: locale === "bn" ? "চলমান" : "In Progress",
              count: counts.in_progress
            },
            {
              id: "resolved",
              label: locale === "bn" ? "সমাধান" : "Resolved",
              count: counts.resolved
            }
          ]}
        />

        <SearchInput
          value={search}
          onChange={(v) => startTransition(() => setSearch(v))}
          placeholder={locale === "bn" ? "সমস্যা বা ফ্ল্যাট খুঁজুন..." : "Search issue or unit..."}
          ariaLabel={locale === "bn" ? "মেরামত খুঁজুন" : "Search maintenance requests"}
          className="sm:w-64"
        />
      </div>

      {/* Tickets List */}
      {loading ? (
        <SkeletonRows count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-5 w-5" aria-hidden="true" />}
          title={t(locale, "noData")}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <article
              key={m.id}
              className="surface-card rounded-xl p-4 transition-colors hover:border-[var(--border-strong)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--ink-primary)]">{m.title}</h3>
                    <Badge tone={priorityTone(m.priority)} dot>
                      {priorityLabel(m.priority)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--ink-secondary)]">
                    {m.description}
                  </p>
                  <p className="tabular-nums mt-1.5 text-[11px] font-medium text-[var(--ink-muted)]">
                    {m.properties?.name}
                    {m.units?.unit_code ? ` · ${locale === "bn" ? `ফ্ল্যাট ${m.units.unit_code}` : `Unit ${m.units.unit_code}`}` : ""}
                    {m.tenants?.full_name ? ` · ${m.tenants.full_name}` : ""}
                    {m.created_at ? ` · ${formatDhakaDate(m.created_at, locale)}` : ""}
                  </p>
                </div>

                {/* Status Transition Controls */}
                <div
                  role="group"
                  aria-label={locale === "bn" ? "অবস্থা পরিবর্তন" : "Update ticket status"}
                  className="flex shrink-0 flex-wrap items-center gap-1.5"
                >
                  {(
                    [
                      ["open", locale === "bn" ? "খোলা" : "Open"],
                      ["in_progress", locale === "bn" ? "চলমান" : "In Progress"],
                      ["resolved", locale === "bn" ? "সমাধান" : "Resolved"]
                    ] as const
                  ).map(([st, label]) => {
                    const active = m.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        disabled={updatingId === m.id}
                        aria-pressed={active}
                        onClick={() => void updateStatus(m.id, st)}
                        className={`min-h-8 cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                          active
                            ? "bg-[#046c4e] text-white"
                            : "border border-[var(--border-default)] bg-white text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* LOG ISSUE MODAL */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        titleId="maintenance-modal-title"
        maxWidth="max-w-md"
        closeLabel={locale === "bn" ? "বন্ধ করুন" : "Close dialog"}
        title={
          <span className="inline-flex items-center gap-2">
            <Wrench className="h-4 w-4 text-[#046c4e]" aria-hidden="true" />
            {locale === "bn" ? "নতুন মেরামতের বিবরণ" : "New Maintenance Request"}
          </span>
        }
      >
        <form onSubmit={createItem} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="maint-prop-select"
              label={locale === "bn" ? "বাড়ি" : "Property"}
              required
            >
              <Select
                id="maint-prop-select"
                required
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              id="maint-priority-select"
              label={locale === "bn" ? "অগ্রাধিকার" : "Priority"}
            >
              <Select
                id="maint-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
              >
                <option value="low">{priorityLabel("low")}</option>
                <option value="medium">{priorityLabel("medium")}</option>
                <option value="high">{priorityLabel("high")}</option>
                <option value="urgent">{priorityLabel("urgent")}</option>
              </Select>
            </Field>
          </div>

          <Field
            id="maint-title-input"
            label={locale === "bn" ? "সমস্যার শিরোনাম" : "Issue Title"}
            required
          >
            <Input
              id="maint-title-input"
              required
              minLength={2}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                locale === "bn" ? "যেমন: পানির কল লিক" : "e.g. Kitchen water tap leaking"
              }
            />
          </Field>

          <Field
            id="maint-desc-input"
            label={locale === "bn" ? "বিস্তারিত বিবরণ" : "Details"}
            required
          >
            <Textarea
              id="maint-desc-input"
              required
              minLength={2}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                locale === "bn"
                  ? "ফ্ল্যাট ও সমস্যার বিবরণ লিখুন..."
                  : "Describe location and repair needed..."
              }
            />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              {t(locale, "cancel")}
            </Button>
            <Button type="submit" variant="primary" loading={saving} disabled={!propertyId}>
              {locale === "bn" ? "অনুরোধ সেভ করুন" : "Save Request"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
