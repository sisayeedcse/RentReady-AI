# RentReady AI — AppQuest 2.0

**Team:** The Nerds (4 members — Inter-University Track)  
**Theme / Category:** Theme 4 — Frontier Technologies & Resilient Systems / Category 11: Agentic AI & Autonomous Systems (SDG 8, 9)  
**Status:** Full-Stack Implementation & Security Hardening Complete (Ready for Staging / Pilot Deployment)

---

## Overview

**RentReady AI** is a Bangla-first, AI-assisted rental property operations SaaS for small residential landlords in Bangladesh (2–20 units). It replaces paper *khatas* and unstructured bKash screenshots with:

- **Deterministic Financial Ledger (PostgreSQL):** Integer minor units (`paisa`), full & partial payment allocations, immutable reversals, DB-computed outstanding balances, composite cross-tenant foreign keys, 100% RLS isolation, and append-only audit trails.
- **Safe Bangla/Banglish Voice Copilot:** Browser audio capture → magic-byte validation → Google Gemini Native Multimodal Audio ASR (in-memory only, zero raw audio stored) → editable Bangla transcript (with direct text fallback) → pinned Google Gemini structured JSON extraction (`x-goog-api-key` header) → Zod v4 validation → deterministic entity resolution → **explicit human confirmation** before any write or SMS.
- **Live Banglalink AppLink SMS Integration:** Confirmed payment receipts and rent reminders sent via `https://api.applink.com.bd/sms/send` through an HMAC-SHA256 + nonce replay-protected DigitalOcean Static-IPv4 relay (behind Caddy HTTPS), with strict `statusCode === "S1000"` parsing and `requestId` audit logging.

---

## Documentation

- **Deployment Runbook:** [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)
- **Security Operations & Incident Response:** [`docs/SECURITY_OPERATIONS.md`](./docs/SECURITY_OPERATIONS.md)
- **Architecture & Planning Specs:** [`docs/planning/`](./docs/planning/) (`01-product-vision.md` through `21-source-register.md`)

---

## AI Tools & Open-Source Disclosure (AppQuest 2.0 Compliance)

In accordance with AppQuest 2.0 Rules & Regulations (Delegate Booklet p. 11, 15, 18), Team **The Nerds** explicitly discloses the use of the following AI tools and open-source technologies:

- **AI Development Assistants:** Google Antigravity and OpenCode CLI.
- **Runtime AI / ASR Services:** Google Gemini API (`gemini-3.5-flash-lite` primary with `gemini-2.5-flash` / `gemini-2.5-flash-lite` failover) for in-memory Bangla/Banglish speech transcription and strict Zod-validated JSON intent extraction.
- **Telco & Open-Source Stack:** Banglalink AppLink SMS API (guided by `hSenidMobileCPaaS/Applink-as-a-Skill`), React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Hono, Cloudflare Workers, Supabase (PostgreSQL + Auth + RLS), Zod v4, Vitest.
