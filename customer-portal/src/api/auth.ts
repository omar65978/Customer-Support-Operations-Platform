import axios, { isAxiosError } from "axios";
import { AUTH_URL, REST_URL, SUPABASE_ANON_KEY } from "../config/supabase";
import { authHeaders } from "./axios";
import { AccountError } from "./errors";
import type { AuthUser, LoginCredentials, RegisterPayload, UserRole } from "../types";

interface TokenResponse {
  access_token: string;
  user: { id: string; email?: string };
}

const JSON_HEADERS = { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY };

function signInMessage(error: unknown): string {
  if (!isAxiosError(error)) return "We could not sign you in. Please try again.";
  if (!error.response) return "We could not reach the sign-in service. Check your connection and try again.";
  const body = error.response.data as { error_description?: string; msg?: string } | undefined;
  const detail = `${body?.error_description ?? ""} ${body?.msg ?? ""}`;
  if (/email not confirmed/i.test(detail)) {
    return "Please confirm your email address first. Open the confirmation link we sent you, then sign in.";
  }
  if (/invalid login credentials/i.test(detail)) return "Invalid email or password. Please try again.";
  return "We could not sign you in. Please try again.";
}

/**
 * Reads the account's role from the users table. The role is set by the database,
 * never taken from user-editable metadata.
 */
export async function fetchProfile(userId: string, accessToken: string): Promise<Omit<AuthUser, "accessToken">> {
  const { data } = await axios.get<Array<{ id: string; email: string; name: string; role: UserRole }>>(
    `${REST_URL}/users`,
    {
      params: { id: `eq.${userId}`, select: "id,email,name,role" },
      headers: authHeaders(accessToken),
    }
  );
  const row = Array.isArray(data) ? data[0] : undefined;
  if (!row) {
    throw new AccountError("Your account is not set up for the support portal yet. Please contact support.");
  }
  return { id: row.id, email: row.email, name: row.name || row.email, role: row.role };
}

export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  let session: TokenResponse;
  try {
    const response = await axios.post<TokenResponse>(
      `${AUTH_URL}/token?grant_type=password`,
      { email: credentials.email, password: credentials.password },
      { headers: JSON_HEADERS }
    );
    session = response.data;
  } catch (error) {
    throw new AccountError(signInMessage(error));
  }
  const profile = await fetchProfile(session.user.id, session.access_token);
  return { ...profile, accessToken: session.access_token };
}

export interface RegisterResult {
  /** True when Supabase sent a confirmation email and no session was created yet. */
  needsConfirmation: boolean;
  user?: AuthUser;
}

export async function register(payload: RegisterPayload): Promise<RegisterResult> {
  let body: (Partial<TokenResponse> & { id?: string }) | undefined;
  try {
    const response = await axios.post(
      `${AUTH_URL}/signup`,
      { email: payload.email, password: payload.password, data: { full_name: payload.name } },
      { headers: JSON_HEADERS }
    );
    body = response.data;
  } catch (error) {
    if (isAxiosError(error) && /already|registered/i.test(JSON.stringify(error.response?.data ?? {}))) {
      throw new AccountError("An account with this email already exists. Try signing in instead.");
    }
    throw new AccountError("Registration failed. Check your details and try again.");
  }

  if (!body?.access_token || !body.user) {
    return { needsConfirmation: true };
  }
  const profile = await fetchProfile(body.user.id, body.access_token);
  return { needsConfirmation: false, user: { ...profile, accessToken: body.access_token } };
}

/** Ends the Supabase session on the server. Failures are ignored; the local session is cleared anyway. */
export async function revokeSession(accessToken: string): Promise<void> {
  try {
    await axios.post(`${AUTH_URL}/logout`, {}, { headers: authHeaders(accessToken) });
  } catch {
    // Nothing to do: the token expires on its own.
  }
}
