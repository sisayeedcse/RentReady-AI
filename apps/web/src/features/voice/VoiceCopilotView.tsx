import { HelpCircle, Receipt, Send, Wallet, Wrench } from "lucide-react";
import type { Locale } from "../../lib/i18n";
import { HeroVoiceLauncher } from "./HeroVoiceLauncher";

export function VoiceCopilotView({
  accessToken,
  locale,
  onToast
}: {
  accessToken: string;
  locale: Locale;
  onToast?: (msg: string) => void;
}) {
  const examples =
    locale === "bn"
      ? [
          {
            icon: <Wallet className="h-4 w-4 text-emerald-600" />,
            title: "ভাড়া জমা করা",
            say: "“ফ্ল্যাট 3B এর রহিম ভাই ৮০০০ টাকা বিকাশ করেছে”"
          },
          {
            icon: <HelpCircle className="h-4 w-4 text-amber-600" />,
            title: "বকেয়া বা আয় জানা",
            say: "“এই মাসে কত ভাড়া বাকি আছে?”"
          },
          {
            icon: <Receipt className="h-4 w-4 text-rose-600" />,
            title: "বাড়ির খরচ লেখা",
            say: "“পানির পাম্প মেরামতে ১৫০০ টাকা খরচ হয়েছে”"
          },
          {
            icon: <Wrench className="h-4 w-4 text-blue-600" />,
            title: "মেরামতের অনুরোধ",
            say: "“ফ্ল্যাট 3B এর রান্নাঘরের কল নষ্ট, জরুরি মেরামত লাগবে”"
          },
          {
            icon: <Send className="h-4 w-4 text-teal-600" />,
            title: "তাগাদা SMS তৈরি",
            say: "“ফ্ল্যাট 3B এর রহিম ভাইকে ভাড়ার রিমাইন্ডার পাঠাও”"
          }
        ]
      : [
          {
            icon: <Wallet className="h-4 w-4 text-emerald-600" />,
            title: "Record Rent Payment",
            say: "“Flat 3B Rahim paid 8000 taka via bKash”"
          },
          {
            icon: <HelpCircle className="h-4 w-4 text-amber-600" />,
            title: "Check Dues & Totals",
            say: "“How much rent is outstanding this month?”"
          },
          {
            icon: <Receipt className="h-4 w-4 text-rose-600" />,
            title: "Log Property Expense",
            say: "“Spent 1500 taka on water pump repair”"
          },
          {
            icon: <Wrench className="h-4 w-4 text-blue-600" />,
            title: "Log Maintenance Issue",
            say: "“Flat 3B kitchen tap is leaking, urgent repair”"
          },
          {
            icon: <Send className="h-4 w-4 text-teal-600" />,
            title: "Prepare Rent Reminder",
            say: "“Send rent reminder SMS to Flat 3B Rahim”"
          }
        ];

  return (
    <div className="space-y-5">
      <HeroVoiceLauncher accessToken={accessToken} locale={locale} onToast={onToast} />

      <section className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900">
          {locale === "bn" ? "কীভাবে কথা বলবেন? (নমুনা)" : "What You Can Say (Examples)"}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          {locale === "bn"
            ? "স্বাভাবিক বাংলায় বা বাংলিশে বলুন — প্রতিবার সেভ করার আগে আপনাকে যাচাই করার সুযোগ দেওয়া হবে।"
            : "Speak naturally in Bangla or English — you always review and confirm before anything is saved."}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {examples.map((ex) => (
            <div
              key={ex.title}
              className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 transition hover:border-emerald-200 hover:bg-emerald-50/30"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-2xs">
                  {ex.icon}
                </span>
                {ex.title}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{ex.say}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
