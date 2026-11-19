import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearAccessToken, getAccessToken, setAccessToken } from "../../api/client.js";
import { getCurrentUser } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const handleUnauthorized = () => {
      if (active) setUser(null);
    };
    window.addEventListener("clinic:unauthorized", handleUnauthorized);

    if (!getAccessToken()) {
      setLoading(false);
    } else {
      getCurrentUser()
        .then((currentUser) => {
          if (active) setUser(currentUser);
        })
        .catch(() => clearAccessToken())
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
      window.removeEventListener("clinic:unauthorized", handleUnauthorized);
    };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    signIn(response) {
      setAccessToken(response.access_token);
      setUser({
        id: response.user_id,
        name: response.name,
        role: response.role,
        clinic_id: response.clinic_id ?? null,
        clinic_name: response.clinic_name ?? null,
      });
    },
    signOut() {
      clearAccessToken();
      setUser(null);
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}