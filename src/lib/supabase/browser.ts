"use client";
import { createBrowserClient } from "@supabase/ssr";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zuqwmvshkhniqebtxlks.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_l4RMBQjRzPpd8mfEF2AMaQ_m9M5Y0-o";

export function browserClient() {
  return createBrowserClient(URL, KEY);
}
