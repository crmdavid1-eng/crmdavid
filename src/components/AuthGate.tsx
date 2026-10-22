"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { IS_DEMO } from "@/lib/supabase/mode";
import { CrmApp } from "@/components/CrmApp";

/** Сессия живёт в браузере: клиент Supabase сам её обновляет, данные защищены RLS. */
export function AuthGate() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(IS_DEMO ? "демо-режим" : null);

  useEffect(() => {
    if (IS_DEMO) return;
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => {
      if (data.session) setEmail(data.session.user.email ?? "");
      else router.replace("/login");
    });
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (email == null) {
    return <div className="flex h-full items-center justify-center text-sm text-muted">Загружаем заявки…</div>;
  }
  return <CrmApp email={email} demo={IS_DEMO} />;
}
