import { createBrowserClient } from "@supabase/ssr";
import { demoClient } from "./demo";
import { IS_DEMO } from "./mode";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function supabase(): ReturnType<typeof createBrowserClient> {
  if (IS_DEMO) return demoClient as unknown as ReturnType<typeof createBrowserClient>;
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}
