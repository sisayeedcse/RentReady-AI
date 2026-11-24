import { Cookie, FileText, ShieldCheck, X } from "lucide-react";
import { useEffect } from "react";
import type { Locale } from "../../lib/i18n";

export type LegalDocType = "privacy" | "terms" | "cookies";

export function LegalModal({
  doc,
  locale,
  onChangeDoc,
  onClose
}: {
  doc: LegalDocType;
  locale: Locale;
  onChangeDoc: (next: LegalDocType) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const titleId = "legal-modal-title";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet-up flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="text-base font-extrabold text-slate-900">
              {doc === "privacy"
                ? locale === "bn"
                  ? "গোপনীয়তা নীতি (Privacy Policy)"
                  : "Privacy Policy"
                : doc === "terms"
                  ? locale === "bn"
                    ? "ব্যবহারের শর্তাবলি (Terms & Conditions)"
                    : "Terms & Conditions"
                  : locale === "bn"
                    ? "কুকি ও ব্রাউজার স্টোরেজ নীতি (Cookie Policy)"
                    : "Cookie & Browser Storage Policy"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              {locale === "bn"
                ? "কার্যকর তারিখ: ২৪ নভেম্বর ২০২৬ • বাংলাদেশ"
                : "Effective Date: 24 November 2026 • Bangladesh"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={locale === "bn" ? "বন্ধ করুন" : "Close dialog"}
            className="rounded-xl bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Document Switcher */}
        <div
          role="tablist"
          aria-label={locale === "bn" ? "আইনি নথি নির্বাচন" : "Legal documents"}
          className="grid grid-cols-3 gap-1 border-b border-slate-200 bg-slate-50 p-2"
        >
          {(
            [
              ["privacy", ShieldCheck, locale === "bn" ? "গোপনীয়তা" : "Privacy"],
              ["terms", FileText, locale === "bn" ? "শর্তাবলি" : "Terms"],
              ["cookies", Cookie, locale === "bn" ? "কুকি ও স্টোরেজ" : "Cookies & Storage"]
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={doc === id}
              onClick={() => onChangeDoc(id)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                doc === id
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-700 hover:bg-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 text-xs leading-relaxed text-slate-700 sm:px-6 sm:text-sm">
          {doc === "privacy" && <PrivacyContent locale={locale} />}
          {doc === "terms" && <TermsContent locale={locale} />}
          {doc === "cookies" && <CookiesContent locale={locale} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
          >
            {locale === "bn" ? "বুঝেছি ও বন্ধ করুন" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PrivacyContent({ locale }: { locale: Locale }) {
  if (locale === "bn") {
    return (
      <>
        <p>
          <strong>RentReady</strong> বাংলাদেশের আবাসিক বাড়িওয়ালাদের জন্য একটি ডিজিটাল ভাড়া ও
          হিসাব পরিচালনা সফটওয়্যার। এই গোপনীয়তা নীতিতে আমরা প্রকৃতপক্ষে কী তথ্য সংগ্রহ করি, কীভাবে
          প্রক্রিয়াজাত করি এবং কীভাবে সুরক্ষিত রাখি তা স্পষ্টভাবে বর্ণনা করা হয়েছে।
        </p>

        <section className="space-y-1">
          <h3 className="font-bold text-slate-900">১. আমরা কী তথ্য সংগ্রহ করি</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>বাড়িওয়ালার অ্যাকাউন্ট তথ্য:</strong> পূর্ণ নাম, ইমেইল ঠিকানা এবং পছন্দের ভাষা।
            </li>
            <li>
              <strong>সম্পত্তি ও ভাড়াটিয়ার তথ্য:</strong> বাড়ির নাম ও ঠিকানা, ফ্ল্যাট নম্বর,
              ভাড়াটিয়ার নাম, বাংলাদেশি মোবাইল নম্বর (+880), ঐচ্ছিক ইমেইল ও নোট।
            </li>
            <li>
              <strong>আর্থিক ও পরিচালনা রেকর্ড:</strong> মাসিক ভাড়ার বিল, জমার পরিমাণ ও মাধ্যম
              (নগদ/বিকাশ/নগদ/ব্যাংক), সংশোধন (রিভার্সাল), বাড়ির খরচ, মেরামতের অনুরোধ এবং অডিট লগ।
            </li>
            <li>
              <strong>ভয়েস ও SMS তথ্য:</strong> ভয়েস কমান্ডের <em>টেক্সট ট্রান্সক্রিপ্ট</em>{" "}
              সংরক্ষণ করা হয়। <strong>কাঁচা ভয়েস অডিও ফাইল সংরক্ষণ করা হয় না</strong>—তা কেবল
              ইন-মেমরিতে ট্রান্সক্রিপ্ট করার পর তাৎক্ষণিকভাবে মুছে ফেলা হয়। আমরা ভাড়াটিয়ার
              জাতীয় পরিচয়পত্র (NID) নম্বর/ছবি বা কোনো মোবাইল ব্যাংকিং পিন/পাসওয়ার্ড সংগ্রহ করি না।
            </li>
          </ul>
        </section>

        <section className="space-y-1">
          <h3 className="font-bold text-slate-900">২. তথ্য ব্যবহারের উদ্দেশ্য ও তৃতীয় পক্ষের সেবা</h3>
          <p>আপনার তথ্য শুধুমাত্র হিসাব পরিচালনা, ভয়েস এন্ট্রি বিশ্লেষণ এবং নিশ্চিতকৃত SMS পাঠাতে ব্যবহৃত হয়। আমরা কখনোই ব্যক্তিগত তথ্য বিজ্ঞাপনদাতার কাছে বিক্রি করি না। ব্যবহৃত প্রযুক্তি অংশীদার:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Supabase:</strong> প্রমাণীকরণ (Auth) ও PostgreSQL ডেটাবেজ হোস্টিং।</li>
            <li><strong>Cloudflare Workers:</strong> ওয়েব অ্যাপ ও API হোস্টিং।</li>
            <li><strong>Google Gemini API:</strong> ভয়েস অডিও থেকে বাংলা/ইংরেজি টেক্সট রূপান্তর ও কাঠামোবদ্ধ তথ্য বিশ্লেষণ (সার্ভার-সাইডে)।</li>
            <li><strong>Banglalink AppLink (ফিক্সড-আইপি রিলে):</strong> আপনার স্পষ্ট অনুমতির পর ভাড়াটিয়াকে রসিদ বা তাগাদা SMS পাঠানো।</li>
            <li><strong>Google Fonts:</strong> বাংলা ও ইংরেজি ফন্ট প্রদর্শনের জন্য স্টাইলশিট লোড।</li>
          </ul>
        </section>

        <section className="space-y-1">
          <h3 className="font-bold text-slate-900">৩. নিরাপত্তা ব্যবস্থা ও তথ্য সংরক্ষণ</h3>
          <p>
            আমরা ট্রানজিটে HTTPS/TLS এনক্রিপশন, ডেটাবেজে PostgreSQL Row Level Security (RLS)
            যাতে প্রতিটি বাড়িওয়ালা শুধুমাত্র নিজের তথ্য দেখতে পান, JWT যাচাইকরণ এবং প্রতিটি AI
            এন্ট্রি ও SMS-এর আগে বাধ্যতামূলক মানব নিশ্চিতকরণ ব্যবহার করি। তবে কোনো ইন্টারনেট সিস্টেম
            শতভাগ ঝুঁকিমুক্ত নয়। আর্থিক হিসাবের স্বচ্ছতার জন্য পেমেন্ট ও অডিট রেকর্ড স্থায়ীভাবে
            সংরক্ষিত থাকে যতক্ষণ না অ্যাকাউন্ট বন্ধ বা মুছে ফেলার অনুরোধ প্রক্রিয়াজাত হয়।
          </p>
        </section>

        <section className="space-y-1">
          <h3 className="font-bold text-slate-900">৪. আপনার অধিকার ও প্রযোজ্য আইন</h3>
          <p>
            বাংলাদেশের <strong>ব্যক্তিগত উপাত্ত সুরক্ষা আইন, ২০২৬ (Personal Data Protection Act, 2026)</strong>{" "}
            এবং <strong>সাইবার নিরাপত্তা আইন, ২০২৬</strong>-এর আলোকে আপনার তথ্য দেখার, সংশোধন করার
            এবং অ্যাকাউন্ট মুছে ফেলার অনুরোধ করার অধিকার রয়েছে।
          </p>
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>গোপনীয়তা যোগাযোগ (প্রকাশনার আগে পূরণীয়):</strong> জনসাধারণের জন্য উন্মুক্ত
            করার আগে পরিচালনাকারী প্রতিষ্ঠানের যাচাইকৃত সাপোর্ট ইমেইল ও যোগাযোগের ঠিকানা এখানে যুক্ত
            করতে হবে।
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <p>
        <strong>RentReady</strong> is a residential rental property ledger and voice-assisted
        operations tool designed for landlords in Bangladesh. This Privacy Policy describes what
        data the application actually collects, why it is processed, which external services receive
        it, and what rights you have.
      </p>

      <section className="space-y-1">
        <h3 className="font-bold text-slate-900">1. Information We Collect</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Landlord Account Information:</strong> Full name, email address, and preferred
            interface language.
          </li>
          <li>
            <strong>Property &amp; Tenant Records:</strong> Property names/addresses, unit codes,
            monthly rent amounts, tenant names, Bangladesh mobile numbers (+880), and optional
            tenant email or operational notes entered by the landlord.
          </li>
          <li>
            <strong>Financial &amp; Operational Records:</strong> Rent bills, recorded payment
            amounts and methods (cash/bKash/Nagad/bank), reversal entries, property expenses,
            maintenance tickets, and append-only audit logs.
          </li>
          <li>
            <strong>Voice Transcripts &amp; SMS Logs:</strong> When you use the Voice Assistant,
            audio is transmitted in-memory for speech-to-text transcription and{" "}
            <strong>immediately discarded (raw audio is never stored)</strong>. Only the resulting
            text transcript, structured action draft, and SMS delivery status codes are stored. We
            do <strong>not</strong> collect National ID (NID) numbers/photos or financial account
            PINs/passwords.
          </li>
        </ul>
      </section>

      <section className="space-y-1">
        <h3 className="font-bold text-slate-900">2. Third-Party Service Providers</h3>
        <p>
          We do not sell personal data or run third-party advertising trackers. To operate the
          service, data is processed strictly as needed by:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Supabase:</strong> User authentication (bcrypt password hashing) and PostgreSQL database storage.</li>
          <li><strong>Cloudflare Workers:</strong> Web application and API request routing.</li>
          <li><strong>Google Gemini API:</strong> Server-side speech-to-text transcription of voice clips (in-memory) and structured command extraction from transcripts.</li>
          <li><strong>Banglalink AppLink (via Fixed-IP Relay):</strong> Sending landlord-confirmed SMS receipts and rent reminders to tenant phone numbers.</li>
          <li><strong>Google Fonts:</strong> Loading Bangla and English display font stylesheets in the browser.</li>
        </ul>
      </section>

      <section className="space-y-1">
        <h3 className="font-bold text-slate-900">3. Security Measures &amp; Data Retention</h3>
        <p>
          We apply HTTPS/TLS transport encryption, PostgreSQL Row Level Security (RLS) so each
          landlord can only access their own records, server-side JWT validation, rate limiting,
          HMAC-authenticated SMS relay dispatch, and mandatory human confirmation prior to any
          AI-suggested write or SMS. No system can guarantee absolute security, and we do not claim
          third-party security certifications. Financial ledger and audit records are retained for
          accurate accounting while your account remains active or until an account deletion request
          is processed in accordance with applicable law.
        </p>
      </section>

      <section className="space-y-1">
        <h3 className="font-bold text-slate-900">4. Applicable Jurisdiction &amp; Your Rights</h3>
        <p>
          RentReady is designed primarily for users in the People&apos;s Republic of Bangladesh. Under
          Bangladesh&apos;s <strong>Personal Data Protection Act, 2026 (PDPA)</strong> (Act No. 63 of
          2026) and <strong>Cyber Security Act, 2026</strong>, you may request access to, correction
          of, export of, or deletion of your personal data.
        </p>
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Privacy Contact (Operator Action Required Before Public Launch):</strong> Insert
          the verified operator legal entity name, official support/privacy email, and physical
          contact address prior to public commercial launch.
        </p>
      </section>
    </>
  );
}

function TermsContent({ locale }: { locale: Locale }) {
  if (locale === "bn") {
    return (
      <>
        <p>
          <strong>RentReady</strong> ব্যবহার করে আপনি নিম্নোক্ত শর্তাবলিতে সম্মত হচ্ছেন। অনুগ্রহ করে
          অ্যাকাউন্ট তৈরি ও ব্যবহারের আগে এই শর্তগুলো মনোযোগ সহকারে পড়ুন।
        </p>

        <section className="space-y-1">
          <h3 className="font-bold text-slate-900">১. অ্যাকাউন্ট ও ব্যবহারকারীর দায়িত্ব</h3>
          <p>
            আপনার অ্যাকাউন্টের পাসওয়ার্ড গোপন রাখা এবং আপনার অ্যাকাউন্ট থেকে করা সকল হিসাব ও
            কার্যক্রমের দায়ভার আপনার। কমপক্ষে ১৮ বছর বয়সী বৈধ বাড়িওয়ালা বা অনুমোদিত সম্পত্তি
            ব্যবস্থাপক হিসেবেই এই সেবা ব্যবহার করতে হবে।
          </p>
        </section>

        <section className="space-y-1">
          <h3 className="font-bold text-slate-900">২. ভাড়াটিয়ার তথ্য ও SMS পাঠানোর সম্মতি</h3>
          <p>
            আপনি যখন কোনো ভাড়াটিয়ার নাম ও মোবাইল নম্বর যুক্ত করেন বা SMS রসিদ/তাগাদা পাঠান, তখন
            উক্ত ভাড়াটিয়ার সাথে বৈধ ভাড়া চুক্তি ও যোগাযোগের অনুমতি থাকার বিষয়টি নিশ্চিত করার
            দায়িত্ব আপনার। স্প্যাম, হয়রানি বা অননুমোদিত বার্তা পাঠানো সম্পূর্ণ নিষিদ্ধ।
          </p>
        </section>

        <section className="space-y-1">
          <h3 className="font-bold text-slate-900">৩. হিসাবরক্ষক টুল ও AI সহায়তার সীমাবদ্ধতা</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>অর্থ লেনদেন নয়:</strong> RentReady কেবল হিসাব সংরক্ষণের ডিজিটাল খাতা। আমরা
              কোনো ভাড়ার টাকা গ্রহণ, সংরক্ষণ বা স্থানান্তর (পেমেন্ট প্রসেসিং) করি না।
            </li>
            <li>
              <strong>AI যাচাইকরণ:</strong> ভয়েস কমান্ড থেকে AI দ্বারা প্রস্তুত যেকোনো এন্ট্রি
              সেভ বা SMS পাঠানোর আগে সঠিক অঙ্ক, ফ্ল্যাট ও ভাড়াটিয়া যাচাই করা আপনার দায়িত্ব।
            </li>
            <li>
              <strong>আইনি বা কর পরামর্শ নয়:</strong> এই অ্যাপের রিপোর্ট কোনো আইনি, কর বা চার্টার্ড
              অ্যাকাউন্টিং পরামর্শের বিকল্প নয়।
            </li>
          </ul>
        </section>

        <section className="space-y-1">
          <h3 className="font-bold text-slate-900">৪. মূল্য, রিফান্ড ও সেবার প্রাপ্যতা</h3>
          <p>
            বর্তমানে এই সংস্করণে কোনো অনলাইন পেইড সাবস্ক্রিপশন বা চেকআউট চালু নেই। ভবিষ্যতে পেইড
            প্ল্যান চালু করা হলে ক্রয়ের পূর্বেই স্পষ্ট মূল্য, বাতিলকরণ ও রিফান্ড নীতি প্রকাশ করা হবে।
            সার্ভার রক্ষণাবেক্ষণ বা তৃতীয় পক্ষের নেটওয়ার্ক (যেমন টেলকো SMS বা AI সার্ভার) সমস্যার
            কারণে সাময়িক বিঘ্ন ঘটতে পারে।
          </p>
        </section>

        <section className="space-y-1">
          <h3 className="font-bold text-slate-900">৫. প্রযোজ্য আইন ও বিরোধ নিষ্পত্তি</h3>
          <p>
            এই শর্তাবলি গণপ্রজাতন্ত্রী বাংলাদেশের প্রচলিত আইন দ্বারা পরিচালিত হবে। নীতিমালা লঙ্ঘন বা
            অপব্যবহারের ক্ষেত্রে অ্যাকাউন্ট স্থগিত বা বাতিল করার অধিকার সংরক্ষিত।
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <p>
        By creating an account or using <strong>RentReady</strong>, you agree to these Terms &amp;
        Conditions. Please read them carefully before using the application.
      </p>

      <section className="space-y-1">
        <h3 className="font-bold text-slate-900">1. Eligibility &amp; Account Security</h3>
        <p>
          You must be at least 18 years old and authorized to manage the properties you record. You
          are responsible for maintaining the confidentiality of your login credentials and for all
          actions confirmed under your account.
        </p>
      </section>

      <section className="space-y-1">
        <h3 className="font-bold text-slate-900">2. Tenant Data &amp; Lawful SMS Use</h3>
        <p>
          You represent that you have an active rental relationship or lawful basis to store tenant
          contact details and send transactional rent receipts or reminders. Sending spam,
          harassing messages, or unlawful content via the SMS gateway is strictly prohibited and may
          result in immediate suspension.
        </p>
      </section>

      <section className="space-y-1">
        <h3 className="font-bold text-slate-900">3. Operational Ledger &amp; AI Disclaimers</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Not a Payment Processor:</strong> RentReady records offline and third-party
            payments (cash, bKash, Nagad, bank transfer) for bookkeeping only. We do not collect,
            hold, or transfer rent funds.
          </li>
          <li>
            <strong>Human Review of AI Entries:</strong> Voice transcription and AI intent
            extraction may occasionally mishear numbers or names. You are solely responsible for
            verifying every confirmation card before saving or dispatching SMS.
          </li>
          <li>
            <strong>No Legal or Tax Advice:</strong> Summaries and ledgers are provided for
            convenience and do not constitute legal, tax, or professional accounting advice.
          </li>
        </ul>
      </section>

      <section className="space-y-1">
        <h3 className="font-bold text-slate-900">4. Pricing, Subscriptions &amp; Availability</h3>
        <p>
          This release does not include paid online checkout or recurring subscription billing;
          accordingly, no commercial refund policy applies at this time. If paid tiers are offered in
          the future, clear pricing, cancellation, and refund terms will be published prior to any
          purchase. The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, and
          depends on third-party infrastructure (database, AI, and telecom SMS providers).
        </p>
      </section>

      <section className="space-y-1">
        <h3 className="font-bold text-slate-900">5. Governing Law &amp; Termination</h3>
        <p>
          These Terms are governed by the laws of the People&apos;s Republic of Bangladesh. We may
          suspend or terminate accounts that engage in abuse, unauthorized access attempts, or
          violations of applicable law.
        </p>
      </section>
    </>
  );
}

function CookiesContent({ locale }: { locale: Locale }) {
  if (locale === "bn") {
    return (
      <>
        <p>
          <strong>RentReady</strong> কোনো বিজ্ঞাপন, অ্যানালিটিক্স বা তৃতীয় পক্ষের ট্র্যাকিং কুকি
          ব্যবহার করে না।
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-3 py-2 font-bold">প্রযুক্তি</th>
                <th className="px-3 py-2 font-bold">ধরন</th>
                <th className="px-3 py-2 font-bold">উদ্দেশ্য</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-3 py-2 font-mono">sb-*-auth-token (localStorage)</td>
                <td className="px-3 py-2 font-semibold text-emerald-700">অত্যাবশ্যকীয়</td>
                <td className="px-3 py-2">Supabase Auth লগইন সেশন নিরাপদে চালু রাখা। লগআউট করলে মুছে যায়।</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono">Google Fonts (CSS)</td>
                <td className="px-3 py-2 font-semibold text-slate-700">কার্যকরী</td>
                <td className="px-3 py-2">বাংলা (Hind Siliguri) ও ইংরেজি ফন্ট লোড করা। কোনো বিজ্ঞাপন কুকি সেট করে না।</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-slate-600">
          যেহেতু আমরা কোনো অপ্রয়োজনীয় ট্র্যাকিং বা বিজ্ঞাপন কুকি ব্যবহার করি না, তাই আলাদা কুকি
          সম্মতি ব্যানার দেখানো হয় না। আপনি যেকোনো সময় লগআউট করে বা ব্রাউজারের সাইট ডেটা ক্লিয়ার
          করে স্থানীয় স্টোরেজ মুছে ফেলতে পারেন।
        </p>
      </>
    );
  }

  return (
    <>
      <p>
        <strong>RentReady</strong> uses <strong>zero</strong> advertising, behavioral analytics, or
        third-party tracking cookies. Only strictly necessary browser storage is used to keep you
        signed in.
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2 font-bold">Storage / Resource</th>
              <th className="px-3 py-2 font-bold">Category</th>
              <th className="px-3 py-2 font-bold">Purpose</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-3 py-2 font-mono">sb-*-auth-token (localStorage)</td>
              <td className="px-3 py-2 font-semibold text-emerald-700">Strictly Necessary</td>
              <td className="px-3 py-2">Maintains your authenticated Supabase Auth session across page reloads. Cleared when you sign out.</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono">Google Fonts Stylesheet</td>
              <td className="px-3 py-2 font-semibold text-slate-700">Functional</td>
              <td className="px-3 py-2">Loads Hind Siliguri (Bangla) and Plus Jakarta Sans fonts. Does not set tracking cookies.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-slate-600">
        Because no non-essential tracking cookies or analytics scripts are loaded, a cookie consent
        pop-up banner is not required. You may clear stored session data at any time by signing out
        or clearing site storage in your browser settings.
      </p>
    </>
  );
}
