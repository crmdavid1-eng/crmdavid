"use client";

import { useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Modal } from "@/components/Modal";
import { downloadTemplate, parseImport, type ParsedImport } from "@/lib/excel";
import type { Crm } from "@/lib/useCrm";

export function ImportModal({ crm, onClose }: { crm: Crm; onClose: () => void }) {
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [fileName, setFileName] = useState("");
  const [skipDupes, setSkipDupes] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState("");

  const existingPhones = new Set(crm.leads.map((l) => l.phone).filter(Boolean));
  const dupes = parsed?.rows.filter((r) => r.phone && existingPhones.has(r.phone)).length ?? 0;

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    setFileName(file.name);
    try {
      const p = await parseImport(file, crm.stages);
      if (!p.recognized.length) setError("Не нашли знакомых колонок. Скачайте шаблон — в нём правильные заголовки.");
      setParsed(p);
    } catch {
      setError("Не удалось прочитать файл. Поддерживаются .xlsx, .xls и .csv");
    }
  }

  async function run() {
    if (!parsed) return;
    setBusy(true);
    const rows = skipDupes ? parsed.rows.filter((r) => !r.phone || !existingPhones.has(r.phone)) : parsed.rows;
    const n = await crm.importLeads(rows);
    setBusy(false);
    setDone(n);
  }

  return (
    <Modal title="Загрузить из Excel" onClose={onClose}>
      {done != null ? (
        <div className="space-y-4 text-center">
          <p className="text-lg font-semibold">Загружено заявок: {done}</p>
          <button className="btn-primary" onClick={onClose}>Закрыть</button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Заявки попадут в воронку «{crm.pipeline?.name}». Колонки: Имя, Телефон, Instagram, Email, Источник, Сумма, Этап, Заметка.
            Если этап не указан или не найден — заявка встанет в первый этап.
          </p>
          <button className="btn-outline w-full" onClick={downloadTemplate}>
            <FileSpreadsheet size={16} /> Скачать шаблон
          </button>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line p-6 text-sm text-muted hover:border-accent/50">
            <Upload size={22} />
            {fileName || "Выбрать файл .xlsx / .csv"}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {parsed && parsed.recognized.length > 0 && (
            <div className="rounded-lg bg-black/[0.03] p-3 text-sm">
              <p>Найдено заявок: <b>{parsed.rows.length}</b>{parsed.skipped > 0 && ` (пустых строк пропущено: ${parsed.skipped})`}</p>
              <p className="text-muted">Колонки: {parsed.recognized.join(", ")}</p>
              {dupes > 0 && (
                <label className="mt-2 flex items-center gap-2">
                  <input type="checkbox" checked={skipDupes} onChange={(e) => setSkipDupes(e.target.checked)} className="accent-accent" />
                  Пропустить {dupes} с уже существующими телефонами
                </label>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose}>Отмена</button>
            <button className="btn-accent" disabled={!parsed?.rows.length || busy} onClick={run}>
              {busy ? "Загружаем…" : "Загрузить заявки"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
