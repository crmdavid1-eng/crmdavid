"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarCheck2, Columns3, Settings, X } from "lucide-react";
import { useCrm } from "@/lib/crm";
import { dueStatus } from "@/lib/format";
import { resetDemo } from "@/lib/supabase/demo";
import { useSession, Splash } from "@/components/AuthGate";
import { LeadDrawer } from "@/components/LeadDrawer";
import { NewLeadModal } from "@/components/NewLeadModal";
import { Toasts } from "@/components/Toasts";
import { toast } from "@/lib/toast";

const NAV = [
  { href: "/", label: "Воронка", icon: Columns3 },
  { href: "/today", label: "Дела", icon: CalendarCheck2 },
  { href: "/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/settings", label: "Настройки", icon: Settings },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const crm = useCrm();
  const { demo } = useSession();
  const path = usePathname();

  // Сколько дел требует внимания: просрочено + сегодня
  const urgent = useMemo(() => {
    const now = new Date();
    return crm.leads.filter((l) => {
      const d = dueStatus(l.next_action_at, now);
      return d === "overdue" || d === "today";
    }).length;
  }, [crm.leads]);

  // Горячие клавиши: N — новая заявка, / — поиск
  const { openNewLead } = crm;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "т") { e.preventDefault(); openNewLead(); }
      if (e.key === "/") {
        const el = document.getElementById("search") as HTMLInputElement | null;
        if (el) { e.preventDefault(); el.focus(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNewLead]);

  if (crm.loading) return <Splash />;

  const openLead = crm.leads.find((l) => l.id === crm.openLeadId) ?? null;

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Боковая панель — компьютер */}
      <nav className="hidden w-[76px] shrink-0 flex-col items-center gap-1 border-r border-line py-4 md:flex" aria-label="Разделы">
        <Link href="/" className="mb-4" aria-label="На главную">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-9 w-9" />
        </Link>
        {NAV.map((n) => (
          <NavItem key={n.href} {...n} active={path === n.href} badge={n.href === "/today" ? urgent : 0} />
        ))}
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {demo && (
          <div className="flex items-center gap-3 bg-ink px-4 py-1.5 text-xs text-bg/80">
            <span className="flex-1">Демо-режим: данные хранятся только в этом браузере.</span>
            <button
              className="shrink-0 underline-offset-2 hover:underline"
              onClick={() => { if (confirm("Стереть демо-данные и начать заново?")) { resetDemo(); location.reload(); } }}
            >
              Сбросить
            </button>
          </div>
        )}
        {crm.error && (
          <div className="flex items-center gap-2 bg-danger-soft px-4 py-2 text-sm text-danger">
            <span className="flex-1">Не удалось сохранить: {crm.error}. Проверьте интернет и обновите страницу.</span>
            <button onClick={crm.clearError} aria-label="Скрыть"><X size={16} /></button>
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>

        {/* Нижние вкладки — телефон */}
        <nav
          className="grid shrink-0 grid-cols-4 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Разделы"
        >
          {NAV.map((n) => (
            <TabItem key={n.href} {...n} active={path === n.href} badge={n.href === "/today" ? urgent : 0} />
          ))}
        </nav>
      </div>

      {openLead && <LeadDrawer key={openLead.id} lead={openLead} onClose={() => crm.openLead(null)} />}
      {crm.newLead && (
        <NewLeadModal
          stageId={crm.newLead.stageId}
          onClose={crm.closeNewLead}
          onCreated={(lead) => toast("Заявка создана", { action: { label: "Открыть", run: () => crm.openLead(lead.id) } })}
        />
      )}
      <Toasts />
    </div>
  );
}

type NavProps = { href: string; label: string; icon: typeof Columns3; active: boolean; badge: number };

function NavItem({ href, label, icon: Icon, active, badge }: NavProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex w-16 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition ${
        active ? "bg-panel text-ink shadow-sm" : "text-muted hover:bg-ink/[0.04] hover:text-ink"
      }`}
    >
      <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
      {label}
      {badge > 0 && <Badge n={badge} className="absolute top-1 right-2.5" />}
    </Link>
  );
}

function TabItem({ href, label, icon: Icon, active, badge }: NavProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10px] font-medium ${active ? "text-accent" : "text-muted"}`}
    >
      <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
      {label}
      {badge > 0 && <Badge n={badge} className="absolute top-1 left-1/2 ml-2" />}
    </Link>
  );
}

function Badge({ n, className }: { n: number; className: string }) {
  return (
    <span className={`min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-semibold text-white tabular-nums ${className}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}
