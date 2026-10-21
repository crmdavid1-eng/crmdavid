import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { IS_DEMO } from "@/lib/supabase/mode";

export async function POST(req: NextRequest) {
  if (IS_DEMO) return NextResponse.redirect(new URL("/", req.url), { status: 303 });
  const sb = await serverSupabase();
  await sb.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
