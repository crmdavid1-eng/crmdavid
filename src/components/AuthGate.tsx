"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { IS_DEMO } from "@/lib/supabase/mode";

const SessionCtx = createContext<{ login: string; demo: boolean }>({ login: "", demo: IS_DEMO });
export const useSession = () => useContext(SessionCtx);

/** Сессия живёт в браузере: клиент Supabase сам её обновляет, данные защищены RLS. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(IS_DEMO ? "демо" : null);

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

  if (email == null) return <Splash />;
  return (
    <SessionCtx.Provider value={{ login: email.replace(/@crm\.local$/, ""), demo: IS_DEMO }}>
      {children}
    </SessionCtx.Provider>
  );
}

export function Splash() {
  return (
    <div className="flex h-full items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" className="pulse-dot h-10 w-10" />
    </div>
  );
}
