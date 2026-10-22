import { NextResponse, type NextRequest } from "next/server";
import { adminSupabase } from "@/lib/supabase/server";

/** Отдаёт секрет вебхука только вошедшему пользователю. */
export async function GET(req: NextRequest) {
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!jwt) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await adminSupabase().auth.getUser(jwt);
  if (!data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ token: process.env.WEBHOOK_SECRET ?? "" });
}
