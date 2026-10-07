import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { AuthUser } from "../types";
import {
  clearAuthSession,
  login as apiLogin,
  register as apiRegister,
  restoreSession,
  revokeAuthSession,
  saveAuthSession,
} from "../api/auth";
import type { LoginCredentials, RegisterPayload } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    const accessToken = localStorage.getItem("token");
    if (!accessToken) {
      setIsLoading(false);
      return () => { isCurrent = false; };
    }

    restoreSession()
      .then((authUser) => {
        if (!isCurrent) return;
        if (!authUser || authUser.role !== "customer") throw new Error("This portal is for customer accounts only.");
        saveAuthSession(authUser);
        setUser(authUser);
      })
      .catch(() => {
        if (!isCurrent) return;
        clearAuthSession();
        setUser(null);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => { isCurrent = false; };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const authUser = await apiLogin(credentials);
    if (authUser.role !== "customer") {
      revokeAuthSession(authUser.accessToken);
      throw new Error("This portal is for customer accounts only. Use the Support Workspace for staff accounts.");
    }
    saveAuthSession(authUser);
    setUser(authUser);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const authUser = await apiRegister(payload);
    if (!authUser) return false;
    if (authUser.role !== "customer") {
      revokeAuthSession(authUser.accessToken);
      throw new Error("New portal accounts must have the customer role.");
    }
    saveAuthSession(authUser);
    setUser(authUser);
    return true;
  }, []);

  const logout = useCallback(() => {
    const accessToken = localStorage.getItem("token") ?? "";
    clearAuthSession();
    setUser(null);
    revokeAuthSession(accessToken);
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
