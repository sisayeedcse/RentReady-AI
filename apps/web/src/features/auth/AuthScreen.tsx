import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Lock,
  Mail,
  Mic,
  Send,
  ShieldCheck,
  User
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { AlertBanner } from "../../components/ui/States";
import { SegmentedTabs } from "../../components/ui/Tabs";
import { toFriendlyError } from "../../lib/friendlyError";
import { type Locale, t } from "../../lib/i18n";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import type { LegalDocType } from "../legal/LegalPages";

function getPasswordStrength(pw: string): { score: number; labelBn: string; labelEn: string; bar: string } {
  if (!pw) return { score: 0, labelBn: "", labelEn: "", bar: "bg-slate-200" };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score += 1;

  if (score <= 1) return { score: 1, labelBn: "দুর্বল", labelEn: "Weak", bar: "bg-rose-500" };
  if (score === 2) return { score: 2, labelBn: "মাঝারি", labelEn: "Fair", bar: "bg-amber-500" };
  if (score === 3) return { score: 3, labelBn: "ভালো", labelEn: "Good", bar: "bg-emerald-500" };
  return { score: 4, labelBn: "শক্তিশালী", labelEn: "Strong", bar: "bg-[#046c4e]" };
}

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
  const [showPassword, setShowPassword] = useState(false);
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
    setShowPassword(false);
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

  const strength = getPasswordStrength(password);

  const pillars =
    locale === "bn"
      ? [
          {
            icon: <Mic className="h-4 w-4 text-emerald-300" aria-hidden="true" />,
            title: "বাংলা ভয়েস ও টেক্সট এন্ট্রি",
            desc: "মুখে বলেই ভাড়া জমা, খরচ বা বকেয়া যাচাই করুন — আপনার সম্মতি ছাড়া কিছুই সেভ হয় না।"
          },
          {
            icon: <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />,
            title: "নির্ভুল অডিটযোগ্য লেজার",
            desc: "পূর্ণ ও আংশিক ভাড়া, বকেয়া হিসাব এবং নিরাপদ রিভার্সাল এন্ট্রি একদম স্বচ্ছভাবে সংরক্ষিত।"
          },
          {
            icon: <Send className="h-4 w-4 text-emerald-300" aria-hidden="true" />,
            title: "নিশ্চিতকৃত SMS রসিদ ও তাগাদা",
            desc: "ভাড়াটিয়াকে বাংলালিংক AppLink SMS অথবা WhatsApp-এ তাৎক্ষণিক রসিদ পাঠান।"
          }
        ]
      : [
          {
            icon: <Mic className="h-4 w-4 text-emerald-300" aria-hidden="true" />,
            title: "Bangla & English Voice Ledger",
            desc: "Speak naturally to log payments, expenses, or check dues — every write requires your explicit review."
          },
          {
            icon: <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />,
            title: "Exact Integer Financial Accounting",
            desc: "Track full and partial rent payments, derived balances, and immutable reversals with complete audit trails."
          },
          {
            icon: <Send className="h-4 w-4 text-emerald-300" aria-hidden="true" />,
            title: "Confirmed SMS Receipts & Reminders",
            desc: "Review every message before dispatching receipts or rent reminders via Banglalink AppLink or WhatsApp."
          }
        ];

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] lg:grid lg:grid-cols-12">
      {/* LEFT ARCHITECTURAL BRAND SHOWCASE (Desktop lg+) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0c231c] bg-ledger-grid p-10 text-white lg:col-span-5 lg:flex xl:p-12">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/35">
              <Building2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-extrabold tracking-tight text-white">
                {t(locale, "brand")}
              </p>
              <p className="text-xs font-medium text-emerald-200/80">{t(locale, "badge")}</p>
            </div>
          </div>

          <div className="mt-12 max-w-md">
            <h2 className="text-2xl leading-snug font-bold tracking-tight text-white xl:text-[28px]">
              {locale === "bn"
                ? "আপনার বাড়ির ভাড়া, বকেয়া ও খরচের নির্ভরযোগ্য ডিজিটাল খাতা।"
                : "Clear, auditable rental operations built for landlords in Bangladesh."}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-emerald-100/75">
              {t(locale, "tagline")}
            </p>
          </div>

          <div className="mt-10 space-y-3.5">
            {pillars.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3.5 rounded-xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/20">
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/75">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-8 border-t border-white/10 pt-5 text-xs text-emerald-100/70">
          {locale === "bn"
            ? "কোনো অডিও ফাইল সংরক্ষণ করা হয় না • প্রতিটি বাড়িওয়ালার তথ্য সম্পূর্ণ পৃথক (RLS সুরক্ষিত)"
            : "Raw voice audio is never stored • Strictly isolated landlord records with Row-Level Security"}
        </div>
      </aside>

      {/* RIGHT AUTHENTICATION WORKSPACE */}
      <div className="flex min-h-screen flex-col justify-between bg-white lg:col-span-7">
        {/* Top Bar (Mobile Brand + Language Switcher) */}
        <header className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-8 lg:border-b-0 lg:pt-6">
          <div className="flex items-center gap-2.5 lg:invisible">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#046c4e] text-white">
              <Building2 className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="leading-tight">
              <span className="block text-sm font-extrabold tracking-tight text-[var(--ink-primary)]">
                {t(locale, "brand")}
              </span>
              <span className="block text-[11px] font-medium text-[var(--ink-muted)]">
                {t(locale, "badge")}
              </span>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onToggleLocale}
            aria-label={
              locale === "bn" ? "Switch language to English" : "ভাষা বাংলায় পরিবর্তন করুন"
            }
          >
            <Globe className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden="true" />
            <span>{t(locale, "switchLang")}</span>
          </Button>
        </header>

        {/* Centered Form Panel */}
        <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-5 py-8 sm:px-6">
          <div className="animate-fade-up">
            {/* Compact Mobile Value Context */}
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ink-primary)]">
                {mode === "reset"
                  ? locale === "bn"
                    ? "পাসওয়ার্ড রিসেট করুন"
                    : "Reset your password"
                  : mode === "signup"
                    ? locale === "bn"
                      ? "নতুন বাড়িওয়ালা অ্যাকাউন্ট"
                      : "Create your account"
                    : locale === "bn"
                      ? "আপনার খাতায় লগইন করুন"
                      : "Sign in to RentReady"}
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]">
                {mode === "reset"
                  ? locale === "bn"
                    ? "আপনার নিবন্ধিত ইমেইল লিখুন, আমরা রিসেট লিংক পাঠিয়ে দেব।"
                    : "Enter your account email and we will send a password reset link."
                  : locale === "bn"
                    ? "বাংলায় কথা বলে বা লিখে ভাড়া, বকেয়া ও রসিদ পরিচালনা করুন।"
                    : "Manage rent ledgers, partial dues, expenses, and SMS receipts."}
              </p>
            </div>

            {!isSupabaseConfigured ? (
              <AlertBanner
                tone="warning"
                message={
                  locale === "bn"
                    ? "সার্ভার সংযোগ সেটআপ প্রয়োজন। অনুগ্রহ করে আপনার অ্যাডমিনের সাথে যোগাযোগ করুন।"
                    : "Service connection required. Please configure environment settings before signing in."
                }
              />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode !== "reset" ? (
                  <SegmentedTabs
                    ariaLabel={locale === "bn" ? "লগইন বা নতুন অ্যাকাউন্ট" : "Authentication mode"}
                    fullWidth
                    value={mode}
                    onChange={(next) => switchMode(next)}
                    options={[
                      { id: "signin", label: t(locale, "signIn") },
                      { id: "signup", label: t(locale, "signUp") }
                    ]}
                  />
                ) : (
                  <div className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3.5 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-primary)]">
                      <KeyRound className="h-3.5 w-3.5 text-[#046c4e]" aria-hidden="true" />
                      {locale === "bn" ? "পাসওয়ার্ড পুনরুদ্ধার" : "Password Recovery"}
                    </span>
                    <button
                      type="button"
                      onClick={() => switchMode("signin")}
                      className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#046c4e] hover:underline"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      {locale === "bn" ? "লগইনে ফিরুন" : "Back to Sign In"}
                    </button>
                  </div>
                )}

                {mode === "signup" && (
                  <Field id="auth-full-name" label={t(locale, "fullName")} required>
                    <Input
                      id="auth-full-name"
                      type="text"
                      required
                      autoComplete="name"
                      maxLength={120}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={
                        locale === "bn" ? "যেমন: মোঃ কামাল হোসেন" : "e.g. Md. Kamal Hossain"
                      }
                      leftIcon={<User className="h-4 w-4" />}
                    />
                  </Field>
                )}

                <Field id="auth-email" label={t(locale, "email")} required>
                  <Input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    leftIcon={<Mail className="h-4 w-4" />}
                  />
                </Field>

                {mode !== "reset" && (
                  <div>
                    <Field
                      id="auth-password"
                      label={t(locale, "password")}
                      required
                      labelAction={
                        mode === "signin" ? (
                          <button
                            type="button"
                            onClick={() => switchMode("reset")}
                            className="cursor-pointer rounded px-1 py-1 text-xs font-semibold text-[#046c4e] hover:underline"
                          >
                            {locale === "bn" ? "পাসওয়ার্ড ভুলে গেছেন?" : "Forgot password?"}
                          </button>
                        ) : undefined
                      }
                      hint={
                        mode === "signup" && !password
                          ? locale === "bn"
                            ? "কমপক্ষে ৮ অক্ষরের শক্তিশালী পাসওয়ার্ড ব্যবহার করুন।"
                            : "Use at least 8 characters with a strong, unique password."
                          : undefined
                      }
                    >
                      <Input
                        id="auth-password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={mode === "signup" ? 8 : 6}
                        maxLength={128}
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        aria-describedby={mode === "signup" ? "auth-password-hint" : undefined}
                        leftIcon={<Lock className="h-4 w-4" />}
                        rightSlot={
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={
                              showPassword
                                ? locale === "bn"
                                  ? "পাসওয়ার্ড লুকান"
                                  : "Hide password"
                                : locale === "bn"
                                  ? "পাসওয়ার্ড দেখুন"
                                  : "Show password"
                            }
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[var(--ink-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                        }
                      />
                    </Field>

                    {mode === "signup" && password.length > 0 && (
                      <div id="auth-password-hint" className="mt-2 space-y-1">
                        <div className="grid grid-cols-4 gap-1" aria-hidden="true">
                          {[1, 2, 3, 4].map((step) => (
                            <span
                              key={step}
                              className={`h-1 rounded-full transition-colors ${
                                step <= strength.score ? strength.bar : "bg-slate-200"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-[11px] font-medium text-[var(--ink-muted)]">
                          {locale === "bn"
                            ? `পাসওয়ার্ডের মান: ${strength.labelBn} (কমপক্ষে ৮ অক্ষর)`
                            : `Strength: ${strength.labelEn} (min 8 characters)`}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {mode === "signup" && (
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-rail)] p-3.5">
                    <div className="flex items-start gap-3">
                      <input
                        id="auth-consent"
                        type="checkbox"
                        required
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-[var(--border-strong)] accent-[#046c4e]"
                      />
                      <div className="text-xs leading-relaxed text-[var(--ink-secondary)]">
                        <label htmlFor="auth-consent" className="cursor-pointer font-medium">
                          {locale === "bn"
                            ? "আমি গোপনীয়তা নীতি ও ব্যবহারের শর্তাবলি পড়েছি এবং সম্মত আছি।"
                            : "I have read and agree to the Privacy Policy and Terms & Conditions."}
                        </label>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold">
                          <button
                            type="button"
                            onClick={() => onOpenLegal("privacy")}
                            className="cursor-pointer text-[#046c4e] underline underline-offset-2 hover:text-[#03543f]"
                          >
                            {locale === "bn" ? "গোপনীয়তা নীতি পড়ুন" : "Read Privacy Policy"}
                          </button>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenLegal("terms")}
                            className="cursor-pointer text-[#046c4e] underline underline-offset-2 hover:text-[#03543f]"
                          >
                            {locale === "bn" ? "শর্তাবলি পড়ুন" : "Read Terms & Conditions"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {error && <AlertBanner tone="error" message={error} />}
                {notice && (
                  <div
                    role="status"
                    className="animate-scale-in flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs font-medium text-emerald-900"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#046c4e]" aria-hidden="true" />
                    <span className="leading-relaxed">{notice}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  loading={loading}
                  disabled={cooldownSec > 0}
                  className="w-full"
                >
                  {cooldownSec > 0
                    ? locale === "bn"
                      ? `${cooldownSec} সেকেন্ড পরে আবার চেষ্টা করুন`
                      : `Wait ${cooldownSec}s before retrying`
                    : mode === "reset"
                      ? locale === "bn"
                        ? "রিসেট লিংক পাঠান"
                        : "Send Reset Link"
                      : mode === "signin"
                        ? t(locale, "signIn")
                        : t(locale, "signUp")}
                </Button>
              </form>
            )}

            {/* Mobile-only compact trust strip */}
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-[var(--border-subtle)] pt-5 text-center lg:hidden">
              <div className="rounded-lg bg-[var(--bg-rail)] px-2 py-2">
                <Mic className="mx-auto h-4 w-4 text-[#046c4e]" aria-hidden="true" />
                <p className="mt-1 text-[11px] font-semibold text-[var(--ink-secondary)]">
                  {locale === "bn" ? "বাংলা ভয়েস" : "Bangla Voice"}
                </p>
              </div>
              <div className="rounded-lg bg-[var(--bg-rail)] px-2 py-2">
                <ShieldCheck className="mx-auto h-4 w-4 text-[#046c4e]" aria-hidden="true" />
                <p className="mt-1 text-[11px] font-semibold text-[var(--ink-secondary)]">
                  {locale === "bn" ? "নির্ভুল খাতা" : "Exact Ledger"}
                </p>
              </div>
              <div className="rounded-lg bg-[var(--bg-rail)] px-2 py-2">
                <Send className="mx-auto h-4 w-4 text-[#046c4e]" aria-hidden="true" />
                <p className="mt-1 text-[11px] font-semibold text-[var(--ink-secondary)]">
                  {locale === "bn" ? "SMS রসিদ" : "SMS Receipts"}
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* Footer Legal Links */}
        <footer className="border-t border-[var(--border-subtle)] px-5 py-4 text-center sm:px-8">
          <div className="mx-auto flex max-w-md flex-col items-center justify-between gap-2 sm:flex-row">
            <p className="text-xs text-[var(--ink-muted)]">
              {locale === "bn"
                ? "ডিজিটাল বাড়িভাড়া ও হিসাব পরিচালনা • বাংলাদেশ"
                : "Digital Property Ledger • Bangladesh"}
            </p>
            <nav
              aria-label={locale === "bn" ? "আইনি লিংক" : "Legal links"}
              className="flex flex-wrap items-center justify-center gap-2.5 text-xs font-semibold text-[var(--ink-secondary)]"
            >
              <button
                type="button"
                onClick={() => onOpenLegal("privacy")}
                className="cursor-pointer rounded px-1 py-1.5 underline-offset-2 hover:text-[#046c4e] hover:underline"
              >
                {locale === "bn" ? "গোপনীয়তা" : "Privacy"}
              </button>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <button
                type="button"
                onClick={() => onOpenLegal("terms")}
                className="cursor-pointer rounded px-1 py-1.5 underline-offset-2 hover:text-[#046c4e] hover:underline"
              >
                {locale === "bn" ? "শর্তাবলি" : "Terms"}
              </button>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <button
                type="button"
                onClick={() => onOpenLegal("cookies")}
                className="cursor-pointer rounded px-1 py-1.5 underline-offset-2 hover:text-[#046c4e] hover:underline"
              >
                {locale === "bn" ? "কুকি নীতি" : "Cookies"}
              </button>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
