const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export function formatMoney(v: number | null | undefined) {
  if (v == null) return "";
  return `${money.format(v)} ₸`;
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `сегодня ${time}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `вчера ${time}`;
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }) + ` ${time}`;
}

/** Оставляет только цифры и ведущий +, 8XXXXXXXXXX → +7XXXXXXXXXX */
export function normalizePhone(raw: string | null | undefined) {
  if (!raw) return null;
  let s = String(raw).replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("8") && s.length === 11) s = "+7" + s.slice(1);
  else if (s.startsWith("7") && s.length === 11) s = "+" + s;
  return s;
}


export function igLink(handle: string) {
  return `https://instagram.com/${handle.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "")}`;
}

/** plural(5, "заявка", "заявки", "заявок") → "заявок" */
export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** +77011234567 → +7 701 123 45 67 (для показа) */
export function formatPhone(p: string | null | undefined) {
  if (!p) return "";
  const m = p.match(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+7 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : p;
}

const DAY = 864e5;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export type Due = "overdue" | "today" | "tomorrow" | "later";

/** Статус срока следующего шага. */
export function dueStatus(iso: string | null | undefined, now = new Date()): Due | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (d.getTime() < now.getTime()) return "overdue";
  const days = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return "later";
}

/** Короткая подпись срока: «сегодня 15:00», «вчера», «пт 12:00», «3 нояб.» */
export function formatDue(iso: string, now = new Date()) {
  const d = new Date(iso);
  const days = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY);
  const hasTime = !(d.getHours() === 0 && d.getMinutes() === 0);
  const time = hasTime ? " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
  if (days === 0) return "сегодня" + time;
  if (days === 1) return "завтра" + time;
  if (days === -1) return "вчера" + time;
  if (days < -1) return `${-days} ${plural(-days, "день", "дня", "дней")} назад`;
  if (days < 7) return d.toLocaleDateString("ru-RU", { weekday: "short" }) + time;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) + time;
}

/** Сколько полных дней прошло с даты. */
export function daysSince(iso: string, now = new Date()) {
  return Math.floor((startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / DAY);
}

/** Быстрые варианты срока для следующего шага. */
export function quickDue(kind: "evening" | "tomorrow" | "3days" | "week", now = new Date()) {
  const d = new Date(now);
  if (kind === "evening") {
    d.setHours(Math.max(18, d.getHours() + 1), 0, 0, 0);
    return d;
  }
  d.setDate(d.getDate() + (kind === "tomorrow" ? 1 : kind === "3days" ? 3 : 7));
  d.setHours(11, 0, 0, 0);
  return d;
}

/** Значение для <input type="datetime-local"> */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Подставляет {имя} и {сумма} в шаблон сообщения. */
export function fillTemplate(body: string, lead: { name: string; amount: number | null }) {
  const first = lead.name.trim().split(/\s+/)[0] ?? "";
  return body
    .replace(/\{имя\}/gi, first)
    .replace(/\{сумма\}/gi, lead.amount != null ? formatMoney(lead.amount) : "")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/^[,\s]+/, "");
}

export function waLink(phone: string, text?: string) {
  const base = `https://wa.me/${phone.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
