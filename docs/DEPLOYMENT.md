# RentReady AI — Zero-Cost Deployment Runbook (AppQuest 2.0)

Follow these exact steps to go live on **Supabase Free + Cloudflare Workers Static Assets + Oracle Cloud Always Free Static-IP Relay + Banglalink AppLink**.

---

## Step 1: Supabase Database Setup (5 minutes)
1. Create a free project at `https://supabase.com/dashboard`.
2. Open **SQL Editor** and run these 3 migrations in exact order:
   - `supabase/migrations/20261122000001_initial_schema.sql`
   - `supabase/migrations/20261122000002_views_and_rpcs.sql`
   - `supabase/migrations/20261122000003_rls_policies.sql`
3. Copy your **Project URL** and **Anon Key** from **Project Settings → API**.

---

## Step 2: Oracle Cloud Always Free VM (Fixed-IP AppLink Relay)
1. Create an **Always Free Ubuntu VM** on Oracle Cloud (`cloud.oracle.com`) and note its **Public Static IPv4**.
2. Open TCP port `8788` (or `443` with Caddy TLS) in the OCI Security List + Ubuntu firewall (`sudo ufw allow 8788/tcp`).
3. **Whitelist that exact Public Static IPv4** in your Banglalink AppLink app settings (`user.applink.com.bd`) and ensure **Email 2 (App Approval)** to `support@applink.com.bd` is approved.
4. On the OCI VM, clone the repo and start the relay:
   ```bash
   cp services/applink-relay/.env.example services/applink-relay/.env
   # Edit .env with your REAL APPLINK_APPLICATION_ID, APPLINK_PASSWORD, and a 32-char RELAY_SHARED_SECRET
   docker build -f services/applink-relay/Dockerfile -t rentready-relay .
   docker run -d --name rentready-relay --restart unless-stopped --env-file services/applink-relay/.env -p 8788:8788 rentready-relay
   curl http://127.0.0.1:8788/health
   ```

---

## Step 3: Build Web SPA & Deploy Cloudflare Worker (Static Assets + Hono API)
1. Create `apps/web/.env.local` from `apps/web/.env.example` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Build the production SPA:
   ```bash
   pnpm build
   ```
3. Log in to Cloudflare and set Worker secrets (NEVER commit secrets):
   ```bash
   cd apps/api
   npx wrangler login
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_ANON_KEY
   npx wrangler secret put GROQ_API_KEY
   npx wrangler secret put OPENROUTER_API_KEY
   npx wrangler secret put APPLINK_RELAY_URL
   npx wrangler secret put RELAY_SHARED_SECRET
   npx wrangler deploy
   ```
4. Your live URL (`https://rentready-ai.<your-subdomain>.workers.dev`) serves both the Bangla/English SPA and `/api/*` under a single origin!

---

## Step 4: Verify Live End-to-End Before Recording Your 2-Minute Demo Video
1. Sign up as a test landlord → Add Property ("Shanti Nibash") → Add Unit `3B` (`12,000 BDT`) → Add Test Tenant (`Rahim Uddin`, your Banglalink test number `+88019...`) → Assign Tenancy → Click **Generate Monthly Bills**.
2. Open **Bangla Voice AI** → Speak or type: *"Flat 3B er Rahim bhai 8000 taka bKash korse"* → Verify Confirmation Card shows `৳8,000` (`৳4,000` remaining) → Click **Confirm & Execute**.
3. Open **Ledger & Expenses** → Click the **Send SMS Receipt** button → Click **Confirm & Execute** → Verify **AppLink SMS & Audit** tab logs `statusCode: S1000` + `requestId` and your Banglalink handset receives the real SMS!
