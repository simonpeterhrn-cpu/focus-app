import { createClient } from "@supabase/supabase-js";

// These come from your .env file (see .env.example).
// In Vite, env vars exposed to the browser MUST be prefixed with VITE_.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseReady = Boolean(supabaseUrl && supabaseAnonKey);

// If keys aren't set yet, we export null so the app can fall back to
// sample data and still run. Wire up .env, then real data flows in.
export const supabase = supabaseReady
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
