"use client";

import { useMemo, useState } from "react";
import { AlarmClock, ChevronDown, Columns3, Plus, Search, Table2, X } from "lucide-react";
import { useCrm } from "@/lib/crm";
import { dueStatus, formatMoney, plural } from "@/lib/format";
import { Board } from "@/components/Board";
import { FunnelStrip } from "@/components/FunnelStrip";
import { LeadsTable } from "@/components/LeadsTable";

type View = "board" | "table";
const VIEW_KEY = "crm.view";

export function PipelineView() {
  const crm = useCrm();
  const [view, setView] = useState<View>(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(VIEW_KEY) === "table" ? "table" : "board";
    } catch {
      return "board";
    }
  });
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [tag, setTag] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const changeView = (v: View) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
  };

  const leads = crm.pipelineLeads;
  const sources = useMemo(() => [...new Set(leads.map((l) => l.source).filter(Boolean) as string[])].sort(), [leads]);
  const tags = useMemo(() => [...new Set(leads.flatMap((l) => l.tags))].sort(), [leads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const now = new Date();
    return leads.filter((l) => {
      if (source && l.source !== source) return false;
      if (tag && !l.tags.includes(tag)) return false;
      if (overdueOnly && dueStatus(l.next_action_at, now) !== "overdue") return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.instagram?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.note?.toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q)) ||
        (qDigits.length >= 3 && l.phone?.replace(/\D/g, "").includes(qDigits))
      );
    });
  }, [leads, query, source, tag, overdueOnly]);

  const overdueCount = useMemo(() => leads.filter((l) => dueStatus(l.next_action_at) === "overdue").length, [leads]);
  const openTotal = filtered
    .filter((l) => crm.stageById.get(l.stage_id)?.kind === "open")
    .reduce((s, l) => s + (l.amount ?? 0), 0);
  const filtering = Boolean(query || source || tag || overdueOnly);

  function pickStage(stageId: string) {
    if (view !== "board") changeView("board");
    requestAnimationFrame(() =>
      document.getElementById(`stage-${stageId}`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }),
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[128rem] flex-1 flex-col">
      <header className="flex items-center gap-2 px-4 pt-3 md:gap-4 md:px-6 md:pt-5">
        <div className="relative min-w-0">
          <select
            value={crm.pipelineId ?? ""}
            onChange={(e) => crm.setPipelineId(e.target.value)}
            aria-label="Воронка"
            className="max-w-[56vw] cursor-pointer appearance-none truncate rounded-lg bg-transparent py-1 pr-7 pl-1 text-xl font-semibold tracking-tight outline-none [field-sizing:content] hover:bg-ink/5 md:max-w-none md:text-2xl"
          >
            {crm.pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={18} className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-muted" />
        </div>

        <div className="hidden rounded-lg bg-ink/[0.06] p-0.5 sm:flex">
          <ViewBtn on={view === "board"} onClick={() => changeView("board")} icon={<Columns3 size={15} />} label="Канбан" />
          <ViewBtn on={view === "table"} onClick={() => changeView("table")} icon={<Table2 size={15} />} label="Таблица" />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="relative hidden md:block">
            <Search size={15} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
            <input
              id="search"
              className="input w-64 py-1.5 pr-8 pl-8"
              placeholder="Имя, телефон, @ник, тег"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && (setQuery(""), e.currentTarget.blur())}
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-line px-1 text-[0.625rem] text-muted">/</kbd>
          </div>
          <button className="btn-ghost p-2 md:hidden" onClick={() => setSearchOpen(!searchOpen)} aria-label="Поиск">
            <Search size={19} />
          </button>
          <button className="btn-accent" onClick={() => crm.openNewLead()} title="Новая заявка (N)">
            <Plus size={16} /> <span className="hidden sm:inline">Новая заявка</span>
          </button>
        </div>
      </header>

      {searchOpen && (
        <div className="relative px-4 pt-2 md:hidden">
          <Search size={15} className="absolute top-1/2 left-7 mt-1 -translate-y-1/2 text-muted" />
          <input autoFocus className="input pl-9" placeholder="Имя, телефон, @ник, тег" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}

      <div className="px-4 pt-3 md:px-6 md:pt-4">
        <FunnelStrip stages={crm.stages} leads={filtered} onPick={pickStage} />
      </div>

      <div className="scroll-thin flex items-center gap-2 overflow-x-auto px-4 py-3 text-sm md:px-6">
        <div className="flex shrink-0 rounded-lg bg-ink/[0.06] p-0.5 sm:hidden">
          <ViewBtn on={view === "board"} onClick={() => changeView("board")} icon={<Columns3 size={15} />} label="" />
          <ViewBtn on={view === "table"} onClick={() => changeView("table")} icon={<Table2 size={15} />} label="" />
        </div>
        {overdueCount > 0 && (
          <button
            onClick={() => setOverdueOnly(!overdueOnly)}
            aria-pressed={overdueOnly}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 transition ${
              overdueOnly ? "border-danger bg-danger text-white" : "border-danger/30 bg-danger-soft text-danger"
            }`}
          >
            <AlarmClock size={14} /> Просрочено: {overdueCount}
          </button>
        )}
        {sources.length > 0 && (
          <FilterSelect value={source} onChange={setSource} label="Все источники" options={sources} />
        )}
        {tags.length > 0 && <FilterSelect value={tag} onChange={setTag} label="Все теги" options={tags} />}
        {filtering && (
          <button
            className="btn-ghost shrink-0 px-2 py-1 text-muted"
            onClick={() => { setQuery(""); setSource(""); setTag(""); setOverdueOnly(false); }}
          >
            <X size={14} /> Сбросить
          </button>
        )}
        <p className="ml-auto shrink-0 pl-2 text-muted">
          <span className="font-semibold text-ink tabular-nums">{filtered.length}</span> {plural(filtered.length, "заявка", "заявки", "заявок")}
          {openTotal > 0 && (
            <span className="max-sm:hidden">
              {", "}в работе <span className="font-semibold text-money tabular-nums">{formatMoney(openTotal)}</span>
            </span>
          )}
        </p>
      </div>

      <main className="min-h-0 flex-1">
        {leads.length === 0 ? (
          <EmptyState />
        ) : view === "board" ? (
          <Board
            stages={crm.stages}
            leads={filtered}
            onMove={crm.moveLead}
            onOpen={(l) => crm.openLead(l.id)}
            onAdd={(stageId) => crm.openNewLead(stageId)}
          />
        ) : (
          <LeadsTable leads={filtered} />
        )}
      </main>
    </div>
  );
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={`shrink-0 cursor-pointer rounded-lg border px-2 py-1 outline-none ${value ? "border-ink bg-ink text-bg" : "border-line bg-panel"}`}
    >
      <option value="">{label}</option>
      {options.map((s) => <option key={s}>{s}</option>)}
    </select>
  );
}

function EmptyState() {
  const crm = useCrm();
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h2 className="text-lg font-semibold">В этой воронке пока нет заявок</h2>
        <p className="mt-1 text-sm text-muted">
          Добавьте первую вручную, загрузите базу из Excel в настройках или подключите заявки из Instagram.
        </p>
        <button className="btn-accent mt-4" onClick={() => crm.openNewLead()}>
          <Plus size={16} /> Новая заявка
        </button>
      </div>
    </div>
  );
}

function ViewBtn({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={label || undefined}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition ${on ? "bg-panel font-medium text-ink shadow-sm" : "text-muted hover:text-ink"}`}
    >
      {icon}
      {label}
    </button>
  );
}
