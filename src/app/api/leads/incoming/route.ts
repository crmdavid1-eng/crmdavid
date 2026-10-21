import { NextResponse, type NextRequest } from "next/server";
import { adminSupabase } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/format";

/**
 * Приём заявок извне: Make/Zapier (Instagram Lead Ads), Tilda, любые формы.
 * POST /api/leads/incoming?token=WEBHOOK_SECRET
 * Тело — JSON или form-data. Поля: name, phone, instagram, email, source, amount, note,
 * pipeline (название воронки), stage (название этапа), external_id.
 * Неизвестные поля дописываются в заметку.
 */

const KEYS: Record<string, string> = {
  name: "name", имя: "name", full_name: "name", fullname: "name", fio: "name",
  phone: "phone", телефон: "phone", phone_number: "phone", tel: "phone",
  instagram: "instagram", ig: "instagram", instagram_username: "instagram",
  email: "email", mail: "email",
  source: "source", источник: "source", utm_source: "source",
  amount: "amount", сумма: "amount", price: "amount",
  note: "note", comment: "note", message: "note", комментарий: "note",
  pipeline: "pipeline", stage: "stage",
  external_id: "external_id", lead_id: "external_id", leadgen_id: "external_id", tranid: "external_id",
};

const IGNORE = new Set(["token", "formid", "formname", "test", "cookies"]);

export async function POST(req: NextRequest) {
  const secret = process.env.WEBHOOK_SECRET;
  const token = req.nextUrl.searchParams.get("token") ?? req.headers.get("x-webhook-token");
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) body = await req.json();
    else body = Object.fromEntries((await req.formData()).entries());
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  // Tilda шлёт test=test при проверке вебхука
  if (body.test === "test") return NextResponse.json({ ok: true });

  const f: Record<string, string> = {};
  const extra: string[] = [];
  for (const [k, v] of Object.entries(body)) {
    if (v == null || v === "" || typeof v === "object") continue;
    const key = KEYS[k.toLowerCase()];
    if (key) f[key] ??= String(v).trim();
    else if (!IGNORE.has(k.toLowerCase())) extra.push(`${k}: ${v}`);
  }

  const sb = adminSupabase();

  const { data: pipelines } = await sb.from("pipelines").select("id,name").order("position").order("created_at");
  const pipeline =
    pipelines?.find((p) => f.pipeline && p.name.toLowerCase() === f.pipeline.toLowerCase()) ?? pipelines?.[0];
  if (!pipeline) return NextResponse.json({ error: "no pipeline" }, { status: 500 });

  const { data: stages } = await sb.from("stages").select("id,name").eq("pipeline_id", pipeline.id).order("position");
  const stage = stages?.find((s) => f.stage && s.name.toLowerCase() === f.stage.toLowerCase()) ?? stages?.[0];
  if (!stage) return NextResponse.json({ error: "no stage" }, { status: 500 });

  const phone = normalizePhone(f.phone);
  const source = f.source || "Вебхук";
  const note = [f.note, ...extra].filter(Boolean).join("\n") || null;

  // Повторная заявка с того же телефона — пишем в историю существующей
  if (phone) {
    const { data: existing } = await sb
      .from("leads")
      .select("id")
      .eq("pipeline_id", pipeline.id)
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();
    if (existing) {
      await sb.from("activities").insert({
        lead_id: existing.id,
        kind: "created",
        body: `Повторная заявка (${source})${note ? "\n" + note : ""}`,
      });
      return NextResponse.json({ ok: true, id: existing.id, duplicate: true });
    }
  }

  const amount = f.amount ? Number(f.amount.replace(/[^\d.]/g, "")) : null;
  const { data: lead, error } = await sb
    .from("leads")
    .insert({
      pipeline_id: pipeline.id,
      stage_id: stage.id,
      name: f.name ?? "",
      phone,
      instagram: f.instagram || null,
      email: f.email || null,
      source,
      amount: amount && !Number.isNaN(amount) ? amount : null,
      note,
      external_id: f.external_id || null,
      position: -Date.now() / 1000,
    })
    .select("id")
    .single();

  if (error) {
    // уникальность (source, external_id) — дубль от повторной доставки вебхука
    if (error.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await sb.from("activities").insert({ lead_id: lead.id, kind: "created", body: `Заявка пришла: ${source}` });
  return NextResponse.json({ ok: true, id: lead.id });
}
