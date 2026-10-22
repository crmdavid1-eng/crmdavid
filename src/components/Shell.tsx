"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarCheck2, Columns3, MessageCircle, Search, Settings, X } from "lucide-react";
import { useCrm } from "@/lib/crm";
import { dueStatus } from "@/lib/format";
import { resetDemo } from "@/lib/supabase/demo";
import { useSession, Splash } from "@/components/AuthGate";
import { LeadDrawer } from "@/components/LeadDrawer";
import { NewLeadModal } from "@/components/NewLeadModal";
import { Toasts } from "@/components/Toasts";
import { toast } from "@/lib/toast";
import { useReminders } from "@/lib/reminders";
import { CommandPalette } from "@/components/CommandPalette";
import { LostReasonModal } from "@/components/LostReasonModal";

const NAV = [
  { href: "/", label: "Воронка", icon: Columns3 },
  { href: "/today", label: "Дела", icon: CalendarCheck2 },
  { href: "/chats", label: "Чаты", icon: MessageCircle },
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

  const unread = useMemo(() => crm.leads.reduce((s, l) => s + (l.unread || 0), 0), [crm.leads]);

  // Счётчик срочных дел в заголовке вкладки
  useEffect(() => {
    // Next.js выставляет title из metadata после перехода — ставим свой следом
    const t = setTimeout(() => { document.title = urgent ? `(${urgent}) CRM` : "CRM"; }, 50);
    return () => clearTimeout(t);
  }, [urgent, path]);

  useReminders(crm.leads, crm.openLead);

  // Горячие клавиши: N — новая заявка, / — поиск, Ctrl/⌘+K — палитра
  const { openNewLead, setPaletteOpen } = crm;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "л")) {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
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
  }, [openNewLead, setPaletteOpen]);

  if (crm.loading) return <Splash />;

  const openLead = crm.leads.find((l) => l.id === crm.openLeadId) ?? null;

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Боковая панель — компьютер */}
      <nav className="hidden w-[4.75rem] shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-4 md:flex" aria-label="Разделы">
        <Link href="/" className="mb-4" aria-label="На главную">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-9 w-9" />
        </Link>
        {NAV.map((n) => (
          <NavItem key={n.href} {...n} active={path === n.href} badge={n.href === "/today" ? urgent : n.href === "/chats" ? unread : 0} />
        ))}
        <button
          onClick={() => crm.setPaletteOpen(true)}
          className="mt-auto flex w-16 flex-col items-center gap-1 rounded-xl py-2 text-[0.6875rem] font-medium text-muted transition hover:bg-ink/[0.04] hover:text-ink"
          title="Поиск и команды (Ctrl+K)"
        >
          <Search size={20} strokeWidth={1.8} />
          Ctrl+K
        </button>
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
          className="grid shrink-0 grid-cols-5 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Разделы"
        >
          {NAV.map((n) => (
            <TabItem key={n.href} {...n} active={path === n.href} badge={n.href === "/today" ? urgent : n.href === "/chats" ? unread : 0} />
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
      <LostReasonModal />
      {crm.paletteOpen && <CommandPalette />}
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
      className={`relative flex w-16 flex-col items-center gap-1 rounded-xl py-2 text-[0.6875rem] font-medium transition ${
        active ? "bg-accent-soft text-accent" : "text-muted hover:bg-ink/[0.04] hover:text-ink"
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
      className={`relative flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[0.625rem] font-medium ${active ? "text-accent" : "text-muted"}`}
    >
      <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
      {label}
      {badge > 0 && <Badge n={badge} className="absolute top-1 left-1/2 ml-2" />}
    </Link>
  );
}

function Badge({ n, className }: { n: number; className: string }) {
  return (
    <span className={`min-w-4 rounded-full bg-danger px-1 text-center text-[0.625rem] leading-4 font-semibold text-white tabular-nums ${className}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}
