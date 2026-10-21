"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageCircle, Phone, Plus } from "lucide-react";
import type { Lead, Stage } from "@/lib/types";
import { formatDate, formatMoney, formatPhone, waLink } from "@/lib/format";

type Columns = Record<string, Lead[]>;

function group(stages: Stage[], leads: Lead[]): Columns {
  const cols: Columns = Object.fromEntries(stages.map((s) => [s.id, []]));
  for (const l of leads) cols[l.stage_id]?.push(l);
  for (const id in cols) cols[id].sort((a, b) => a.position - b.position);
  return cols;
}

function findColumn(cols: Columns, id: string) {
  if (id in cols) return id;
  return Object.keys(cols).find((k) => cols[k].some((l) => l.id === id));
}

function positionBetween(list: Lead[], index: number) {
  const prev = list[index - 1]?.position;
  const next = list[index + 1]?.position;
  if (prev == null && next == null) return 0;
  if (prev == null) return next! - 1;
  if (next == null) return prev + 1;
  return (prev + next) / 2;
}

export function Board({
  stages,
  leads,
  onMove,
  onOpen,
  onAdd,
}: {
  stages: Stage[];
  leads: Lead[];
  onMove: (id: string, stageId: string, position: number) => void;
  onOpen: (lead: Lead) => void;
  onAdd: (stageId: string) => void;
}) {
  const base = useMemo(() => group(stages, leads), [stages, leads]);
  const [dragCols, setDragCols] = useState<Columns | null>(null);
  const [active, setActive] = useState<Lead | null>(null);
  const cols = dragCols ?? base;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function onDragStart(e: DragStartEvent) {
    setActive(leads.find((l) => l.id === e.active.id) ?? null);
    setDragCols(base);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    setDragCols((c) => {
      if (!c) return c;
      const from = findColumn(c, String(active.id));
      const to = findColumn(c, String(over.id));
      if (!from || !to || from === to) return c;
      const item = c[from].find((l) => l.id === active.id)!;
      const target = c[to];
      const overIndex = target.findIndex((l) => l.id === over.id);
      const index = overIndex === -1 ? target.length : overIndex;
      return {
        ...c,
        [from]: c[from].filter((l) => l.id !== active.id),
        [to]: [...target.slice(0, index), { ...item, stage_id: to }, ...target.slice(index)],
      };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const c = dragCols;
    setActive(null);
    setDragCols(null);
    if (!over || !c) return;
    const col = findColumn(c, String(active.id));
    if (!col) return;
    let list = c[col];
    const oldIndex = list.findIndex((l) => l.id === active.id);
    const overIndex = list.findIndex((l) => l.id === over.id);
    const newIndex = overIndex === -1 ? oldIndex : overIndex;
    if (oldIndex !== newIndex) list = arrayMove(list, oldIndex, newIndex);

    const original = leads.find((l) => l.id === active.id);
    if (original?.stage_id === col && oldIndex === newIndex && base[col]?.[newIndex]?.id === active.id) return;
    onMove(String(active.id), col, positionBetween(list, newIndex));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => { setActive(null); setDragCols(null); }}
    >
      <div className="scroll-thin flex h-full snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 md:snap-none md:px-6">
        {stages.map((s) => (
          <Column key={s.id} stage={s} leads={cols[s.id] ?? []} onOpen={onOpen} onAdd={() => onAdd(s.id)} />
        ))}
      </div>
      <DragOverlay>{active && <Card lead={active} overlay />}</DragOverlay>
    </DndContext>
  );
}

function Column({ stage, leads, onOpen, onAdd }: { stage: Stage; leads: Lead[]; onOpen: (l: Lead) => void; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = leads.reduce((sum, l) => sum + (l.amount ?? 0), 0);

  return (
    <section
      id={`stage-${stage.id}`}
      className="flex h-full w-[86vw] shrink-0 snap-center flex-col overflow-hidden rounded-xl bg-white/45 sm:w-[17.5rem]"
      style={{ boxShadow: `inset 0 3px 0 ${stage.color}` }}
    >
      <header className="flex items-end gap-2 px-3 pt-3.5 pb-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{stage.name}</h2>
          <p className="h-4 text-xs text-money tabular-nums">{total > 0 ? formatMoney(total) : ""}</p>
        </div>
        <span className="text-2xl leading-none font-semibold tracking-tight tabular-nums" style={{ color: stage.color }}>
          {leads.length}
        </span>
      </header>
      <div
        ref={setNodeRef}
        className={`scroll-thin flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 transition-colors ${isOver ? "bg-accent/[0.06]" : ""}`}
      >
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((l) => (
            <SortableCard key={l.id} lead={l} onOpen={onOpen} />
          ))}
        </SortableContext>
        <button onClick={onAdd} className="btn-ghost shrink-0 justify-start text-muted hover:text-ink">
          <Plus size={16} /> Добавить заявку
        </button>
      </div>
    </section>
  );
}

function SortableCard({ lead, onOpen }: { lead: Lead; onOpen: (l: Lead) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg ${isDragging ? "opacity-30" : ""}`}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter") onOpen(lead);
      }}
    >
      <Card lead={lead} />
    </div>
  );
}

function Card({ lead, overlay }: { lead: Lead; overlay?: boolean }) {
  const title = lead.name || formatPhone(lead.phone) || lead.instagram || "Без имени";
  return (
    <article
      className={`cursor-pointer rounded-lg border border-line bg-panel px-3 py-2.5 transition-colors hover:border-ink/25 ${overlay ? "rotate-[1.5deg] border-ink/25 shadow-xl" : ""}`}
    >
      <div className="flex items-baseline gap-2">
        <h3 className="line-clamp-2 flex-1 text-[0.9rem] leading-snug font-medium">{title}</h3>
        {lead.amount != null && (
          <span className="shrink-0 text-xs font-semibold text-money tabular-nums">{formatMoney(lead.amount)}</span>
        )}
      </div>
      {lead.note && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{lead.note}</p>}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted">
        {lead.source && <span className="font-medium text-ink/70">{lead.source}</span>}
        <span className="ml-auto tabular-nums">{formatDate(lead.created_at)}</span>
      </div>
      {lead.phone && (
        <div className="-mx-1 mt-2 flex items-center gap-0.5 border-t border-line/70 pt-1.5">
          <span className="flex-1 truncate px-1 text-xs tabular-nums text-ink/80">{formatPhone(lead.phone)}</span>
          <a
            href={`tel:${lead.phone}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink"
            aria-label="Позвонить"
          >
            <Phone size={14} />
          </a>
          <a
            href={waLink(lead.phone)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded-md p-1.5 text-[#1a9e5c] hover:bg-[#1a9e5c]/10"
            aria-label="Написать в WhatsApp"
          >
            <MessageCircle size={14} />
          </a>
        </div>
      )}
    </article>
  );
}
