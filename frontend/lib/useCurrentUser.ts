"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe, hasAccessToken, hasRefreshToken, storeTokens, UserMe } from "@/lib/api";

let cachedUser: UserMe | null = null;

export function clearUserCache() {
  cachedUser = null;
}

/** Force next useCurrentUser consumers to refetch /users/me. */
export function invalidateUserCache() {
  cachedUser = null;
}

export function useCurrentUser() {
  const router = useRouter();
  const [user, setUser] = useState<UserMe | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (cachedUser) {
      setUser(cachedUser);
      setLoading(false);
      return;
    }

    // No session at all — go sign in without hitting the API.
    if (!hasAccessToken() && !hasRefreshToken()) {
      setLoading(false);
      setError("Please sign in again.");
      router.replace("/sign-in");
      return;
    }

    fetchMe()
      .then((me) => {
        if (!alive) return;
        cachedUser = me;
        setUser(me);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        storeTokens(null);
        clearUserCache();
        setError("Please sign in again.");
        setLoading(false);
        router.replace("/sign-in");
      });

    return () => {
      alive = false;
    };
  }, [router]);

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
