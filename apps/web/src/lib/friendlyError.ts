import type { Locale } from "./i18n";

/**
 * Translates raw technical / HTTP / Supabase / Gemini / AppLink errors
 * into warm, customer-friendly Bangla or English messages.
 */
export function toFriendlyError(err: unknown, locale: Locale): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lower = raw.toLowerCase();

  if (lower.includes("429") || lower.includes("rate-limit") || lower.includes("rate limit") || lower.includes("quota")) {
    return locale === "bn"
      ? "এই মুহূর্তে AI সার্ভারে একটু বেশি চাপ আছে। অনুগ্রহ করে ৫–১০ সেকেন্ড পরে আবার চেষ্টা করুন।"
      : "The AI assistant is momentarily busy. Please wait 5–10 seconds and try again.";
  }

  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network error")) {
    return locale === "bn"
      ? "সার্ভারের সাথে সংযোগ পাওয়া যাচ্ছে না। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।"
      : "Could not reach the server. Please check your internet connection and try again.";
  }

  if (lower.includes("invalid login credentials")) {
    return locale === "bn"
      ? "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।"
      : "Incorrect email or password. Please try again.";
  }

  if (lower.includes("email not confirmed")) {
    return locale === "bn"
      ? "আপনার ইমেইল এখনো যাচাই করা হয়নি। অনুগ্রহ করে আপনার ইমেইল ইনবক্স দেখুন।"
      : "Your email address is not verified yet. Please check your inbox.";
  }

  if (lower.includes("uq_tenancies_one_active_per_unit") || lower.includes("already occupied")) {
    return locale === "bn"
      ? "এই ফ্ল্যাটে ইতিমধ্যেই একজন সক্রিয় ভাড়াটিয়া আছেন।"
      : "This unit already has an active tenant assigned.";
  }

  if (lower.includes("e1303") || lower.includes("ip address") || lower.includes("relay_unreachable")) {
    return locale === "bn"
      ? "Banglalink AppLink SMS সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। আপনি বার্তাটি কপি করে পাঠাতে পারেন।"
      : "Could not connect to the Banglalink AppLink SMS gateway right now. You can copy the text to send manually.";
  }

  if (lower.includes("e1313")) {
    return locale === "bn"
      ? "Banglalink AppLink অ্যাকাউন্ট যাচাই ব্যর্থ হয়েছে। অনুগ্রহ করে সেটিংস পরীক্ষা করুন।"
      : "Banglalink AppLink authentication failed. Please verify your app credentials.";
  }

  if (lower.includes("microphone") || lower.includes("permission denied") || lower.includes("notallowederror")) {
    return locale === "bn"
      ? "মাইক্রোফোনের অনুমতি পাওয়া যায়নি। নিচে লিখে আপনার আপডেট দিতে পারেন।"
      : "Microphone permission was denied. You can type your update below instead.";
  }

  if (lower.includes("not configured") || lower.includes("missing")) {
    return locale === "bn"
      ? "এই সুবিধাটি এখনো সার্ভারে সেটআপ করা হয়নি।"
      : "This feature is not configured on the server yet.";
  }

  if (lower.includes("unsupported audio") || lower.includes("valid audio format")) {
    return locale === "bn"
      ? "অডিও ফাইলটি সঠিক নয়। অনুগ্রহ করে সরাসরি মাইক্রোফোন ব্যবহার করুন অথবা নিচে লিখুন।"
      : "Unsupported or invalid audio file. Please record directly with your microphone or type below.";
  }

  if (lower.includes("too many requests")) {
    return locale === "bn"
      ? "একটু বেশি অনুরোধ পাঠানো হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।"
      : "Too many requests right now. Please wait a moment and try again.";
  }

  if (lower.includes("already been reversed") || lower.includes("already finalized")) {
    return locale === "bn"
      ? "এই কাজটি ইতিমধ্যেই সম্পন্ন বা বাতিল করা হয়েছে।"
      : "This action has already been completed or cancelled.";
  }

  if (lower.includes("invalid or expired session") || lower.includes("authorization bearer")) {
    return locale === "bn"
      ? "আপনার লগইন সেশনের মেয়াদ শেষ হয়ে গেছে। অনুগ্রহ করে আবার সাইন ইন করুন।"
      : "Your session has expired. Please sign in again.";
  }

  if (lower.includes("cross-origin request forbidden")) {
    return locale === "bn"
      ? "নিরাপত্তা নীতির কারণে অনুরোধটি গ্রহণ করা যায়নি। অনুগ্রহ করে পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।"
      : "Request was blocked by origin security policy. Please reload the page and try again.";
  }

  if (
    lower.includes("could not analyze voice command") ||
    lower.includes("audio transcription failed")
  ) {
    return locale === "bn"
      ? "এই মুহূর্তে AI কমান্ডটি বিশ্লেষণ করতে পারেনি। অনুগ্রহ করে কয়েক সেকেন্ড পরে আবার চেষ্টা করুন।"
      : "The AI assistant could not analyze that command right now. Please try again in a few seconds.";
  }

  if (lower.includes("already exists") || lower.includes("unique details")) {
    return locale === "bn"
      ? "এই তথ্যটি ইতিমধ্যেই সংরক্ষিত আছে।"
      : "A record with these details already exists.";
  }

  if (lower.includes("invalid bangladesh mobile")) {
    return locale === "bn"
      ? "সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 019XXXXXXXX)।"
      : "Please enter a valid Bangladesh mobile number (e.g. 019XXXXXXXX).";
  }

  if (lower.includes("empty transcript") || lower.includes("audio file")) {
    return locale === "bn"
      ? "কোনো কথা শোনা যায়নি। অনুগ্রহ করে মাইক্রোফোনের কাছে পরিষ্কারভাবে আবার বলুন।"
      : "No speech was detected. Please speak clearly and try again.";
  }

  return locale === "bn"
    ? "দুঃখিত, কাজটি সম্পন্ন করা যায়নি। অনুগ্রহ করে একটু পরে আবার চেষ্টা করুন।"
    : "Sorry, something went wrong. Please try again in a moment.";
}
