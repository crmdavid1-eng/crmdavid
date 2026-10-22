"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useCrm } from "@/lib/crm";
import { downloadTemplate, exportLeads, parseImport, type ParsedImport } from "@/lib/excel";
import { plural } from "@/lib/format";
import { toast } from "@/lib/toast";

export function ImportPanel() {
  const crm = useCrm();
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [fileName, setFileName] = useState("");
  const [skipDupes, setSkipDupes] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const existingPhones = new Set(crm.leads.map((l) => l.phone).filter(Boolean));
  const dupes = parsed?.rows.filter((r) => r.phone && existingPhones.has(r.phone)).length ?? 0;

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    setFileName(file.name);
    try {
      const p = await parseImport(file, crm.stages);
      if (!p.recognized.length) setError("Не нашли знакомых колонок. Скачайте шаблон: в нём правильные заголовки.");
      setParsed(p);
    } catch {
      setError("Не удалось прочитать файл. Подходят .xlsx, .xls и .csv");
    }
  }

  async function run() {
    if (!parsed) return;
    setBusy(true);
    const rows = skipDupes ? parsed.rows.filter((r) => !r.phone || !existingPhones.has(r.phone)) : parsed.rows;
    const n = await crm.importLeads(rows);
    setBusy(false);
    setParsed(null);
    setFileName("");
    toast(`Загружено ${n} ${plural(n, "заявка", "заявки", "заявок")}`);
  }

  function exportAll(scope: "pipeline" | "all") {
    const list = scope === "all" ? crm.leads : crm.pipelineLeads;
    const date = new Date().toISOString().slice(0, 10);
    const name = scope === "all" ? "все-воронки" : (crm.pipeline?.name ?? "crm");
    exportLeads(list, crm.allStages, `заявки-${name}-${date}.xlsx`, crm.pipelines).then(() =>
      toast(`Выгружено ${list.length} ${plural(list.length, "заявка", "заявки", "заявок")}`),
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Выгрузить в Excel</h3>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline" onClick={() => exportAll("pipeline")}>
            <Download size={16} /> Воронка «{crm.pipeline?.name}»
          </button>
          {crm.pipelines.length > 1 && (
            <button className="btn-outline" onClick={() => exportAll("all")}><Download size={16} /> Все воронки</button>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold">Загрузить из Excel</h3>
        <p className="mb-3 text-xs text-muted">
          Заявки попадут в воронку «{crm.pipeline?.name}». Колонки: Имя, Телефон, Instagram, Email, Источник, Сумма, Этап, Заметка, Теги.
          Если этап не указан или не найден, заявка встанет в первый этап.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line p-5 text-sm text-muted hover:border-accent/50">
            <Upload size={18} />
            {fileName || "Выбрать файл .xlsx или .csv"}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          <button className="btn-ghost text-muted" onClick={downloadTemplate}>
            <FileSpreadsheet size={16} /> Скачать шаблон
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        {parsed && parsed.recognized.length > 0 && (
          <div className="mt-3 rounded-lg bg-sunken p-3 text-sm">
            <p>
              Найдено заявок: <b>{parsed.rows.length}</b>
              {parsed.skipped > 0 && <span className="text-muted"> (пустых строк пропущено: {parsed.skipped})</span>}
            </p>
            <p className="text-xs text-muted">Колонки: {parsed.recognized.join(", ")}</p>
            {dupes > 0 && (
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" checked={skipDupes} onChange={(e) => setSkipDupes(e.target.checked)} className="accent-accent" />
                Пропустить {dupes} с телефонами, которые уже есть в CRM
              </label>
            )}
            <button className="btn-accent mt-3" disabled={!parsed.rows.length || busy} onClick={run}>
              {busy ? "Загружаем…" : "Загрузить заявки"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
