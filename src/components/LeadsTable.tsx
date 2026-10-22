"use client";

import { useMemo, useState } from "react";
import { AlarmClock, ArrowDown, ArrowUp, Download, Trash2, X } from "lucide-react";
import { useCrm } from "@/lib/crm";
import type { Lead } from "@/lib/types";
import { dueStatus, formatDate, formatDue, formatMoney, formatPhone, plural } from "@/lib/format";
import { exportLeads } from "@/lib/excel";
import { toast } from "@/lib/toast";

type SortKey = "created_at" | "name" | "amount" | "stage" | "next";

const DUE_TEXT = { overdue: "text-danger font-medium", today: "text-warn font-medium", tomorrow: "text-accent", later: "text-muted" };

export function LeadsTable({ leads }: { leads: Lead[] }) {
  const crm = useCrm();
  const { stages, stageById } = crm;
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "created_at", asc: false });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const stageIndex = useMemo(() => new Map(stages.map((s, i) => [s.id, i])), [stages]);

  const rows = useMemo(() => {
    const r = [...leads];
    const dir = sort.asc ? 1 : -1;
    r.sort((a, b) => {
      switch (sort.key) {
        case "name": return dir * a.name.localeCompare(b.name, "ru");
        case "amount": return dir * ((a.amount ?? -1) - (b.amount ?? -1));
        case "stage": return dir * ((stageIndex.get(a.stage_id) ?? 0) - (stageIndex.get(b.stage_id) ?? 0));
        case "next": return dir * ((a.next_action_at ?? "9999").localeCompare(b.next_action_at ?? "9999"));
        default: return dir * a.created_at.localeCompare(b.created_at);
      }
    });
    return r;
  }, [leads, sort, stageIndex]);

  // Выбор действует только на видимые строки
  const visibleSelected = rows.filter((l) => selected.has(l.id));
  const allOn = rows.length > 0 && visibleSelected.length === rows.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  async function bulkStage(stageId: string) {
    await Promise.all(visibleSelected.map((l) => crm.updateLead(l.id, { stage_id: stageId })));
    toast(`Перенесено: ${visibleSelected.length}`);
    setSelected(new Set());
  }
  async function bulkDelete() {
    const n = visibleSelected.length;
    if (!confirm(`Удалить ${n} ${plural(n, "заявку", "заявки", "заявок")}? Это необратимо.`)) return;
    await crm.deleteLeads(visibleSelected.map((l) => l.id));
    toast(`Удалено: ${n}`);
    setSelected(new Set());
  }

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
    return <p className="p-8 text-center text-sm text-muted">Ничего не нашлось. Измените поиск или сбросьте фильтры.</p>;
  }

  return (
    <div className="flex h-full flex-col">
      {visibleSelected.length > 0 && (
        <div className="sheet-in mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-ink px-3 py-2 text-sm text-bg md:mx-6">
          <button onClick={() => setSelected(new Set())} aria-label="Снять выбор" className="opacity-70 hover:opacity-100"><X size={16} /></button>
          <span className="font-medium">Выбрано: {visibleSelected.length}</span>
          <select
            className="ml-auto cursor-pointer rounded-md bg-bg/15 px-2 py-1 outline-none"
            value=""
            onChange={(e) => e.target.value && bulkStage(e.target.value)}
            aria-label="Перенести в этап"
          >
            <option value="">Перенести в этап…</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button
            className="inline-flex items-center gap-1 rounded-md bg-bg/15 px-2 py-1 hover:bg-bg/25"
            onClick={() => exportLeads(visibleSelected, crm.allStages, "заявки-выбранные.xlsx")}
          >
            <Download size={14} /> Выгрузить
          </button>
          <button className="inline-flex items-center gap-1 rounded-md bg-danger px-2 py-1 text-white" onClick={bulkDelete}>
            <Trash2 size={14} /> Удалить
          </button>
        </div>
      )}

      <div className="scroll-thin min-h-0 flex-1 overflow-auto px-4 pb-4 md:px-6">
        {/* Телефон — список */}
        <ul className="space-y-2 md:hidden">
          {rows.map((l) => {
            const s = stageById.get(l.stage_id);
            const due = dueStatus(l.next_action_at);
            return (
              <li key={l.id} onClick={() => crm.openLead(l.id)} className="rounded-lg border border-line bg-panel p-3">
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate font-medium">{l.name || formatPhone(l.phone) || "Без имени"}</span>
                  {l.amount != null && <span className="text-sm font-semibold text-money tabular-nums">{formatMoney(l.amount)}</span>}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                  {s && (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.name}
                    </span>
                  )}
                  {due && l.next_action_at ? (
                    <span className={`ml-auto inline-flex items-center gap-1 ${DUE_TEXT[due]}`}>
                      <AlarmClock size={11} /> {formatDue(l.next_action_at)}
                    </span>
                  ) : (
                    <span className="ml-auto">{formatDate(l.created_at)}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Компьютер — таблица */}
        <table className="hidden w-full overflow-hidden rounded-xl border border-line bg-panel text-sm md:table">
          <thead className="sticky top-0 z-[1] border-b border-line bg-panel text-left text-xs text-muted">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={allOn}
                  onChange={() => setSelected(allOn ? new Set() : new Set(rows.map((l) => l.id)))}
                  aria-label="Выбрать все"
                />
              </th>
              {th("name", "Имя")}
              <th className="px-3 py-2 font-medium">Телефон</th>
              {th("stage", "Этап")}
              {th("next", "Следующий шаг")}
              <th className="px-3 py-2 font-medium">Источник</th>
              {th("amount", "Сумма", "text-right")}
              {th("created_at", "Создана")}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const s = stageById.get(l.stage_id);
              const due = dueStatus(l.next_action_at);
              const on = selected.has(l.id);
              return (
                <tr
                  key={l.id}
                  onClick={() => crm.openLead(l.id)}
                  className={`cursor-pointer border-b border-line last:border-0 ${on ? "bg-accent-soft" : "hover:bg-sunken"}`}
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="accent-accent" checked={on} onChange={() => toggle(l.id)} aria-label={`Выбрать ${l.name}`} />
                  </td>
                  <td className="max-w-56 px-3 py-2">
                    <span className="block truncate font-medium">{l.name || "Без имени"}</span>
                    {l.tags.length > 0 && <span className="block truncate text-xs text-muted">{l.tags.map((t) => `#${t}`).join(" ")}</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatPhone(l.phone)}</td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: s?.color }} />
                      <select
                        className="cursor-pointer bg-transparent outline-none [field-sizing:content]"
                        value={l.stage_id}
                        onChange={(e) => crm.updateLead(l.id, { stage_id: e.target.value })}
                        aria-label="Этап"
                      >
                        {stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                      </select>
                    </span>
                  </td>
                  <td className="max-w-56 px-3 py-2">
                    {due && l.next_action_at ? (
                      <>
                        <span className={`block text-xs whitespace-nowrap ${DUE_TEXT[due]}`}>{formatDue(l.next_action_at)}</span>
                        <span className="block truncate text-xs text-muted">{l.next_action}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted/60">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted">{l.source}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{formatMoney(l.amount)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted tabular-nums">{formatDate(l.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
