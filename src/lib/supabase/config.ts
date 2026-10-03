/** Public Supabase defaults (safe in the browser: read-only by RLS). Env vars override them. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zuqwmvshkhniqebtxlks.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_l4RMBQjRzPpd8mfEF2AMaQ_m9M5Y0-o";
