"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, Me } from "./api";

const STORAGE_KEY = "mytaman-user-id";

interface SessionContextValue {
  userId: string | null;
  me: Me | null;
  loading: boolean;
  setUserId: (id: string | null) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const setUserId = useCallback((id: string | null) => {
    setUserIdState(id);
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    setUserIdState(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  useEffect(() => {
    if (!userId) {
      setMe(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getMe(userId)
      .then(setMe)
      .catch(() => {
        // Stale/invalid id (e.g. database was reseeded) — clear it so the user re-enters one.
        setMe(null);
        setUserId(null);
      })
      .finally(() => setLoading(false));
  }, [userId, setUserId]);

  return (
    <SessionContext.Provider value={{ userId, me, loading, setUserId }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
