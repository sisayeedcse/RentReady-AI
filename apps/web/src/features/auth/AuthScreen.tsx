import { Building2, Lock, Mail, User } from "lucide-react";
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-md sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{t(locale, "brand")}</h1>
              <p className="text-xs font-medium text-emerald-700">{t(locale, "badge")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleLocale}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t(locale, "switchLang")}
          </button>
        </div>

        <p className="mb-5 text-sm text-slate-600">{t(locale, "tagline")}</p>

        {!isSupabaseConfigured ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Supabase Environment Variables Required</p>
            <p className="mt-1 text-xs leading-relaxed">
              Copy <code>apps/web/.env.example</code> to <code>apps/web/.env.local</code> and add{" "}
              <code>VITE_SUPABASE_URL</code> + <code>VITE_SUPABASE_ANON_KEY</code> to sign in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  mode === "signin" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600"
                }`}
              >
                {t(locale, "signIn")}
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  mode === "signup" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600"
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
                  <User className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Md. Kamal Hossain"
                    className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {t(locale, "email")}
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="landlord@example.com"
                  className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {t(locale, "password")}
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "..." : mode === "signin" ? t(locale, "signIn") : t(locale, "signUp")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
