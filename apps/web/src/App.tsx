import type { Session } from "@supabase/supabase-js";
import {
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  Users,
  Wallet,
  Wrench,
  X
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { AuthScreen } from "./features/auth/AuthScreen";
import { DashboardView } from "./features/dashboard/DashboardView";
import { type SmsDraft, SmsModal } from "./features/notifications/SmsModal";
import { type Locale, t } from "./lib/i18n";
import { supabase } from "./lib/supabase";

// Code-split secondary views for ultra-fast initial mobile launch load
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

export function App() {
  const [locale, setLocale] = useState<Locale>("bn");
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(Boolean(supabase));
  const [tab, setTab] = useState<TabId>("dashboard");
  const [smsDraft, setSmsDraft] = useState<SmsDraft | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingAuth(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const toggleLocale = () => setLocale((prev) => (prev === "bn" ? "en" : "bn"));

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
          <Building2 className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold text-slate-500">RentReady AI...</p>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen locale={locale} onToggleLocale={toggleLocale} />;
  }

  const navItems: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: "dashboard", label: t(locale, "navDashboard"), icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "voice", label: t(locale, "navVoice"), icon: <Mic className="h-4 w-4" /> },
    { id: "finance", label: t(locale, "navFinance"), icon: <Wallet className="h-4 w-4" /> },
    { id: "properties", label: t(locale, "navProperties"), icon: <Building2 className="h-4 w-4" /> },
    { id: "tenants", label: t(locale, "navTenants"), icon: <Users className="h-4 w-4" /> },
    { id: "maintenance", label: t(locale, "navMaintenance"), icon: <Wrench className="h-4 w-4" /> },
    { id: "logs", label: t(locale, "navLogs"), icon: <FileText className="h-4 w-4" /> }
  ];

  const token = session.access_token;

  function selectTab(next: TabId) {
    setTab(next);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8">
      {/* Glassmorphic Sticky Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => selectTab("dashboard")}
            className="flex items-center gap-2.5 text-left transition active:scale-95"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900">
                {t(locale, "brand")}
              </h1>
              <p className="text-[10px] font-semibold text-emerald-700">{t(locale, "badge")}</p>
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
              onClick={() => void supabase?.auth.signOut()}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-rose-50 hover:text-rose-700 active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t(locale, "signOut")}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-3.5 py-5 sm:px-4 sm:py-6">
        {/* Desktop Sidebar */}
        <aside className="hidden w-60 shrink-0 md:block">
          <nav className="sticky top-20 space-y-1 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-xs">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
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
        </aside>

        {/* Main Animated Content Area */}
        <main key={tab} className="animate-fade-up min-w-0 flex-1">
          <Suspense fallback={<ViewSkeleton />}>
            {tab === "dashboard" && (
              <DashboardView accessToken={token} locale={locale} onOpenSms={setSmsDraft} />
            )}
            {tab === "voice" && <VoiceCopilotView accessToken={token} locale={locale} />}
            {tab === "properties" && <PropertiesView accessToken={token} locale={locale} />}
            {tab === "tenants" && <TenantsView accessToken={token} locale={locale} />}
            {tab === "finance" && (
              <FinanceView accessToken={token} locale={locale} onOpenSms={setSmsDraft} />
            )}
            {tab === "maintenance" && <MaintenanceView accessToken={token} locale={locale} />}
            {tab === "logs" && <LogsView accessToken={token} locale={locale} />}
          </Suspense>
        </main>
      </div>

      {/* Native-App-Style Mobile Bottom Navigation with BIG Raised Center Mic Button */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 backdrop-blur-md md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5 pb-1">
          <MobileTabButton
            active={tab === "dashboard"}
            icon={<LayoutDashboard className="h-5 w-5" />}
            label={locale === "bn" ? "হোম" : "Home"}
            onClick={() => selectTab("dashboard")}
          />
          <MobileTabButton
            active={tab === "finance"}
            icon={<Wallet className="h-5 w-5" />}
            label={locale === "bn" ? "লেজার" : "Ledger"}
            onClick={() => selectTab("finance")}
          />

          {/* Raised Glowing Center Mic Button */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => selectTab("voice")}
              aria-label={t(locale, "navVoice")}
              className={`-mt-6 flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-4 ring-white transition-transform duration-150 active:scale-90 ${
                tab === "voice"
                  ? "bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-emerald-600/40"
                  : "bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-emerald-700/30"
              }`}
            >
              <Mic className="h-6 w-6" />
            </button>
            <span className="mt-1 text-[10px] font-bold text-emerald-700">
              {locale === "bn" ? "বলুন" : "Speak"}
            </span>
          </div>

          <MobileTabButton
            active={tab === "properties" || tab === "tenants"}
            icon={<Building2 className="h-5 w-5" />}
            label={locale === "bn" ? "ফ্ল্যাট" : "Units"}
            onClick={() => selectTab("properties")}
          />
          <MobileTabButton
            active={mobileMenuOpen || tab === "maintenance" || tab === "logs"}
            icon={<Menu className="h-5 w-5" />}
            label={locale === "bn" ? "আরও" : "More"}
            onClick={() => setMobileMenuOpen((v) => !v)}
          />
        </div>
      </nav>

      {/* Mobile "More" Slide-Up Sheet */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-slate-900/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="animate-fade-up w-full rounded-t-3xl bg-white p-5 pb-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">
                {locale === "bn" ? "সকল মেনু" : "All Sections"}
              </p>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-full bg-slate-100 p-1.5 text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
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
          </div>
        </div>
      )}

      {smsDraft && (
        <SmsModal
          draft={smsDraft}
          accessToken={token}
          locale={locale}
          onClose={() => setSmsDraft(null)}
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
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 py-1 transition active:scale-90 ${
        active ? "text-emerald-700" : "text-slate-400"
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function ViewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-36 rounded-2xl bg-slate-200/70" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-slate-200/70" />
        <div className="h-24 rounded-2xl bg-slate-200/70" />
      </div>
    </div>
  );
}
