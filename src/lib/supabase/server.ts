import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

// Next's fetch data cache would otherwise replay graph reads from an earlier build forever. Revalidate on the same
// 5-minute TTL as the loader cache (no-store would make every prerender throw "dynamic server usage").
const noStore: typeof fetch = (input, init) => fetch(input, { ...init, next: { revalidate: 300 } } as RequestInit);

/** Read-only client with the public key. The graph is public-read by RLS. */
export function publicClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { fetch: noStore } });
}

/** Service-role client. Server only, optional (writes prefer security-definer RPCs callable with the public key). */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}
