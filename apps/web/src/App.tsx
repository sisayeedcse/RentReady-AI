import type { Session } from "@supabase/supabase-js";
import {
  Building2,
  Calendar,
  Eye,
  EyeOff,
  FileText,
  Globe,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  ShieldCheck,
  Users,
  Wallet,
  Wrench,
  X
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useState, useTransition } from "react";
import { Toast } from "./components/Toast";
import { Button } from "./components/ui/Button";
import { Field, Input } from "./components/ui/Input";
import { Modal } from "./components/ui/Modal";
import { AlertBanner, SkeletonCards } from "./components/ui/States";
import { AuthScreen } from "./features/auth/AuthScreen";
import type { FinanceSubTab } from "./features/finance/FinanceView";
import type { LegalDocType } from "./features/legal/LegalPages";
import type { SmsDraft } from "./features/notifications/SmsModal";
import { toFriendlyError } from "./lib/friendlyError";
import { getCurrentDhakaMonthLabel, type Locale, t } from "./lib/i18n";
import { supabase } from "./lib/supabase";

const DashboardView = lazy(() =>
  import("./features/dashboard/DashboardView").then((m) => ({ default: m.DashboardView }))
);
const FinanceView = lazy(() =>
  import("./features/finance/FinanceView").then((m) => ({ default: m.FinanceView }))
);
const MaintenanceView = lazy(() =>
  import("./features/maintenance/MaintenanceView").then((m) => ({ default: m.MaintenanceView }))
);
const LogsView = lazy(() =>
  import("./features/notifications/LogsView").then((m) => ({ default: m.LogsView }))
);
const PropertiesView = lazy(() =>
  import("./features/properties/PropertiesView").then((m) => ({ default: m.PropertiesView }))
);
const TenantsView = lazy(() =>
  import("./features/tenants/TenantsView").then((m) => ({ default: m.TenantsView }))
);
const VoiceCopilotView = lazy(() =>
  import("./features/voice/VoiceCopilotView").then((m) => ({ default: m.VoiceCopilotView }))
);
const LegalModal = lazy(() =>
  import("./features/legal/LegalPages").then((m) => ({ default: m.LegalModal }))
);
const SmsModal = lazy(() =>
  import("./features/notifications/SmsModal").then((m) => ({ default: m.SmsModal }))
);

export type TabId =
  | "dashboard"
  | "voice"
  | "properties"
  | "tenants"
  | "finance"
  | "maintenance"
  | "logs";

export interface NavigateOptions {
  financeSubTab?: FinanceSubTab;
}

function getInitialLegalDoc(): LegalDocType | null {
  const path = window.location.pathname.toLowerCase();
  if (path === "/privacy") return "privacy";
  if (path === "/terms") return "terms";
  if (path === "/cookies") return "cookies";
  return null;
}

function getInitials(name: string, email?: string): string {
  const cleaned = name.trim();
  if (cleaned) {
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
    }
    return cleaned.slice(0, 2).toUpperCase();
  }
  return (email?.[0] ?? "R").toUpperCase();
}

export function App() {
  const [locale, setLocale] = useState<Locale>("bn");
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(Boolean(supabase));
  const [tab, setTab] = useState<TabId>("dashboard");
  const [financeInitialTab, setFinanceInitialTab] = useState<FinanceSubTab>("bills");
  const [financeNavKey, setFinanceNavKey] = useState(0);
  const [smsDraft, setSmsDraft] = useState<SmsDraft | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(getInitialLegalDoc);
  const [, startTransition] = useTransition();

  // Supabase PASSWORD_RECOVERY flow state
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showRecoveryPw, setShowRecoveryPw] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title =
      locale === "bn"
        ? "RentReady — ডিজিটাল বাড়িভাড়া খাতা ও হিসাবরক্ষক"
        : "RentReady — Smart Rental Property Ledger";
  }, [locale]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingAuth(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 3400);
  }, []);

  const selectTab = useCallback((next: TabId, opts?: NavigateOptions) => {
    startTransition(() => {
      if (next === "finance" && opts?.financeSubTab) {
        setFinanceInitialTab(opts.financeSubTab);
        setFinanceNavKey((k) => k + 1);
      }
      setTab(next);
    });
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  async function handleSignOut() {
    setSmsDraft(null);
    setMobileMenuOpen(false);
    setTab("dashboard");
    await supabase?.auth.signOut().catch(() => {});
  }

  async function handlePasswordRecoverySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setRecoveryError(null);
    if (newPassword.length < 8) {
      setRecoveryError(
        locale === "bn"
          ? "নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।"
          : "New password must be at least 8 characters long."
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setRecoveryError(
        locale === "bn" ? "দুটি পাসওয়ার্ড মেলেনি।" : "Passwords do not match."
      );
      return;
    }
    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setRecoveryMode(false);
      setNewPassword("");
      setConfirmPassword("");
      showToast(
        locale === "bn"
          ? "পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!"
          : "Password updated successfully!"
      );
    } catch (err) {
      setRecoveryError(toFriendlyError(err, locale));
    } finally {
      setUpdatingPassword(false);
    }
  }

  const toggleLocale = () => setLocale((prev) => (prev === "bn" ? "en" : "bn"));

  if (checkingAuth) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--bg-canvas)]"
        role="status"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#046c4e] text-white shadow-sm">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-secondary)]">
          <span>{t(locale, "brand")}</span>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#046c4e]" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <AuthScreen
          locale={locale}
          onToggleLocale={toggleLocale}
          onOpenLegal={setLegalDoc}
        />
        {legalDoc && (
          <Suspense fallback={null}>
            <LegalModal
              doc={legalDoc}
              locale={locale}
              onChangeDoc={setLegalDoc}
              onClose={() => setLegalDoc(null)}
            />
          </Suspense>
        )}
      </>
    );
  }

  const rawFullName = (session.user.user_metadata?.full_name as string | undefined) ?? "";
  const cleanUserName = rawFullName.replace(/\s*\(demo.*?\)\s*/gi, "").trim();
  const userEmail = session.user.email ?? "";
  const userInitials = getInitials(cleanUserName, userEmail);
  const monthLabel = getCurrentDhakaMonthLabel(locale);

  const navGroups: Array<{
    label: string;
    items: Array<{ id: TabId; label: string; icon: React.ReactNode }>;
  }> = [
    {
      label: locale === "bn" ? "মূল প্যানেল" : "Overview",
      items: [
        {
          id: "dashboard",
          label: t(locale, "navDashboard"),
          icon: <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
        },
        {
          id: "voice",
          label: t(locale, "navVoice"),
          icon: <Mic className="h-4 w-4 shrink-0" aria-hidden="true" />
        }
      ]
    },
    {
      label: locale === "bn" ? "পরিচালনা ও হিসাব" : "Operations",
      items: [
        {
          id: "finance",
          label: t(locale, "navFinance"),
          icon: <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
        },
        {
          id: "properties",
          label: t(locale, "navProperties"),
          icon: <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        },
        {
          id: "tenants",
          label: t(locale, "navTenants"),
          icon: <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
        },
        {
          id: "maintenance",
          label: t(locale, "navMaintenance"),
          icon: <Wrench className="h-4 w-4 shrink-0" aria-hidden="true" />
        }
      ]
    },
    {
      label: locale === "bn" ? "রেকর্ড ও অডিট" : "Records",
      items: [
        {
          id: "logs",
          label: t(locale, "navLogs"),
          icon: <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
        }
      ]
    }
  ];

  const allNavItems = navGroups.flatMap((g) => g.items);
  const activeNav = allNavItems.find((item) => item.id === tab);
  const token = session.access_token;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--ink-primary)] md:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-[#046c4e] focus:px-4 py-2 focus:text-xs focus:font-bold focus:text-white focus:shadow-lg"
      >
        {locale === "bn" ? "মূল অংশে যান" : "Skip to main content"}
      </a>

      <Toast message={toastMsg} onClose={() => setToastMsg(null)} />

      {/* DESKTOP PERSISTENT SIDEBAR RAIL */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-[var(--border-default)] md:bg-[var(--bg-rail)]">
        {/* Brand Masthead */}
        <div className="flex h-14 items-center gap-2.5 border-b border-[var(--border-subtle)] px-4">
          <button
            type="button"
            onClick={() => selectTab("dashboard")}
            className="flex cursor-pointer items-center gap-2.5 text-left transition-opacity hover:opacity-90"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#046c4e] text-white shadow-xs">
              <Building2 className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-extrabold tracking-tight text-[var(--ink-primary)]">
                {t(locale, "brand")}
              </p>
              <p className="text-[11px] font-medium text-[var(--ink-muted)]">
                {t(locale, "badge")}
              </p>
            </div>
          </button>
        </div>

        {/* Grouped Navigation */}
        <nav
          aria-label={locale === "bn" ? "প্রধান নেভিগেশন" : "Primary navigation"}
          className="flex-1 space-y-5 overflow-y-auto px-3 py-4"
        >
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-wider text-[var(--ink-muted)] uppercase">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => selectTab(item.id)}
                      className={`group relative flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-colors duration-150 ${
                        active
                          ? "bg-[#ecfdf5] text-[#046c4e]"
                          : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
                      }`}
                    >
                      {active && (
                        <span
                          className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-r-full bg-[#046c4e]"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={
                          active
                            ? "text-[#046c4e]"
                            : "text-[var(--ink-muted)] group-hover:text-[var(--ink-primary)]"
                        }
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer: Account + Legal + Sign Out */}
        <div className="border-t border-[var(--border-subtle)] p-3 space-y-2.5">
          <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-white px-2.5 py-2">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ecfdf5] text-xs font-bold text-[#046c4e]"
              aria-hidden="true"
            >
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[var(--ink-primary)]">
                {cleanUserName || (locale === "bn" ? "বাড়িওয়ালা" : "Landlord")}
              </p>
              {userEmail && (
                <p className="truncate text-[11px] text-[var(--ink-muted)]">{userEmail}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              title={t(locale, "signOut")}
              aria-label={t(locale, "signOut")}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--ink-muted)] transition-colors hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[11px] font-medium text-[var(--ink-muted)]">
            <ShieldCheck className="h-3 w-3 shrink-0 text-[#046c4e]" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setLegalDoc("privacy")}
              className="cursor-pointer hover:text-[#046c4e] hover:underline"
            >
              {locale === "bn" ? "গোপনীয়তা" : "Privacy"}
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setLegalDoc("terms")}
              className="cursor-pointer hover:text-[#046c4e] hover:underline"
            >
              {locale === "bn" ? "শর্তাবলি" : "Terms"}
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setLegalDoc("cookies")}
              className="cursor-pointer hover:text-[#046c4e] hover:underline"
            >
              {locale === "bn" ? "কুকি" : "Cookies"}
            </button>
          </div>
        </div>
      </aside>

      {/* RIGHT WORKSPACE COLUMN */}
      <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-0">
        {/* Top Workspace Utility Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[var(--border-default)] bg-white/95 px-4 backdrop-blur-sm sm:px-6">
          {/* Mobile Brand + Active View */}
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => selectTab("dashboard")}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#046c4e] text-white md:hidden"
              aria-label={t(locale, "brand")}
            >
              <Building2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold tracking-tight text-[var(--ink-primary)] sm:text-[15px]">
                {activeNav?.label ?? t(locale, "brand")}
              </h1>
              <p className="hidden items-center gap-1 text-[11px] font-medium text-[var(--ink-muted)] sm:flex">
                <Calendar className="h-3 w-3 text-[#046c4e]" aria-hidden="true" />
                <span>{monthLabel}</span>
                <span aria-hidden="true">•</span>
                <span>{locale === "bn" ? "ঢাকা সময় (BST)" : "Asia/Dhaka"}</span>
              </p>
            </div>
          </div>

          {/* Right Utilities */}
          <div className="flex shrink-0 items-center gap-2">
            {tab !== "voice" && (
              <Button
                variant="subtle"
                size="sm"
                onClick={() => selectTab("voice")}
                className="hidden sm:inline-flex"
              >
                <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                {t(locale, "navVoice")}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleLocale}
              aria-label={
                locale === "bn" ? "Switch language to English" : "ভাষা বাংলায় পরিবর্তন করুন"
              }
            >
              <Globe className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden="true" />
              <span>{t(locale, "switchLang")}</span>
            </Button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              aria-label={t(locale, "signOut")}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--border-default)] bg-white text-[var(--ink-secondary)] transition-colors hover:bg-rose-50 hover:text-rose-700 md:hidden"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Main Stable Content Landmark */}
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 focus:outline-none sm:px-6 sm:py-6"
        >
          <div key={tab} className="animate-fade-up">
            <Suspense fallback={<ViewSkeleton />}>
              {tab === "dashboard" && (
                <DashboardView
                  accessToken={token}
                  locale={locale}
                  userName={cleanUserName || undefined}
                  onOpenSms={setSmsDraft}
                  onNavigate={selectTab}
                  onToast={showToast}
                />
              )}
              {tab === "voice" && (
                <VoiceCopilotView
                  accessToken={token}
                  locale={locale}
                  onToast={showToast}
                />
              )}
              {tab === "properties" && (
                <PropertiesView
                  accessToken={token}
                  locale={locale}
                  onToast={showToast}
                />
              )}
              {tab === "tenants" && (
                <TenantsView
                  accessToken={token}
                  locale={locale}
                  onOpenSms={setSmsDraft}
                  onToast={showToast}
                />
              )}
              {tab === "finance" && (
                <FinanceView
                  key={financeNavKey}
                  accessToken={token}
                  locale={locale}
                  initialSubTab={financeInitialTab}
                  onOpenSms={setSmsDraft}
                  onToast={showToast}
                />
              )}
              {tab === "maintenance" && (
                <MaintenanceView
                  accessToken={token}
                  locale={locale}
                  onToast={showToast}
                />
              )}
              {tab === "logs" && <LogsView accessToken={token} locale={locale} />}
            </Suspense>
          </div>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav
        aria-label={locale === "bn" ? "মোবাইল নেভিগেশন" : "Mobile navigation"}
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-default)] bg-white/98 backdrop-blur-sm md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5 pb-1">
          <MobileTabButton
            active={tab === "dashboard"}
            icon={<LayoutDashboard className="h-5 w-5" aria-hidden="true" />}
            label={locale === "bn" ? "হোম" : "Home"}
            onClick={() => selectTab("dashboard")}
          />
          <MobileTabButton
            active={tab === "finance"}
            icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
            label={locale === "bn" ? "খাতা" : "Ledger"}
            onClick={() => selectTab("finance")}
          />

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => selectTab("voice")}
              aria-label={t(locale, "navVoice")}
              aria-current={tab === "voice" ? "page" : undefined}
              className={`-mt-5 flex h-13 w-13 cursor-pointer items-center justify-center rounded-full shadow-md ring-4 ring-white transition-transform duration-150 active:scale-95 ${
                tab === "voice"
                  ? "bg-[#03543f] text-white"
                  : "bg-[#046c4e] text-white hover:bg-[#03543f]"
              }`}
            >
              <Mic className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="mt-1 text-[10px] font-bold text-[#046c4e]">
              {locale === "bn" ? "বলুন" : "Speak"}
            </span>
          </div>

          <MobileTabButton
            active={tab === "properties"}
            icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
            label={locale === "bn" ? "ফ্ল্যাট" : "Units"}
            onClick={() => selectTab("properties")}
          />
          <MobileTabButton
            active={
              mobileMenuOpen ||
              tab === "tenants" ||
              tab === "maintenance" ||
              tab === "logs"
            }
            icon={<Menu className="h-5 w-5" aria-hidden="true" />}
            label={locale === "bn" ? "আরও" : "More"}
            onClick={() => setMobileMenuOpen((v) => !v)}
          />
        </div>
      </nav>

      {/* MOBILE "MORE" BOTTOM SHEET */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[#0d1512]/55 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-more-title"
            className="animate-sheet-up w-full rounded-t-2xl border-t border-[var(--border-default)] bg-white p-5 pb-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-slate-300" aria-hidden="true" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p id="mobile-more-title" className="text-sm font-bold text-[var(--ink-primary)]">
                  {locale === "bn" ? "সব বিভাগ" : "All Sections"}
                </p>
                {cleanUserName && (
                  <p className="text-[11px] text-[var(--ink-muted)]">{cleanUserName}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label={locale === "bn" ? "মেনু বন্ধ করুন" : "Close menu"}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-[var(--bg-subtle)] text-[var(--ink-secondary)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {allNavItems.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => selectTab(item.id)}
                    className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                      active
                        ? "border-[#a7f3d0] bg-[#ecfdf5] text-[#046c4e]"
                        : "border-[var(--border-default)] bg-white text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3.5 text-xs">
              <div className="flex items-center gap-2.5 font-medium text-[var(--ink-muted)]">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setLegalDoc("privacy");
                  }}
                  className="cursor-pointer hover:text-[#046c4e] hover:underline"
                >
                  {locale === "bn" ? "গোপনীয়তা" : "Privacy"}
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setLegalDoc("terms");
                  }}
                  className="cursor-pointer hover:text-[#046c4e] hover:underline"
                >
                  {locale === "bn" ? "শর্তাবলি" : "Terms"}
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setLegalDoc("cookies");
                  }}
                  className="cursor-pointer hover:text-[#046c4e] hover:underline"
                >
                  {locale === "bn" ? "কুকি" : "Cookies"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-rose-700 hover:underline"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                {t(locale, "signOut")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASSWORD RECOVERY MODAL */}
      <Modal
        open={recoveryMode}
        onClose={() => setRecoveryMode(false)}
        titleId="recovery-modal-title"
        maxWidth="max-w-md"
        closeLabel={locale === "bn" ? "বন্ধ করুন" : "Close"}
        title={
          <span className="inline-flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#046c4e]" aria-hidden="true" />
            {locale === "bn" ? "নতুন পাসওয়ার্ড সেট করুন" : "Set New Password"}
          </span>
        }
      >
        <form onSubmit={handlePasswordRecoverySubmit} className="space-y-4">
          <Field
            id="recovery-new-pw"
            label={
              locale === "bn"
                ? "নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)"
                : "New Password (min 8 characters)"
            }
            required
          >
            <Input
              id="recovery-new-pw"
              type={showRecoveryPw ? "text" : "password"}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowRecoveryPw((v) => !v)}
                  aria-label={
                    showRecoveryPw
                      ? locale === "bn"
                        ? "পাসওয়ার্ড লুকান"
                        : "Hide password"
                      : locale === "bn"
                        ? "পাসওয়ার্ড দেখুন"
                        : "Show password"
                  }
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)]"
                >
                  {showRecoveryPw ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              }
            />
          </Field>

          <Field
            id="recovery-confirm-pw"
            label={locale === "bn" ? "পাসওয়ার্ড নিশ্চিত করুন" : "Confirm New Password"}
            required
          >
            <Input
              id="recovery-confirm-pw"
              type={showRecoveryPw ? "text" : "password"}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </Field>

          {recoveryError && <AlertBanner tone="error" message={recoveryError} />}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setRecoveryMode(false)}>
              {t(locale, "cancel")}
            </Button>
            <Button type="submit" loading={updatingPassword}>
              {locale === "bn" ? "পাসওয়ার্ড আপডেট করুন" : "Update Password"}
            </Button>
          </div>
        </form>
      </Modal>

      {smsDraft && (
        <Suspense fallback={null}>
          <SmsModal
            draft={smsDraft}
            accessToken={token}
            locale={locale}
            onClose={() => setSmsDraft(null)}
            onSent={showToast}
          />
        </Suspense>
      )}

      {legalDoc && (
        <Suspense fallback={null}>
          <LegalModal
            doc={legalDoc}
            locale={locale}
            onChangeDoc={setLegalDoc}
            onClose={() => setLegalDoc(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

function MobileTabButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`flex min-h-11 cursor-pointer flex-col items-center justify-center gap-0.5 py-1 transition-colors active:scale-95 ${
        active ? "text-[#046c4e]" : "text-[var(--ink-muted)]"
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function ViewSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-52 animate-pulse rounded-lg bg-slate-200/80" />
      <SkeletonCards count={4} cols="sm:grid-cols-2 lg:grid-cols-4" />
    </div>
  );
}
