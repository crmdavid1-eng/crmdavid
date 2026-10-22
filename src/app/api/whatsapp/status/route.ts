import { NextResponse, type NextRequest } from "next/server";
import { requireUser, unauthorized } from "@/lib/server/auth";
import { phoneInfo, waConfigured } from "@/lib/server/whatsapp";

/** Подключён ли WhatsApp и к какому номеру — для настроек. */
export async function GET(req: NextRequest) {
  if (!(await requireUser(req))) return unauthorized();
  if (!waConfigured()) return NextResponse.json({ configured: false, verifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN) });
  try {
    const info = await phoneInfo();
    return NextResponse.json({ configured: true, ok: true, number: info.display_phone_number, name: info.verified_name, secured: Boolean(process.env.WHATSAPP_APP_SECRET) });
  } catch (e) {
    return NextResponse.json({ configured: true, ok: false, error: e instanceof Error ? e.message : "error" });
  }
}
