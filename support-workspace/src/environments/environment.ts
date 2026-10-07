declare global {
  interface Window {
    __SUPPORT_WORKSPACE_CONFIG__?: {
      supabaseUrl?: string;
      supabaseAnonKey?: string;
    };
  }
}

const runtimeConfig = typeof window === 'undefined' ? undefined : window.__SUPPORT_WORKSPACE_CONFIG__;
const supabaseUrl = runtimeConfig?.supabaseUrl?.trim().replace(/\/+$/, '') ?? '';
const supabaseAnonKey = runtimeConfig?.supabaseAnonKey?.trim() ?? '';

export const environment = {
  production: false,
  supabaseUrl,
  apiUrl: `${supabaseUrl}/rest/v1`,
  supabaseAnonKey,
  isSupabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
};
