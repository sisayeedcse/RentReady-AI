# RentReady AI — Local Setup & Production Deployment Guide (AppQuest 2.0)

This guide covers:
1. **Running 100% locally on Windows** (before deploying anything to the cloud).
2. **Deploying live** on **Supabase Free + Cloudflare Workers Static Assets + DigitalOcean Basic Droplet ($4/mo Static-IPv4 Relay) + Banglalink AppLink**.

---

## Part A: Run Locally on Windows First (5 Minutes)

### 1. Supabase Database Setup (Free)
1. Create a free project at `https://supabase.com/dashboard` (Region: Singapore `ap-southeast-1`).
2. Open **SQL Editor** and run these 3 files in exact order:
   - `supabase/migrations/20261122000001_initial_schema.sql`
   - `supabase/migrations/20261122000002_views_and_rpcs.sql`
   - `supabase/migrations/20261122000003_rls_policies.sql`
3. Under **Authentication → Providers → Email**, optionally disable **"Confirm email"** during local hackathon testing so signups log in immediately.
4. Copy **Project URL** and **anon public key** from **Project Settings → API**.

### 2. Generate a Shared Relay Secret (PowerShell)
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Create the 3 Local Gitignored Env Files
1. **`apps/web/.env.local`** (copy from `apps/web/.env.example`):
   ```env
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
2. **`apps/api/.dev.vars`** (copy from `apps/api/.dev.vars.example`):
   ```env
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   OPENROUTER_API_KEY=sk-or-v1-...
   OPENROUTER_INTENT_MODEL=google/gemma-4-26b-a4b-it:free
   GROQ_API_KEY=gsk_...
   APPLINK_RELAY_URL=http://127.0.0.1:8788
   RELAY_SHARED_SECRET=<your-64-char-hex-secret>
   ```
3. **`services/applink-relay/.env`** (copy from `services/applink-relay/.env.example`):
   ```env
   PORT=8788
   RELAY_SHARED_SECRET=<same-64-char-hex-secret>
   APPLINK_APPLICATION_ID=APP_XXXXXX
   APPLINK_PASSWORD=your-applink-password
   ```

### 4. Start All 3 Local Services (3 PowerShell Terminals)
From `d:\Softwares\AppQuest\RentReady AI`:
- **Terminal 1 (Local AppLink Relay — port 8788):**
  ```powershell
  pnpm dev:relay
  ```
- **Terminal 2 (Cloudflare Worker API — port 8787):**
  ```powershell
  pnpm dev:api
  ```
- **Terminal 3 (React Bangla/English SPA — port 5173):**
  ```powershell
  pnpm dev:web
  ```
Open **`http://localhost:5173`** in Chrome/Edge!

*(Note: When running the relay locally on your PC, live AppLink calls will only succeed if your current public IPv4 is whitelisted in AppLink — otherwise AppLink returns `E1303`, which RentReady AI safely catches and logs in `notification_logs`. For reliable live SMS with a permanent IPv4, deploy the relay to DigitalOcean in Part B.)*

---

## Part B: Production Deployment (DigitalOcean $4/mo Static-IP Relay + Cloudflare Workers)

### 1. Provision a DigitalOcean Basic Droplet ($4/mo, ~500 BDT/mo)
*(Alternatively, any $4–$5/mo static-IPv4 Ubuntu VPS such as Hetzner Cloud or AWS Lightsail works identically.)*
1. Create an account at `https://cloud.digitalocean.com` → **Create → Droplets**.
2. Region: **Singapore (`SGP1`)** | Image: **Ubuntu 24.04 LTS** | Plan: **Basic → Regular → $4/mo** (512 MB RAM / 1 vCPU — plenty for our lightweight Hono relay).
3. Copy the Droplet's **Public Static IPv4** (e.g. `159.x.x.x`).
4. **Whitelist that exact IPv4** in your Banglalink AppLink app settings (`user.applink.com.bd`) and confirm **Email 2 (App Approval)** to `support@applink.com.bd` is approved.
5. SSH into the Droplet and start the Dockerized relay:
   ```bash
   ssh root@<YOUR_DROPLET_IPV4>
   apt update && apt install -y docker.io git ufw
   ufw allow 22/tcp && ufw allow 8788/tcp && ufw --force enable

   git clone <YOUR_GITHUB_REPO_URL> rentready-ai
   cd rentready-ai
   cp services/applink-relay/.env.example services/applink-relay/.env
   nano services/applink-relay/.env
   # Fill in RELAY_SHARED_SECRET, APPLINK_APPLICATION_ID, APPLINK_PASSWORD

   docker build -f services/applink-relay/Dockerfile -t rentready-relay .
   docker run -d --name rentready-relay --restart unless-stopped \
     --env-file services/applink-relay/.env -p 8788:8788 rentready-relay
   curl http://127.0.0.1:8788/health
   ```

### 2. Deploy Cloudflare Worker (Static Assets + Hono API)
```powershell
pnpm build
cd apps/api
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put APPLINK_RELAY_URL        # http://<YOUR_DROPLET_IPV4>:8788
npx wrangler secret put RELAY_SHARED_SECRET
npx wrangler deploy
```
Your live app is now running at `https://rentready-ai.<your-subdomain>.workers.dev`!
