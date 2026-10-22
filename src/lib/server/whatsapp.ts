import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Официальный WhatsApp Cloud API (Meta). Настройки — переменные окружения:
 * WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET.
 */
const VERSION = process.env.WHATSAPP_API_VERSION || "v25.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;

export const waConfigured = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

export class WhatsAppError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
  }
}

async function graph<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GRAPH}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json?.error;
    throw new WhatsAppError(err?.error_data?.details || err?.message || `WhatsApp API ${res.status}`, err?.code);
  }
  return json as T;
}

/** Номер телефона → wa_id: только цифры. */
export const toWaId = (phone: string) => phone.replace(/\D/g, "");

export async function sendText(phone: string, text: string) {
  const r = await graph<{ messages: { id: string }[] }>(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: toWaId(phone), type: "text", text: { body: text, preview_url: true } }),
  });
  return r.messages[0]?.id;
}

/** Синие галочки у клиента. Ошибки не критичны. */
export async function markRead(wamid: string) {
  await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: wamid }),
  }).catch(() => {});
}

export async function phoneInfo() {
  return graph<{ display_phone_number: string; verified_name: string }>(
    `${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name`,
  );
}

/** Скачивает медиа по id: сначала временная ссылка, потом сам файл. */
export async function downloadMedia(mediaId: string) {
  const meta = await graph<{ url: string; mime_type: string }>(mediaId);
  const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } });
  if (!res.ok) throw new WhatsAppError(`media ${res.status}`);
  return { body: await res.arrayBuffer(), mime: meta.mime_type };
}

/** Подпись X-Hub-Signature-256 от Meta. Без WHATSAPP_APP_SECRET проверка пропускается. */
export function validSignature(raw: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Человеческое описание ошибки отправки. */
export function sendErrorText(e: unknown) {
  if (e instanceof WhatsAppError) {
    if (e.code === 131047 || /24 hours|re-engagement/i.test(e.message))
      return "Клиент писал больше 24 часов назад. WhatsApp разрешает первым писать только шаблонами — откройте чат в телефоне или дождитесь сообщения клиента.";
    if (e.code === 190) return "Токен WhatsApp недействителен или истёк. Обновите WHATSAPP_TOKEN в Netlify.";
    if (e.code === 131026) return "Сообщение не доставлено: у этого номера нет WhatsApp.";
    return `WhatsApp: ${e.message}`;
  }
  return "Не удалось отправить сообщение. Проверьте интернет.";
}
