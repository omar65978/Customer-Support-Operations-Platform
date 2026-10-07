import axios, { AxiosError } from "axios";
import type { AuthUser, LoginCredentials, RegisterPayload, UserRole } from "../types";
import { assertSupabaseConfigured, supabaseConfig } from "../config/supabase";

interface SupabaseAuthUser {
  id: string;
  email?: string;
}

interface SupabaseTokenResponse {
  access_token: string;
  refresh_token: string;
  user: SupabaseAuthUser;
}

interface SupabaseProfile {
  id: string;
  full_name: string;
  role: UserRole;
}

function authHeaders(accessToken?: string): Record<string, string> {
  return {
    apikey: supabaseConfig.anonKey,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function loadProfile(
  authUser: SupabaseAuthUser,
  accessToken: string,
  refreshToken: string,
): Promise<AuthUser> {
  const response = await axios.get<SupabaseProfile[]>(`${supabaseConfig.restUrl}/profiles`, {
    params: {
      id: `eq.${authUser.id}`,
      select: "id,full_name,role",
    },
    headers: authHeaders(accessToken),
  });
  const profile = response.data[0];

  if (!profile || profile.id !== authUser.id || !["customer", "agent", "manager"].includes(profile.role)) {
    throw new Error("Your account profile is not set up for Support Platform access.");
  }

  return {
    id: profile.id,
    email: authUser.email ?? "",
    name: profile.full_name,
    role: profile.role,
    accessToken,
    refreshToken,
  };
}

export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  assertSupabaseConfigured();
  const response = await axios.post<SupabaseTokenResponse>(
    `${supabaseConfig.authUrl}/token?grant_type=password`,
    credentials,
    { headers: { ...authHeaders(), "Content-Type": "application/json" } },
  );

  return loadProfile(response.data.user, response.data.access_token, response.data.refresh_token);
}

export async function register(payload: RegisterPayload): Promise<AuthUser | null> {
  assertSupabaseConfigured();
  const response = await axios.post<Partial<SupabaseTokenResponse> & { user?: SupabaseAuthUser }>(
    `${supabaseConfig.authUrl}/signup`,
    {
      email: payload.email,
      password: payload.password,
      data: { full_name: payload.name },
    },
    { headers: { ...authHeaders(), "Content-Type": "application/json" } },
  );

  if (!response.data.access_token || !response.data.refresh_token || !response.data.user) {
    return null;
  }

  return loadProfile(response.data.user, response.data.access_token, response.data.refresh_token);
}

export async function refreshAuthSession(refreshToken: string): Promise<AuthUser> {
  assertSupabaseConfigured();
  const response = await axios.post<SupabaseTokenResponse>(
    `${supabaseConfig.authUrl}/token?grant_type=refresh_token`,
    { refresh_token: refreshToken },
    { headers: { ...authHeaders(), "Content-Type": "application/json" } },
  );

  return loadProfile(response.data.user, response.data.access_token, response.data.refresh_token);
}

export async function restoreSession(): Promise<AuthUser | null> {
  assertSupabaseConfigured();
  const accessToken = localStorage.getItem("token");
  const refreshToken = localStorage.getItem("refresh_token");
  if (!accessToken) return null;

  try {
    const response = await axios.get<SupabaseAuthUser>(`${supabaseConfig.authUrl}/user`, {
      headers: authHeaders(accessToken),
    });
    return loadProfile(response.data, accessToken, refreshToken ?? "");
  } catch (error) {
    if (refreshToken && error instanceof AxiosError && error.response?.status === 401) {
      return refreshAuthSession(refreshToken);
    }
    throw error;
  }
}

export function saveAuthSession(authUser: AuthUser): void {
  localStorage.setItem("token", authUser.accessToken);
  localStorage.setItem("refresh_token", authUser.refreshToken);
  localStorage.setItem("user", JSON.stringify({
    id: authUser.id,
    email: authUser.email,
    name: authUser.name,
    role: authUser.role,
  }));
}

export function clearAuthSession(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
}

export function revokeAuthSession(accessToken: string): void {
  if (!supabaseConfig.isConfigured || !accessToken) return;
  void axios.post(`${supabaseConfig.authUrl}/logout`, null, {
    headers: authHeaders(accessToken),
  }).catch(() => undefined);
}
