import type { Lead, Stage } from "@/lib/types";
import { normalizePhone } from "@/lib/format";
import type { LeadInput } from "@/lib/useCrm";

const COLUMNS = ["Имя", "Телефон", "Instagram", "Email", "Источник", "Сумма", "Этап", "Заметка", "Создана"] as const;

/** Варианты заголовков, которые узнаём при импорте (в нижнем регистре). */
const ALIASES: Record<string, keyof LeadInput | "stage" | "created"> = {
  "имя": "name", "фио": "name", "клиент": "name", "name": "name", "контакт": "name",
  "телефон": "phone", "тел": "phone", "номер": "phone", "phone": "phone", "мобильный": "phone", "whatsapp": "phone",
  "instagram": "instagram", "инстаграм": "instagram", "инста": "instagram", "ig": "instagram",
  "email": "email", "e-mail": "email", "почта": "email",
  "источник": "source", "source": "source", "канал": "source",
  "сумма": "amount", "бюджет": "amount", "amount": "amount", "цена": "amount",
  "этап": "stage", "статус": "stage", "stage": "stage", "status": "stage",
  "заметка": "note", "комментарий": "note", "примечание": "note", "note": "note", "comment": "note", "описание": "note",
  "создана": "created", "дата": "created", "дата создания": "created", "created": "created",
};

export async function exportLeads(leads: Lead[], stages: Stage[], fileName: string) {
  const XLSX = await import("xlsx");
  const stageName = new Map(stages.map((s) => [s.id, s.name]));
  const rows = leads.map((l) => ({
    "Имя": l.name,
    "Телефон": l.phone ?? "",
    "Instagram": l.instagram ?? "",
    "Email": l.email ?? "",
    "Источник": l.source ?? "",
    "Сумма": l.amount ?? "",
    "Этап": stageName.get(l.stage_id) ?? "",
    "Заметка": l.note ?? "",
    "Создана": new Date(l.created_at),
  }));
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...COLUMNS], cellDates: true });
  ws["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 40 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Заявки");
  XLSX.writeFile(wb, fileName);
}

export async function downloadTemplate() {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([
    [...COLUMNS.slice(0, -1)],
    ["Айгерим", "+77011234567", "@aigerim", "", "Instagram", 50000, "Новая заявка", "Интересует консультация"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Заявки");
  XLSX.writeFile(wb, "шаблон-импорта.xlsx");
}

export type ParsedImport = { rows: LeadInput[]; recognized: string[]; skipped: number };

export async function parseImport(file: File, stages: Stage[]): Promise<ParsedImport> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const stageByName = new Map(stages.map((s) => [s.name.trim().toLowerCase(), s.id]));
  const headers = Object.keys(raw[0] ?? {});
  const map = new Map<string, string>();
  for (const h of headers) {
    const key = ALIASES[h.trim().toLowerCase()];
    if (key) map.set(h, key);
  }

  let skipped = 0;
  const rows: LeadInput[] = [];
  for (const r of raw) {
    const lead: LeadInput & { created_at?: string } = {};
    for (const [h, key] of map) {
      const v = r[h];
      if (v === "" || v == null) continue;
      const s = String(v).trim();
      if (key === "phone") lead.phone = normalizePhone(s);
      else if (key === "amount") {
        const n = Number(s.replace(/[^\d.,-]/g, "").replace(",", "."));
        if (!Number.isNaN(n)) lead.amount = n;
      } else if (key === "stage") {
        const id = stageByName.get(s.toLowerCase());
        if (id) lead.stage_id = id;
      } else if (key === "created") {
        const d = v instanceof Date ? v : new Date(s);
        if (!Number.isNaN(d.getTime())) lead.created_at = d.toISOString();
      } else {
        (lead as Record<string, unknown>)[key] = s;
      }
    }
    if (!lead.name && !lead.phone && !lead.instagram && !lead.email) {
      skipped++;
      continue;
    }
    lead.name ??= "";
    rows.push(lead);
  }
  return { rows, recognized: [...map.keys()], skipped };
}
