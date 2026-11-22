export type Locale = "bn" | "en";

export const MESSAGES = {
  bn: {
    brand: "RentReady AI",
    tagline: "বাংলায় কথা বলেই ভাড়া, বকেয়া ও রসিদ পরিচালনা করুন",
    badge: "AppQuest 2.0 • Team The Nerds",
    apiOnline: "API সচল আছে",
    apiOffline: "API সংযুক্ত নয় (লোকাল প্রিভিউ)",
    ledgerTitle: "নির্ভুল ফাইন্যান্সিয়াল লেজার",
    ledgerDesc: "পূর্ণ ও আংশিক ভাড়া, বকেয়া হিসাব ও অপরিবর্তনীয় রিভার্সাল—পয়সা পর্যন্ত নির্ভুল।",
    voiceTitle: "বাংলা ভয়েস কো-পাইলট",
    voiceDesc: "কথা বলুন, ট্রান্সক্রিপ্ট দেখুন এবং নিশ্চিত না করা পর্যন্ত কোনো ডেটা পরিবর্তন হবে না।",
    smsTitle: "Banglalink AppLink SMS",
    smsDesc: "নিশ্চিত পেমেন্ট রসিদ ও ভাড়ার রিমাইন্ডার সরাসরি ভাড়াটিয়ার ফোনে পাঠান।",
    sampleDueLabel: "নমুনা বকেয়া (ফ্ল্যাট 3B)",
    switchLang: "English"
  },
  en: {
    brand: "RentReady AI",
    tagline: "Bangla-first AI rental operations with a verified financial ledger",
    badge: "AppQuest 2.0 • Team The Nerds",
    apiOnline: "API Online",
    apiOffline: "API Offline (Local Preview)",
    ledgerTitle: "Verified Financial Ledger",
    ledgerDesc: "Full & partial payments, DB-computed dues, and immutable reversals in exact paisa.",
    voiceTitle: "Safe Bangla Voice Copilot",
    voiceDesc: "Speak naturally in Bangla or Banglish — every write requires explicit confirmation.",
    smsTitle: "Banglalink AppLink SMS",
    smsDesc: "Send confirmed payment receipts and rent reminders with real S1000 audit logs.",
    sampleDueLabel: "Sample Outstanding (Unit 3B)",
    switchLang: "বাংলা"
  }
} as const;

export type MessageKey = keyof typeof MESSAGES.en;

export function t(locale: Locale, key: MessageKey): string {
  return MESSAGES[locale][key];
}
