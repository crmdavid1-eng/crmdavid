"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightLeft, AtSign, MessageCircle, Phone, Send, Sparkles, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { SOURCES, type Activity, type Lead, type Stage } from "@/lib/types";
import { formatDate, igLink, normalizePhone, waLink } from "@/lib/format";
import type { LeadInput } from "@/lib/useCrm";

export function LeadDrawer({
  lead,
  stages,
  onClose,
  onUpdate,
  onDelete,
}: {
  lead: Lead;
  stages: Stage[];
  onClose: () => void;
  onUpdate: (id: string, patch: LeadInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const sb = supabase();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [comment, setComment] = useState("");

  const loadActivities = useCallback(async () => {
    const { data } = await sb
      .from("activities")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setActivities(data ?? []);
  }, [sb, lead.id]);

  useEffect(() => {
    let alive = true;
    sb.from("activities")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }: { data: Activity[] | null }) => alive && setActivities(data ?? []));
    return () => { alive = false; };
  }, [sb, lead.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    const body = comment.trim();
    if (!body) return;
    setComment("");
    const { data } = await sb.from("activities").insert({ lead_id: lead.id, kind: "comment", body }).select().single();
    if (data) setActivities((a) => [data, ...a]);
  }

  async function removeActivity(id: string) {
    setActivities((a) => a.filter((x) => x.id !== id));
    await sb.from("activities").delete().eq("id", id);
  }

  async function remove() {
    if (!confirm("Удалить заявку вместе с комментариями?")) return;
    await onDelete(lead.id);
    onClose();
  }

  const save = (patch: LeadInput) => {
    const changed = Object.entries(patch).some(([k, v]) => lead[k as keyof Lead] !== v);
    if (!changed) return;
    const done = onUpdate(lead.id, patch);
    if (patch.stage_id) done.then(loadActivities);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onMouseDown={onClose}>
      <aside
        className="flex h-full w-full flex-col bg-panel shadow-2xl sm:max-w-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <EditableText
            className="flex-1 text-lg font-semibold"
            value={lead.name}
            placeholder="Имя клиента"
            onSave={(name) => save({ name })}
          />
          <button onClick={remove} className="btn-ghost p-2 text-red-600" title="Удалить">
            <Trash2 size={18} />
          </button>
          <button onClick={onClose} className="btn-ghost p-2" aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>

        <div className="scroll-thin flex-1 overflow-y-auto">
          {/* Этапы */}
          <div className="flex flex-wrap gap-1.5 px-4 pt-4">
            {stages.map((s) => {
              const on = s.id === lead.stage_id;
              return (
                <button
                  key={s.id}
                  onClick={() => save({ stage_id: s.id })}
                  className="rounded-full border px-3 py-1 text-xs font-medium transition"
                  style={
                    on
                      ? { background: s.color, borderColor: s.color, color: "#fff" }
                      : { borderColor: "var(--color-line)", color: "var(--color-ink)" }
                  }
                >
                  {s.name}
                </button>
              );
            })}
          </div>

          {/* Быстрые действия */}
          {(lead.phone || lead.instagram) && (
            <div className="flex gap-2 px-4 pt-3">
              {lead.phone && (
                <>
                  <a href={`tel:${lead.phone}`} className="btn-outline flex-1"><Phone size={16} /> Позвонить</a>
                  <a href={waLink(lead.phone)} target="_blank" rel="noreferrer" className="btn-outline flex-1 text-emerald-700">
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                </>
              )}
              {lead.instagram && (
                <a href={igLink(lead.instagram)} target="_blank" rel="noreferrer" className="btn-outline flex-1 text-pink-600">
                  <AtSign size={16} /> Instagram
                </a>
              )}
            </div>
          )}

          {/* Поля */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 p-4">
            <Prop label="Телефон">
              <EditableText value={lead.phone ?? ""} placeholder="—" type="tel" onSave={(v) => save({ phone: normalizePhone(v) })} />
            </Prop>
            <Prop label="Instagram">
              <EditableText value={lead.instagram ?? ""} placeholder="—" onSave={(v) => save({ instagram: v.trim() || null })} />
            </Prop>
            <Prop label="Сумма, ₸">
              <EditableText
                value={lead.amount != null ? String(lead.amount) : ""}
                placeholder="—"
                inputMode="numeric"
                onSave={(v) => {
                  const n = Number(v.replace(/[^\d.,]/g, "").replace(",", "."));
                  save({ amount: v.trim() && !Number.isNaN(n) ? n : null });
                }}
              />
            </Prop>
            <Prop label="Источник">
              <select
                className="w-full rounded-md bg-transparent px-2 py-1.5 outline-none hover:bg-black/[0.03] focus:bg-white focus:ring-2 focus:ring-accent/15"
                value={lead.source ?? ""}
                onChange={(e) => save({ source: e.target.value || null })}
              >
                <option value="">—</option>
                {[...new Set([...SOURCES, ...(lead.source ? [lead.source] : [])])].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Prop>
            <Prop label="Email" full>
              <EditableText value={lead.email ?? ""} placeholder="—" type="email" onSave={(v) => save({ email: v.trim() || null })} />
            </Prop>
            <Prop label="Заметка" full>
              <EditableText
                multiline
                value={lead.note ?? ""}
                placeholder="Что важно знать о клиенте"
                onSave={(v) => save({ note: v.trim() || null })}
              />
            </Prop>
            <p className="col-span-2 px-2 text-xs text-muted">Создана {formatDate(lead.created_at)}</p>
          </div>

          {/* Лента */}
          <div className="border-t border-line px-4 py-4">
            <h3 className="mb-3 text-sm font-semibold">Комментарии и история</h3>
            <ul className="space-y-3">
              {activities.map((a) => (
                <ActivityItem key={a.id} a={a} onDelete={() => removeActivity(a.id)} />
              ))}
              {!activities.length && <li className="text-sm text-muted">Пока пусто</li>}
            </ul>
          </div>
        </div>

        <form onSubmit={addComment} className="flex items-end gap-2 border-t border-line p-3">
          <textarea
            className="input max-h-40 min-h-[42px] flex-1 resize-none"
            rows={1}
            value={comment}
            placeholder="Написать комментарий…"
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
                e.preventDefault();
                addComment(e);
              }
            }}
          />
          <button className="btn-primary h-[42px] w-[42px] p-0" disabled={!comment.trim()} aria-label="Отправить">
            <Send size={16} />
          </button>
        </form>
      </aside>
    </div>
  );
}

function Prop({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="px-2 text-xs text-muted">{label}</div>
      {children}
    </div>
  );
}

function ActivityItem({ a, onDelete }: { a: Activity; onDelete: () => void }) {
  if (a.kind === "comment" || a.kind === "message_in" || a.kind === "message_out") {
    const tone =
      a.kind === "message_in" ? "bg-emerald-50 border-emerald-100" : a.kind === "message_out" ? "bg-accent-soft border-indigo-100" : "bg-amber-50/60 border-amber-100";
    return (
      <li className={`group rounded-lg border p-3 ${tone}`}>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted">
          <span>{a.kind === "message_in" ? "Входящее" : a.kind === "message_out" ? "Исходящее" : "Комментарий"}</span>
          <span>· {formatDate(a.created_at)}</span>
          {a.kind === "comment" && (
            <button onClick={onDelete} className="ml-auto opacity-0 transition group-hover:opacity-100 hover:text-red-600" title="Удалить">
              <Trash2 size={13} />
            </button>
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm">{a.body}</p>
      </li>
    );
  }
  const Icon = a.kind === "stage" ? ArrowRightLeft : Sparkles;
  return (
    <li className="flex items-start gap-2 px-1 text-xs text-muted">
      <Icon size={13} className="mt-0.5 shrink-0" />
      <span className="flex-1 whitespace-pre-wrap">{a.body}</span>
      <span className="shrink-0">{formatDate(a.created_at)}</span>
    </li>
  );
}

function EditableText({
  value,
  onSave,
  placeholder,
  className = "",
  multiline,
  type = "text",
  inputMode,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const [v, setV] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setV(value);
  }
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (multiline && ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [v, multiline]);

  const cls = `w-full rounded-md bg-transparent px-2 py-1.5 outline-none placeholder:text-muted/60 hover:bg-black/[0.03] focus:bg-white focus:ring-2 focus:ring-accent/15 ${className}`;
  const commit = () => v !== value && onSave(v);

  if (multiline) {
    return (
      <textarea ref={ref} rows={2} className={`${cls} resize-none`} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} />
    );
  }
  return (
    <input
      className={cls}
      type={type}
      inputMode={inputMode}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}
