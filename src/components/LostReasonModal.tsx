"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useCrm } from "@/lib/crm";
import { LOST_REASONS } from "@/lib/types";

/** Спрашивает причину отказа при переносе заявки в этап типа «Отказ». */
export function LostReasonModal() {
  const crm = useCrm();
  const [custom, setCustom] = useState("");
  const ask = crm.lostAsk;
  if (!ask) return null;
  const lead = crm.leads.find((l) => l.id === ask.id);
  const stage = crm.stageById.get(ask.stageId);

  return (
    <Modal title="Почему отказ?" onClose={crm.cancelLost}>
      <p className="mb-3 text-sm text-muted">
        {lead?.name || "Заявка"} переходит в «{stage?.name}». Причина попадёт в историю и в аналитику: так видно, что чаще всего мешает продаже.
      </p>
      <div className="flex flex-wrap gap-2">
        {LOST_REASONS.map((r) => (
          <button key={r} className="btn-outline" onClick={() => crm.confirmLost(r)}>{r}</button>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim()) crm.confirmLost(custom.trim());
        }}
      >
        <input className="input" placeholder="Своя причина" value={custom} onChange={(e) => setCustom(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={!custom.trim()}>Сохранить</button>
      </form>
      <div className="mt-4 flex justify-between">
        <button className="btn-ghost text-muted" onClick={crm.cancelLost}>Не переносить</button>
        <button className="btn-ghost text-muted" onClick={() => crm.confirmLost(null)}>Без причины</button>
      </div>
    </Modal>
  );
}
