# RentReady AI — AppQuest 2.0

**Team:** The Nerds (4 members — Inter-University Track)  
**Theme / Category:** Theme 4 — Frontier Technologies & Resilient Systems / Category 11: Agentic AI & Autonomous Systems (SDG 8, 9)  
**Status:** Milestone M0 Complete (Research, Architecture & Governance Locked)

---

## Overview

**RentReady AI** is a Bangla-first, AI-assisted rental property operations SaaS for small residential landlords in Bangladesh (2–20 units). It replaces paper *khatas* and unstructured bKash screenshots with:

- **Deterministic Financial Ledger (PostgreSQL):** Integer minor units (`paisa`), full & partial payment allocations, immutable reversals, DB-computed outstanding balances, and append-only audit trails.
- **Safe Bangla/Banglish Voice Copilot:** Browser audio capture → Groq Whisper Large V3 Turbo ASR → editable Bangla transcript (with direct text fallback) → pinned OpenRouter structured JSON extraction → Zod validation → deterministic entity resolution → **explicit human confirmation** before any write or SMS.
- **Live Banglalink AppLink SMS Integration:** Confirmed payment receipts and rent reminders sent via `https://api.applink.com.bd/sms/send` through an HMAC-authenticated Oracle Cloud Always Free static-IPv4 relay, with full `statusCode` (`S1000`) and `requestId` audit logging.

---

## Architecture & Planning Documentation

All 21 research, architecture, security, cost, and submission documents live in [`docs/planning/`](./docs/planning/):
- [01-product-vision.md](./docs/planning/01-product-vision.md) | [02-appquest-requirements.md](./docs/planning/02-appquest-requirements.md) | [03-market-research.md](./docs/planning/03-market-research.md)
- [05-mvp-scope.md](./docs/planning/05-mvp-scope.md) | [08-system-architecture.md](./docs/planning/08-system-architecture.md) | [09-database-schema.md](./docs/planning/09-database-schema.md)
- [10-ai-voice-design.md](./docs/planning/10-ai-voice-design.md) | [11-applink-integration.md](./docs/planning/11-applink-integration.md) | [16-implementation-roadmap.md](./docs/planning/16-implementation-roadmap.md)

---

## AI Tools & Open-Source Disclosure (AppQuest 2.0 Compliance)

In accordance with AppQuest 2.0 Rules & Regulations (Delegate Booklet p. 11, 15, 18), Team **The Nerds** explicitly discloses the use of the following AI tools and open-source technologies:

- **AI Development Assistants:** Google Antigravity (research, architecture, reviews, documentation) and OpenCode CLI (code implementation and testing) via OpenRouter free-tier open-weight models (`particle-ai/particle-1:free`, `recursive/flint-v1.0:free`, `nvidia/nemotron-3-ultra-550b-a55b:free`, `google/gemma-4-26b-a4b-it:free`).
- **Runtime AI / ASR Services:** Groq Whisper Large V3 Turbo (Bangla/Banglish speech-to-text) and OpenRouter pinned free-tier models (strict Zod-validated JSON intent extraction).
- **Telco & Open-Source Stack:** Banglalink AppLink SMS API (guided by `hSenidMobileCPaaS/Applink-as-a-Skill`), React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Hono, Cloudflare Workers, Supabase (PostgreSQL + Auth + RLS), Zod, Vitest.
