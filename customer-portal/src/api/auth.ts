import axios from "axios";
import type { LoginCredentials, RegisterPayload, AuthUser } from "../types";

const SUPABASE_AUTH_URL = "https://iaukydzbcdmglqajllei.supabase.co/auth/v1";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhdWt5ZHpiY2RtZ2xxYWpsbGVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNjQzMzIsImV4cCI6MjEwMjg0MDMzMn0.GxvoOvmGBpVUOeRC2G3nN3POzX02KGD33hmh7joN_dc";

export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  const response = await axios.post(
    `${SUPABASE_AUTH_URL}/token?grant_type=password`,
    credentials,
    {
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
      },
    }
  );

  const { access_token, user } = response.data;

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.name || user.email,
    role: user.user_metadata?.role || user.role || "customer",
    accessToken: access_token,
  };

  localStorage.setItem("token", access_token);
  localStorage.setItem("user", JSON.stringify(authUser));

  return authUser;
}

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  const response = await axios.post(
    `${SUPABASE_AUTH_URL}/signup`,
    {
      email: payload.email,
      password: payload.password,
      data: {
        full_name: payload.name,
        role: payload.role || "customer",
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

  const authUser: AuthUser = {
    id: user?.id || "",
    email: payload.email,
    name: payload.name,
    role: payload.role || "customer",
    accessToken: access_token || "",
  };

  if (access_token) {
    localStorage.setItem("token", access_token);
    localStorage.setItem("user", JSON.stringify(authUser));
  }

  return authUser;
}