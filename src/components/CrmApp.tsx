"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown, Columns3, Download, LogOut, Menu, Plug, Plus, RefreshCw, Search, Settings2, Table2, Upload, X,
} from "lucide-react";
import { useCrm } from "@/lib/useCrm";
import { exportLeads } from "@/lib/excel";
import { formatMoney, plural } from "@/lib/format";
import { toast } from "@/lib/toast";
import { resetDemo } from "@/lib/supabase/demo";
import { supabase } from "@/lib/supabase/client";
import { Board } from "@/components/Board";
import { FunnelStrip } from "@/components/FunnelStrip";
import { LeadsTable } from "@/components/LeadsTable";
import { LeadDrawer } from "@/components/LeadDrawer";
import { NewLeadModal } from "@/components/NewLeadModal";
import { PipelineSettings } from "@/components/PipelineSettings";
import { ImportModal } from "@/components/ImportModal";
import { IntegrationsModal } from "@/components/IntegrationsModal";
import { Toasts } from "@/components/Toasts";

type View = "board" | "table";
type Dialog = null | "settings" | "import" | "integrations" | { newLead: string | undefined };

const VIEW_KEY = "crm.view";

export function CrmApp({ email, demo }: { email: string; demo?: boolean }) {
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
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [menu, setMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const changeView = (v: View) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
  };

  const sources = useMemo(
    () => [...new Set(crm.leads.map((l) => l.source).filter(Boolean) as string[])].sort(),
    [crm.leads],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return crm.leads.filter((l) => {
      if (source && l.source !== source) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.instagram?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.note?.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && l.phone?.replace(/\D/g, "").includes(qDigits))
      );
    });
  }, [crm.leads, query, source]);

  const openLead = crm.leads.find((l) => l.id === openId) ?? null;
  const total = filtered.reduce((s, l) => s + (l.amount ?? 0), 0);
  const filtering = Boolean(query || source);

  function doExport() {
    setMenu(false);
    const date = new Date().toISOString().slice(0, 10);
    exportLeads(filtered, crm.stages, `заявки-${crm.pipeline?.name ?? "crm"}-${date}.xlsx`).then(() =>
      toast(`Выгружено ${filtered.length} ${plural(filtered.length, "заявка", "заявки", "заявок")}`),
    );
  }

  function pickStage(stageId: string) {
    if (view !== "board") changeView("board");
    requestAnimationFrame(() =>
      document.getElementById(`stage-${stageId}`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }),
    );
  }

  if (crm.loading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted">Загружаем заявки…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {demo && (
        <div className="flex items-center gap-3 bg-ink px-4 py-1.5 text-xs text-white/80">
          <span className="flex-1">Демо-режим: данные хранятся только в этом браузере. Подключите Supabase, чтобы вести настоящую базу.</span>
          <button
            className="shrink-0 underline-offset-2 hover:underline"
            onClick={() => { if (confirm("Стереть демо-данные и начать заново?")) { resetDemo(); location.reload(); } }}
          >
            Сбросить
          </button>
        </div>
      )}

      {/* Шапка */}
      <header className="flex items-center gap-2 px-4 pt-3 md:gap-4 md:px-6 md:pt-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="hidden h-8 w-8 md:block" />

        <div className="relative min-w-0">
          <select
            value={crm.pipelineId ?? ""}
            onChange={(e) => crm.setPipelineId(e.target.value)}
            aria-label="Воронка"
            className="max-w-[52vw] cursor-pointer appearance-none truncate rounded-lg bg-transparent py-1 pr-7 pl-1 text-xl font-semibold tracking-tight outline-none [field-sizing:content] hover:bg-ink/5 md:max-w-none md:text-2xl"
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
              className="input w-64 py-1.5 pl-8"
              placeholder="Имя, телефон или @ник"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button className="btn-ghost p-2 md:hidden" onClick={() => setSearchOpen(!searchOpen)} aria-label="Поиск">
            <Search size={19} />
          </button>
          <button className="btn-accent" onClick={() => setDialog({ newLead: undefined })}>
            <Plus size={16} /> <span className="hidden sm:inline">Новая заявка</span>
          </button>

          <div className="relative">
            <button className="btn-ghost p-2" onClick={() => setMenu(!menu)} aria-label="Меню" aria-expanded={menu}>
              <Menu size={19} />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} />
                <div className="sheet-in absolute right-0 z-30 mt-1 w-64 overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-xl">
                  <MenuItem icon={<Settings2 size={16} />} onClick={() => { setMenu(false); setDialog("settings"); }}>Воронки и этапы</MenuItem>
                  <MenuItem icon={<Upload size={16} />} onClick={() => { setMenu(false); setDialog("import"); }}>Загрузить из Excel</MenuItem>
                  <MenuItem icon={<Download size={16} />} onClick={doExport}>Выгрузить в Excel</MenuItem>
                  <MenuItem icon={<Plug size={16} />} onClick={() => { setMenu(false); setDialog("integrations"); }}>Подключить источники заявок</MenuItem>
                  <MenuItem icon={<RefreshCw size={16} />} onClick={() => { setMenu(false); crm.reload(); }}>Обновить</MenuItem>
                  <div className="my-1 border-t border-line" />
                  <div className="truncate px-3 py-1 text-xs text-muted">{email.replace(/@crm\.local$/, "")}</div>
                  {!demo && (
                    <MenuItem icon={<LogOut size={16} />} onClick={() => supabase().auth.signOut()}>Выйти</MenuItem>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {searchOpen && (
        <div className="relative px-4 pt-2 md:hidden">
          <Search size={15} className="absolute top-1/2 left-7 mt-1 -translate-y-1/2 text-muted" />
          <input autoFocus className="input pl-9" placeholder="Имя, телефон или @ник" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}

      {/* Воронка */}
      <div className="px-4 pt-3 md:px-6 md:pt-4">
        <FunnelStrip stages={crm.stages} leads={filtered} onPick={pickStage} />
      </div>

      {/* Фильтры и итоги */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 text-sm md:px-6">
        <div className="flex shrink-0 rounded-lg bg-ink/[0.06] p-0.5 sm:hidden">
          <ViewBtn on={view === "board"} onClick={() => changeView("board")} icon={<Columns3 size={15} />} label="" />
          <ViewBtn on={view === "table"} onClick={() => changeView("table")} icon={<Table2 size={15} />} label="" />
        </div>
        {sources.length > 0 && (
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label="Источник"
            className={`shrink-0 cursor-pointer rounded-lg border px-2 py-1 outline-none ${source ? "border-ink bg-ink text-white" : "border-line bg-panel"}`}
          >
            <option value="">Все источники</option>
            {sources.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
        {filtering && (
          <button className="btn-ghost shrink-0 px-2 py-1 text-muted" onClick={() => { setQuery(""); setSource(""); }}>
            <X size={14} /> Сбросить
          </button>
        )}
        <p className="ml-auto shrink-0 text-muted">
          <span className="font-semibold text-ink tabular-nums">{filtered.length}</span> {plural(filtered.length, "заявка", "заявки", "заявок")}
          {total > 0 && (
            <span className="max-sm:hidden">
              {" "}на <span className="font-semibold text-money tabular-nums">{formatMoney(total)}</span>
            </span>
          )}
        </p>
      </div>

      {crm.error && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 md:mx-6">
          <span className="flex-1">Не удалось сохранить изменения: {crm.error}. Проверьте интернет и нажмите «Обновить» в меню.</span>
          <button onClick={crm.clearError} aria-label="Скрыть"><X size={16} /></button>
        </div>
      )}

      <main className="min-h-0 flex-1">
        {crm.leads.length === 0 ? (
          <EmptyState onAdd={() => setDialog({ newLead: undefined })} onImport={() => setDialog("import")} />
        ) : view === "board" ? (
          <Board
            stages={crm.stages}
            leads={filtered}
            onMove={crm.moveLead}
            onOpen={(l) => setOpenId(l.id)}
            onAdd={(stageId) => setDialog({ newLead: stageId })}
          />
        ) : (
          <LeadsTable
            stages={crm.stages}
            leads={filtered}
            onOpen={(l) => setOpenId(l.id)}
            onStage={(id, stageId) => crm.updateLead(id, { stage_id: stageId })}
          />
        )}
      </main>

      {openLead && (
        <LeadDrawer
          key={openLead.id}
          lead={openLead}
          stages={crm.stages}
          onClose={() => setOpenId(null)}
          onUpdate={crm.updateLead}
          onDelete={async (id) => { await crm.deleteLead(id); toast("Заявка удалена"); }}
        />
      )}
      {dialog && typeof dialog === "object" && (
        <NewLeadModal
          stages={crm.stages}
          stageId={dialog.newLead}
          onClose={() => setDialog(null)}
          onCreate={async (input) => {
            const lead = await crm.createLead(input);
            if (lead) toast("Заявка создана", { action: { label: "Открыть", run: () => setOpenId(lead.id) } });
            return lead;
          }}
        />
      )}
      {dialog === "settings" && <PipelineSettings crm={crm} onClose={() => setDialog(null)} />}
      {dialog === "import" && <ImportModal crm={crm} onClose={() => setDialog(null)} />}
      {dialog === "integrations" && <IntegrationsModal demo={demo} onClose={() => setDialog(null)} />}
      <Toasts />
    </div>
  );
}

function EmptyState({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h2 className="text-lg font-semibold">В этой воронке пока нет заявок</h2>
        <p className="mt-1 text-sm text-muted">Добавьте первую вручную или загрузите базу клиентов из Excel.</p>
        <div className="mt-4 flex justify-center gap-2">
          <button className="btn-accent" onClick={onAdd}><Plus size={16} /> Новая заявка</button>
          <button className="btn-outline" onClick={onImport}><Upload size={16} /> Загрузить из Excel</button>
        </div>
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
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition ${on ? "bg-white font-medium text-ink shadow-sm" : "text-muted hover:text-ink"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function MenuItem({
  icon,
  children,
  ...props
}: { icon: React.ReactNode; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-ink/[0.04]">
      <span className="text-muted">{icon}</span>
      {children}
    </button>
  );
}
