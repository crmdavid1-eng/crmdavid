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
  );
  return client;
}
