import { describe, expect, it } from "vitest";
import { MESSAGES, t } from "../lib/i18n";

describe("Bangla / English i18n dictionary", () => {
  it("keeps 100% key parity between bn and en locales", () => {
    const bnKeys = Object.keys(MESSAGES.bn).sort();
    const enKeys = Object.keys(MESSAGES.en).sort();
    expect(bnKeys).toEqual(enKeys);
  });

  it("returns localized strings cleanly", () => {
    expect(t("bn", "brand")).toBe("RentReady AI");
    expect(t("bn", "switchLang")).toBe("English");
    expect(t("en", "switchLang")).toBe("বাংলা");
  });
});
