const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "") ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  authUrl: `${supabaseUrl}/auth/v1`,
  restUrl: `${supabaseUrl}/rest/v1`,
  storageUrl: `${supabaseUrl}/storage/v1`,
  isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
};

export function assertSupabaseConfigured(): void {
  if (!supabaseConfig.isConfigured) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in customer-portal/.env.");
  }
}
