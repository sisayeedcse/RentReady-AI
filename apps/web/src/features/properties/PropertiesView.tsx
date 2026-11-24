import { addPaisa, bdtToPaisa, formatBdt } from "@rentready/shared/money";
import { Building2, Home, MapPin, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import {
  AlertBanner,
  EmptyState,
  PageHeader,
  SearchInput,
  SkeletonCards
} from "../../components/ui/States";
import { FilterPills } from "../../components/ui/Tabs";
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
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "occupied" | "vacant">("all");
  const [activePropertyId, setActivePropertyId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  const [openModal, setOpenModal] = useState<"none" | "property" | "unit">("none");
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
      setError(null);
      const [pRes, uRes] = await Promise.all([
        apiFetch<{ data: PropertyRow[] }>("/api/properties", accessToken),
        apiFetch<{ data: UnitRow[] }>("/api/units", accessToken)
      ]);
      setProperties(pRes.data);
      setUnits(uRes.data);
      const firstId = pRes.data[0]?.id ?? "";
      if (firstId) {
        setSelectedPropId((prev) => prev || firstId);
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
      setOpenModal("none");
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
      setOpenModal("none");
      onToast?.(locale === "bn" ? "নতুন ফ্ল্যাট যুক্ত হয়েছে!" : "Unit added!");
      await load();
    } catch (err) {
      setError(toFriendlyError(err, locale));
    } finally {
      setSaving(false);
    }
  }

  const propertyStats = useMemo(() => {
    const map = new Map<string, { total: number; occupied: number; rentPaisa: number }>();
    for (const u of units) {
      const curr = map.get(u.property_id) ?? { total: 0, occupied: 0, rentPaisa: 0 };
      curr.total += 1;
      if (u.status === "occupied") curr.occupied += 1;
      curr.rentPaisa = addPaisa(curr.rentPaisa, u.default_rent_paisa);
      map.set(u.property_id, curr);
    }
    return map;
  }, [units]);

  const scopedUnits = useMemo(
    () =>
      activePropertyId === "all"
        ? units
        : units.filter((u) => u.property_id === activePropertyId),
    [units, activePropertyId]
  );

  const occupiedCount = useMemo(
    () => scopedUnits.filter((u) => u.status === "occupied").length,
    [scopedUnits]
  );
  const vacantCount = useMemo(
    () => scopedUnits.filter((u) => u.status === "vacant").length,
    [scopedUnits]
  );

  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedUnits.filter((u) => {
      if (filter !== "all" && u.status !== filter) return false;
      if (!q) return true;
      return (
        u.unit_code.toLowerCase().includes(q) ||
        (u.floor_label ?? "").toLowerCase().includes(q) ||
        (u.properties?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [scopedUnits, filter, search]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={locale === "bn" ? "বাড়ি ও ফ্ল্যাট তালিকা" : "Properties & Units"}
        subtitle={
          locale === "bn"
            ? `${properties.length}টি বাড়ি · ${units.length}টি ফ্ল্যাট (${occupiedCount}টি ভাড়া, ${vacantCount}টি খালি)`
            : `${properties.length} properties · ${units.length} units (${occupiedCount} occupied, ${vacantCount} vacant)`
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setOpenModal("property")}>
              <Plus className="h-3.5 w-3.5 text-[#046c4e]" aria-hidden="true" />
              {locale === "bn" ? "নতুন বাড়ি" : "Add Property"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={properties.length === 0}
              onClick={() => {
                if (activePropertyId !== "all") setSelectedPropId(activePropertyId);
                setOpenModal("unit");
              }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {locale === "bn" ? "নতুন ফ্ল্যাট" : "Add Unit"}
            </Button>
          </>
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

      {loading ? (
        <SkeletonCards count={6} />
      ) : (
        <>
          {/* Interactive Property Filter Strip */}
          {properties.length > 0 && (
            <div
              role="group"
              aria-label={locale === "bn" ? "বাড়ি নির্বাচন ফিল্টার" : "Filter by property"}
              className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1"
            >
              <button
                type="button"
                aria-pressed={activePropertyId === "all"}
                onClick={() => startTransition(() => setActivePropertyId("all"))}
                className={`min-w-[160px] shrink-0 cursor-pointer rounded-xl border p-3.5 text-left transition-colors ${
                  activePropertyId === "all"
                    ? "border-[#046c4e] bg-[#ecfdf5]/70"
                    : "border-[var(--border-default)] bg-white hover:border-[var(--border-strong)]"
                }`}
              >
                <p className="text-xs font-bold text-[var(--ink-primary)]">
                  {locale === "bn" ? "সব বাড়ি" : "All Properties"}
                </p>
                <p className="tabular-nums mt-1 text-[11px] text-[var(--ink-muted)]">
                  {locale === "bn"
                    ? `${properties.length}টি বাড়ি · ${units.length}টি ফ্ল্যাট`
                    : `${properties.length} properties · ${units.length} units`}
                </p>
              </button>

              {properties.map((p) => {
                const st = propertyStats.get(p.id) ?? { total: 0, occupied: 0, rentPaisa: 0 };
                const active = activePropertyId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => startTransition(() => setActivePropertyId(p.id))}
                    className={`min-w-[230px] shrink-0 cursor-pointer rounded-xl border p-3.5 text-left transition-colors ${
                      active
                        ? "border-[#046c4e] bg-[#ecfdf5]/70"
                        : "border-[var(--border-default)] bg-white hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[var(--ink-primary)]">
                          {p.name}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-[var(--ink-muted)]">
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{p.address}</span>
                        </p>
                      </div>
                      <Badge tone={st.occupied === st.total && st.total > 0 ? "emerald" : "neutral"}>
                        <span className="tabular-nums">
                          {st.occupied}/{st.total}
                        </span>
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Filter & Search Toolbar */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <FilterPills
              ariaLabel={locale === "bn" ? "ফ্ল্যাট অবস্থা ফিল্টার" : "Filter units by status"}
              value={filter}
              onChange={(next) => startTransition(() => setFilter(next))}
              options={[
                { id: "all", label: t(locale, "all"), count: scopedUnits.length },
                { id: "occupied", label: t(locale, "occupied"), count: occupiedCount },
                { id: "vacant", label: t(locale, "vacant"), count: vacantCount }
              ]}
            />
            <SearchInput
              value={search}
              onChange={(v) => startTransition(() => setSearch(v))}
              placeholder={
                locale === "bn" ? "ফ্ল্যাট নম্বর বা তলা খুঁজুন..." : "Search unit code or floor..."
              }
              ariaLabel={locale === "bn" ? "ফ্ল্যাট খুঁজুন" : "Search units"}
              className="sm:w-64"
            />
          </div>

          {/* Units Grid */}
          {filteredUnits.length === 0 ? (
            <EmptyState
              icon={<Home className="h-5 w-5" aria-hidden="true" />}
              title={t(locale, "noData")}
              description={
                properties.length === 0
                  ? locale === "bn"
                    ? "শুরু করতে প্রথমে একটি নতুন বাড়ি যুক্ত করুন।"
                    : "Start by adding your first property, then add its rental units."
                  : undefined
              }
              action={
                properties.length === 0 ? (
                  <Button variant="primary" size="sm" onClick={() => setOpenModal("property")}>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    {locale === "bn" ? "প্রথম বাড়ি যুক্ত করুন" : "Add First Property"}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredUnits.map((u) => {
                const isOccupied = u.status === "occupied";
                return (
                  <div
                    key={u.id}
                    className="surface-card rounded-xl p-4 transition-colors hover:border-[var(--border-strong)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-bold text-[var(--ink-primary)]">
                          {locale === "bn" ? `ফ্ল্যাট ${u.unit_code}` : `Unit ${u.unit_code}`}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                          {u.properties?.name}
                          {u.floor_label ? ` · ${u.floor_label}` : ""}
                        </p>
                      </div>
                      <Badge tone={isOccupied ? "emerald" : "neutral"} dot>
                        {isOccupied ? t(locale, "occupied") : t(locale, "vacant")}
                      </Badge>
                    </div>
                    <div className="mt-4 flex items-baseline justify-between border-t border-[var(--border-subtle)] pt-3">
                      <span className="text-[11px] font-medium text-[var(--ink-muted)]">
                        {locale === "bn" ? "নির্ধারিত মাসিক ভাড়া" : "Default Monthly Rent"}
                      </span>
                      <span className="tabular-nums text-base font-bold text-[#046c4e]">
                        {formatBdt(u.default_rent_paisa, locale)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ADD PROPERTY MODAL */}
      <Modal
        open={openModal === "property"}
        onClose={() => setOpenModal("none")}
        titleId="add-property-modal-title"
        maxWidth="max-w-md"
        closeLabel={locale === "bn" ? "বন্ধ করুন" : "Close dialog"}
        title={
          <span className="inline-flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#046c4e]" aria-hidden="true" />
            {locale === "bn" ? "নতুন বাড়ির তথ্য দিন" : "Add New Property"}
          </span>
        }
      >
        <form onSubmit={addProperty} className="space-y-4">
          <Field
            id="prop-name-input"
            label={locale === "bn" ? "বাড়ির নাম" : "Property Name"}
            required
          >
            <Input
              id="prop-name-input"
              required
              value={propName}
              onChange={(e) => setPropName(e.target.value)}
              placeholder={
                locale === "bn" ? "যেমন: শান্তি নিবাস" : "e.g. Shanti Nibash"
              }
            />
          </Field>

          <Field
            id="prop-address-input"
            label={locale === "bn" ? "ঠিকানা" : "Address"}
            required
          >
            <Input
              id="prop-address-input"
              required
              value={propAddress}
              onChange={(e) => setPropAddress(e.target.value)}
              placeholder={
                locale === "bn"
                  ? "যেমন: ধানমন্ডি ৯/এ, ঢাকা"
                  : "e.g. House 14, Road 9/A, Dhanmondi"
              }
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpenModal("none")}>
              {t(locale, "cancel")}
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {locale === "bn" ? "বাড়ি সেভ করুন" : "Save Property"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ADD UNIT MODAL */}
      <Modal
        open={openModal === "unit"}
        onClose={() => setOpenModal("none")}
        titleId="add-unit-modal-title"
        maxWidth="max-w-md"
        closeLabel={locale === "bn" ? "বন্ধ করুন" : "Close dialog"}
        title={
          <span className="inline-flex items-center gap-2">
            <Home className="h-4 w-4 text-[#046c4e]" aria-hidden="true" />
            {locale === "bn" ? "নতুন ফ্ল্যাট / ইউনিট যোগ করুন" : "Add New Unit / Flat"}
          </span>
        }
      >
        <form onSubmit={addUnit} className="space-y-4">
          <Field
            id="unit-prop-select"
            label={locale === "bn" ? "বাড়ি নির্বাচন করুন" : "Property"}
            required
          >
            <Select
              id="unit-prop-select"
              required
              value={selectedPropId}
              onChange={(e) => setSelectedPropId(e.target.value)}
            >
              <option value="">
                {locale === "bn" ? "বাড়ি বাছাই করুন" : "Select property"}
              </option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="unit-code-input"
              label={locale === "bn" ? "ফ্ল্যাট নম্বর" : "Unit Code"}
              required
            >
              <Input
                id="unit-code-input"
                required
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value)}
                placeholder={locale === "bn" ? "যেমন: 3B" : "e.g. 3B"}
              />
            </Field>
            <Field
              id="unit-floor-input"
              label={locale === "bn" ? "তলা (ঐচ্ছিক)" : "Floor (Optional)"}
            >
              <Input
                id="unit-floor-input"
                value={floorLabel}
                onChange={(e) => setFloorLabel(e.target.value)}
                placeholder={locale === "bn" ? "যেমন: ৩য় তলা" : "e.g. 3rd Floor"}
              />
            </Field>
          </div>

          <Field
            id="unit-rent-input"
            label={locale === "bn" ? "মাসিক ভাড়া (টাকা)" : "Default Monthly Rent (BDT)"}
            required
          >
            <Input
              id="unit-rent-input"
              required
              type="number"
              min="1"
              step="0.01"
              value={unitRentBdt}
              onChange={(e) => setUnitRentBdt(e.target.value)}
              className="tabular-nums font-semibold"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpenModal("none")}>
              {t(locale, "cancel")}
            </Button>
            <Button type="submit" variant="primary" loading={saving} disabled={!selectedPropId}>
              {locale === "bn" ? "ফ্ল্যাট সেভ করুন" : "Save Unit"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
