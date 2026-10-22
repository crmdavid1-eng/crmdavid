"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useCrm } from "@/lib/crm";
import { STAGE_COLORS, STAGE_KIND_LABEL, type StageKind } from "@/lib/types";

export function PipelineSettings() {
  const crm = useCrm();
  const [newPipeline, setNewPipeline] = useState("");
  const [newStage, setNewStage] = useState("");
  const { stages, leads } = crm;

  function move(i: number, dir: -1 | 1) {
    const ids = stages.map((s) => s.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    crm.reorderStages(ids);
  }

  async function removeStage(id: string) {
    if (stages.length <= 1) return alert("В воронке должен остаться хотя бы один этап");
    const count = leads.filter((l) => l.stage_id === id).length;
    const target = stages.find((s) => s.id !== id)!;
    if (count) {
      if (!confirm(`На этапе ${count} заявок. Перенести их в «${target.name}» и удалить этап?`)) return;
      await crm.deleteStage(id, target.id);
    } else {
      if (!confirm("Удалить этап?")) return;
      await crm.deleteStage(id, null);
    }
  }

  async function removePipeline(id: string, name: string) {
    if (crm.pipelines.length <= 1) return alert("Нельзя удалить единственную воронку");
    const n = leads.filter((l) => l.pipeline_id === id).length;
    if (!confirm(`Удалить воронку «${name}»${n ? ` и ${n} заявок в ней` : ""}? Это необратимо.`)) return;
    await crm.deletePipeline(id);
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Воронки</h3>
        <p className="mb-3 text-xs text-muted">Например, отдельные воронки для продаж и для консультаций. Выберите воронку, чтобы настроить её этапы.</p>
        <ul className="space-y-1.5">
          {crm.pipelines.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <input
                type="radio"
                name="pipeline"
                checked={p.id === crm.pipelineId}
                onChange={() => crm.setPipelineId(p.id)}
                className="accent-accent"
                aria-label={`Настраивать воронку ${p.name}`}
              />
              <input
                key={p.id + p.name}
                className="input py-1.5"
                defaultValue={p.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && crm.renamePipeline(p.id, e.target.value.trim())}
              />
              <span className="w-10 shrink-0 text-center text-xs text-muted tabular-nums" title="Заявок">
                {leads.filter((l) => l.pipeline_id === p.id).length}
              </span>
              <button onClick={() => removePipeline(p.id, p.name)} className="btn-ghost p-2 text-muted hover:text-danger" aria-label="Удалить воронку">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newPipeline.trim()) return;
            crm.createPipeline(newPipeline.trim());
            setNewPipeline("");
          }}
        >
          <input className="input py-1.5" placeholder="Название новой воронки" value={newPipeline} onChange={(e) => setNewPipeline(e.target.value)} />
          <button className="btn-outline shrink-0"><Plus size={16} /> Добавить</button>
        </form>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Этапы воронки «{crm.pipeline?.name}»</h3>
        <p className="mb-3 text-xs text-muted">
          Тип «Успех» отмечает оплату, «Отказ» — потерянную заявку. По ним считается конверсия и выручка в аналитике.
        </p>
        <ul className="space-y-1.5">
          {stages.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted hover:text-ink disabled:opacity-20" aria-label="Выше"><ChevronUp size={16} /></button>
                <button onClick={() => move(i, 1)} disabled={i === stages.length - 1} className="text-muted hover:text-ink disabled:opacity-20" aria-label="Ниже"><ChevronDown size={16} /></button>
              </div>
              <ColorPicker value={s.color} onChange={(color) => crm.updateStage(s.id, { color })} />
              <input
                key={s.id + s.name}
                className="input min-w-0 py-1.5"
                defaultValue={s.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && crm.updateStage(s.id, { name: e.target.value.trim() })}
              />
              <select
                value={s.kind}
                onChange={(e) => crm.updateStage(s.id, { kind: e.target.value as StageKind })}
                className="shrink-0 rounded-lg border border-line bg-panel px-2 py-1.5 text-sm outline-none"
                aria-label="Тип этапа"
              >
                {(Object.keys(STAGE_KIND_LABEL) as StageKind[]).map((k) => <option key={k} value={k}>{STAGE_KIND_LABEL[k]}</option>)}
              </select>
              <span className="hidden w-8 shrink-0 text-center text-xs text-muted tabular-nums sm:block" title="Заявок на этапе">
                {leads.filter((l) => l.stage_id === s.id).length}
              </span>
              <button onClick={() => removeStage(s.id)} className="btn-ghost shrink-0 p-2 text-muted hover:text-danger" aria-label="Удалить этап">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newStage.trim()) return;
            crm.createStage(newStage.trim(), STAGE_COLORS[stages.length % STAGE_COLORS.length]);
            setNewStage("");
          }}
        >
          <input className="input py-1.5" placeholder="Название нового этапа" value={newStage} onChange={(e) => setNewStage(e.target.value)} />
          <button className="btn-outline shrink-0"><Plus size={16} /> Добавить</button>
        </form>
      </div>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="h-7 w-7 rounded-full border-2 border-panel shadow ring-1 ring-line"
        style={{ background: value }}
        aria-label="Цвет этапа"
      />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-9 left-0 z-20 grid w-44 grid-cols-5 gap-2 rounded-xl border border-line bg-panel p-3 shadow-lg">
            {STAGE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { onChange(c); setOpen(false); }}
                className={`h-6 w-6 rounded-full ${c === value ? "ring-2 ring-ink ring-offset-2 ring-offset-panel" : ""}`}
                style={{ background: c }}
                aria-label={`Цвет ${c}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
