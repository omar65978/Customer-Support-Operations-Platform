import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { AuthUser, LoginCredentials, RegisterPayload } from "../types";
import { login as apiLogin, register as apiRegister, revokeSession, type RegisterResult } from "../api/auth";
import { clearSession, SESSION_TOKEN_KEY, SESSION_USER_KEY } from "../api/axios";
import { AccountError } from "../api/errors";

export const STAFF_ON_CUSTOMER_PORTAL =
  "This portal is for customers. Support staff should sign in to the Support Workspace.";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<RegisterResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function persistSession(user: AuthUser) {
  localStorage.setItem(SESSION_TOKEN_KEY, user.accessToken);
  localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
}

/** Restores the stored session. Sessions for any role other than customer are discarded. */
function restoreSession(): AuthUser | null {
  const storedUser = localStorage.getItem(SESSION_USER_KEY);
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  if (!storedUser || !token) return null;
  try {
    const parsed = JSON.parse(storedUser) as AuthUser;
    if (!parsed.id || parsed.role !== "customer") {
      clearSession();
      return null;
    }
    return { ...parsed, accessToken: token };
  } catch {
    clearSession();
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(restoreSession());
    setIsLoading(false);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const authUser = await apiLogin(credentials);
    if (authUser.role !== "customer") {
      // Staff accounts are not stored in the customer portal.
      void revokeSession(authUser.accessToken);
      throw new AccountError(STAFF_ON_CUSTOMER_PORTAL);
    }
    persistSession(authUser);
    setUser(authUser);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const result = await apiRegister(payload);
    if (result.user) {
      persistSession(result.user);
      setUser(result.user);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    clearSession();
    setUser(null);
    if (token) void revokeSession(token);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
