"use client";

import { useMemo, useState } from "react";
import { AlarmClock, Check, ChevronRight, MessageCircle, Phone, Redo2 } from "lucide-react";
import { useCrm } from "@/lib/crm";
import type { Lead } from "@/lib/types";
import { daysSince, dueStatus, formatDue, formatMoney, formatPhone, plural, quickDue, waLink } from "@/lib/format";
import { toast } from "@/lib/toast";

type Group = { key: string; title: string; hint?: string; tone: string; leads: Lead[] };

export function TodayView() {
  const crm = useCrm();
  const [showForgotten, setShowForgotten] = useState(true);

  const groups = useMemo<Group[]>(() => {
    const now = new Date();
    const by: Record<string, Lead[]> = { overdue: [], today: [], tomorrow: [], later: [], none: [] };
    for (const l of crm.leads) {
      const kind = crm.stageById.get(l.stage_id)?.kind;
      const d = dueStatus(l.next_action_at, now);
      if (d) by[d].push(l);
      else if (kind === "open") by.none.push(l);
    }
    const byDue = (a: Lead, b: Lead) => (a.next_action_at ?? "").localeCompare(b.next_action_at ?? "");
    for (const k of ["overdue", "today", "tomorrow", "later"]) by[k].sort(byDue);
    by.none.sort((a, b) => a.stage_changed_at.localeCompare(b.stage_changed_at));
    return [
      { key: "overdue", title: "Просрочено", tone: "text-danger", leads: by.overdue },
      { key: "today", title: "Сегодня", tone: "text-warn", leads: by.today },
      { key: "tomorrow", title: "Завтра", tone: "text-accent", leads: by.tomorrow },
      { key: "later", title: "Позже", tone: "text-muted", leads: by.later.slice(0, 30) },
      {
        key: "none",
        title: "Без следующего шага",
        hint: "Заявки в работе, по которым не назначено, что делать дальше. Так клиенты и теряются.",
        tone: "text-muted",
        leads: by.none,
      },
    ];
  }, [crm.leads, crm.stageById]);

  const [overdue, today] = groups;
  const todayStr = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  const focus = overdue.leads.length + today.leads.length;

  async function done(l: Lead) {
    await crm.completeAction(l);
    toast(`Сделано: ${l.name || "заявка"}`, { action: { label: "Следующий шаг", run: () => crm.openLead(l.id) } });
  }

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 pt-4 pb-10 md:px-6 md:pt-8">
        <p className="text-sm text-muted first-letter:uppercase">{todayStr}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight md:text-3xl">
          {focus === 0 ? "На сегодня всё сделано" : `${focus} ${plural(focus, "дело", "дела", "дел")} на сегодня`}
        </h1>
        {overdue.leads.length > 0 && (
          <p className="mt-1 text-sm text-danger">
            Из них просрочено {overdue.leads.length}. Начните с них: клиент ждёт.
          </p>
        )}

        {groups.map((g) => {
          if (!g.leads.length) return null;
          const collapsible = g.key === "none";
          const open = !collapsible || showForgotten;
          return (
            <section key={g.key} className="mt-8">
              <button
                className={`flex w-full items-baseline gap-2 text-left ${collapsible ? "cursor-pointer" : "cursor-default"}`}
                onClick={() => collapsible && setShowForgotten(!showForgotten)}
                disabled={!collapsible}
              >
                <h2 className={`text-sm font-semibold ${g.tone}`}>{g.title}</h2>
                <span className="text-sm text-muted tabular-nums">{g.leads.length}</span>
                {collapsible && <ChevronRight size={14} className={`text-muted transition ${open ? "rotate-90" : ""}`} />}
              </button>
              {g.hint && open && <p className="mt-0.5 text-xs text-muted">{g.hint}</p>}
              {open && (
                <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
                  {g.leads.map((l) => (
                    <Row key={l.id} lead={l} onDone={() => done(l)} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        {crm.leads.length === 0 && (
          <p className="mt-8 text-sm text-muted">
            Когда появятся заявки, здесь будет список того, что нужно сделать: кому перезвонить, кому отправить КП.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ lead, onDone }: { lead: Lead; onDone: () => void }) {
  const crm = useCrm();
  const stage = crm.stageById.get(lead.stage_id);
  const pipeline = crm.pipelines.length > 1 ? crm.pipelines.find((p) => p.id === lead.pipeline_id)?.name : null;
  const due = dueStatus(lead.next_action_at);
  const idle = daysSince(lead.stage_changed_at);

  return (
    <li className="group flex items-center gap-3 px-3 py-2.5 hover:bg-sunken md:px-4">
      <button className="min-w-0 flex-1 text-left" onClick={() => crm.openLead(lead.id)}>
        <div className="flex items-baseline gap-2">
          <span className="truncate font-medium">{lead.name || formatPhone(lead.phone) || "Без имени"}</span>
          {lead.amount != null && <span className="shrink-0 text-xs font-semibold text-money tabular-nums">{formatMoney(lead.amount)}</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          {lead.next_action_at ? (
            <span>
              <AlarmClock size={12} className={`mr-1 inline align-[-2px] ${due === "overdue" ? "text-danger" : due === "today" ? "text-warn" : ""}`} />
              <span className={due === "overdue" ? "text-danger" : due === "today" ? "text-warn" : ""}>{formatDue(lead.next_action_at)}</span>
              {lead.next_action && <span className="text-ink/80">: {lead.next_action}</span>}
            </span>
          ) : (
            <span>{idle === 0 ? "на этапе с сегодня" : `${idle} ${plural(idle, "день", "дня", "дней")} без движения`}</span>
          )}
          {stage && (
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: stage.color }} />
              {pipeline ? `${pipeline}, ` : ""}{stage.name}
            </span>
          )}
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        {lead.phone && (
          <>
            <a href={`tel:${lead.phone}`} className="rounded-lg p-2 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Позвонить">
              <Phone size={16} />
            </a>
            <a href={waLink(lead.phone)} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-wa hover:bg-wa-soft" aria-label="WhatsApp">
              <MessageCircle size={16} />
            </a>
          </>
        )}
        {lead.next_action_at ? (
          <>
            <button
              className="hidden rounded-lg p-2 text-muted hover:bg-ink/5 hover:text-ink sm:block"
              onClick={() => crm.updateLead(lead.id, { next_action_at: quickDue("tomorrow").toISOString() })}
              aria-label="Перенести на завтра"
              title="Перенести на завтра"
            >
              <Redo2 size={16} />
            </button>
            <button className="btn-outline ml-1 px-2 py-1.5" onClick={onDone} title="Сделано">
              <Check size={15} /> <span className="hidden sm:inline">Сделано</span>
            </button>
          </>
        ) : (
          <button className="btn-outline ml-1 px-2 py-1.5 text-xs" onClick={() => crm.openLead(lead.id)}>
            Назначить
          </button>
        )}
      </div>
    </li>
  );
}
