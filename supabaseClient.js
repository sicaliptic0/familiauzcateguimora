// Supabase client (public/anon)
// This key is safe to use in the browser when RLS is enabled.
const SUPABASE_URL = "https://rbmepxgqzcdlrmaiyvyy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_kNQ1h9gKz4ZvFQ6wJldizg_Eefd51mV";

function getSupabase() {
  if (!window.supabase) return null;
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Expose for non-module scripts (app.js)
window.getSupabase = getSupabase;

