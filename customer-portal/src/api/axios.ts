import axios, { type InternalAxiosRequestConfig } from "axios";
import { supabaseConfig } from "../config/supabase";
import {
  clearAuthSession,
  refreshAuthSession,
  saveAuthSession,
} from "./auth";
import type { AuthUser } from "../types";

const apiClient = axios.create({
  baseURL: supabaseConfig.restUrl,
  headers: {
    "Content-Type": "application/json",
    apikey: supabaseConfig.anonKey,
  },
});

let refreshPromise: Promise<AuthUser> | null = null;

apiClient.interceptors.request.use((config) => {
  config.headers.set("apikey", supabaseConfig.anonKey);
  const token = localStorage.getItem("token");
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  else config.headers.delete("Authorization");
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && config && !config._retry) {
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        config._retry = true;
        refreshPromise ??= refreshAuthSession(refreshToken)
          .then((authUser) => {
            saveAuthSession(authUser);
            return authUser;
          })
          .finally(() => { refreshPromise = null; });

        try {
          const authUser = await refreshPromise;
          config.headers.set("Authorization", `Bearer ${authUser.accessToken}`);
          return apiClient(config);
        } catch {
          clearAuthSession();
          if (!window.location.pathname.includes("/login")) window.location.href = "/login";
        }
      } else if (localStorage.getItem("token")) {
        clearAuthSession();
        if (!window.location.pathname.includes("/login")) window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
