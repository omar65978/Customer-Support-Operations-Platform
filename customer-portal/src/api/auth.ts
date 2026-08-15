import apiClient from "./axios";
import type { AuthUser, LoginCredentials, RegisterPayload } from "../types";

export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  const response = await apiClient.post<{ accessToken: string } & Omit<AuthUser, "accessToken">>("/login", credentials);
  const { accessToken, ...rest } = response.data;
  return { ...rest, accessToken };
}

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  const response = await apiClient.post<{ accessToken: string } & Omit<AuthUser, "accessToken">>("/register", payload);
  const { accessToken, ...rest } = response.data;
  return { ...rest, accessToken };
}
