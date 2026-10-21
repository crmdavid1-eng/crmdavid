import { Suspense } from "react";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { IS_DEMO } from "@/lib/supabase/mode";
import { CrmApp } from "@/components/CrmApp";

export default function Home() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted">Загрузка…</div>}>
      <Authed />
    </Suspense>
  );
}

async function Authed() {
  if (IS_DEMO) return <CrmApp email="демо-режим" webhookToken="" demo />;
  const sb = await serverSupabase();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/login");
  return <CrmApp email={data.user.email ?? ""} webhookToken={process.env.WEBHOOK_SECRET ?? ""} />;
}
