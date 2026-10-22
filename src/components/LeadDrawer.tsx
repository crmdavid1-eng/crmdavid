"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlarmClock, ArrowRightLeft, AtSign, Check, ChevronDown, CircleCheck, MessageCircle, Phone, Send, Sparkles, Trash2, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useCrm, type LeadInput } from "@/lib/crm";
import { SOURCES, type Activity, type Lead } from "@/lib/types";
import {
  daysSince, dueStatus, fillTemplate, formatDate, formatDue, igLink, normalizePhone, plural, quickDue, toLocalInput, waLink,
} from "@/lib/format";
import { toast } from "@/lib/toast";

export function LeadDrawer({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const crm = useCrm();
  const sb = supabase();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [comment, setComment] = useState("");
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const stages = crm.allStages.filter((s) => s.pipeline_id === lead.pipeline_id).sort((a, b) => a.position - b.position);
  const stage = crm.stageById.get(lead.stage_id);

  const loadActivities = useCallback(async () => {
    const { data } = await sb.from("activities").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(300);
    setActivities(data ?? []);
  }, [sb, lead.id]);

  useEffect(() => {
    let alive = true;
    sb.from("activities")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data }: { data: Activity[] | null }) => alive && setActivities(data ?? []));
    return () => { alive = false; };
  }, [sb, lead.id, crm.activityTick]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement).closest("input, textarea")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async (patch: LeadInput) => {
    const changed = Object.entries(patch).some(([k, v]) => JSON.stringify(lead[k as keyof Lead]) !== JSON.stringify(v));
    if (!changed) return;
    await crm.updateLead(lead.id, patch);
    if (patch.stage_id) loadActivities();
  };

  async function addComment(e?: React.FormEvent) {
    e?.preventDefault();
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
    if (!confirm("Удалить заявку вместе с историей?")) return;
    await crm.deleteLead(lead.id);
    toast("Заявка удалена");
    onClose();
  }

  async function sendWhatsApp(text?: string) {
    if (!lead.phone) return;
    window.open(waLink(lead.phone, text), "_blank", "noopener");
    if (text) {
      await crm.logActivity(lead.id, "message_out", text);
      loadActivities();
    }
  }

  async function changePipeline(pid: string) {
    if (pid === lead.pipeline_id) return;
    const first = crm.allStages.filter((s) => s.pipeline_id === pid).sort((a, b) => a.position - b.position)[0];
    if (!first) return;
    await save({ pipeline_id: pid, stage_id: first.id });
    toast(`Перенесено в «${crm.pipelines.find((p) => p.id === pid)?.name}»`);
  }

  const inStage = daysSince(lead.stage_changed_at);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onMouseDown={onClose}>
      <aside
        className="drawer-in flex h-full w-full flex-col bg-panel shadow-2xl sm:max-w-[34rem]"
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Карточка заявки"
      >
        <header className="flex items-center gap-1 border-b border-line px-3 py-2.5">
          <EditableText
            className="flex-1 text-lg font-semibold"
            value={lead.name}
            placeholder="Имя клиента"
            onSave={(name) => save({ name: name.trim() })}
          />
          <button onClick={remove} className="btn-ghost p-2 text-muted hover:text-danger" aria-label="Удалить заявку">
            <Trash2 size={18} />
          </button>
          <button onClick={onClose} className="btn-ghost p-2" aria-label="Закрыть">
            <X size={20} />
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
                  onClick={() => crm.changeStage(lead.id, s.id).then(loadActivities)}
                  aria-pressed={on}
                  className="rounded-full border px-3 py-1 text-xs font-medium transition hover:border-ink/30"
                  style={on ? { background: s.color, borderColor: s.color, color: "#fff" } : { borderColor: "var(--c-line)" }}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
          <p className="px-4 pt-2 text-xs text-muted">
            На этапе {inStage === 0 ? "с сегодняшнего дня" : `${inStage} ${plural(inStage, "день", "дня", "дней")}`}, создана {formatDate(lead.created_at)}
          </p>

          {/* Связаться */}
          {(lead.phone || lead.instagram) && (
            <div className="flex gap-2 px-4 pt-3">
              {lead.phone && (
                <>
                  <a href={`tel:${lead.phone}`} className="btn-outline min-w-0 flex-1 px-2"><Phone size={16} className="shrink-0" /> <span className="truncate">Позвонить</span></a>
                  <WhatsAppButton onSend={sendWhatsApp} lead={lead} />
                </>
              )}
              {lead.instagram && (
                <a href={igLink(lead.instagram)} target="_blank" rel="noreferrer" className="btn-outline min-w-0 flex-1 px-2 text-[#d62976]">
                  <AtSign size={16} className="shrink-0" /> <span className="truncate">Instagram</span>
                </a>
              )}
            </div>
          )}

          {/* Итог контакта в один клик */}
          {lead.phone && stage?.kind === "open" && (
            <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2 text-xs">
              <span className="text-muted">Итог:</span>
              {OUTCOMES.map((o) => (
                <button
                  key={o.label}
                  className="rounded-full border border-line px-2.5 py-1 font-medium transition hover:border-ink/30"
                  onClick={async () => {
                    await crm.logActivity(lead.id, "task", o.log);
                    if (o.next) await save({ next_action: o.next.text, next_action_at: quickDue(o.next.when).toISOString() });
                    loadActivities();
                    if (o.focusComment) commentRef.current?.focus();
                    toast(o.next ? `${o.log}. Следующий шаг: ${o.next.text.toLowerCase()}` : o.log);
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {/* Следующий шаг */}
          {(stage?.kind === "open" || lead.next_action_at) && (
            <NextStep
              key={lead.next_action_at ?? "none"}
              lead={lead}
              onSave={save}
              onDone={async () => { await crm.completeAction(lead); loadActivities(); toast("Отмечено как сделанное"); }}
            />
          )}

          {/* Поля */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-2 pt-3 pb-2">
            <Prop label="Телефон">
              <EditableText value={lead.phone ?? ""} placeholder="Добавить" type="tel" onSave={(v) => save({ phone: normalizePhone(v) })} />
            </Prop>
            <Prop label="Instagram">
              <EditableText value={lead.instagram ?? ""} placeholder="Добавить" onSave={(v) => save({ instagram: v.trim() || null })} />
            </Prop>
            <Prop label="Сумма, ₸">
              <EditableText
                value={lead.amount != null ? String(lead.amount) : ""}
                placeholder="Добавить"
                inputMode="numeric"
                onSave={(v) => {
                  const n = Number(v.replace(/[^\d.,]/g, "").replace(",", "."));
                  save({ amount: v.trim() && !Number.isNaN(n) ? n : null });
                }}
              />
            </Prop>
            <Prop label="Источник">
              <select
                className="w-full cursor-pointer rounded-md bg-transparent px-2 py-1.5 outline-none hover:bg-ink/[0.04] focus:bg-panel focus:ring-2 focus:ring-accent/15"
                value={lead.source ?? ""}
                onChange={(e) => save({ source: e.target.value || null })}
              >
                <option value="">Не указан</option>
                {[...new Set([...SOURCES, ...(lead.source ? [lead.source] : [])])].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Prop>
            <Prop label="Email">
              <EditableText value={lead.email ?? ""} placeholder="Добавить" type="email" onSave={(v) => save({ email: v.trim() || null })} />
            </Prop>
            <Prop label="Воронка">
              <select
                className="w-full cursor-pointer rounded-md bg-transparent px-2 py-1.5 outline-none hover:bg-ink/[0.04] focus:bg-panel focus:ring-2 focus:ring-accent/15"
                value={lead.pipeline_id}
                onChange={(e) => changePipeline(e.target.value)}
              >
                {crm.pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Prop>
            <Prop label="Теги" full>
              <TagInput
                tags={lead.tags}
                suggestions={[...new Set(crm.leads.flatMap((l) => l.tags))]}
                onChange={(tags) => save({ tags })}
              />
            </Prop>
            <Prop label="Заметка" full>
              <EditableText
                multiline
                value={lead.note ?? ""}
                placeholder="Что важно знать о клиенте: запрос, бюджет, возражения"
                onSave={(v) => save({ note: v.trim() || null })}
              />
            </Prop>
          </div>

          {/* История */}
          <div className="border-t border-line px-4 py-4">
            <h3 className="mb-3 text-sm font-semibold">История</h3>
            <ul className="space-y-3">
              {activities.map((a) => <ActivityItem key={a.id} a={a} onDelete={() => removeActivity(a.id)} />)}
              {!activities.length && <li className="text-sm text-muted">Здесь появятся комментарии, смены этапов и сообщения.</li>}
            </ul>
          </div>
        </div>

        <form onSubmit={addComment} className="flex items-end gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <textarea
            ref={commentRef}
            className="input max-h-40 min-h-[2.625rem] flex-1 resize-none"
            rows={1}
            value={comment}
            placeholder="Комментарий: о чём договорились"
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
                e.preventDefault();
                addComment();
              }
            }}
          />
          <button className="btn-accent h-[2.625rem] w-[2.625rem] p-0" disabled={!comment.trim()} aria-label="Добавить комментарий">
            <Send size={16} />
          </button>
        </form>
      </aside>
    </div>
  );
}

/* ---------- Итог контакта ---------- */

const OUTCOMES: { label: string; log: string; next?: { text: string; when: Parameters<typeof quickDue>[0] }; focusComment?: boolean }[] = [
  { label: "Не дозвонился", log: "Звонок: не дозвонился", next: { text: "Перезвонить", when: "tomorrow" } },
  { label: "Поговорили", log: "Звонок: поговорили", focusComment: true },
  { label: "Отправил КП", log: "Отправлено КП", next: { text: "Узнать решение по КП", when: "3days" } },
];

/* ---------- Следующий шаг ---------- */

const QUICK: { key: Parameters<typeof quickDue>[0]; label: string }[] = [
  { key: "evening", label: "Сегодня вечером" },
  { key: "tomorrow", label: "Завтра" },
  { key: "3days", label: "Через 3 дня" },
  { key: "week", label: "Через неделю" },
];

function NextStep({ lead, onSave, onDone }: { lead: Lead; onSave: (p: LeadInput) => void; onDone: () => void }) {
  const [editing, setEditing] = useState(!lead.next_action_at);
  const [text, setText] = useState(lead.next_action ?? "");
  const [when, setWhen] = useState(toLocalInput(lead.next_action_at));
  const due = dueStatus(lead.next_action_at);

  function commit(at: Date | string) {
    onSave({ next_action: text.trim() || "Связаться", next_action_at: new Date(at).toISOString() });
    setEditing(false);
  }

  if (!editing && lead.next_action_at) {
    const tone =
      due === "overdue" ? "border-danger/40 bg-danger-soft" : due === "today" ? "border-warn/40 bg-warn-soft" : "border-line bg-sunken";
    return (
      <div className={`mx-4 mt-4 rounded-xl border p-3 ${tone}`}>
        <div className="flex items-start gap-2.5">
          <AlarmClock size={18} className={`mt-0.5 shrink-0 ${due === "overdue" ? "text-danger" : due === "today" ? "text-warn" : "text-muted"}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{lead.next_action || "Связаться"}</p>
            <p className={`text-xs ${due === "overdue" ? "text-danger" : "text-muted"}`}>
              {due === "overdue" ? "Просрочено: " : ""}{formatDue(lead.next_action_at)}
            </p>
          </div>
          <button className="btn-primary px-2.5 py-1.5" onClick={onDone}>
            <Check size={15} /> Сделано
          </button>
        </div>
        <div className="mt-2 flex gap-1 pl-7">
          <button className="btn-ghost px-2 py-1 text-xs text-muted" onClick={() => onSave({ next_action_at: quickDue("tomorrow").toISOString() })}>
            Перенести на завтра
          </button>
          <button className="btn-ghost px-2 py-1 text-xs text-muted" onClick={() => setEditing(true)}>Изменить</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-4 rounded-xl border border-dashed border-line p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <AlarmClock size={16} className="text-muted" /> Следующий шаг
      </p>
      <input
        className="input py-1.5"
        placeholder="Что сделать: перезвонить, отправить КП…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button key={q.key} className="btn-outline px-2.5 py-1 text-xs" onClick={() => commit(quickDue(q.key))}>
            {q.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input type="datetime-local" className="input min-w-0 flex-1 py-1.5" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Дата и время" />
        <button className="btn-primary" disabled={!when} onClick={() => commit(when)}>Сохранить</button>
        {lead.next_action_at && <button className="btn-ghost" onClick={() => setEditing(false)}>Отмена</button>}
      </div>
    </div>
  );
}

/* ---------- WhatsApp с шаблонами ---------- */

function WhatsAppButton({ lead, onSend }: { lead: Lead; onSend: (text?: string) => void }) {
  const { templates } = useCrm();
  const [open, setOpen] = useState(false);
  if (!templates.length) {
    return <button onClick={() => onSend()} className="btn-outline min-w-0 flex-1 px-2 text-wa"><MessageCircle size={16} className="shrink-0" /> <span className="truncate">WhatsApp</span></button>;
  }
  return (
    <div className="relative flex min-w-0 flex-1">
      <button onClick={() => setOpen(!open)} className="btn-outline min-w-0 flex-1 px-2 text-wa" aria-expanded={open}>
        <MessageCircle size={16} className="shrink-0" /> <span className="truncate">WhatsApp</span> <ChevronDown size={14} className="shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="sheet-in absolute top-full right-0 z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-xl">
            <button className="block w-full px-3 py-2 text-left text-sm hover:bg-ink/[0.04]" onClick={() => { setOpen(false); onSend(); }}>
              Открыть чат без текста
            </button>
            <div className="my-1 border-t border-line" />
            {templates.map((t) => {
              const text = fillTemplate(t.body, lead);
              return (
                <button key={t.id} className="block w-full px-3 py-2 text-left hover:bg-ink/[0.04]" onClick={() => { setOpen(false); onSend(text); }}>
                  <span className="block text-sm font-medium">{t.title}</span>
                  <span className="line-clamp-2 text-xs text-muted">{text}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Теги ---------- */

function TagInput({ tags, suggestions, onChange }: { tags: string[]; suggestions: string[]; onChange: (t: string[]) => void }) {
  const [v, setV] = useState("");
  const add = (raw: string) => {
    const t = raw.trim().replace(/^#/, "").toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setV("");
  };
  const hints = suggestions.filter((s) => !tags.includes(s) && (!v || s.includes(v.toLowerCase()))).slice(0, 6);
  return (
    <div className="px-2 py-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span key={t} className="chip bg-ink/[0.07] py-1 text-xs text-ink">
            #{t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Убрать тег ${t}`} className="text-muted hover:text-danger">
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          className="min-w-24 flex-1 bg-transparent py-1 outline-none placeholder:text-muted/70"
          placeholder={tags.length ? "" : "Добавить: vip, рассрочка…"}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(v); }
            if (e.key === "Backspace" && !v && tags.length) onChange(tags.slice(0, -1));
          }}
          onBlur={() => v && add(v)}
        />
      </div>
      {v && hints.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {hints.map((h) => (
            <button key={h} onMouseDown={(e) => e.preventDefault()} onClick={() => add(h)} className="chip bg-accent-soft text-accent">
              #{h}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Мелочи ---------- */

function Prop({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="px-2 pt-1 text-xs text-muted">{label}</div>
      {children}
    </div>
  );
}

function ActivityItem({ a, onDelete }: { a: Activity; onDelete: () => void }) {
  if (a.kind === "comment" || a.kind === "message_in" || a.kind === "message_out") {
    const tone =
      a.kind === "message_in" ? "bg-wa-soft border-wa/20" : a.kind === "message_out" ? "bg-accent-soft border-accent/15" : "bg-sunken border-line";
    const label = a.kind === "message_in" ? "Клиент написал" : a.kind === "message_out" ? "Отправлено в WhatsApp" : "Комментарий";
    return (
      <li className={`group rounded-lg border p-3 ${tone}`}>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted">
          <span className="font-medium text-ink/70">{label}</span>
          <span className="ml-auto tabular-nums">{formatDate(a.created_at)}</span>
          {a.kind === "comment" && (
            <button onClick={onDelete} className="opacity-0 transition group-hover:opacity-100 focus:opacity-100 hover:text-danger" aria-label="Удалить комментарий">
              <Trash2 size={13} />
            </button>
          )}
        </div>
        <p className="text-sm whitespace-pre-wrap">{a.body}</p>
      </li>
    );
  }
  const Icon = a.kind === "stage" ? ArrowRightLeft : a.kind === "task" ? CircleCheck : Sparkles;
  return (
    <li className="flex items-start gap-2 px-1 text-xs text-muted">
      <Icon size={13} className={`mt-0.5 shrink-0 ${a.kind === "task" ? "text-money" : ""}`} />
      <span className="flex-1 whitespace-pre-wrap">{a.body}</span>
      <span className="shrink-0 tabular-nums">{formatDate(a.created_at)}</span>
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

  const cls = `w-full rounded-md bg-transparent px-2 py-1.5 outline-none placeholder:text-muted/60 hover:bg-ink/[0.04] focus:bg-panel focus:ring-2 focus:ring-accent/15 ${className}`;
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
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") { setV(value); (e.target as HTMLInputElement).blur(); }
      }}
    />
  );
}
