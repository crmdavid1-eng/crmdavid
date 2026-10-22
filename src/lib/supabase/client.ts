import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { demoClient } from "./demo";
import { IS_DEMO } from "./mode";

let client: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  if (IS_DEMO) return demoClient as unknown as SupabaseClient;
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Протокол 2.0 (по умолчанию в realtime-js 2.118) у проекта зависает на подписке — TIMED_OUT.
    // Подписка на бесплатном тарифе занимает 5–10+ с, поэтому таймаут больше стандартных 10 с.
    { realtime: { vsn: "1.0.0", timeout: 30_000 } },
  );
  return client;
}
