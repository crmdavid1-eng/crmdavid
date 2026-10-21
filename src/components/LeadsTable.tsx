"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Lead, Stage } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/format";

type SortKey = "created_at" | "name" | "amount" | "stage";

export function LeadsTable({
  stages,
  leads,
  onOpen,
  onStage,
}: {
  stages: Stage[];
  leads: Lead[];
  onOpen: (l: Lead) => void;
  onStage: (id: string, stageId: string) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "created_at", asc: false });
  const stageIndex = useMemo(() => new Map(stages.map((s, i) => [s.id, i])), [stages]);
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const rows = useMemo(() => {
    const r = [...leads];
    const dir = sort.asc ? 1 : -1;
    r.sort((a, b) => {
      switch (sort.key) {
        case "name": return dir * a.name.localeCompare(b.name, "ru");
        case "amount": return dir * ((a.amount ?? -1) - (b.amount ?? -1));
        case "stage": return dir * ((stageIndex.get(a.stage_id) ?? 0) - (stageIndex.get(b.stage_id) ?? 0));
        default: return dir * a.created_at.localeCompare(b.created_at);
      }
    });
    return r;
  }, [leads, sort, stageIndex]);

  const th = (k: SortKey, children: React.ReactNode, className = "") => (
    <th className={`px-3 py-2 font-medium ${className}`}>
      <button
        className="inline-flex items-center gap-1 hover:text-ink"
        onClick={() => setSort((s) => ({ key: k, asc: s.key === k ? !s.asc : k !== "created_at" }))}
      >
        {children}
        {sort.key === k && (sort.asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );

  if (!leads.length) {
    return <p className="p-8 text-center text-sm text-muted">Заявок не найдено</p>;
  }

  return (
    <div className="h-full overflow-auto px-4 pb-4">
      {/* Мобильный вид — список */}
      <ul className="space-y-2 md:hidden">
        {rows.map((l) => {
          const s = stageById.get(l.stage_id);
          return (
            <li key={l.id} onClick={() => onOpen(l)} className="rounded-lg border border-line bg-panel p-3">
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate font-medium">{l.name || l.phone || "Без имени"}</span>
                {l.amount != null && <span className="text-sm font-semibold text-emerald-700">{formatMoney(l.amount)}</span>}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                {s && (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.name}
                  </span>
                )}
                {l.phone && <span>· {l.phone}</span>}
                <span className="ml-auto">{formatDate(l.created_at)}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Десктоп — таблица */}
      <table className="hidden w-full overflow-hidden rounded-xl border border-line bg-panel text-sm md:table">
        <thead className="sticky top-0 border-b border-line bg-panel text-left text-xs text-muted">
          <tr>
            {th("name", "Имя")}
            <th className="px-3 py-2 font-medium">Телефон</th>
            <th className="px-3 py-2 font-medium">Instagram</th>
            {th("stage", "Этап")}
            <th className="px-3 py-2 font-medium">Источник</th>
            {th("amount", "Сумма", "text-right")}
            {th("created_at", "Создана")}
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const s = stageById.get(l.stage_id);
            return (
              <tr key={l.id} onClick={() => onOpen(l)} className="cursor-pointer border-b border-line last:border-0 hover:bg-black/[0.02]">
                <td className="max-w-56 truncate px-3 py-2 font-medium">{l.name || "Без имени"}</td>
                <td className="whitespace-nowrap px-3 py-2">{l.phone}</td>
                <td className="max-w-40 truncate px-3 py-2">{l.instagram}</td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: s?.color }} />
                    <select
                      className="cursor-pointer bg-transparent outline-none"
                      value={l.stage_id}
                      onChange={(e) => onStage(l.id, e.target.value)}
                    >
                      {stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                    </select>
                  </span>
                </td>
                <td className="px-3 py-2 text-muted">{l.source}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{formatMoney(l.amount)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-muted">{formatDate(l.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
