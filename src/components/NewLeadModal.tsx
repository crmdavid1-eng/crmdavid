"use client";

import { useState } from "react";
import { Field, Modal } from "@/components/Modal";
import { SOURCES, type Lead, type Stage } from "@/lib/types";
import { normalizePhone } from "@/lib/format";
import type { LeadInput } from "@/lib/useCrm";

export function NewLeadModal({
  stages,
  stageId,
  onClose,
  onCreate,
}: {
  stages: Stage[];
  stageId?: string;
  onClose: () => void;
  onCreate: (input: LeadInput) => Promise<Lead | null>;
}) {
  const [f, setF] = useState({
    name: "",
    phone: "",
    instagram: "",
    source: "Instagram",
    amount: "",
    note: "",
    stage_id: stageId ?? stages[0]?.id ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const lead = await onCreate({
      name: f.name.trim(),
      phone: normalizePhone(f.phone),
      instagram: f.instagram.trim() || null,
      source: f.source || null,
      amount: f.amount ? Number(f.amount.replace(/\s/g, "")) : null,
      note: f.note.trim() || null,
      stage_id: f.stage_id,
    });
    setSaving(false);
    if (lead) onClose();
  }

  return (
    <Modal title="Новая заявка" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Имя">
          <input className="input" autoFocus value={f.name} onChange={set("name")} placeholder="Как зовут клиента" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Телефон">
            <input className="input" type="tel" value={f.phone} onChange={set("phone")} placeholder="+7 7XX XXX XX XX" />
          </Field>
          <Field label="Instagram">
            <input className="input" value={f.instagram} onChange={set("instagram")} placeholder="@username" />
          </Field>
          <Field label="Источник">
            <select className="input" value={f.source} onChange={set("source")}>
              <option value="">—</option>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Сумма, ₸">
            <input className="input" inputMode="numeric" value={f.amount} onChange={set("amount")} placeholder="0" />
          </Field>
        </div>
        <Field label="Этап">
          <select className="input" value={f.stage_id} onChange={set("stage_id")}>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Заметка">
          <textarea className="input min-h-20" value={f.note} onChange={set("note")} placeholder="Что хочет клиент" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Отмена</button>
          <button className="btn-accent" disabled={saving || (!f.name.trim() && !f.phone.trim() && !f.instagram.trim())}>
            {saving ? "Создаём…" : "Создать заявку"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
