const SUPABASE_URL = "https://reakcivpsxwntgquxkkm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_JxsLFvg0rdiPEk7EgwbHGA_xAE2WmOC";

window.nscSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
