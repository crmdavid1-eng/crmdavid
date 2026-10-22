import { NextResponse, type NextRequest } from "next/server";
import { adminSupabase } from "@/lib/supabase/server";
import { validSignature } from "@/lib/server/whatsapp";

/**
 * Вебхук WhatsApp Cloud API.
 * GET — проверка адреса при подключении в Meta (hub.challenge).
 * POST — входящие сообщения и статусы доставки.
 */

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

type WaMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type?: string; caption?: string };
  video?: { id: string; caption?: string };
  audio?: { id: string; voice?: boolean };
  document?: { id: string; filename?: string; caption?: string };
  sticker?: { id: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: { name?: { formatted_name?: string } }[];
  button?: { text: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
  reaction?: { emoji?: string };
  referral?: { source_url?: string; source_type?: string; headline?: string; body?: string; ctwa_clid?: string };
};

type WaStatus = { id: string; status: string; timestamp: string; errors?: { title?: string; message?: string }[] };

type WaValue = {
  contacts?: { profile?: { name?: string }; wa_id: string }[];
  messages?: WaMessage[];
  statuses?: WaStatus[];
};

/** Текст и тип для ленты: у медиа — подпись или пометка. */
function describe(m: WaMessage): { text: string; media?: string; mime?: string } {
  switch (m.type) {
    case "text": return { text: m.text?.body ?? "" };
    case "image": return { text: m.image?.caption || "📷 Фото", media: m.image?.id, mime: m.image?.mime_type };
    case "video": return { text: m.video?.caption || "🎬 Видео", media: m.video?.id };
    case "audio": return { text: m.audio?.voice ? "🎤 Голосовое сообщение" : "🎵 Аудио", media: m.audio?.id };
    case "document": return { text: `📎 ${m.document?.filename || "Документ"}${m.document?.caption ? `\n${m.document.caption}` : ""}`, media: m.document?.id };
    case "sticker": return { text: "Стикер", media: m.sticker?.id };
    case "location": return { text: `📍 ${m.location?.name || m.location?.address || `${m.location?.latitude}, ${m.location?.longitude}`}` };
    case "contacts": return { text: `👤 Контакт: ${m.contacts?.[0]?.name?.formatted_name ?? ""}` };
    case "button": return { text: m.button?.text ?? "" };
    case "interactive": return { text: m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "" };
    case "reaction": return { text: `Реакция ${m.reaction?.emoji ?? ""}` };
    default: return { text: "Сообщение этого типа пока не поддерживается — откройте WhatsApp на телефоне" };
  }
}

function sourceFromReferral(r?: WaMessage["referral"]) {
  if (!r) return "WhatsApp";
  const url = r.source_url?.toLowerCase() ?? "";
  if (url.includes("instagram")) return "Instagram";
  if (url.includes("facebook") || url.includes("fb.")) return "Facebook";
  return r.source_type === "ad" ? "Реклама" : "WhatsApp";
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let body: { entry?: { changes?: { value?: WaValue }[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const sb = adminSupabase();
  const values = (body.entry ?? []).flatMap((e) => e.changes ?? []).map((c) => c.value).filter(Boolean) as WaValue[];

  for (const value of values) {
    // Статусы доставки исходящих: sent → delivered → read / failed
    for (const st of value.statuses ?? []) {
      const { data: act } = await sb.from("activities").select("id, meta").eq("external_id", st.id).maybeSingle();
      if (act) {
        const meta = { ...(act.meta ?? {}), status: st.status, ...(st.errors?.length ? { error: st.errors[0].message || st.errors[0].title } : {}) };
        await sb.from("activities").update({ meta }).eq("id", act.id);
      }
    }

    for (const m of value.messages ?? []) {
      const phone = `+${m.from}`;
      const profileName = value.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? "";
      const at = new Date(Number(m.timestamp) * 1000 || Date.now()).toISOString();
      const { text, media, mime } = describe(m);

      // Ищем клиента по телефону; нет — создаём заявку в первом этапе первой воронки
      let { data: lead } = await sb
        .from("leads")
        .select("id, next_action_at")
        .eq("phone", phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lead) {
        const { data: pipeline } = await sb.from("pipelines").select("id").order("position").order("created_at").limit(1).maybeSingle();
        if (!pipeline) continue;
        const { data: stage } = await sb.from("stages").select("id").eq("pipeline_id", pipeline.id).order("position").limit(1).maybeSingle();
        if (!stage) continue;
        const r = m.referral;
        const { data: created } = await sb
          .from("leads")
          .insert({
            pipeline_id: pipeline.id,
            stage_id: stage.id,
            name: profileName,
            phone,
            source: sourceFromReferral(r),
            note: r?.headline ? `Из рекламы: ${r.headline}` : null,
            position: -Date.now() / 1000,
            next_action: "Ответить в WhatsApp",
            next_action_at: at,
          })
          .select("id, next_action_at")
          .single();
        if (!created) continue;
        lead = created;
        await sb.from("activities").insert({
          lead_id: created.id,
          kind: "created",
          body: r ? `Новый чат WhatsApp из рекламы${r.headline ? `: ${r.headline}` : ""}${r.source_url ? `\n${r.source_url}` : ""}` : "Новый чат WhatsApp",
          meta: r ? { referral: r } : null,
        });
      } else if (!lead.next_action_at) {
        await sb.from("leads").update({ next_action: "Ответить в WhatsApp", next_action_at: at }).eq("id", lead.id);
      }

      // Само сообщение; повторная доставка того же wamid отсекается уникальным индексом
      const { error } = await sb.from("activities").insert({
        lead_id: lead.id,
        kind: "message_in",
        body: text,
        external_id: m.id,
        created_at: at,
        meta: { channel: "whatsapp", type: m.type, ...(media ? { media, mime } : {}) },
      });
      if (error) continue; // дубль

      await sb.rpc("bump_lead_message", { p_lead: lead.id, p_text: text, p_at: at, p_incoming: true });
    }
  }

  // Meta ждёт 200 быстро, иначе будет повторять доставку
  return NextResponse.json({ ok: true });
}
