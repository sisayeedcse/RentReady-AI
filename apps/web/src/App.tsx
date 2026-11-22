import type { Session } from "@supabase/supabase-js";
import {
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Mic,
  Users,
  Wallet,
  Wrench
} from "lucide-react";
import { useEffect, useState } from "react";
import { AuthScreen } from "./features/auth/AuthScreen";
import { DashboardView } from "./features/dashboard/DashboardView";
import { FinanceView } from "./features/finance/FinanceView";
import { MaintenanceView } from "./features/maintenance/MaintenanceView";
import { LogsView } from "./features/notifications/LogsView";
import { type SmsDraft, SmsModal } from "./features/notifications/SmsModal";
import { PropertiesView } from "./features/properties/PropertiesView";
import { TenantsView } from "./features/tenants/TenantsView";
import { VoiceCopilotView } from "./features/voice/VoiceCopilotView";
import { type Locale, t } from "./lib/i18n";
import { supabase } from "./lib/supabase";

type TabId = "dashboard" | "voice" | "properties" | "tenants" | "finance" | "maintenance" | "logs";

export function App() {
  const [locale, setLocale] = useState<Locale>("bn");
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(Boolean(supabase));
  const [tab, setTab] = useState<TabId>("dashboard");
  const [smsDraft, setSmsDraft] = useState<SmsDraft | null>(null);

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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading RentReady AI...
      </div>
    );
  }

  if (!session) {
    return <AuthScreen locale={locale} onToggleLocale={toggleLocale} />;
  }

  const navItems: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: "dashboard", label: t(locale, "navDashboard"), icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "voice", label: t(locale, "navVoice"), icon: <Mic className="h-4 w-4" /> },
    { id: "properties", label: t(locale, "navProperties"), icon: <Building2 className="h-4 w-4" /> },
    { id: "tenants", label: t(locale, "navTenants"), icon: <Users className="h-4 w-4" /> },
    { id: "finance", label: t(locale, "navFinance"), icon: <Wallet className="h-4 w-4" /> },
    { id: "maintenance", label: t(locale, "navMaintenance"), icon: <Wrench className="h-4 w-4" /> },
    { id: "logs", label: t(locale, "navLogs"), icon: <FileText className="h-4 w-4" /> }
  ];

  const token = session.access_token;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">{t(locale, "brand")}</h1>
              <p className="text-[11px] font-medium text-emerald-700">{t(locale, "badge")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLocale}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {t(locale, "switchLang")}
            </button>
            <button
              type="button"
              onClick={() => void supabase?.auth.signOut()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t(locale, "signOut")}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-20 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                  tab === item.id
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-700 hover:bg-white hover:text-slate-900"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
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
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-slate-200 bg-white px-1 py-1.5 md:hidden">
        {navItems.slice(0, 5).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-semibold ${
              tab === item.id ? "text-emerald-700" : "text-slate-500"
            }`}
          >
            {item.icon}
            <span>{item.label.split(" ")[0]}</span>
          </button>
        ))}
      </nav>

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
