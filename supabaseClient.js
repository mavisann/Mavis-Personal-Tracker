(function () {
  "use strict";

  // Ensure the global Supabase object from the CDN is available.
  if (!window.supabase || !window.supabase.createClient) {
    console.error("Supabase client library not found. Make sure the CDN script is included in index.html.");
    window.MAVIS_SUPABASE = null;
    return;
  }

  var config = window.MAVIS_SUPABASE_CONFIG || {};
  var url = (config.url || "https://dpfkybonkhgdxfzvcioc.supabase.co").trim();
  var anonKey = (config.anonKey || "sb_publishable_eLdMrUpAQfjkWfEX1ma1Tw_KKgqhRad").trim();

  // Initialize to null. The app will handle this state.
  window.MAVIS_SUPABASE = null;

  if (!url || !anonKey || !window.supabase || !window.supabase.createClient) {
    console.warn("Supabase is not configured. Set window.MAVIS_SUPABASE_CONFIG in index.html.");
    return;
  }

  // Create the client and attach it to the window for the main app to use.
  window.MAVIS_SUPABASE = window.supabase.createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
})();
