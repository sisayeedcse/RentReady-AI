import { describe, expect, it } from "vitest";
import { toFriendlyError } from "../lib/friendlyError";
import { MESSAGES, t } from "../lib/i18n";

describe("Bangla / English i18n dictionary", () => {
  it("keeps 100% key parity between bn and en locales", () => {
    const bnKeys = Object.keys(MESSAGES.bn).sort();
    const enKeys = Object.keys(MESSAGES.en).sort();
    expect(bnKeys).toEqual(enKeys);
  });

  it("contains zero hackathon or demo branding in production UI copy", () => {
    const allCopy = [...Object.values(MESSAGES.bn), ...Object.values(MESSAGES.en)].join(" ");
    expect(allCopy).not.toMatch(/appquest|the nerds|demo/i);
  });

  it("returns localized strings cleanly", () => {
    expect(t("bn", "brand")).toBe("RentReady");
    expect(t("bn", "switchLang")).toBe("English");
    expect(t("en", "switchLang")).toBe("বাংলা");
  });
});

describe("Customer-friendly error translator", () => {
  it("converts raw HTTP 429, E1303, and auth errors into warm Bangla/English copy", () => {
    expect(toFriendlyError(new Error("HTTP 429 rate-limited"), "bn")).toContain("৫–১০ সেকেন্ড");
    expect(toFriendlyError(new Error("AppLink E1303 IP address not provisioned"), "en")).toContain(
      "copy the text"
    );
    expect(toFriendlyError(new Error("Invalid login credentials"), "bn")).toContain("পাসওয়ার্ড");
    expect(toFriendlyError(new Error("Unsupported audio format"), "en")).toContain("Unsupported");
    expect(toFriendlyError(new Error("Too many requests"), "bn")).toContain("কিছুক্ষণ পর");
    expect(toFriendlyError(new Error("Invalid or expired session token"), "en")).toContain("session has expired");
    expect(toFriendlyError(new Error("Cross-origin request forbidden"), "en")).toContain("origin security policy");
    expect(toFriendlyError(new Error("Could not analyze voice command right now."), "bn")).toContain("বিশ্লেষণ");
  });
});
