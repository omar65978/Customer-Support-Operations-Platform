// Supabase connection settings. Both apps talk to Supabase directly:
//   REST    /rest/v1     (tables, protected by Row Level Security)
//   Auth    /auth/v1     (sign in, sign up, sign out, session)
//   Storage /storage/v1  (private "attachments" bucket)
// Values come from .env.local (see .env.example). The anon key is public by design;
// it never grants access on its own, because Row Level Security applies to every request.

const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

export const SUPABASE_URL = rawUrl.replace(/\/+$/, "");
export const SUPABASE_ANON_KEY = anonKey;
export const SUPABASE_CONFIGURED = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";

export const REST_URL = `${SUPABASE_URL}/rest/v1`;
export const AUTH_URL = `${SUPABASE_URL}/auth/v1`;
export const STORAGE_URL = `${SUPABASE_URL}/storage/v1`;

export const CONFIG_HELP =
  "Supabase is not configured. Copy customer-portal/.env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.";
