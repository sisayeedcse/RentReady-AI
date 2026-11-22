# 11 — Banglalink AppLink Integration & Fixed-IP Blocker Analysis

**Last Updated:** 2026-11-22  
**Epistemic Legend:** `[Official requirement]` | `[Verified technical fact]` | `[Recommendation]` | `[Assumption]` | `[Unknown]` | `[Unverified]`

---

## 1. Verified AppLink API Specifications

All facts below are verified from `https://dev.applink.com.bd/docs`, `/docs/quickstart`, `/docs/authentication`, and `https://github.com/hSenidMobileCPaaS/Applink-as-a-Skill` (accessed 2026-11-22):

- **Protocol:** HTTP `POST`, `Content-Type: application/json;charset=utf-8` `[Verified technical fact]`.
- **Authentication:** Credentials (`applicationId` and `password`) are passed in the **JSON request body** (not HTTP Authorization headers). Never expose them in browser or mobile clients `[Verified technical fact]`.
- **SMS MT Endpoint:** `https://api.applink.com.bd/sms/send` `[Verified technical fact]`.
- **OTP Endpoints (Release B):** `https://api.applink.com.bd/otp/request` and `https://api.applink.com.bd/otp/verify` `[Verified technical fact]`.
- **Verified SMS Request Shape:**
  ```json
  {
    "version": "1.0",
    "applicationId": "APP_999999",
    "password": "REDACTED_SERVER_SECRET",
    "message": "RentReady: Payment of BDT 12,000 received for Unit 3B (Nov 2026). Balance: BDT 0.",
    "destinationAddresses": ["tel:+88019XXXXXXXX"],
    "deliveryStatusRequest": "1"
  }
  ```
- **Critical Response Quirk:** AppLink frequently returns **HTTP `200 OK`** even when a logical error occurs. You **must** parse the JSON body and verify `statusCode === "S1000"` (`requestId` returned) `[Verified technical fact — source: hSenidMobileCPaaS/Applink-as-a-Skill, accessed 2026-11-22]`.
- **Key Error Codes:**
  - `S1000`: Success `[Verified technical fact]`.
  - `E1313`: Authentication failed (invalid `applicationId`, inactive app, or wrong `password`) `[Verified technical fact]`.
  - `E1303`: **IP address not provisioned** — *"IP address from which this request originated is not provisioned to send requests to application `<application-id>`"* `[Verified technical fact]`.
- **Developer Cost & Subscriber Scope:**
  - Developer sign-up, provisioning, and API access are **free ($0)** `[Verified technical fact]`.
  - **Operator Constraint:** AppLink APIs natively serve **Banglalink subscribers only** (`+88019...`, `+88014...` prefixes, though MNP can move numbers across operators). They do **not** send SMS to Grameenphone, Robi, Airtel, or Teletalk subscribers `[Verified technical fact]`.

---

## 2. CRITICAL BLOCKER: Cloudflare Workers vs. AppLink Static IP Requirement

### The Blocker
- **AppLink requires every API request to originate from an explicitly provisioned static IPv4 address** (otherwise returning `E1303`) `[Verified technical fact]`.
- **Cloudflare Workers run on a global Anycast network with dynamically rotating outbound IPs.** Neither Cloudflare Workers Free ($0) nor Workers Paid ($5/mo) provides a static egress IP address; dedicated egress IPs require Cloudflare Enterprise contracts (thousands of USD/month) `[Verified technical fact — accessed 2026-11-22]`.
- **Conclusion:** **A direct Cloudflare-Worker-to-AppLink integration WILL FAIL with `E1303`.** Do not attempt live integration directly from a Cloudflare Worker `[Recommendation]`.

### Evaluated Solutions

| Option | Architecture | Monthly Cost (USD / BDT) | Reliability | Verdict |
| :--- | :--- | :---: | :---: | :--- |
| **1. Direct Cloudflare Worker** | Worker -> AppLink | $0 / 0 BDT | Fails (`E1303`) | **REJECTED** `[Verified technical fact]` |
| **2. Cloudflare Worker -> Oracle Cloud Always Free VM Relay** | Worker -> HMAC-authenticated Node/Hono relay on OCI Always Free VM (Static IPv4) -> AppLink | **$0 / 0 BDT** *(if OCI signup succeeds)* | High once provisioned, but OCI fraud checks frequently reject cards | **Try First if you already have OCI; otherwise skip** `[Recommendation]` |
| **3. Cloudflare Worker -> Small Static-IP VPS Relay (Recommended)** | Worker -> HMAC-authenticated minimal relay on DigitalOcean Basic Droplet ($4/mo) or Hetzner (~$3.80–$4.50/mo) -> AppLink | **$4.00–$4.50 USD (~500–560 BDT/mo)** | **Very High** — 1 dedicated IPv4 whitelisted in AppLink portal | **RECOMMENDED MINIMUM VIABLE PAID COMPONENT** `[Recommendation]` |
| **4. Third-Party Static Egress Proxy (e.g., Fixie / QuotaGuard)** | Worker -> HTTP Proxy -> AppLink | Free trial / ~$19–$29/mo paid | High | More expensive than a $4 VPS `[Recommendation]` |

---

## 3. Relay Security & Reliability Design

1. **Zero Open Proxy Risk:** The relay (`services/applink-relay`) **only** forwards to hardcoded `https://api.applink.com.bd/sms/send` (and `/otp/*` in Release B) — never arbitrary URLs (prevents SSRF) `[Recommendation]`.
2. **Mutual Authentication:** Cloudflare Worker signs every relay request with `X-Relay-Signature` (HMAC-SHA256 using `RELAY_SHARED_SECRET` + timestamp window $\le 60\text{s}$ to block replay attacks) `[Recommendation]`.
3. **Secret Isolation:** `APPLINK_APP_ID` and `APPLINK_PASSWORD` live strictly as environment secrets on the relay (or Cloudflare Worker secrets injected server-side), never logged to stdout or `notification_logs` `[Recommendation]`.
4. **Idempotency:** Before calling the relay, the Worker checks `notifications(landlord_id, idempotency_key)`. If already `sent`, return the stored `provider_request_id` without resending SMS `[Recommendation]`.
5. **Graceful Operator Handling:** If a tenant's phone number is non-Banglalink or AppLink returns an operator/delivery error, record the exact `provider_status_code` in `notification_logs` and show a clear Bangla/English message in the UI (offering a 1-click "Copy Receipt Text" fallback for WhatsApp/SMS) `[Recommendation]`.

---

## 4. Using `hSenidMobileCPaaS/Applink-as-a-Skill`

- The official GitHub repo `https://github.com/hSenidMobileCPaaS/Applink-as-a-Skill` provides validated AppLink contract references and review rules `[Verified technical fact]`.
- **Recommendation:** During implementation (Milestone 5), reference its official contract rules in `AGENTS.md` so OpenCode respects `statusCode === "S1000"` parsing, `tel:+880...` formatting, and callback verification `[Recommendation]`.
