# RentReady AI — Local Setup & Production Deployment Guide

This guide covers:
1. **Running 100% locally on Windows** (before deploying anything to the cloud).
2. **Deploying securely to production** on **Supabase + Cloudflare Workers Static Assets + DigitalOcean Static-IPv4 Relay (behind Caddy HTTPS) + Banglalink AppLink**.

---

## Part A: Run Locally on Windows First (5 Minutes)

### 1. Supabase Database Setup
1. Create a project at `https://supabase.com/dashboard` (Region: Singapore `ap-southeast-1`).
2. Open **SQL Editor** and run all 4 migrations in exact sequential order:
   - `supabase/migrations/20261122000001_initial_schema.sql`
   - `supabase/migrations/20261122000002_views_and_rpcs.sql`
   - `supabase/migrations/20261122000003_rls_policies.sql`
   - `supabase/migrations/20261124000004_security_hardening.sql`
3. Under **Authentication → Providers → Email**:
   - Keep **"Confirm email" ENABLED** in production. (You may temporarily disable it only in a dedicated local/staging test project.)
   - Set **Minimum password length** to **8** under **Authentication → Providers → Email / Password Settings**.
   - Configure **Site URL** and **Redirect URLs** to your deployed `https://...` origin so password reset links work securely.
4. Copy **Project URL** and **anon public key** from **Project Settings → API**. Never use `service_role` in user-facing routes.

### 2. Generate a Strong 32-Byte Shared Relay Secret (PowerShell)
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
   GEMINI_API_KEY=AIzaSy...
   GEMINI_MODEL=gemini-3.5-flash-lite
   APPLINK_RELAY_URL=http://127.0.0.1:8788
   RELAY_SHARED_SECRET=<your-64-char-hex-secret>
   ALLOWED_ORIGINS=http://localhost:5173
   ```
3. **`services/applink-relay/.env`** (copy from `services/applink-relay/.env.example`):
   ```env
   PORT=8788
   RELAY_HOST=0.0.0.0
   RELAY_SHARED_SECRET=<same-64-char-hex-secret>
   APPLINK_APPLICATION_ID=APP_XXXXXX
   APPLINK_PASSWORD=your-applink-password
   ```

### 4. Start All 3 Local Services (3 PowerShell Terminals)
From `d:\Softwares\AppQuest\RentReady AI`:
- **Terminal 1 (Local AppLink Relay — port 8788):** `pnpm dev:relay`
- **Terminal 2 (Cloudflare Worker API — port 8787):** `pnpm dev:api`
- **Terminal 3 (React Bangla/English SPA — port 5173):** `pnpm dev:web`

Open **`http://localhost:5173`**.

*(Note: When running the relay locally, live AppLink calls only succeed if your current public IPv4 is whitelisted in AppLink — otherwise AppLink returns `E1303`, which RentReady AI catches and logs in `notification_logs`. For live SMS, deploy the hardened HTTPS relay in Part B.)*

---

## Part B: Hardened Production Deployment (HTTPS Relay + Cloudflare Workers)

### 1. Provision a Static-IPv4 Ubuntu VPS (DigitalOcean Basic $4/mo, SGP1)
1. Create an Ubuntu 24.04 LTS Droplet in **Singapore (`SGP1`)** with SSH key authentication (disable root password login).
2. Copy the Droplet's **Public Static IPv4** and **whitelist that exact IPv4** in `user.applink.com.bd`.
3. Point a DNS `A` record (e.g. `relay.yourdomain.com`) to the Droplet's Static IPv4 so Caddy can issue a free Let's Encrypt TLS certificate.
4. SSH into the Droplet, lock the firewall to SSH + HTTPS/HTTP-ACME ONLY (never expose port 8788 publicly!), and run the Dockerized non-root relay behind Caddy:
   ```bash
   ssh root@<YOUR_DROPLET_IPV4>
   apt update && apt install -y docker.io git ufw caddy
   ufw default deny incoming
   ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

   git clone <YOUR_GITHUB_REPO_URL> rentready-ai
   cd rentready-ai
   cp services/applink-relay/.env.example services/applink-relay/.env
   chmod 600 services/applink-relay/.env
   nano services/applink-relay/.env
   # Fill in strong 64-char hex RELAY_SHARED_SECRET, APPLINK_APPLICATION_ID, APPLINK_PASSWORD

   docker build -f services/applink-relay/Dockerfile -t rentready-relay .
   docker run -d --name rentready-relay --restart unless-stopped \
     --env-file services/applink-relay/.env \
     -p 127.0.0.1:8788:8788 rentready-relay
   curl http://127.0.0.1:8788/health
   ```
5. Configure `/etc/caddy/Caddyfile` for automatic HTTPS termination:
   ```caddy
   relay.yourdomain.com {
       reverse_proxy 127.0.0.1:8788
   }
   ```
   Then reload Caddy: `systemctl reload caddy` and verify `curl https://relay.yourdomain.com/health`.

*(Security Enforcement: `apps/api` rejects non-HTTPS remote relay URLs by default (`INSECURE_RELAY_URL`) so SMS payloads and phone numbers are always encrypted in transit.)*

### 2. Deploy Cloudflare Worker (Static Assets + Hono API)
```powershell
pnpm build
cd apps/api
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put APPLINK_RELAY_URL        # https://relay.yourdomain.com
npx wrangler secret put RELAY_SHARED_SECRET
npx wrangler deploy
```

### 3. Post-Deploy Production Hardening Checklist
- Configure Cloudflare Dashboard **Security → WAF → Rate limiting rules** on `/api/voice/*` and `/api/notifications/send` for global multi-POP enforcement beyond per-isolate Worker limits.
- Enable **Always Use HTTPS** and **Automatic HTTPS Rewrites** in Cloudflare SSL/TLS settings.
- Confirm `apps/web/public/_headers` security headers (`CSP`, `HSTS`, `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`) are present on the deployed origin.
- Complete the operator support email / entity details inside `apps/web/src/features/legal/LegalPages.tsx` before onboarding external commercial users.
- See [`docs/SECURITY_OPERATIONS.md`](./SECURITY_OPERATIONS.md) for incident response, monitoring, and backup drills.
