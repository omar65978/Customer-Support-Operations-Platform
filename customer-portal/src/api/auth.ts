import apiClient from "./axios";
import type { LoginCredentials, RegisterPayload, AuthUser } from "../types";

export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  const response = await apiClient.post<{ accessToken: string; user: AuthUser }>(
    "/login",
    credentials
  );
  const { accessToken, user } = response.data;
  return { ...user, accessToken };
}

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  const response = await apiClient.post<{ accessToken: string; user: AuthUser }>(
    "/register",
    { email: payload.email, password: payload.password, name: payload.name, role: payload.role }
  );
  const { accessToken, user } = response.data;
  return { ...user, accessToken };
}