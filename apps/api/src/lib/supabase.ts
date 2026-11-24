import { getDhakaBillingMonthString, getDhakaDateString } from "@rentready/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Context, Next } from "hono";
import type { EnvBindings } from "../app.js";
import { getClientIp, logSecurityEvent, type SecurityVariables } from "./security.js";

export interface AuthVariables extends SecurityVariables {
  userId: string;
  userEmail: string | null;
  accessToken: string;
  supabase: SupabaseClient;
}

/**
 * Creates a user-scoped Supabase client forwarding the caller's JWT.
 * PostgreSQL RLS enforces landlord_id = auth.uid() on every query.
 * NEVER uses SUPABASE_SERVICE_ROLE_KEY in user-facing routes.
 */
export function createUserSupabaseClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
  accessToken: string
): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

export async function requireAuth(
  c: Context<{ Bindings: EnvBindings; Variables: AuthVariables }>,
  next: Next
): Promise<Response | void> {
  const authHeader = c.req.header("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logSecurityEvent("warn", "auth_missing_bearer", {
      request_id: c.get("requestId"),
      path: c.req.path,
      client_ip: getClientIp(c)
    });
    return c.json({ error: "Missing or invalid Authorization Bearer token" }, 401);
  }

  const token = authHeader.slice(7).trim();
  if (!token || token.length > 4096) {
    logSecurityEvent("warn", "auth_malformed_bearer", {
      request_id: c.get("requestId"),
      path: c.req.path,
      client_ip: getClientIp(c)
    });
    return c.json({ error: "Empty or malformed Bearer token" }, 401);
  }

  const supabaseUrl = c.env?.SUPABASE_URL;
  const supabaseAnonKey = c.env?.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    logSecurityEvent("error", "server_supabase_unconfigured", {
      request_id: c.get("requestId")
    });
    return c.json({ error: "Server authentication service is not configured" }, 503);
  }

  const supabase = createUserSupabaseClient(supabaseUrl, supabaseAnonKey, token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    logSecurityEvent("warn", "auth_invalid_session", {
      request_id: c.get("requestId"),
      path: c.req.path,
      client_ip: getClientIp(c)
    });
    return c.json({ error: "Invalid or expired session token" }, 401);
  }

  c.set("userId", data.user.id);
  c.set("userEmail", data.user.email ?? null);
  c.set("accessToken", token);
  c.set("supabase", supabase);

  await next();
}

export function getCurrentDhakaBillingMonth(now: Date = new Date()): string {
  return getDhakaBillingMonthString(now);
}

export function getCurrentDhakaDate(now: Date = new Date()): string {
  return getDhakaDateString(now);
}
