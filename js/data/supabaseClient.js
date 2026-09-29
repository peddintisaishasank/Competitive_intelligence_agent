/**
 * supabaseClient.js
 * ─────────────────────────────────────────────────────────────────
 * Creates and exports the Supabase JS client.
 * Uses the official @supabase/supabase-js CDN build (no bundler needed).
 *
 * Loaded via the ESM CDN import below — no npm install required.
 * ─────────────────────────────────────────────────────────────────
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase.config.js";

// Import Supabase client from the official ESM CDN (works without a bundler)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/**
 * The shared Supabase client instance.
 * Exported and re-used across all data-access functions.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Checks if an authenticated user session exists.
 * Returns { ok: true, session, user } if logged in, or { ok: false, session: null } if unauthenticated.
 */
export async function ensureAuthenticatedSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return { ok: true, session, user: session.user };
    }
    return { ok: false, session: null, user: null };
  } catch (err) {
    console.error("[supabase] Error checking session:", err);
    return { ok: false, error: err.message };
  }
}

/**
 * Returns current authenticated user, or null if unauthenticated.
 */
export async function getAuthenticatedUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

/**
 * isConfigured()
 * Returns true if the config values look like real credentials.
 * Used by db.js to decide whether to hit Supabase or fall back to mock data.
 */
export function isConfigured() {
  return (
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("YOUR_PROJECT_ID") &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes("YOUR_ANON_KEY")
  );
}

