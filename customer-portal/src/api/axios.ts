import axios, { type AxiosError } from "axios";
import { REST_URL, SUPABASE_ANON_KEY } from "../config/supabase";

export const SESSION_TOKEN_KEY = "token";
export const SESSION_USER_KEY = "user";

export function getAccessToken(): string | null {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  return token && token.trim() !== "" ? token : null;
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(SESSION_USER_KEY);
}

/** Headers for Supabase calls made as a user (or as anon when no session exists). */
export function authHeaders(token?: string | null): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token ?? getAccessToken() ?? SUPABASE_ANON_KEY}`,
  };
}

// Used for REST and Storage calls. Absolute URLs (Storage) bypass baseURL.
const apiClient = axios.create({
  baseURL: REST_URL,
  headers: {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
  },
});

apiClient.interceptors.request.use((config) => {
  config.headers.apikey = SUPABASE_ANON_KEY;
  config.headers.Authorization = `Bearer ${getAccessToken() ?? SUPABASE_ANON_KEY}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // 401 with a stored session means the session expired: sign out and ask for a new sign-in.
    // 403 and 4xx are permission or validation results and must not sign the user out.
    if (error.response?.status === 401 && getAccessToken()) {
      clearSession();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login?reason=expired");
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
