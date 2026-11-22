# 06 — AI Development Tooling, OpenRouter Free Models & Benchmark Plan

**Last Updated:** 2026-11-22  
**Epistemic Legend:** `[Official requirement]` | `[Verified technical fact]` | `[Recommendation]` | `[Assumption]` | `[Unknown]` | `[Unverified]`

---

## 1. Tool Responsibility Split & Safety Rules

The user will develop autonomously using **Google Antigravity**, **OpenCode**, and **OpenRouter** free models, and **cannot rely on GLM-5.3-Flash** `[Official requirement — User Constraint]`.

| Tool | Role | Limits & Constraints |
| :--- | :--- | :--- |
| **Google Antigravity** | Research, planning, architecture review, PR/milestone audits, and visual UI inspection `[Recommendation]` | Free tier ($0/mo) uses baseline models with a **weekly quota refresh** (`https://antigravity.google/docs/`, accessed 2026-11-22) `[Verified technical fact]`. Do **not** use unsupported OAuth hacks to proxy Antigravity models into OpenCode `[Recommendation]`. |
| **OpenCode** | Primary repository owner: file editing, terminal operations, migrations, test execution `[Recommendation]` | Native built-in OpenRouter provider via `/connect` or `opencode.json` (`https://opencode.ai/docs/providers`, accessed 2026-11-22) `[Verified technical fact]`. |
| **OpenRouter** | LLM API provider for OpenCode and RentReady AI backend intent extraction `[Recommendation]` | Strict platform rate limits on `:free` models (see Section 2) `[Verified technical fact]`. |

### Mandatory Multi-Agent Repository Rules
- **Never** run Antigravity and OpenCode editing the same workspace simultaneously `[Recommendation]`.
- Always create a clean Git checkpoint (`git commit`) before handing control between Antigravity and OpenCode `[Recommendation]`.
- Maintain a root `AGENTS.md` file that OpenCode reads before every milestone `[Recommendation]`.

---

## 2. OpenRouter Free Tier Reality Check (Critical Warning)

Verified as of **2026-11-22** (`https://openrouter.ai/models`, `https://openrouter.ai/api/v1/key`):
- **Requests Per Minute (RPM):** 20 RPM globally across all `:free` models `[Verified technical fact]`.
- **Requests Per Day (RPD) — Default ($0 spent):** **50 RPD** (resets 00:00 UTC) `[Verified technical fact]`.
- **Requests Per Day (RPD) — Upgraded ($\ge$ \$10 lifetime credit top-up):** **1,000 RPD** (one-time lifetime top-up, not a recurring subscription; account balance must stay $\ge \$0$) `[Verified technical fact]`.
- **Upstream Bottlenecks:** Third-party free hosts frequently return `429 Too Many Requests` during peak hours; failed upstream 429s generally do not deduct from your OpenRouter RPD quota `[Verified technical fact]`.

> **Honest Engineering Warning:** **50 RPD is NOT viable for autonomous OpenCode agent loops.** A single feature milestone in OpenCode (reading files, planning edits, writing code, running tests, fixing a TS error) typically consumes **15–40 API requests**. At 50 RPD, development will stall after 1–2 small tasks per day.  
> **Recommendation:** Perform a **one-time \$10 USD (~1,250 BDT) OpenRouter credit top-up** (which you do not even have to spend on paid models) solely to unlock **1,000 RPD on `:free` models** `[Recommendation]`.

---

## 3. Verified Free Model Catalogue (As of 2026-11-22)

*Note: OpenRouter rotates `:free` endpoints without long notice. Always verify live status at `https://openrouter.ai/models?max_price=0` before starting a sprint.*

| Model Name | Exact Pinned OpenRouter ID | Context Window | Primary Strength | Tool Calling / JSON | Availability Status (2026-11-22) |
| :--- | :--- | :---: | :--- | :---: | :--- |
| **Particle-1** | `particle-ai/particle-1:free` | 1M tokens | Agentic coding, terminal workflows, codebase edits (post-trained on DeepSeek V4.1 Flash) | Supported `[Verified]` | Active `[Verified]` |
| **Recursive Flint v1.0** | `recursive/flint-v1.0:free` | 262K tokens | Open-weight MoE (~40B total / ~2.5B active) coding agent & bug fixing | Supported `[Verified]` | Active `[Verified]` |
| **NVIDIA Nemotron 3 Ultra** | `nvidia/nemotron-3-ultra-550b-a55b:free` | 1M tokens | Heavy frontier reasoning, architecture review, multi-step planning | Supported `[Verified]` | Active `[Verified]` |
| **NVIDIA Nemotron 3.5 Lightning** | `nvidia/nemotron-3.5-lightning:free` | 1M tokens | Fast, lightweight agentic tasks, docs, quick refactors | Supported `[Verified]` | Active `[Verified]` |
| **Google Gemma 4 26B A4B IT** | `google/gemma-4-26b-a4b-it:free` | 262K tokens | High provider uptime, fast structured output & Bangla comprehension | Supported `[Verified]` | Active `[Verified]` |
| **Google Gemma 4 31B IT** | `google/gemma-4-31b-it:free` | 262K tokens | Dense multimodal instruct model, strong instruction adherence | Supported `[Verified]` | Active `[Verified]` |
| **Cohere North Mini Code** | `cohere/north-mini-code:free` | Long context | Agentic coding fallback | Supported `[Verified]` | Active `[Verified]` |
| **OpenRouter Free Auto-Router** | `openrouter/free` | ~200K tokens | Dynamic random routing | Auto-filters | **DO NOT USE for critical coding** `[Recommendation]` |

---

## 4. Recommended Model Allocation (Pinned IDs)

| Slot | Recommended Pinned Model ID | Backup Pinned Model ID | Rationale |
| :--- | :--- | :--- | :--- |
| **Primary OpenCode Coding Model** | `particle-ai/particle-1:free` | `recursive/flint-v1.0:free` | Specifically post-trained for agentic terminal coding and multi-file edits `[Recommendation]` |
| **Secondary Coding Model** | `recursive/flint-v1.0:free` | `cohere/north-mini-code:free` | Fast MoE coding specialist when Particle-1 hits upstream 429 `[Recommendation]` |
| **Reasoning / Architecture Review** | `nvidia/nemotron-3-ultra-550b-a55b:free` | Google Antigravity | Large 550B/55B active MoE suited for deep schema/RLS/security audits `[Recommendation]` |
| **Lightweight Documentation Model** | `nvidia/nemotron-3.5-lightning:free` | `google/gemma-4-26b-a4b-it:free` | High throughput for READMEs, comments, and simple scaffolds `[Recommendation]` |
| **Production App Structured Output (Bangla Intent Extraction)** | `google/gemma-4-26b-a4b-it:free` *(verify Bangla JSON quality in benchmark)* | `nvidia/nemotron-3.5-lightning:free` | Gemma family historically exhibits strong multilingual/Bangla comprehension and high uptime; must be benchmarked on real Bangla/Banglish test prompts before locking `[Recommendation]` `[Unverified until benchmarked]` |

---

## 5. Ten-Task Comparative Benchmark Protocol

**Execution Status:** `[Pending User OpenRouter API Key]` — Because this initial phase is **Research Only** and no OpenRouter API key is configured in the workspace, live benchmark scores are **not fabricated**. Run this exact 10-task harness immediately after the user configures `OPENROUTER_API_KEY` (and before Milestone 1 coding begins) `[Recommendation]`.

### Benchmark Suite (10 Representative Tasks)
1. **Repo Architecture Inspection:** Inspect a TypeScript monorepo and summarize module boundaries accurately.
2. **PostgreSQL Schema Creation:** Generate normalized tables with UUID PKs, FKs, integer minor-unit money columns, and non-negative `CHECK` constraints.
3. **Supabase RLS Policies:** Write strict `SELECT`/`INSERT`/`UPDATE`/`DELETE` policies scoped to `auth.uid()` without recursion or leaks.
4. **React Form + Zod Validation:** Build a React Hook Form + Zod component with accessible error states and Bangla/English labels.
5. **Cloudflare Worker Hono Endpoint:** Implement a typed Hono POST route with JWT verification and Zod body validation.
6. **Debug Failing Test:** Diagnose and fix an intentional off-by-one/allocation bug in a Vitest unit test.
7. **Fix TypeScript Compilation Error:** Resolve strict `tsc --noEmit` generic/discriminated-union errors without using `any`.
8. **Idempotent Financial Transaction:** Implement a payment recording handler using an `idempotency_key` that safely returns the prior result on retry.
9. **Strict Structured JSON (Bangla/Banglish Input):** Extract valid schema-compliant JSON from 5 Bangla/Banglish rent utterances with zero hallucinated fields.
10. **Instruction Adherence:** Edit a single target function while strictly obeying a rule not to touch unrelated files or formatting.

### Scoring Rubric (Per Model, 0–100 Total)
- **Correctness & Test Pass Rate (30 pts)**
- **Tool-Call & File-Edit Reliability (20 pts)**
- **Instruction Adherence / Zero Unrelated Diffs (15 pts)**
- **Structured JSON / Zod Pass Rate (15 pts)**
- **Latency & Rate-Limit / 429 Resilience (10 pts)**
- **Token Efficiency (10 pts)**

### Rate-Limit Fallback Playbook
1. Check remaining daily quota via `GET https://openrouter.ai/api/v1/key` (`free_model_daily_requests`).
2. If an upstream provider throws `429` twice, switch OpenCode `/models` from Primary -> Secondary pinned model (never `openrouter/free` for financial/RLS code).
3. If your daily RPD cap is exhausted, pause OpenCode implementation and use Antigravity for architecture review, documentation, or test-plan design until 00:00 UTC reset `[Recommendation]`.
