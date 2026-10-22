import { NextResponse, type NextRequest } from "next/server";
import { adminSupabase } from "@/lib/supabase/server";
import { requireUser, unauthorized } from "@/lib/server/auth";
import { markRead, waConfigured } from "@/lib/server/whatsapp";

/** Чат открыт: сбрасываем счётчик и ставим клиенту синие галочки. */
export async function POST(req: NextRequest) {
  if (!(await requireUser(req))) return unauthorized();
  const { leadId } = (await req.json().catch(() => ({}))) as { leadId?: string };
  if (!leadId) return NextResponse.json({ error: "no lead" }, { status: 400 });

  const sb = adminSupabase();
  await sb.from("leads").update({ unread: 0 }).eq("id", leadId);
  if (waConfigured()) {
    const { data: last } = await sb
      .from("activities")
      .select("external_id")
      .eq("lead_id", leadId)
      .eq("kind", "message_in")
      .not("external_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last?.external_id) await markRead(last.external_id);
  }
  return NextResponse.json({ ok: true });
}
