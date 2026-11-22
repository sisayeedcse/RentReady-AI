/**
 * Banglalink AppLink SMS MT client & strict response parser.
 * Follows official hSenidMobileCPaaS/Applink-as-a-Skill rules:
 * - Hardcoded allowlist endpoint: https://api.applink.com.bd/sms/send
 * - POST Content-Type: application/json;charset=utf-8
 * - Credentials in JSON body; NEVER log password
 * - CRITICAL: AppLink often returns HTTP 200 OK for logical failures (E1303, E1313, etc.).
 *   Success is ONLY body.statusCode === "S1000".
 */

export const APPLINK_SMS_SEND_URL = "https://api.applink.com.bd/sms/send" as const;

export interface ApplinkSmsRequest {
  message: string;
  destinationAddresses: string[];
  deliveryStatusRequest?: "0" | "1";
}

export interface ApplinkParsedResult {
  ok: boolean;
  httpStatus: number;
  statusCode: string;
  statusDetail: string;
  requestId: string | null;
  errorCategory:
    | "none"
    | "ip_not_provisioned"
    | "auth_failed"
    | "provider_rejected"
    | "network_or_parse_error";
}

export function parseApplinkResponse(httpStatus: number, rawBody: unknown): ApplinkParsedResult {
  const body = (typeof rawBody === "object" && rawBody !== null ? rawBody : {}) as Record<
    string,
    unknown
  >;

  const statusCode = typeof body.statusCode === "string" ? body.statusCode : "UNKNOWN";
  const statusDetail =
    typeof body.statusDetail === "string"
      ? body.statusDetail
      : `Unexpected AppLink response (HTTP ${httpStatus})`;
  const requestId = typeof body.requestId === "string" ? body.requestId : null;

  if (statusCode === "S1000") {
    return {
      ok: true,
      httpStatus,
      statusCode,
      statusDetail,
      requestId,
      errorCategory: "none"
    };
  }

  if (statusCode === "E1303") {
    return {
      ok: false,
      httpStatus,
      statusCode,
      statusDetail,
      requestId,
      errorCategory: "ip_not_provisioned"
    };
  }

  if (statusCode === "E1313") {
    return {
      ok: false,
      httpStatus,
      statusCode,
      statusDetail,
      requestId,
      errorCategory: "auth_failed"
    };
  }

  return {
    ok: false,
    httpStatus,
    statusCode,
    statusDetail,
    requestId,
    errorCategory: statusCode === "UNKNOWN" ? "network_or_parse_error" : "provider_rejected"
  };
}

export async function sendApplinkSms(params: {
  applicationId: string;
  password: string;
  payload: ApplinkSmsRequest;
  fetchImpl?: typeof fetch;
}): Promise<ApplinkParsedResult> {
  const { applicationId, password, payload, fetchImpl = fetch } = params;

  const requestBody = {
    version: "1.0",
    applicationId,
    password,
    message: payload.message,
    destinationAddresses: payload.destinationAddresses,
    deliveryStatusRequest: payload.deliveryStatusRequest ?? "1"
  };

  try {
    const response = await fetchImpl(APPLINK_SMS_SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8"
      },
      body: JSON.stringify(requestBody)
    });

    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      return {
        ok: false,
        httpStatus: response.status,
        statusCode: "PARSE_ERROR",
        statusDetail: `Non-JSON response from AppLink (HTTP ${response.status})`,
        requestId: null,
        errorCategory: "network_or_parse_error"
      };
    }

    return parseApplinkResponse(response.status, json);
  } catch (err) {
    return {
      ok: false,
      httpStatus: 0,
      statusCode: "NETWORK_ERROR",
      statusDetail: err instanceof Error ? err.message : "Network error contacting AppLink",
      requestId: null,
      errorCategory: "network_or_parse_error"
    };
  }
}
