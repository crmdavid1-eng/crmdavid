import { NextResponse, type NextRequest } from "next/server";
import { adminSupabase } from "@/lib/supabase/server";

/** Проверяет JWT пользователя из заголовка Authorization. null — не вошёл. */
export async function requireUser(req: NextRequest) {
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!jwt) return null;
  const { data } = await adminSupabase().auth.getUser(jwt);
  return data.user ?? null;
}

export const unauthorized = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });
