import { NextResponse, type NextRequest } from "next/server";
import { adminSupabase } from "@/lib/supabase/server";
import { requireUser, unauthorized } from "@/lib/server/auth";
import { sendErrorText, sendText, waConfigured } from "@/lib/server/whatsapp";

/** Отправка сообщения клиенту из карточки. */
export async function POST(req: NextRequest) {
  if (!(await requireUser(req))) return unauthorized();
  if (!waConfigured()) return NextResponse.json({ error: "WhatsApp не подключён: заполните переменные WHATSAPP_* в Netlify." }, { status: 400 });

  const { leadId, text } = (await req.json().catch(() => ({}))) as { leadId?: string; text?: string };
  const body = text?.trim();
  if (!leadId || !body) return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });

  const sb = adminSupabase();
  const { data: lead } = await sb.from("leads").select("id, phone").eq("id", leadId).maybeSingle();
  if (!lead?.phone) return NextResponse.json({ error: "У клиента не указан телефон" }, { status: 400 });

  try {
    const wamid = await sendText(lead.phone, body);
    const at = new Date().toISOString();
    const { data: activity } = await sb
      .from("activities")
      .insert({ lead_id: lead.id, kind: "message_out", body, external_id: wamid, created_at: at, meta: { channel: "whatsapp", status: "sent" } })
      .select()
      .single();
    await sb.rpc("bump_lead_message", { p_lead: lead.id, p_text: body, p_at: at, p_incoming: false });
    return NextResponse.json({ ok: true, activity });
  } catch (e) {
    return NextResponse.json({ error: sendErrorText(e) }, { status: 400 });
  }
}
