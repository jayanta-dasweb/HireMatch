"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ensureAccessToken, fetchMe, hasAnySession, storeTokens, UserMe } from "@/lib/api";

let cachedUser: UserMe | null = null;

export function clearUserCache() {
  cachedUser = null;
}

export function invalidateUserCache() {
  cachedUser = null;
}

export function useCurrentUser() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserMe | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (cachedUser) {
        setUser(cachedUser);
        setLoading(false);
        return;
      }

      if (!hasAnySession()) {
        setLoading(false);
        setError("Please sign in again.");
        if (!pathname?.startsWith("/sign-in") && !pathname?.startsWith("/register")) {
          router.replace("/sign-in");
        }
        return;
      }

      // Refresh first if access JWT is expired — avoids console 401 spam on /users/me.
      const ready = await ensureAccessToken();
      if (!alive) return;
      if (!ready) {
        storeTokens(null);
        clearUserCache();
        setLoading(false);
        setError("Please sign in again.");
        router.replace("/sign-in");
        return;
      }

      try {
        const me = await fetchMe();
        if (!alive) return;
        cachedUser = me;
        setUser(me);
        setLoading(false);
      } catch {
        if (!alive) return;
        storeTokens(null);
        clearUserCache();
        setError("Please sign in again.");
        setLoading(false);
        router.replace("/sign-in");
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [router, pathname]);

  return {
    user,
    loading,
    error,
    setUser: (u: UserMe) => {
      cachedUser = u;
      setUser(u);
    },
  };
}
