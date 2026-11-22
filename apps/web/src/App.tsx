import { formatBdt } from "@rentready/shared";
import { Building2, CheckCircle2, Mic, Send, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { type Locale, t } from "./lib/i18n";

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

export function App() {
  const [locale, setLocale] = useState<Locale>("bn");
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then((res) => (res.ok ? (res.json() as Promise<HealthResponse>) : null))
      .then((data) => {
        if (active && data?.status === "ok") {
          setHealth(data);
        }
      })
      .catch(() => {
        if (active) setHealth(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleLocale = () => setLocale((prev) => (prev === "bn" ? "en" : "bn"));

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/70 via-white to-slate-50">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                {t(locale, "brand")}
              </h1>
              <p className="text-xs font-medium text-emerald-700">{t(locale, "badge")}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                health
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {health ? t(locale, "apiOnline") : t(locale, "apiOffline")}
            </span>

            <button
              type="button"
              onClick={toggleLocale}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
            >
              {t(locale, "switchLang")}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl space-y-2">
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                {t(locale, "tagline")}
              </h2>
              <p className="text-sm text-slate-600">
                {t(locale, "sampleDueLabel")}:{" "}
                <span className="font-bold text-emerald-700">
                  {formatBdt(400_000, locale)}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <FeatureCard
              icon={<ShieldCheck className="h-5 w-5 text-emerald-600" />}
              title={t(locale, "ledgerTitle")}
              description={t(locale, "ledgerDesc")}
            />
            <FeatureCard
              icon={<Mic className="h-5 w-5 text-emerald-600" />}
              title={t(locale, "voiceTitle")}
              description={t(locale, "voiceDesc")}
            />
            <FeatureCard
              icon={<Send className="h-5 w-5 text-emerald-600" />}
              title={t(locale, "smsTitle")}
              description={t(locale, "smsDesc")}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-2.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100/80">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
    </div>
  );
}
