"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown, Columns3, Download, LogOut, Menu, Plug, Plus, RefreshCw, Search, Settings2, Table2, Upload, X,
} from "lucide-react";
import { useCrm } from "@/lib/useCrm";
import { exportLeads } from "@/lib/excel";
import { formatMoney } from "@/lib/format";
import { Board } from "@/components/Board";
import { LeadsTable } from "@/components/LeadsTable";
import { LeadDrawer } from "@/components/LeadDrawer";
import { NewLeadModal } from "@/components/NewLeadModal";
import { PipelineSettings } from "@/components/PipelineSettings";
import { ImportModal } from "@/components/ImportModal";
import { IntegrationsModal } from "@/components/IntegrationsModal";

type View = "board" | "table";
type Dialog = null | "settings" | "import" | "integrations" | { newLead: string | undefined };

const VIEW_KEY = "crm.view";

export function CrmApp({ email, webhookToken }: { email: string; webhookToken: string }) {
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

  function doExport() {
    setMenu(false);
    const date = new Date().toISOString().slice(0, 10);
    exportLeads(filtered, crm.stages, `заявки-${crm.pipeline?.name ?? "crm"}-${date}.xlsx`);
  }

  if (crm.loading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted">Загрузка…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Шапка */}
      <header className="flex items-center gap-2 px-4 pt-3 pb-2 md:gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="hidden h-8 w-8 md:block" />

        <div className="relative min-w-0">
          <select
            value={crm.pipelineId ?? ""}
            onChange={(e) => crm.setPipelineId(e.target.value)}
            className="max-w-[52vw] cursor-pointer appearance-none [field-sizing:content] truncate rounded-lg bg-transparent py-1.5 pr-7 pl-1 text-lg font-semibold outline-none hover:bg-black/5 md:max-w-none"
          >
            {crm.pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-muted" />
        </div>

        <div className="hidden rounded-lg bg-black/5 p-0.5 sm:flex">
          <ViewBtn on={view === "board"} onClick={() => changeView("board")} icon={<Columns3 size={15} />} label="Канбан" />
          <ViewBtn on={view === "table"} onClick={() => changeView("table")} icon={<Table2 size={15} />} label="Таблица" />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="relative hidden md:block">
            <Search size={15} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
            <input
              className="input w-60 py-1.5 pl-8"
              placeholder="Поиск: имя, телефон, @ник"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button className="btn-ghost p-2 md:hidden" onClick={() => setSearchOpen(!searchOpen)} aria-label="Поиск">
            <Search size={18} />
          </button>
          <button className="btn-primary" onClick={() => setDialog({ newLead: undefined })}>
            <Plus size={16} /> <span className="hidden sm:inline">Заявка</span>
          </button>

          <div className="relative">
            <button className="btn-ghost p-2" onClick={() => setMenu(!menu)} aria-label="Меню">
              <Menu size={18} />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} />
                <div className="absolute right-0 z-30 mt-1 w-60 overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-lg">
                  <MenuItem icon={<Settings2 size={16} />} onClick={() => { setMenu(false); setDialog("settings"); }}>Воронки и этапы</MenuItem>
                  <MenuItem icon={<Upload size={16} />} onClick={() => { setMenu(false); setDialog("import"); }}>Импорт из Excel</MenuItem>
                  <MenuItem icon={<Download size={16} />} onClick={doExport}>Экспорт в Excel</MenuItem>
                  <MenuItem icon={<Plug size={16} />} onClick={() => { setMenu(false); setDialog("integrations"); }}>Интеграции</MenuItem>
                  <MenuItem icon={<RefreshCw size={16} />} onClick={() => { setMenu(false); crm.reload(); }}>Обновить</MenuItem>
                  <div className="my-1 border-t border-line" />
                  <div className="truncate px-3 py-1 text-xs text-muted">{email}</div>
                  <form action="/auth/signout" method="post">
                    <MenuItem icon={<LogOut size={16} />} type="submit">Выйти</MenuItem>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Мобильный поиск */}
      {searchOpen && (
        <div className="relative px-4 pb-2 md:hidden">
          <Search size={15} className="absolute top-1/2 left-6.5 -translate-y-1/2 text-muted" />
          <input autoFocus className="input pl-8" placeholder="Имя, телефон, @ник" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}

      {/* Фильтры и итоги */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 pb-3 text-sm">
        <div className="flex rounded-lg bg-black/5 p-0.5 sm:hidden">
          <ViewBtn on={view === "board"} onClick={() => changeView("board")} icon={<Columns3 size={15} />} />
          <ViewBtn on={view === "table"} onClick={() => changeView("table")} icon={<Table2 size={15} />} />
        </div>
        {sources.length > 0 && (
          <select value={source} onChange={(e) => setSource(e.target.value)} className="shrink-0 rounded-lg border border-line bg-panel px-2 py-1 outline-none">
            <option value="">Все источники</option>
            {sources.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
        {(query || source) && (
          <button className="btn-ghost px-2 py-1 text-muted" onClick={() => { setQuery(""); setSource(""); }}>
            <X size={14} /> Сбросить
          </button>
        )}
        <span className="ml-auto shrink-0 text-muted">
          {filtered.length} заявок
          {total > 0 && <span className="hidden sm:inline"> · {formatMoney(total)}</span>}
        </span>
      </div>

      {crm.error && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <span className="flex-1">Ошибка: {crm.error}</span>
          <button onClick={crm.clearError}><X size={16} /></button>
        </div>
      )}

      <main className="min-h-0 flex-1">
        {view === "board" ? (
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
          onDelete={crm.deleteLead}
        />
      )}
      {dialog && typeof dialog === "object" && (
        <NewLeadModal
          stages={crm.stages}
          stageId={dialog.newLead}
          onClose={() => setDialog(null)}
          onCreate={crm.createLead}
        />
      )}
      {dialog === "settings" && <PipelineSettings crm={crm} onClose={() => setDialog(null)} />}
      {dialog === "import" && <ImportModal crm={crm} onClose={() => setDialog(null)} />}
      {dialog === "integrations" && <IntegrationsModal token={webhookToken} onClose={() => setDialog(null)} />}
    </div>
  );
}

function ViewBtn({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label?: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition ${on ? "bg-white font-medium shadow-sm" : "text-muted hover:text-ink"}`}
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
    <button {...props} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-black/[0.04]">
      <span className="text-muted">{icon}</span>
      {children}
    </button>
  );
}
