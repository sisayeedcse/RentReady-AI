# 20 — Decisions Log (All Locked — Ready for Milestone M0)

**Last Updated:** 2026-11-22

| # | Decision Topic | Locked User Decision | Status |
| :---: | :--- | :--- | :---: |
| **D1** | **AppQuest 2.0 Delegate Booklet** | Official 21-page booklet supplied & extracted into `02-appquest-requirements.md` and `18-demo-and-submission.md`. Submission deadline: **30 Nov 2026, 11:59 PM BST**. | **LOCKED** |
| **D2** | **Fixed-IP AppLink Relay Host** | **Oracle Cloud Always Free VM** ($0/mo, static IPv4). *(Fallback note: if OCI card verification rejects signup, pivot immediately to a $4/mo DigitalOcean Droplet so we don't lose days before 30 Nov.)* | **LOCKED** |
| **D3** | **OpenRouter Budget** | **Stay \$0 Free (50 RPD cap).** Enforce strict 50 RPD discipline: use Antigravity for planning/reviews/docs and micro-scoped OpenCode prompts for coding. | **LOCKED** |
| **D4** | **Banglalink AppLink Account** | **Account created & approved.** Verify that **Email 2 (App Approval)** for RentReady AI + static IP whitelisting are completed once OCI IPv4 is created. | **LOCKED** |
| **D5** | **Primary Bangla ASR Provider** | **Groq Whisper Large V3 Turbo** (Free: 2,000 RPD, 8 audio hrs/day) behind replaceable `SpeechToTextProvider` interface, with **Deepgram Nova-3 `bn`** ($200 free credits) as backup. | **LOCKED** |
| **D6** | **Release A MVP Scope** | **Best tightened approach locked:** Ship rock-solid Auth, Properties/Units, Tenants/Tenancies, Immutable Ledger (Full/Partial/Reversals), Expenses, Maintenance, Bangla Voice + 8 Safe Actions, Live AppLink SMS, Dashboard & Audit Log by **30 Nov**; defer Deposits UI, Photo Uploads, AppLink OTP, and Cron to the **6–16 Dec Enhancement Sprint**. | **LOCKED** |
| **D7** | **Track & Team** | **Inter-University Track** — **Team: The Nerds** (4 members). | **LOCKED** |

---

### Remaining Quick Confirmations Before Live Deployment
1. **Oracle Cloud Static IPv4:** Confirm once your OCI Always Free VM is running and share its public IPv4 (for AppLink IP whitelisting — never share SSH private keys).
2. **AppLink Email 2 (App Approval):** Confirm whether your specific **RentReady AI application** on AppLink has also received Email 2 approval from `support@applink.com.bd` (Booklet p. 7).
3. **Approval to Begin Milestone M0:** Say **"Start M0"** to initialize Git, create `AGENTS.md` (with `Applink-as-a-Skill` rules), and create `opencode.json`.
