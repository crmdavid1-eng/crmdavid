"use client";

import { useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Field, Modal } from "@/components/Modal";
import { useCrm } from "@/lib/crm";
import { SOURCES, type Lead } from "@/lib/types";
import { normalizePhone, quickDue } from "@/lib/format";

const STEPS = [
  { key: "", label: "Без срока" },
  { key: "evening", label: "Сегодня" },
  { key: "tomorrow", label: "Завтра" },
  { key: "3days", label: "Через 3 дня" },
] as const;

export function NewLeadModal({
  stageId,
  onClose,
  onCreated,
}: {
  stageId?: string;
  onClose: () => void;
  onCreated: (lead: Lead) => void;
}) {
  const crm = useCrm();
  const [f, setF] = useState({
    name: "",
    phone: "",
    instagram: "",
    source: "Instagram",
    amount: "",
    note: "",
    stage_id: stageId ?? crm.stages[0]?.id ?? "",
  });
  const [step, setStep] = useState<(typeof STEPS)[number]["key"]>("evening");
  const [stepText, setStepText] = useState("Связаться");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  const phone = normalizePhone(f.phone);
  const ig = f.instagram.trim().replace(/^@/, "").toLowerCase();
  const duplicate = useMemo(
    () =>
      crm.leads.find(
        (l) => (phone && phone.length >= 11 && l.phone === phone) || (ig.length >= 3 && l.instagram?.replace(/^@/, "").toLowerCase() === ig),
      ),
    [crm.leads, phone, ig],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const lead = await crm.createLead({
      name: f.name.trim(),
      phone,
      instagram: f.instagram.trim() || null,
      source: f.source || null,
      amount: f.amount ? Number(f.amount.replace(/[^\d.]/g, "")) : null,
      note: f.note.trim() || null,
      stage_id: f.stage_id,
      ...(step ? { next_action: stepText.trim() || "Связаться", next_action_at: quickDue(step).toISOString() } : {}),
    });
    setSaving(false);
    if (lead) {
      onClose();
      onCreated(lead);
    }
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
            <input className="input" value={f.instagram} onChange={set("instagram")} placeholder="@username" autoCapitalize="none" />
          </Field>
        </div>

        {duplicate && (
          <div className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <p className="flex-1">
              Такой клиент уже есть: <b>{duplicate.name || duplicate.phone}</b>, этап «{crm.stageById.get(duplicate.stage_id)?.name}».
            </p>
            <button
              type="button"
              className="shrink-0 font-semibold underline-offset-2 hover:underline"
              onClick={() => { onClose(); crm.openLead(duplicate.id); }}
            >
              Открыть
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Источник">
            <select className="input" value={f.source} onChange={set("source")}>
              <option value="">Не указан</option>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Сумма, ₸">
            <input className="input" inputMode="numeric" value={f.amount} onChange={set("amount")} placeholder="0" />
          </Field>
        </div>
        <Field label="Этап">
          <select className="input" value={f.stage_id} onChange={set("stage_id")}>
            {crm.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Заметка">
          <textarea className="input min-h-16" value={f.note} onChange={set("note")} placeholder="Что хочет клиент" />
        </Field>

        <div>
          <span className="mb-1 block text-xs font-medium text-muted">Следующий шаг</span>
          <div className="flex gap-2">
            <input className="input min-w-0 flex-1" value={stepText} onChange={(e) => setStepText(e.target.value)} disabled={!step} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STEPS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStep(s.key)}
                aria-pressed={step === s.key}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  step === s.key ? "border-ink bg-ink text-bg" : "border-line hover:border-ink/30"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

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
