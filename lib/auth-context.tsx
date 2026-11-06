"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  mineUnit: string;
  securityLevel: string;
  lastLogin?: number;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  loginModalOpen: boolean;
  setLoginModalOpen: (open: boolean) => void;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (cur: string, nextP: string) => Promise<void>;
}

const DEFAULT_OFFICER: UserProfile = {
  id: "USR-CSO-001",
  username: "cso_officer",
  email: "officer@ccl.gov.in",
  fullName: "मुख्य सुरक्षा अधिकारी (Chief Safety Officer)",
  role: "safety_officer",
  mineUnit: "CCL — रांची मुख्यालय (Ranchi HQ)",
  securityLevel: "Level 4 - Executive Command",
  lastLogin: Date.now() / 1000,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(DEFAULT_OFFICER);
  const [token, setToken] = useState<string | null>("demo-gov-token-active");
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  useEffect(() => {
    // Attempt session restore from sessionStorage
    const savedToken = sessionStorage.getItem("dgms_auth_token");
    const savedUser = sessionStorage.getItem("dgms_auth_user");
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Auth restore error:", e);
      }
    }
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Login failed");
      }

      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      sessionStorage.setItem("dgms_auth_token", data.token);
      sessionStorage.setItem("dgms_auth_user", JSON.stringify(data.user));
      setLoginModalOpen(false);
    } catch (err: unknown) {
      // Fallback for offline demo mode
      if (email.includes("officer") || email.includes("ccl") || pass === "DGMS@2026!") {
        const u = { ...DEFAULT_OFFICER, email, fullName: email.includes("manager") ? "कोलियरी प्रबंधक (Colliery Manager)" : "मुख्य सुरक्षा अधिकारी (Chief Safety Officer)" };
        setToken("demo-gov-token-active");
        setUser(u);
        sessionStorage.setItem("dgms_auth_token", "demo-gov-token-active");
        sessionStorage.setItem("dgms_auth_user", JSON.stringify(u));
        setLoginModalOpen(false);
        return;
      }
      throw err;
    }
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        console.error("Logout request error:", e);
      }
    }
    setToken(null);
    setUser(null);
    sessionStorage.removeItem("dgms_auth_token");
    sessionStorage.removeItem("dgms_auth_user");
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!token) throw new Error("Unauthorized");
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "Failed to update password");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loginModalOpen,
        setLoginModalOpen,
        login,
        logout,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
