import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Context, Next } from "hono";
import type { EnvBindings } from "../app.js";

export interface AuthVariables {
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
    return c.json({ error: "Missing or invalid Authorization Bearer token" }, 401);
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return c.json({ error: "Empty Bearer token" }, 401);
  }

  const supabaseUrl = c.env?.SUPABASE_URL;
  const supabaseAnonKey = c.env?.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return c.json({ error: "Server Supabase configuration is missing" }, 503);
  }

  const supabase = createUserSupabaseClient(supabaseUrl, supabaseAnonKey, token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return c.json({ error: "Invalid or expired session token" }, 401);
  }

  c.set("userId", data.user.id);
  c.set("userEmail", data.user.email ?? null);
  c.set("accessToken", token);
  c.set("supabase", supabase);

  await next();
}

export function getCurrentDhakaBillingMonth(now: Date = new Date()): string {
  // Asia/Dhaka is UTC+06:00 (no DST)
  const dhakaMs = now.getTime() + 6 * 60 * 60 * 1000;
  const d = new Date(dhakaMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function getCurrentDhakaDate(now: Date = new Date()): string {
  const dhakaMs = now.getTime() + 6 * 60 * 60 * 1000;
  const d = new Date(dhakaMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
