"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe, UserMe } from "@/lib/api";

let cachedUser: UserMe | null = null;

export function clearUserCache() {
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

    fetchMe()
      .then((me) => {
        if (!alive) return;
        cachedUser = me;
        setUser(me);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        clearUserCache();
        setError("Please sign in again.");
        setLoading(false);
        router.replace("/sign-in");
      });

    return () => {
      alive = false;
    };
  }, [router]);

  return { user, loading, error, setUser: (u: UserMe) => { cachedUser = u; setUser(u); } };
}
