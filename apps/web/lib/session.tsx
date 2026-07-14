"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "mytaman-user-id";

interface SessionContextValue {
  userId: string | null;
  setUserId: (id: string | null) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<string | null>(null);

  useEffect(() => {
    setUserIdState(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  function setUserId(id: string | null) {
    setUserIdState(id);
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <SessionContext.Provider value={{ userId, setUserId }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
