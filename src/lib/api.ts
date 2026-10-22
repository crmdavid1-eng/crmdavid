"use client";

import { supabase } from "@/lib/supabase/client";

/** fetch к нашим /api с токеном текущего пользователя. */
export async function authedFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase().auth.getSession();
  return fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
      authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
  });
}
