import { getDhakaDateString } from "@rentready/shared/date";
import { bdtToPaisa, formatBdt, paisaToBdtString } from "@rentready/shared/money";
import { Phone, Plus, Send, UserCheck, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field, Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import {
  AlertBanner,
  EmptyState,
  PageHeader,
  SearchInput,
  SkeletonRows
} from "../../components/ui/States";
import { SegmentedTabs } from "../../components/ui/Tabs";
import { apiFetch } from "../../lib/api";
import { toFriendlyError } from "../../lib/friendlyError";
import { type Locale, t } from "../../lib/i18n";
import type { SmsDraft } from "../notifications/SmsModal";

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
  tenant_id: string;
  monthly_rent_paisa: number;
  start_date: string;
  status: string;
  tenants: { full_name: string; phone_e164: string } | null;
  units: { unit_code: string; properties: { name: string } | null } | null;
}

export function TenantsView({
  accessToken,
  locale,
  onOpenSms,
  onToast
}: {
  accessToken: string;
  locale: Locale;
  onOpenSms?: (draft: SmsDraft) => void;
  onToast?: (msg: string) => void;
}) {
  const [subTab, setSubTab] = useState<"leases" | "directory">("leases");
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [tenancies, setTenancies] = useState<TenancyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  const [openModal, setOpenModal] = useState<"none" | "tenant" | "assign">("none");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [unitId, setUnitId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [monthlyRentBdt, setMonthlyRentBdt] = useState("12000");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
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
    } finally {
      setLoading(false);
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
      setOpenModal("none");
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
      setOpenModal("none");
      onToast?.(locale === "bn" ? "ফ্ল্যাটে ভাড়াটিয়া বরাদ্দ হয়েছে!" : "Tenant assigned to unit!");
      await load();
    } catch (err) {
      setError(toFriendlyError(err, locale));
    } finally {
      setSaving(false);
    }
  }

  const vacantUnits = useMemo(() => units.filter((u) => u.status === "vacant"), [units]);

  const activeLeaseByTenant = useMemo(() => {
    const map = new Map<string, TenancyRow>();
    for (const row of tenancies) {
      if (row.status === "active") map.set(row.tenant_id, row);
    }
    return map;
  }, [tenancies]);

  const filteredTenancies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenancies.filter((row) => {
      if (!q) return true;
      return (
        (row.tenants?.full_name ?? "").toLowerCase().includes(q) ||
        (row.tenants?.phone_e164 ?? "").includes(q) ||
        (row.units?.unit_code ?? "").toLowerCase().includes(q) ||
        (row.units?.properties?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [tenancies, search]);

  const filteredDirectory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((tn) => {
      if (!q) return true;
      return tn.full_name.toLowerCase().includes(q) || tn.phone_e164.includes(q);
    });
  }, [tenants, search]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={locale === "bn" ? "ভাড়াটিয়া ব্যবস্থাপনা" : "Tenants & Leases"}
        subtitle={
          locale === "bn"
            ? `মোট ${tenants.length} জন ভাড়াটিয়া · ${tenancies.length}টি সক্রিয় ফ্ল্যাট বরাদ্দ`
            : `${tenants.length} total tenants · ${tenancies.length} active leases`
        }
        actions={
          <>
            <Button variant="primary" size="sm" onClick={() => setOpenModal("tenant")}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {locale === "bn" ? "নতুন ভাড়াটিয়া" : "Add Tenant"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setOpenModal("assign")}>
              <UserCheck className="h-3.5 w-3.5 text-[#046c4e]" aria-hidden="true" />
              {locale === "bn" ? "ফ্ল্যাট বরাদ্দ" : "Assign Unit"}
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs
          ariaLabel={locale === "bn" ? "ভাড়াটিয়া ভিউ" : "Tenant views"}
          value={subTab}
          onChange={(next) => startTransition(() => setSubTab(next))}
          options={[
            {
              id: "leases",
              label: locale === "bn" ? "সক্রিয় চুক্তি" : "Active Leases",
              count: tenancies.length
            },
            {
              id: "directory",
              label: locale === "bn" ? "সকল ভাড়াটিয়া" : "All Tenants",
              count: tenants.length
            }
          ]}
        />

        <SearchInput
          value={search}
          onChange={(v) => startTransition(() => setSearch(v))}
          placeholder={
            locale === "bn"
              ? "নাম, ফ্ল্যাট নম্বর বা মোবাইল..."
              : "Search name, unit, or phone..."
          }
          ariaLabel={locale === "bn" ? "ভাড়াটিয়া খুঁজুন" : "Search tenants"}
          className="sm:w-72"
        />
      </div>

      {loading ? (
        <SkeletonRows count={5} />
      ) : subTab === "leases" ? (
        filteredTenancies.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            title={t(locale, "noData")}
            description={
              tenancies.length === 0
                ? locale === "bn"
                  ? "খালি ফ্ল্যাটে ভাড়াটিয়া বরাদ্দ করতে উপরের 'ফ্ল্যাট বরাদ্দ' বোতামে ক্লিক করুন।"
                  : "Assign a tenant to a vacant unit to start tracking monthly rent obligations."
                : undefined
            }
          />
        ) : (
          <Card className="overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-[11px] font-semibold text-[var(--ink-secondary)] uppercase">
                    <th className="px-4 py-3">{locale === "bn" ? "ভাড়াটিয়া" : "Tenant"}</th>
                    <th className="px-4 py-3">{locale === "bn" ? "ফ্ল্যাট ও বাড়ি" : "Unit & Property"}</th>
                    <th className="px-4 py-3">{locale === "bn" ? "মোবাইল" : "Phone"}</th>
                    <th className="px-4 py-3 text-right">{locale === "bn" ? "মাসিক ভাড়া" : "Monthly Rent"}</th>
                    <th className="px-4 py-3 text-right">{locale === "bn" ? "যোগাযোগ" : "Contact"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] bg-white">
                  {filteredTenancies.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-[var(--bg-hover)]">
                      <td className="px-4 py-3.5 font-bold text-[var(--ink-primary)]">
                        {row.tenants?.full_name}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Badge tone="emerald">
                            {locale === "bn"
                              ? `ফ্ল্যাট ${row.units?.unit_code}`
                              : `Unit ${row.units?.unit_code}`}
                          </Badge>
                          <span className="text-[var(--ink-muted)]">
                            {row.units?.properties?.name}
                          </span>
                        </div>
                      </td>
                      <td className="tabular-nums px-4 py-3.5 font-mono text-[11px] text-[var(--ink-secondary)]">
                        {row.tenants?.phone_e164}
                      </td>
                      <td className="tabular-nums px-4 py-3.5 text-right text-[13px] font-bold text-[#046c4e]">
                        {formatBdt(row.monthly_rent_paisa, locale)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {row.tenants?.phone_e164 && (
                            <a
                              href={`tel:${row.tenants.phone_e164}`}
                              aria-label={
                                locale === "bn"
                                  ? `${row.tenants.full_name}-কে কল করুন`
                                  : `Call ${row.tenants.full_name}`
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-default)] bg-white text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
                            >
                              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                          )}
                          {onOpenSms && row.tenants?.phone_e164 && (
                            <Button
                              variant="subtle"
                              size="sm"
                              onClick={() =>
                                onOpenSms({
                                  tenantId: row.tenant_id,
                                  tenantName: row.tenants!.full_name,
                                  phoneE164: row.tenants!.phone_e164,
                                  templateType: "rent_reminder",
                                  initialMessage:
                                    locale === "bn"
                                      ? `আসসালামু আলাইকুম ${row.tenants!.full_name} (ফ্ল্যাট ${row.units?.unit_code ?? ""}), আপনার মাসিক ভাড়া ${formatBdt(row.monthly_rent_paisa, "bn")} সম্পর্কে স্মরণ করিয়ে দেওয়া হচ্ছে। ধন্যবাদ।`
                                      : `Hello ${row.tenants!.full_name} (Unit ${row.units?.unit_code ?? ""}), a friendly reminder regarding your monthly rent of ${formatBdt(row.monthly_rent_paisa, "en")}. Thank you.`
                                })
                              }
                            >
                              <Send className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>SMS</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="divide-y divide-[var(--border-subtle)] md:hidden">
              {filteredTenancies.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-[var(--ink-primary)]">
                        {row.tenants?.full_name}
                      </span>
                      <Badge tone="emerald">
                        {locale === "bn"
                          ? `ফ্ল্যাট ${row.units?.unit_code}`
                          : `Unit ${row.units?.unit_code}`}
                      </Badge>
                    </div>
                    <p className="tabular-nums mt-0.5 text-xs text-[var(--ink-muted)]">
                      {row.units?.properties?.name} · {row.tenants?.phone_e164}
                    </p>
                    <p className="tabular-nums mt-1 text-sm font-bold text-[#046c4e]">
                      {formatBdt(row.monthly_rent_paisa, locale)}
                      <span className="text-[11px] font-normal text-[var(--ink-muted)]">
                        {locale === "bn" ? " / মাস" : " / month"}
                      </span>
                    </p>
                  </div>
                  {row.tenants?.phone_e164 && (
                    <a
                      href={`tel:${row.tenants.phone_e164}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-[#046c4e]"
                      aria-label={`Call ${row.tenants.full_name}`}
                    >
                      <Phone className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )
      ) : filteredDirectory.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" aria-hidden="true" />} title={t(locale, "noData")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDirectory.map((tn) => {
            const lease = activeLeaseByTenant.get(tn.id);
            return (
              <div
                key={tn.id}
                className="surface-card flex flex-col justify-between gap-3 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--ink-primary)]">
                      {tn.full_name}
                    </p>
                    <p className="tabular-nums mt-0.5 font-mono text-xs text-[var(--ink-muted)]">
                      {tn.phone_e164}
                    </p>
                  </div>
                  {tn.is_banglalink && (
                    <Badge tone="emerald">
                      {locale === "bn" ? "বাংলালিংক SMS" : "BL SMS"}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
                  {lease ? (
                    <Badge tone="blue">
                      {locale === "bn"
                        ? `ফ্ল্যাট ${lease.units?.unit_code}`
                        : `Unit ${lease.units?.unit_code}`}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">
                      {locale === "bn" ? "ফ্ল্যাট বরাদ্দ নেই" : "Unassigned"}
                    </Badge>
                  )}

                  <div className="flex items-center gap-1.5">
                    {!lease && vacantUnits.length > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setTenantId(tn.id);
                          setOpenModal("assign");
                        }}
                      >
                        {locale === "bn" ? "বরাদ্দ করুন" : "Assign"}
                      </Button>
                    )}
                    <a
                      href={`tel:${tn.phone_e164}`}
                      aria-label={`Call ${tn.full_name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-default)] bg-white text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD TENANT MODAL */}
      <Modal
        open={openModal === "tenant"}
        onClose={() => setOpenModal("none")}
        titleId="add-tenant-modal-title"
        maxWidth="max-w-md"
        closeLabel={locale === "bn" ? "বন্ধ করুন" : "Close dialog"}
        title={
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4 text-[#046c4e]" aria-hidden="true" />
            {locale === "bn" ? "নতুন ভাড়াটিয়ার তথ্য" : "New Tenant Profile"}
          </span>
        }
      >
        <form onSubmit={addTenant} className="space-y-4">
          <Field
            id="tenant-fullname-input"
            label={locale === "bn" ? "ভাড়াটিয়ার পূর্ণ নাম" : "Tenant Full Name"}
            required
          >
            <Input
              id="tenant-fullname-input"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={locale === "bn" ? "যেমন: রহিম উদ্দিন" : "e.g. Rahim Uddin"}
            />
          </Field>

          <Field
            id="tenant-phone-input"
            label={locale === "bn" ? "মোবাইল নম্বর (বাংলাদেশ)" : "Mobile Number (Bangladesh)"}
            required
            hint={
              locale === "bn"
                ? "019 বা 014 নম্বর হলে সরাসরি Banglalink AppLink SMS পাঠানো যাবে।"
                : "019 or 014 numbers support direct Banglalink AppLink SMS."
            }
          >
            <Input
              id="tenant-phone-input"
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="019XXXXXXXX"
              className="tabular-nums font-mono"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpenModal("none")}>
              {t(locale, "cancel")}
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {locale === "bn" ? "ভাড়াটিয়া সেভ করুন" : "Save Tenant"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ASSIGN UNIT MODAL */}
      <Modal
        open={openModal === "assign"}
        onClose={() => setOpenModal("none")}
        titleId="assign-unit-modal-title"
        maxWidth="max-w-md"
        closeLabel={locale === "bn" ? "বন্ধ করুন" : "Close dialog"}
        title={
          <span className="inline-flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-[#046c4e]" aria-hidden="true" />
            {locale === "bn"
              ? "খালি ফ্ল্যাটে ভাড়াটিয়া বরাদ্দ করুন"
              : "Assign Tenant to Vacant Unit"}
          </span>
        }
      >
        <form onSubmit={assignTenancy} className="space-y-4">
          {vacantUnits.length === 0 && (
            <AlertBanner
              tone="info"
              message={
                locale === "bn"
                  ? "এই মুহূর্তে কোনো খালি ফ্ল্যাট নেই। আগে 'বাড়ি ও ফ্ল্যাট' পাতা থেকে একটি ফ্ল্যাট যুক্ত করুন।"
                  : "There are no vacant units right now. Add a unit from the Properties view first."
              }
            />
          )}

          <Field
            id="assign-unit-select"
            label={locale === "bn" ? "খালি ফ্ল্যাট" : "Vacant Unit"}
            required
          >
            <Select
              id="assign-unit-select"
              required
              value={unitId}
              onChange={(e) => {
                setUnitId(e.target.value);
                const found = units.find((u) => u.id === e.target.value);
                if (found) setMonthlyRentBdt(paisaToBdtString(found.default_rent_paisa));
              }}
            >
              <option value="">
                {locale === "bn" ? "খালি ফ্ল্যাট বাছাই করুন" : "Select Vacant Unit"}
              </option>
              {vacantUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {locale === "bn" ? `ফ্ল্যাট ${u.unit_code}` : `Unit ${u.unit_code}`}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="assign-tenant-select"
            label={locale === "bn" ? "ভাড়াটিয়া" : "Tenant"}
            required
          >
            <Select
              id="assign-tenant-select"
              required
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            >
              <option value="">
                {locale === "bn" ? "ভাড়াটিয়া বাছাই করুন" : "Select Tenant"}
              </option>
              {tenants.map((tn) => (
                <option key={tn.id} value={tn.id}>
                  {tn.full_name} ({tn.phone_e164})
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="assign-rent-input"
            label={locale === "bn" ? "মাসিক ভাড়া (টাকা)" : "Monthly Rent (BDT)"}
            required
          >
            <Input
              id="assign-rent-input"
              required
              type="number"
              min="1"
              step="0.01"
              value={monthlyRentBdt}
              onChange={(e) => setMonthlyRentBdt(e.target.value)}
              className="tabular-nums font-semibold"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpenModal("none")}>
              {t(locale, "cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={!unitId || !tenantId}
            >
              {locale === "bn" ? "চুক্তি চালু করুন" : "Start Lease"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
