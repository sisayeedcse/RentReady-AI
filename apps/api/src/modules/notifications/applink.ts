import { formatBdt, toApplinkAddress } from "@rentready/shared";
import { signRelayPayloadWebCrypto } from "../../lib/hmac.js";

const RELAY_TIMEOUT_MS = 15_000;

export interface ApplinkRelayResult {
  ok: boolean;
  httpStatus: number;
  statusCode: string;
  statusDetail: string;
  requestId: string | null;
  errorCategory: string;
}

export function isAllowedRelayUrl(relayUrl: string, allowInsecureLocal = true): boolean {
  try {
    const parsed = new URL(relayUrl);
    if (parsed.protocol === "https:") return true;
    if (
      allowInsecureLocal &&
      parsed.protocol === "http:" &&
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function buildPaymentReceiptSms(params: {
  tenantName: string;
  unitCode: string;
  paidPaisa: number;
  remainingPaisa: number;
  billingMonth: string;
  language: "bn" | "en";
}): string {
  const paidStr = formatBdt(params.paidPaisa, params.language);
  const remStr = formatBdt(Math.max(0, params.remainingPaisa), params.language);
  if (params.language === "bn") {
    return `RentReady: ${params.tenantName} (ফ্ল্যাট ${params.unitCode}), ${params.billingMonth} এর ভাড়া বাবদ ${paidStr} গৃহীত হয়েছে। বকেয়া: ${remStr}। ধন্যবাদ।`;
  }
  return `RentReady: Payment of ${paidStr} received from ${params.tenantName} (Unit ${params.unitCode}) for ${params.billingMonth}. Remaining due: ${remStr}. Thank you.`;
}

export function buildRentReminderSms(params: {
  tenantName: string;
  unitCode: string;
  outstandingPaisa: number;
  billingMonth: string;
  language: "bn" | "en";
}): string {
  const dueStr = formatBdt(params.outstandingPaisa, params.language);
  if (params.language === "bn") {
    return `RentReady রিমাইন্ডার: প্রিয় ${params.tenantName} (ফ্ল্যাট ${params.unitCode}), ${params.billingMonth} এর বকেয়া ভাড়া ${dueStr}। অনুগ্রহ করে দ্রুত পরিশোধ করুন। ধন্যবাদ।`;
  }
  return `RentReady Reminder: Dear ${params.tenantName} (Unit ${params.unitCode}), your outstanding rent for ${params.billingMonth} is ${dueStr}. Please settle at your earliest convenience.`;
}

export async function dispatchApplinkSmsViaRelay(params: {
  relayUrl: string;
  sharedSecret: string;
  phoneE164: string;
  message: string;
  allowInsecureHttpRelay?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<ApplinkRelayResult> {
  const {
    relayUrl,
    sharedSecret,
    phoneE164,
    message,
    allowInsecureHttpRelay = false,
    fetchImpl = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args)
  } = params;

  if (!allowInsecureHttpRelay && !isAllowedRelayUrl(relayUrl, true)) {
    return {
      ok: false,
      httpStatus: 0,
      statusCode: "INSECURE_RELAY_URL",
      statusDetail: "Relay URL must use HTTPS in production (HTTP is only allowed for localhost)",
      requestId: null,
      errorCategory: "network_or_parse_error"
    };
  }

  const endpoint = `${relayUrl.replace(/\/+$/, "")}/relay/applink/sms/send`;
  const rawBody = JSON.stringify({
    message,
    destinationAddresses: [toApplinkAddress(phoneE164)],
    deliveryStatusRequest: "1"
  });

  const timestampSec = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const signature = await signRelayPayloadWebCrypto(sharedSecret, timestampSec, rawBody, nonce);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);

  try {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-relay-timestamp": timestampSec,
        "x-relay-nonce": nonce,
        "x-relay-signature": signature
      },
      body: rawBody,
      signal: controller.signal
    });

    const data = (await res.json().catch(() => null)) as Partial<ApplinkRelayResult> | null;
    if (!data) {
      return {
        ok: false,
        httpStatus: res.status,
        statusCode: "RELAY_PARSE_ERROR",
        statusDetail: `Relay returned non-JSON response (HTTP ${res.status})`,
        requestId: null,
        errorCategory: "network_or_parse_error"
      };
    }

    return {
      ok: data.ok === true && data.statusCode === "S1000",
      httpStatus: data.httpStatus ?? res.status,
      statusCode: data.statusCode ?? "UNKNOWN",
      statusDetail: String(data.statusDetail ?? "Unknown relay response").slice(0, 200),
      requestId: data.requestId ?? null,
      errorCategory: data.errorCategory ?? "unknown"
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      httpStatus: 0,
      statusCode: isAbort ? "RELAY_TIMEOUT" : "RELAY_UNREACHABLE",
      statusDetail: isAbort ? "AppLink relay timed out" : "Unable to contact AppLink relay",
      requestId: null,
      errorCategory: "network_or_parse_error"
    };
  } finally {
    clearTimeout(timeout);
  }
}
