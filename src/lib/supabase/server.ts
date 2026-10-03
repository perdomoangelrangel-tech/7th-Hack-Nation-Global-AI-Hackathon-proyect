import { createClient } from "@supabase/supabase-js";

/** Cliente de solo lectura con la clave pública. El grafo es público de lectura por RLS. */
// Public project URL + publishable key (read-only by RLS, safe to ship). Env vars override them.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zuqwmvshkhniqebtxlks.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_l4RMBQjRzPpd8mfEF2AMaQ_m9M5Y0-o";

export function publicClient() {
  const url = SUPABASE_URL;
  const key = SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Cliente con service role. Solo en el servidor y solo para escribir (conversaciones, citas). */
export function adminClient() {
  const url = SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
