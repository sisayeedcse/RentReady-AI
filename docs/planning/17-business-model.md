# 17 — Business Model & Commercial Viability (Hypotheses)

**Last Updated:** 2026-11-22  
**Epistemic Legend:** `[Official requirement]` | `[Verified technical fact]` | `[Recommendation]` | `[Assumption]` | `[Unknown]` | `[Unverified]`

> **Honesty Notice:** All pricing tiers, conversion rates, and unit economics below are **unvalidated hypotheses** (`[Assumption]`) until tested with 5–10 real landlords during the Release C pilot. No market size or revenue projections are fabricated.

---

## 1. Value Proposition & Monetization Hypothesis

Small Bangladeshi landlords (2–20 units) are price-sensitive and accustomed to free tools like Baario or paper *khatas* `[Verified technical fact — Baario advertised as free, accessed 2026-11-22]`. Charging upfront before proving ledger accuracy and time savings will cause high drop-off `[Assumption]`.

### Proposed Freemium SaaS Structure (Hypothesis to Validate in Pilot)

| Tier | Target Landlord | Monthly Price (Hypothesis) | Included Features |
| :--- | :--- | :---: | :--- |
| **Free (Starter)** | Very small landlords (up to 4 units) | **0 BDT / mo** | Properties, units, tenants, full/partial ledger, dashboard, Banglalink AppLink SMS receipts (fair-use cap), text entry + limited Bangla voice commands (e.g., 20/mo) `[Assumption]` |
| **Standard (Landlord Pro)** | Active small landlords (5–20 units) | **300 – 500 BDT / mo** (~$2.40–$4.00) | Unlimited units (up to 25), higher Bangla voice allowance (200/mo), multi-operator SMS bundle (e.g., 50 SMS/mo), monthly PDF/CSV reports, deposit & utility tracking `[Assumption]` |
| **Multi-Building / NRB** | Portfolio owners & NRBs (21+ units) | **1,000 – 1,500 BDT / mo** (~$8–$12) | Unlimited properties, caretaker/staff sub-accounts with audit trail, priority multi-operator SMS bundle, annual tax/income export `[Assumption]` |

---

## 2. Unit Economics Sanity Check (At ~100 Landlords)

- **Estimated Infrastructure + AI + SMS COGS at 100 landlords:** ~61–98 BDT per landlord/month (see [14-cost-analysis.md](file:///d:/Softwares/AppQuest/RentReady%20AI/docs/planning/14-cost-analysis.md)) `[Assumption]`.
- **Break-Even Reality Check:**
  - At **350 BDT/mo** average revenue per paying landlord and **~90 BDT/mo** variable/allocated infrastructure cost, gross margin per paying landlord is **~260 BDT/mo** (~74%) `[Assumption]`.
  - Supporting 30 paying landlords (~10,500 BDT/mo revenue) covers the entire ~6,100–9,800 BDT/mo production infrastructure bill for 100 total landlords (including 70 free-tier users) `[Assumption]`.
- **AppLink Revenue-Share Note:** Banglalink AppLink natively offers developer monetization via subscriber billing / revenue-share for telco-billed consumer apps (`https://dev.applink.com.bd`, accessed 2026-11-22) `[Verified technical fact]`. For a B2B/prosumer landlord SaaS, direct monthly SaaS subscriptions (via bKash/Nagad in Release D) are cleaner than charging tenants per SMS, while AppLink provides zero-cost SMS delivery to Banglalink subscribers `[Recommendation]`.

---

## 3. Go-To-Market & Validation Path

1. **Phase 1 (AppQuest 2.0):** Win hackathon credibility, mentor feedback, and Banglalink ecosystem visibility.
2. **Phase 2 (5–10 Landlord Pilot):** Onboard landlords via personal/family networks in Dhaka/Chattogram for 60 days free; run the 10 discovery questions from [03-market-research.md](file:///d:/Softwares/AppQuest/RentReady%20AI/docs/planning/03-market-research.md) to test willingness-to-pay.
3. **Phase 3 (Paid Conversion Test):** Introduce paid tier only after confirming >= 70% Month-2 retention and adding multi-operator SMS support `[Recommendation]`.
