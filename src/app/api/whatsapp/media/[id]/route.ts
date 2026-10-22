import { NextResponse, type NextRequest } from "next/server";
import { requireUser, unauthorized } from "@/lib/server/auth";
import { downloadMedia } from "@/lib/server/whatsapp";

/** Фото и файлы из WhatsApp: Meta отдаёт их только с токеном, поэтому проксируем. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/whatsapp/media/[id]">) {
  if (!(await requireUser(req))) return unauthorized();
  const { id } = await ctx.params;
  try {
    const { body, mime } = await downloadMedia(id);
    return new NextResponse(body, { headers: { "Content-Type": mime, "Cache-Control": "private, max-age=86400" } });
  } catch {
    return NextResponse.json({ error: "Файл недоступен: WhatsApp хранит медиа около 30 дней" }, { status: 404 });
  }
}
