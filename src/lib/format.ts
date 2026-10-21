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
