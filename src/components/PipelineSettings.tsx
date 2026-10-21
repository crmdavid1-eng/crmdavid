"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { STAGE_COLORS } from "@/lib/types";
import type { Crm } from "@/lib/useCrm";

export function PipelineSettings({ crm, onClose }: { crm: Crm; onClose: () => void }) {
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
    const others = stages.filter((s) => s.id !== id);
    if (count) {
      const target = others[0];
      if (!confirm(`На этапе ${count} заявок. Перенести их в «${target.name}» и удалить этап?`)) return;
      await crm.deleteStage(id, target.id);
    } else {
      if (!confirm("Удалить этап?")) return;
      await crm.deleteStage(id, null);
    }
  }

  async function removePipeline(id: string, name: string) {
    if (crm.pipelines.length <= 1) return alert("Нельзя удалить единственную воронку");
    if (!confirm(`Удалить воронку «${name}» вместе со всеми её заявками? Это необратимо.`)) return;
    await crm.deletePipeline(id);
  }

  return (
    <Modal title="Воронки и этапы" onClose={onClose} wide>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Воронки</h3>
        <ul className="space-y-1.5">
          {crm.pipelines.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <input
                type="radio"
                name="pipeline"
                checked={p.id === crm.pipelineId}
                onChange={() => crm.setPipelineId(p.id)}
                className="accent-accent"
                title="Настраивать эту воронку"
              />
              <input
                className="input py-1.5"
                defaultValue={p.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && crm.renamePipeline(p.id, e.target.value.trim())}
              />
              <button onClick={() => removePipeline(p.id, p.name)} className="btn-ghost p-2 text-muted hover:text-red-600" title="Удалить воронку">
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
          <input className="input py-1.5" placeholder="Новая воронка" value={newPipeline} onChange={(e) => setNewPipeline(e.target.value)} />
          <button className="btn-outline shrink-0"><Plus size={16} /> Добавить</button>
        </form>
      </section>

      <section className="mt-6">
        <h3 className="mb-2 text-sm font-semibold">Этапы воронки «{crm.pipeline?.name}»</h3>
        <ul className="space-y-1.5">
          {stages.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted hover:text-ink disabled:opacity-20"><ChevronUp size={16} /></button>
                <button onClick={() => move(i, 1)} disabled={i === stages.length - 1} className="text-muted hover:text-ink disabled:opacity-20"><ChevronDown size={16} /></button>
              </div>
              <ColorPicker value={s.color} onChange={(color) => crm.updateStage(s.id, { color })} />
              <input
                key={s.id + s.name}
                className="input py-1.5"
                defaultValue={s.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && crm.updateStage(s.id, { name: e.target.value.trim() })}
              />
              <span className="w-8 shrink-0 text-center text-xs text-muted" title="Заявок на этапе">
                {leads.filter((l) => l.stage_id === s.id).length}
              </span>
              <button onClick={() => removeStage(s.id)} className="btn-ghost p-2 text-muted hover:text-red-600" title="Удалить этап">
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
          <input className="input py-1.5" placeholder="Новый этап" value={newStage} onChange={(e) => setNewStage(e.target.value)} />
          <button className="btn-outline shrink-0"><Plus size={16} /> Добавить</button>
        </form>
      </section>
    </Modal>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="h-7 w-7 rounded-full border-2 border-white shadow ring-1 ring-line"
        style={{ background: value }}
        aria-label="Цвет этапа"
      />
      {open && (
        <div className="absolute left-0 top-9 z-10 grid w-44 grid-cols-5 gap-2 rounded-xl border border-line bg-panel p-3 shadow-lg">
          {STAGE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { onChange(c); setOpen(false); }}
              className={`h-6 w-6 rounded-full ${c === value ? "ring-2 ring-ink ring-offset-2" : ""}`}
              style={{ background: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
