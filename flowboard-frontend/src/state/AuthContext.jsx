import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { decodeJwt, isTokenActive } from "../services/helpers";

const AuthContext = createContext(null);

const STORAGE_KEY = "flowboard-auth-v2";

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const emptyAuth = {
      token: "",
      userId: "",
      role: "",
      profile: null
    };

    if (!saved) {
      return emptyAuth;
    }

    try {
      const parsed = JSON.parse(saved);

      if (!parsed?.token || !parsed?.userId || !isTokenActive(parsed.token)) {
        return emptyAuth;
      }

      return {
        ...parsed,
        role: parsed.role || decodeJwt(parsed.token).role || ""
      };
    } catch {
      return emptyAuth;
    }
  });

  useEffect(() => {
    if (auth.token && !isTokenActive(auth.token)) {
      setAuth({ token: "", userId: "", role: "", profile: null });
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  }, [auth]);

  const value = useMemo(
    () => ({
      token: auth.token,
      userId: auth.userId,
      role: auth.role,
      profile: auth.profile,
      isAuthenticated: Boolean(auth.token && auth.userId),
      isAdmin: auth.role === "PLATFORM_ADMIN",
      login(nextAuth) {
        setAuth({
          ...nextAuth,
          role: nextAuth.role || decodeJwt(nextAuth.token).role || ""
        });
      },
      logout() {
        setAuth({ token: "", userId: "", role: "", profile: null });
      },
      setProfile(profile) {
        setAuth((current) => ({ ...current, profile }));
      }
    }),
    [auth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
