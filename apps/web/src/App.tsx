import type { Session } from "@supabase/supabase-js";
import {
  Building2,
  FileText,
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
import { lazy, Suspense, useEffect, useState } from "react";
import { Toast } from "./components/Toast";
import { AuthScreen } from "./features/auth/AuthScreen";
import { DashboardView } from "./features/dashboard/DashboardView";
import { type LegalDocType, LegalModal } from "./features/legal/LegalPages";
import { type SmsDraft, SmsModal } from "./features/notifications/SmsModal";
import { toFriendlyError } from "./lib/friendlyError";
import { type Locale, t } from "./lib/i18n";
import { supabase } from "./lib/supabase";

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

type TabId = "dashboard" | "voice" | "properties" | "tenants" | "finance" | "maintenance" | "logs";

function getInitialLegalDoc(): LegalDocType | null {
  const path = window.location.pathname.toLowerCase();
  if (path === "/privacy") return "privacy";
  if (path === "/terms") return "terms";
  if (path === "/cookies") return "cookies";
  return null;
}

export function App() {
  const [locale, setLocale] = useState<Locale>("bn");
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(Boolean(supabase));
  const [tab, setTab] = useState<TabId>("dashboard");
  const [smsDraft, setSmsDraft] = useState<SmsDraft | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(getInitialLegalDoc);

  // Supabase PASSWORD_RECOVERY flow state
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.lang = locale;
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
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  function showToast(msg: string) {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 3200);
  }

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50" role="status">
        <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
          <Building2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="text-xs font-bold text-slate-600">{t(locale, "brand")}...</p>
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
          <LegalModal
            doc={legalDoc}
            locale={locale}
            onChangeDoc={setLegalDoc}
            onClose={() => setLegalDoc(null)}
          />
        )}
      </>
    );
  }

  const rawFullName = (session.user.user_metadata?.full_name as string | undefined) ?? "";
  const cleanUserName = rawFullName.replace(/\s*\(demo.*?\)\s*/gi, "").trim();

  const navItems: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: "dashboard", label: t(locale, "navDashboard"), icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> },
    { id: "voice", label: t(locale, "navVoice"), icon: <Mic className="h-4 w-4" aria-hidden="true" /> },
    { id: "finance", label: t(locale, "navFinance"), icon: <Wallet className="h-4 w-4" aria-hidden="true" /> },
    { id: "properties", label: t(locale, "navProperties"), icon: <Building2 className="h-4 w-4" aria-hidden="true" /> },
    { id: "tenants", label: t(locale, "navTenants"), icon: <Users className="h-4 w-4" aria-hidden="true" /> },
    { id: "maintenance", label: t(locale, "navMaintenance"), icon: <Wrench className="h-4 w-4" aria-hidden="true" /> },
    { id: "logs", label: t(locale, "navLogs"), icon: <FileText className="h-4 w-4" aria-hidden="true" /> }
  ];

  const token = session.access_token;

  function selectTab(next: TabId) {
    setTab(next);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-emerald-700 focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:text-white focus:shadow-lg"
      >
        {locale === "bn" ? "মূল অংশে যান" : "Skip to main content"}
      </a>

      <Toast message={toastMsg} onClose={() => setToastMsg(null)} />

      {/* Clean Glassmorphic Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => selectTab("dashboard")}
            className="flex items-center gap-2.5 text-left transition active:scale-95"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-sm">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900">
                {t(locale, "brand")}
              </h1>
              <p className="text-[11px] font-medium text-emerald-700">{t(locale, "badge")}</p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLocale}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95"
            >
              {t(locale, "switchLang")}
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              aria-label={t(locale, "signOut")}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-rose-50 hover:text-rose-700 active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t(locale, "signOut")}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-3.5 py-5 sm:px-4 sm:py-6">
        {/* Desktop Sidebar */}
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-20 space-y-3">
            <nav
              aria-label={locale === "bn" ? "প্রধান নেভিগেশন" : "Primary navigation"}
              className="space-y-1 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-xs"
            >
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={tab === item.id ? "page" : undefined}
                  onClick={() => selectTab(item.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 active:scale-[0.98] ${
                    tab === item.id
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/20"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-3 text-[11px] text-slate-600 shadow-2xs">
              <p className="mb-1.5 flex items-center gap-1.5 font-bold text-slate-800">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                {locale === "bn" ? "গোপনীয়তা ও শর্তাবলি" : "Privacy & Legal"}
              </p>
              <div className="flex flex-wrap gap-x-2.5 gap-y-1 font-semibold text-slate-700">
                <button type="button" onClick={() => setLegalDoc("privacy")} className="hover:text-emerald-700 hover:underline">
                  {locale === "bn" ? "গোপনীয়তা" : "Privacy"}
                </button>
                <button type="button" onClick={() => setLegalDoc("terms")} className="hover:text-emerald-700 hover:underline">
                  {locale === "bn" ? "শর্তাবলি" : "Terms"}
                </button>
                <button type="button" onClick={() => setLegalDoc("cookies")} className="hover:text-emerald-700 hover:underline">
                  {locale === "bn" ? "কুকি নীতি" : "Cookies"}
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Animated Content Area */}
        <main id="main-content" tabIndex={-1} key={tab} className="animate-fade-up min-w-0 flex-1 focus:outline-none">
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
              <VoiceCopilotView accessToken={token} locale={locale} onToast={showToast} />
            )}
            {tab === "properties" && (
              <PropertiesView accessToken={token} locale={locale} onToast={showToast} />
            )}
            {tab === "tenants" && (
              <TenantsView accessToken={token} locale={locale} onToast={showToast} />
            )}
            {tab === "finance" && (
              <FinanceView
                accessToken={token}
                locale={locale}
                onOpenSms={setSmsDraft}
                onToast={showToast}
              />
            )}
            {tab === "maintenance" && (
              <MaintenanceView accessToken={token} locale={locale} onToast={showToast} />
            )}
            {tab === "logs" && <LogsView accessToken={token} locale={locale} />}
          </Suspense>
        </main>
      </div>

      {/* Native-App Mobile Bottom Bar with Raised Center Voice Mic Button */}
      <nav
        aria-label={locale === "bn" ? "মোবাইল নেভিগেশন" : "Mobile navigation"}
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 backdrop-blur-md md:hidden"
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
            label={locale === "bn" ? "ভাড়া" : "Ledger"}
            onClick={() => selectTab("finance")}
          />

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => selectTab("voice")}
              aria-label={t(locale, "navVoice")}
              aria-current={tab === "voice" ? "page" : undefined}
              className={`-mt-6 flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-4 ring-white transition-transform duration-150 active:scale-90 ${
                tab === "voice"
                  ? "bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-emerald-600/40"
                  : "bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-emerald-700/30"
              }`}
            >
              <Mic className="h-6 w-6" aria-hidden="true" />
            </button>
            <span className="mt-1 text-[10px] font-bold text-emerald-700">
              {locale === "bn" ? "বলুন" : "Speak"}
            </span>
          </div>

          <MobileTabButton
            active={tab === "properties" || tab === "tenants"}
            icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
            label={locale === "bn" ? "ফ্ল্যাট" : "Units"}
            onClick={() => selectTab("properties")}
          />
          <MobileTabButton
            active={mobileMenuOpen || tab === "maintenance" || tab === "logs"}
            icon={<Menu className="h-5 w-5" aria-hidden="true" />}
            label={locale === "bn" ? "আরও" : "More"}
            onClick={() => setMobileMenuOpen((v) => !v)}
          />
        </div>
      </nav>

      {/* Mobile "More" Slide-Up Sheet */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-slate-900/45 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-more-title"
            className="animate-sheet-up w-full rounded-t-3xl bg-white p-5 pb-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
            <div className="mb-4 flex items-center justify-between">
              <p id="mobile-more-title" className="text-sm font-extrabold text-slate-900">
                {locale === "bn" ? "সকল অপশন" : "All Sections"}
              </p>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label={locale === "bn" ? "মেনু বন্ধ করুন" : "Close menu"}
                className="rounded-full bg-slate-100 p-1.5 text-slate-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={tab === item.id ? "page" : undefined}
                  onClick={() => selectTab(item.id)}
                  className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-xs font-bold transition active:scale-95 ${
                    tab === item.id
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-slate-50/70 text-slate-700"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-700">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setLegalDoc("privacy");
                }}
                className="hover:text-emerald-700 hover:underline"
              >
                {locale === "bn" ? "গোপনীয়তা নীতি" : "Privacy Policy"}
              </button>
              <span aria-hidden="true" className="text-slate-400">•</span>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setLegalDoc("terms");
                }}
                className="hover:text-emerald-700 hover:underline"
              >
                {locale === "bn" ? "শর্তাবলি" : "Terms"}
              </button>
              <span aria-hidden="true" className="text-slate-400">•</span>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setLegalDoc("cookies");
                }}
                className="hover:text-emerald-700 hover:underline"
              >
                {locale === "bn" ? "কুকি নীতি" : "Cookies"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Recovery Modal (triggered when user clicks Supabase recovery email link) */}
      {recoveryMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="recovery-modal-title"
            onSubmit={handlePasswordRecoverySubmit}
            className="animate-scale-in w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="recovery-modal-title" className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                <KeyRound className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                {locale === "bn" ? "নতুন পাসওয়ার্ড সেট করুন" : "Set New Password"}
              </h2>
              <button
                type="button"
                onClick={() => setRecoveryMode(false)}
                aria-label={locale === "bn" ? "বন্ধ করুন" : "Close"}
                className="rounded-xl bg-slate-100 p-1.5 text-slate-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div>
              <label htmlFor="recovery-new-pw" className="mb-1 block text-xs font-bold text-slate-700">
                {locale === "bn" ? "নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)" : "New Password (min 8 characters)"}
              </label>
              <input
                id="recovery-new-pw"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="recovery-confirm-pw" className="mb-1 block text-xs font-bold text-slate-700">
                {locale === "bn" ? "পাসওয়ার্ড নিশ্চিত করুন" : "Confirm New Password"}
              </label>
              <input
                id="recovery-confirm-pw"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
              />
            </div>

            {recoveryError && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
                {recoveryError}
              </div>
            )}

            <button
              type="submit"
              disabled={updatingPassword}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {updatingPassword
                ? "..."
                : locale === "bn"
                  ? "পাসওয়ার্ড আপডেট করুন"
                  : "Update Password"}
            </button>
          </form>
        </div>
      )}

      {smsDraft && (
        <SmsModal
          draft={smsDraft}
          accessToken={token}
          locale={locale}
          onClose={() => setSmsDraft(null)}
          onSent={showToast}
        />
      )}

      {legalDoc && (
        <LegalModal
          doc={legalDoc}
          locale={locale}
          onChangeDoc={setLegalDoc}
          onClose={() => setLegalDoc(null)}
        />
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
      className={`flex flex-col items-center gap-0.5 py-1 transition active:scale-90 ${
        active ? "text-emerald-700" : "text-slate-600"
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function ViewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" role="status" aria-label="Loading">
      <div className="h-36 rounded-2xl bg-slate-200/70" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-slate-200/70" />
        <div className="h-24 rounded-2xl bg-slate-200/70" />
      </div>
    </div>
  );
}
