import { describe, expect, it } from "vitest";
import { t } from "../lib/i18n";

describe("Bangla / English i18n dictionary", () => {
  it("returns Bangla and English copy cleanly", () => {
    expect(t("bn", "brand")).toBe("RentReady AI");
    expect(t("bn", "switchLang")).toBe("English");
    expect(t("en", "switchLang")).toBe("বাংলা");
  });
});
