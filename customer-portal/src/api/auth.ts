import axios from "axios";
import type { LoginCredentials, RegisterPayload, AuthUser } from "../types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://iaukydzbcdmglqajllei.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  const response = await axios.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      email: credentials.email,
      password: credentials.password,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
      },
    }
  );

  const { access_token, user } = response.data;

  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.email,
    accessToken: access_token,
  } as AuthUser;
}

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  const response = await axios.post(
    `${SUPABASE_URL}/auth/v1/signup`,
    {
      email: payload.email,
      password: payload.password,
      data: {
        full_name: payload.name,
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
      },
    }
  );

  const { access_token, user } = response.data;

  return {
    id: user.id,
    email: user.email,
    name: payload.name || user.email,
    accessToken: access_token || "",
  } as AuthUser;
}