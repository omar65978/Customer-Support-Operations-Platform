import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { AuthUser } from "../types";
import { supabase } from "../supabaseClient";
import type { LoginCredentials, RegisterPayload } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (stored && token) {
      try {
        const parsed = JSON.parse(stored) as AuthUser;
        setUser({ ...parsed, accessToken: token });
      } catch {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", credentials.email)
      .single();

    if (error || !data) {
      throw new Error("Invalid email or password");
    }

    const authUser: AuthUser = {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role,
      accessToken: "mock-supabase-token-" + data.id,
    };

    localStorage.setItem("token", authUser.accessToken);
    localStorage.setItem("user", JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const newId = crypto.randomUUID();
    const newUser = {
      id: newId,
      email: payload.email,
      password: payload.password,
      name: payload.name,
      role: "customer",
    };

    const { error } = await supabase.from("users").insert([newUser]);

    if (error) {
      throw new Error(error.message);
    }

    const authUser: AuthUser = {
      id: newId,
      email: payload.email,
      name: payload.name,
      role: "customer",
      accessToken: "mock-supabase-token-" + newId,
    };

    localStorage.setItem("token", authUser.accessToken);
    localStorage.setItem("user", JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
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