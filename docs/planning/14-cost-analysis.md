# 14 — Cost Analysis & Zero-Budget Hackathon Strategy (USD & BDT)

**Last Updated:** 2026-11-22  
**Exchange Rate Reference:** `1 USD ≈ 125 BDT` (sources: `xe.com`, `ebl.com.bd`, accessed 2026-11-22) `[Verified technical fact]`.  
**User Decision Locked:** **$0/mo Hackathon Budget** — Oracle Cloud Always Free VM + OpenRouter Free ($0 / 50 RPD) + Groq Whisper Free + Cloudflare Free + Supabase Free.  
**Epistemic Legend:** `[Official requirement]` | `[Verified technical fact]` | `[Recommendation]` | `[Assumption]` | `[Unknown]` | `[Unverified]`

---

## 1. Service Pricing & Free Allowance Audit

| Service | Free Allowance | Card Required? | Verified Paid Upgrade (When Scaling) |
| :--- | :--- | :---: | :--- |
| **Google Antigravity** | Free tier: unlimited tab/command, baseline models, weekly quota refresh | No | $19.99/mo Pro (optional) `[Verified]` |
| **OpenCode** | Open-source CLI/Desktop | No | $0 `[Verified]` |
| **OpenRouter (`:free` models)** | 20 RPM, **50 RPD** ($0 spent) | No | One-time $10 top-up unlocks 1,000 RPD `[Verified]` |
| **Cloudflare Workers + Static Assets** | 100,000 req/day, 10 ms CPU/req, $0 egress | No | $5/mo Paid (~625 BDT) `[Verified]` |
| **Supabase** | 500 MB DB, 50K MAU, 1 GB storage, 5 GB egress, **pauses after 7 days inactivity, no backups** | No | **$25/mo Pro (~3,125 BDT)** — mandatory for Pilot `[Verified]` |
| **Groq Whisper Large V3 Turbo (ASR)** | 20 RPM, 2,000 RPD, **8 audio hours/day** | No | $0.04/audio hour Paid `[Verified]` |
| **Deepgram Nova-3 `bn` (Backup ASR)** | **$200 non-expiring free credits** | No | ~$0.35–$0.48/audio hour `[Verified]` |
| **Banglalink AppLink SMS / OTP** | **Free ($0) for developers** (Banglalink subscribers only) | No (Banglalink SIM) | $0 developer fee `[Verified]` |
| **Oracle Cloud Always Free VM (Static IPv4)** | **Always Free ($0)** — up to 2 public static IPv4s | Verification card | $0 Always Free (fallback: $4/mo DO if OCI rejects card) `[Verified]` |
| **Sentry Monitoring** | 5,000 errors/mo, 1 user, 30-day retention | No | $26/mo Team `[Verified]` |

---

## 2. Three Cost Scenarios

### Scenario 1: AppQuest 2.0 Hackathon (Locked: $0 / 0 BDT Budget)
| Item | Monthly Cost (USD) | Monthly Cost (BDT) | Operational Guardrail |
| :--- | :---: | :---: | :--- |
| Antigravity + OpenCode | $0.00 | 0 BDT | Use Antigravity for architecture, SQL/RLS reviews, and docs; reserve OpenCode for focused code edits |
| OpenRouter `:free` (50 RPD cap) | $0.00 | 0 BDT | **Strict 50 RPD budget** (see survival rules below) |
| Cloudflare Workers + Static Assets | $0.00 | 0 BDT | Free tier (`*.workers.dev`) |
| Supabase Free | $0.00 | 0 BDT | Ping/use daily through Dec Finale so 7-day inactivity pause never triggers |
| Groq Whisper Large V3 Turbo | $0.00 | 0 BDT | 8 hrs/day free audio |
| Banglalink AppLink SMS | $0.00 | 0 BDT | Approved SP account + test data only |
| Oracle Cloud Always Free VM (Relay) | $0.00 | 0 BDT | Whitelist OCI static IPv4 in AppLink portal |
| Sentry + GitHub Actions | $0.00 | 0 BDT | Free tiers |
| **Total Hackathon Cost** | **$0.00 / mo** | **0 BDT / mo** | **100% Zero-Cost Stack** |

#### Strict 50 RPD Survival Protocol for OpenRouter Free (`[Recommendation]`)
Because you chose to stay at **$0 (50 RPD)** on OpenRouter:
1. **Never let OpenCode explore blindly:** Always specify exact file paths and exact changes in every OpenCode prompt so each task uses 3–8 requests instead of 25+.
2. **Use Google Antigravity for heavy planning, code review, SQL design, and documentation** so zero OpenRouter RPD is spent on non-coding prose.
3. **Separate App Runtime Key vs. Dev Key Awareness:** Remember that OpenRouter's 50 RPD is per account — during live demo testing (28–30 Nov), reserve at least 15–20 daily requests for RentReady AI's runtime voice intent extraction!
4. **Monitor Quota:** Check `GET https://openrouter.ai/api/v1/key` before starting a coding session.

---

### Scenario 2: Small Customer Pilot (5–10 Landlords, ~100 Units Total)
| Item | Monthly Cost (USD) | Monthly Cost (BDT) | Notes |
| :--- | :---: | :---: | :--- |
| Supabase **Pro** (Mandatory for uptime + daily backups) | $25.00 | 3,125 BDT | Removes 7-day pause `[Recommendation]` |
| Cloudflare Workers Free | $0.00 | 0 BDT | Under 100K req/day |
| Oracle Cloud Always Free Relay (or $4.50 VPS) | $0.00 – $4.50 | 0 – 563 BDT | $0 if OCI stays healthy |
| Groq Whisper Free | $0.00 | 0 BDT | ~25 min audio/mo |
| OpenRouter LLM | $0.00 – $2.00 | 0 – 250 BDT | Low-cost paid fallback recommended for reliability |
| Multi-Operator Local BD SMS (~100 non-BL SMS) | ~$0.40 | ~50 BDT | AppLink $0 for Banglalink `[Assumption]` |
| Custom Domain (amortized) | $1.00 | 125 BDT | ~$12/yr |
| **Total Monthly Pilot Cost** | **~$26.40 – $32.90 / mo** | **~3,300 – 4,113 BDT / mo** | **~330–411 BDT / landlord at 10 landlords** |

---

### Scenario 3: Commercial Scale (~100 Landlords, ~1,000 Units Total)
| Item | Monthly Cost (USD) | Monthly Cost (BDT) | Notes |
| :--- | :---: | :---: | :--- |
| Supabase Pro | $25.00 | 3,125 BDT | Fits 8 GB DB / 100K MAU |
| Cloudflare Workers Paid | $5.00 | 625 BDT | 10M req/mo, higher CPU ceiling |
| Production Static-IP VPS Relay | $6.00 | 750 BDT | Dedicated VPS with backups |
| Groq Paid Whisper Turbo (~4.2 hrs) | $0.20 | 25 BDT | $0.04/audio hr `[Verified]` |
| Low-Cost Paid LLM (OpenRouter) | $5.00 – $10.00 | 625 – 1,250 BDT | SLA-grade paid inference `[Recommendation]` |
| Local Multi-Operator SMS (~1,800 SMS) | ~$6.50 | ~810 BDT | AppLink $0 for Banglalink `[Assumption]` |
| Domain + Monitoring | $1.00 – $26.00 | 125 – 3,250 BDT | Free or Team Sentry |
| **Total Monthly Scale Cost** | **~$48.70 – $78.70 / mo** | **~6,085 – 9,835 BDT / mo** | **~61 – 98 BDT per landlord/month** |
