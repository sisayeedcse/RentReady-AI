import {
  Building2,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  Mic,
  Send,
  ShieldCheck,
  User
} from "lucide-react";
import { useEffect, useState } from "react";
import { toFriendlyError } from "../../lib/friendlyError";
import { type Locale, t } from "../../lib/i18n";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import type { LegalDocType } from "../legal/LegalPages";

export function AuthScreen({
  locale,
  onToggleLocale,
  onOpenLegal
}: {
  locale: Locale;
  onToggleLocale: () => void;
  onOpenLegal: (doc: LegalDocType) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const id = window.setInterval(() => {
      setCooldownSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldownSec]);

  function switchMode(next: "signin" | "signup" | "reset") {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || cooldownSec > 0) return;
    setError(null);
    setNotice(null);

    if (mode === "signup") {
      if (password.length < 8) {
        setError(
          locale === "bn"
            ? "নিরাপত্তার জন্য পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।"
            : "Password must be at least 8 characters long."
        );
        return;
      }
      if (!acceptedTerms) {
        setError(
          locale === "bn"
            ? "অ্যাকাউন্ট তৈরি করতে গোপনীয়তা নীতি ও ব্যবহারের শর্তাবলিতে সম্মতি দিন।"
            : "Please agree to the Privacy Policy and Terms & Conditions to create an account."
        );
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "reset") {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin
        });
        if (resetErr) throw resetErr;
        // Generic response prevents account enumeration
        setNotice(
          locale === "bn"
            ? "এই ইমেইলে কোনো অ্যাকাউন্ট থাকলে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে। অনুগ্রহ করে ইনবক্স ও স্প্যাম ফোল্ডার দেখুন।"
            : "If an account exists for this email, a password reset link has been sent. Please check your inbox."
        );
        return;
      }

      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: window.location.origin
          }
        });
        if (err) throw err;
        setNotice(
          locale === "bn"
            ? "অ্যাকাউন্ট তৈরি হয়েছে! ইমেইল যাচাই প্রয়োজন হলে ইনবক্স দেখুন, অথবা সরাসরি লগইন করুন।"
            : "Account created! Check your inbox if email verification is required, or sign in."
        );
        setPassword("");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (err) {
          const nextFails = failedAttempts + 1;
          setFailedAttempts(nextFails);
          if (nextFails >= 3) {
            setCooldownSec(Math.min(30, (nextFails - 2) * 5));
          }
          throw err;
        }
        setFailedAttempts(0);
      }
    } catch (err) {
      setError(toFriendlyError(err, locale));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-slate-100 p-4">
      <main className="animate-fade-up w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-emerald-950/10">
        {/* Clean Brand Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-6 text-white">
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-xs ring-1 ring-white/25">
                <Building2 className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight">{t(locale, "brand")}</h1>
                <p className="text-xs font-medium text-emerald-100">{t(locale, "badge")}</p>
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

          <p className="relative mt-4 text-sm leading-relaxed text-emerald-50">
            {t(locale, "tagline")}
          </p>

          <div className="relative mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-emerald-50">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
              <Mic className="h-3 w-3" aria-hidden="true" />
              {locale === "bn" ? "বাংলা ভয়েস এন্ট্রি" : "Bangla Voice Entry"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              {locale === "bn" ? "নির্ভুল বকেয়া হিসাব" : "Exact Due Ledger"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
              <Send className="h-3 w-3" aria-hidden="true" />
              {locale === "bn" ? "নিশ্চিতকৃত SMS রসিদ" : "Confirmed SMS Receipts"}
            </span>
          </div>
        </div>

        <div className="p-6 sm:p-7">
          {!isSupabaseConfigured ? (
            <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
              <p className="font-bold">
                {locale === "bn" ? "সার্ভার সংযোগ সেটআপ প্রয়োজন" : "Service Connection Required"}
              </p>
              <p className="mt-1">
                {locale === "bn"
                  ? "অনুগ্রহ করে আপনার অ্যাডমিনের সাথে যোগাযোগ করুন।"
                  : "Please configure environment settings before signing in."}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
              {mode !== "reset" ? (
                <div
                  role="tablist"
                  aria-label={locale === "bn" ? "লগইন বা নতুন অ্যাকাউন্ট" : "Authentication mode"}
                  className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "signin"}
                    onClick={() => switchMode("signin")}
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
                    role="tab"
                    aria-selected={mode === "signup"}
                    onClick={() => switchMode("signup")}
                    className={`rounded-xl py-2.5 text-xs font-bold transition ${
                      mode === "signup"
                        ? "bg-white text-emerald-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {t(locale, "signUp")}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-2xl bg-slate-100 px-3.5 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <KeyRound className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    {locale === "bn" ? "পাসওয়ার্ড রিসেট করুন" : "Reset Password"}
                  </span>
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="text-xs font-bold text-emerald-700 hover:underline"
                  >
                    {locale === "bn" ? "লগইনে ফিরুন" : "Back to Sign In"}
                  </button>
                </div>
              )}

              {mode === "signup" && (
                <div>
                  <label htmlFor="auth-full-name" className="mb-1 block text-xs font-semibold text-slate-700">
                    {t(locale, "fullName")}
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-500" aria-hidden="true" />
                    <input
                      id="auth-full-name"
                      type="text"
                      required
                      autoComplete="name"
                      maxLength={120}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={locale === "bn" ? "যেমন: মোঃ কামাল হোসেন" : "e.g. Md. Kamal Hossain"}
                      className="w-full rounded-xl border border-slate-300 py-2.5 pr-3 pl-10 text-sm transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="mb-1 block text-xs font-semibold text-slate-700">
                  {t(locale, "email")}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-500" aria-hidden="true" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pr-3 pl-10 text-sm transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                </div>
              </div>

              {mode !== "reset" && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700">
                      {t(locale, "password")}
                    </label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => switchMode("reset")}
                        className="text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        {locale === "bn" ? "পাসওয়ার্ড ভুলে গেছেন?" : "Forgot password?"}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-500" aria-hidden="true" />
                    <input
                      id="auth-password"
                      type="password"
                      required
                      minLength={mode === "signup" ? 8 : 6}
                      maxLength={128}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      aria-describedby={mode === "signup" ? "auth-password-hint" : undefined}
                      className="w-full rounded-xl border border-slate-300 py-2.5 pr-3 pl-10 text-sm transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    />
                  </div>
                  {mode === "signup" && (
                    <p id="auth-password-hint" className="mt-1 text-[11px] text-slate-600">
                      {locale === "bn"
                        ? "কমপক্ষে ৮ অক্ষরের শক্তিশালী পাসওয়ার্ড ব্যবহার করুন।"
                        : "Use at least 8 characters with a strong, unique password."}
                    </p>
                  )}
                </div>
              )}

              {mode === "signup" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700">
                    <input
                      id="auth-consent"
                      type="checkbox"
                      required
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-emerald-600"
                    />
                    <span>
                      {locale === "bn" ? (
                        <>
                          আমি{" "}
                          <button
                            type="button"
                            onClick={() => onOpenLegal("privacy")}
                            className="font-bold text-emerald-700 underline"
                          >
                            গোপনীয়তা নীতি
                          </button>{" "}
                          ও{" "}
                          <button
                            type="button"
                            onClick={() => onOpenLegal("terms")}
                            className="font-bold text-emerald-700 underline"
                          >
                            ব্যবহারের শর্তাবলি
                          </button>{" "}
                          পড়েছি এবং সম্মত আছি।
                        </>
                      ) : (
                        <>
                          I have read and agree to the{" "}
                          <button
                            type="button"
                            onClick={() => onOpenLegal("privacy")}
                            className="font-bold text-emerald-700 underline"
                          >
                            Privacy Policy
                          </button>{" "}
                          and{" "}
                          <button
                            type="button"
                            onClick={() => onOpenLegal("terms")}
                            className="font-bold text-emerald-700 underline"
                          >
                            Terms &amp; Conditions
                          </button>
                          .
                        </>
                      )}
                    </span>
                  </label>
                </div>
              )}

              {error && (
                <div role="alert" className="animate-scale-in rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800">
                  {error}
                </div>
              )}
              {notice && (
                <div role="status" className="animate-scale-in flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{notice}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || cooldownSec > 0}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
              >
                {cooldownSec > 0
                  ? locale === "bn"
                    ? `${cooldownSec} সেকেন্ড পরে আবার চেষ্টা করুন`
                    : `Wait ${cooldownSec}s before retrying`
                  : loading
                    ? locale === "bn"
                      ? "অপেক্ষা করুন..."
                      : "Please wait..."
                    : mode === "reset"
                      ? locale === "bn"
                        ? "রিসেট লিংক পাঠান"
                        : "Send Reset Link"
                      : mode === "signin"
                        ? t(locale, "signIn")
                        : t(locale, "signUp")}
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="mt-5 flex flex-col items-center gap-2 text-center">
        <p className="text-xs font-medium text-slate-600">
          {locale === "bn"
            ? "ডিজিটাল বাড়িভাড়া ও হিসাব পরিচালনা • বাংলাদেশ"
            : "Digital Property & Rent Ledger • Bangladesh"}
        </p>
        <nav
          aria-label={locale === "bn" ? "আইনি লিংক" : "Legal links"}
          className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-700"
        >
          <button
            type="button"
            onClick={() => onOpenLegal("privacy")}
            className="underline-offset-2 hover:text-emerald-700 hover:underline"
          >
            {locale === "bn" ? "গোপনীয়তা নীতি" : "Privacy Policy"}
          </button>
          <span aria-hidden="true" className="text-slate-400">•</span>
          <button
            type="button"
            onClick={() => onOpenLegal("terms")}
            className="underline-offset-2 hover:text-emerald-700 hover:underline"
          >
            {locale === "bn" ? "শর্তাবলি" : "Terms & Conditions"}
          </button>
          <span aria-hidden="true" className="text-slate-400">•</span>
          <button
            type="button"
            onClick={() => onOpenLegal("cookies")}
            className="underline-offset-2 hover:text-emerald-700 hover:underline"
          >
            {locale === "bn" ? "কুকি ও স্টোরেজ" : "Cookies & Storage"}
          </button>
        </nav>
      </footer>
    </div>
  );
}
