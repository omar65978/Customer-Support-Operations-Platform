import apiClient from "./axios";
import type { AuthUser, LoginCredentials, RegisterPayload } from "../types";

export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  const response = await apiClient.post<{ accessToken: string; user: Omit<AuthUser, "accessToken"> }>("/login", credentials);
  return { ...response.data.user, accessToken: response.data.accessToken };
}

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  const response = await apiClient.post<{ accessToken: string; user: Omit<AuthUser, "accessToken"> }>("/register", payload);
  return { ...response.data.user, accessToken: response.data.accessToken };
}
