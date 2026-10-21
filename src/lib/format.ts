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

export function waLink(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
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
