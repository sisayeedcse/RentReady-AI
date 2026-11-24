import { ArrowUpRight, HelpCircle, Receipt, Send, Wallet, Wrench } from "lucide-react";
import { useState } from "react";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
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
  const [command, setCommand] = useState<{ text: string; seq: number } | null>(null);

  const examples =
    locale === "bn"
      ? [
          {
            icon: <Wallet className="h-4 w-4 text-[#046c4e]" aria-hidden="true" />,
            title: "ভাড়া জমা করা",
            prompt: "ফ্ল্যাট 3B এর রহিম ভাই ৮০০০ টাকা বিকাশ করেছে"
          },
          {
            icon: <HelpCircle className="h-4 w-4 text-amber-700" aria-hidden="true" />,
            title: "বকেয়া বা আয় জানা",
            prompt: "এই মাসে কত ভাড়া বাকি আছে?"
          },
          {
            icon: <Receipt className="h-4 w-4 text-rose-700" aria-hidden="true" />,
            title: "বাড়ির খরচ লেখা",
            prompt: "পানির পাম্প মেরামতে ১৫০০ টাকা খরচ হয়েছে"
          },
          {
            icon: <Wrench className="h-4 w-4 text-blue-700" aria-hidden="true" />,
            title: "মেরামতের অনুরোধ",
            prompt: "ফ্ল্যাট 3B এর রান্নাঘরের কল নষ্ট, জরুরি মেরামত লাগবে"
          },
          {
            icon: <Send className="h-4 w-4 text-[#046c4e]" aria-hidden="true" />,
            title: "তাগাদা SMS তৈরি",
            prompt: "ফ্ল্যাট 3B এর রহিম ভাইকে ভাড়ার রিমাইন্ডার পাঠাও"
          }
        ]
      : [
          {
            icon: <Wallet className="h-4 w-4 text-[#046c4e]" aria-hidden="true" />,
            title: "Record Rent Payment",
            prompt: "Flat 3B Rahim paid 8000 taka via bKash"
          },
          {
            icon: <HelpCircle className="h-4 w-4 text-amber-700" aria-hidden="true" />,
            title: "Check Dues & Totals",
            prompt: "How much rent is outstanding this month?"
          },
          {
            icon: <Receipt className="h-4 w-4 text-rose-700" aria-hidden="true" />,
            title: "Log Property Expense",
            prompt: "Spent 1500 taka on water pump repair"
          },
          {
            icon: <Wrench className="h-4 w-4 text-blue-700" aria-hidden="true" />,
            title: "Log Maintenance Issue",
            prompt: "Flat 3B kitchen tap is leaking, urgent repair"
          },
          {
            icon: <Send className="h-4 w-4 text-[#046c4e]" aria-hidden="true" />,
            title: "Prepare Rent Reminder",
            prompt: "Send rent reminder SMS to Flat 3B Rahim"
          }
        ];

  function tryExample(prompt: string) {
    setCommand((prev) => ({ text: prompt, seq: (prev?.seq ?? 0) + 1 }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-5">
      <HeroVoiceLauncher
        accessToken={accessToken}
        locale={locale}
        variant="studio"
        externalCommand={command}
        onToast={onToast}
      />

      <Card>
        <CardHeader
          title={locale === "bn" ? "কীভাবে কথা বলবেন? (ক্লিক করে পরীক্ষা করুন)" : "Command Examples (Click to Try)"}
          subtitle={
            locale === "bn"
              ? "স্বাভাবিক বাংলায় বা ইংরেজিতে বলুন — যেকোনো নমুনায় ট্যাপ করলে সরাসরি খসড়া তৈরি হবে।"
              : "Speak naturally in Bangla or English — click any example below to test the verification flow."
          }
        />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {examples.map((ex) => (
              <button
                key={ex.title}
                type="button"
                onClick={() => tryExample(ex.prompt)}
                className="group flex cursor-pointer flex-col justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-rail)] p-3.5 text-left transition-all duration-150 hover:border-[#a7f3d0] hover:bg-[#ecfdf5]/60 active:scale-[0.99]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--ink-primary)]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-white">
                        {ex.icon}
                      </span>
                      <span>{ex.title}</span>
                    </div>
                    <ArrowUpRight
                      className="h-3.5 w-3.5 text-[var(--ink-muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#046c4e]"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
                    “{ex.prompt}”
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
