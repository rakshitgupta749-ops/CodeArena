import { createContext, useContext, useState, type ReactNode } from "react";
import { api, type AuthUser, type LoginResponse } from "@/lib/api";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem("auth_user");
    return stored ? JSON.parse(stored) : null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("auth_token");
  });

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const data = await api.post<LoginResponse>("/auth/login", { email, password });
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      localStorage.setItem("auth_token", data.token);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Login failed" };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_token");
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
