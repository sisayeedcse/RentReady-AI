import { Building2, Lock, Mail, Mic, Send, ShieldCheck, User } from "lucide-react";
import { useState } from "react";
import { type Locale, t } from "../../lib/i18n";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

export function AuthScreen({
  locale,
  onToggleLocale
}: {
  locale: Locale;
  onToggleLocale: () => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        });
        if (err) throw err;
        setNotice(
          locale === "bn"
            ? "অ্যাকাউন্ট তৈরি হয়েছে! অনুগ্রহ করে ইমেইল যাচাই করুন অথবা লগইন করুন।"
            : "Account created! Please check your email or sign in."
        );
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-emerald-50/90 via-white to-slate-100 p-4">
      <div className="animate-fade-up w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl shadow-emerald-950/5">
        {/* Sleek Top Brand Strip */}
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-xs ring-1 ring-white/25">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight">{t(locale, "brand")}</h1>
                <p className="text-[11px] font-medium text-emerald-100">{t(locale, "badge")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleLocale}
              className="rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-xs transition hover:bg-white/25 active:scale-95"
            >
              {t(locale, "switchLang")}
            </button>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-emerald-50">{t(locale, "tagline")}</p>

          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-emerald-50">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
              <Mic className="h-3 w-3" /> Bangla Voice AI
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
              <ShieldCheck className="h-3 w-3" /> Exact Ledger
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
              <Send className="h-3 w-3" /> AppLink SMS
            </span>
          </div>
        </div>

        <div className="p-6 sm:p-7">
          {!isSupabaseConfigured ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-bold">Supabase Environment Variables Required</p>
              <p className="mt-1 text-xs leading-relaxed">
                Copy <code>apps/web/.env.example</code> to <code>apps/web/.env.local</code> and add{" "}
                <code>VITE_SUPABASE_URL</code> + <code>VITE_SUPABASE_ANON_KEY</code>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={`rounded-xl py-2.5 text-xs font-bold transition ${
                    mode === "signin"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t(locale, "signIn")}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`rounded-xl py-2.5 text-xs font-bold transition ${
                    mode === "signup"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t(locale, "signUp")}
                </button>
              </div>

              {mode === "signup" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {t(locale, "fullName")}
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Md. Kamal Hossain"
                      className="w-full rounded-xl border border-slate-300 py-2.5 pr-3 pl-10 text-sm transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {t(locale, "email")}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="landlord@example.com"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pr-3 pl-10 text-sm transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {t(locale, "password")}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pr-3 pl-10 text-sm transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                </div>
              </div>

              {error && (
                <div className="animate-scale-in rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                  {error}
                </div>
              )}
              {notice && (
                <div className="animate-scale-in rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
                  {notice}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? "..." : mode === "signin" ? t(locale, "signIn") : t(locale, "signUp")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
