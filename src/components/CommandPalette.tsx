"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, CalendarCheck2, Columns3, Moon, Plus, Search, Settings, Sun } from "lucide-react";
import { useCrm } from "@/lib/crm";
import { formatMoney, formatPhone } from "@/lib/format";
import { setTheme } from "@/lib/theme";

type Item = { id: string; title: string; hint?: string; icon?: React.ReactNode; color?: string; run: () => void };

/** Ctrl/⌘+K: найти клиента в любой воронке или выполнить действие. */
export function CommandPalette() {
  const crm = useCrm();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const close = () => crm.setPaletteOpen(false);

  const items = useMemo<Item[]>(() => {
    const query = q.trim().toLowerCase();
    const digits = query.replace(/\D/g, "");
    const commands: Item[] = [
      { id: "new", title: "Новая заявка", hint: "N", icon: <Plus size={16} />, run: () => crm.openNewLead() },
      { id: "board", title: "Открыть воронку", icon: <Columns3 size={16} />, run: () => router.push("/") },
      { id: "today", title: "Открыть дела", icon: <CalendarCheck2 size={16} />, run: () => router.push("/today") },
      { id: "analytics", title: "Открыть аналитику", icon: <BarChart3 size={16} />, run: () => router.push("/analytics") },
      { id: "settings", title: "Открыть настройки", icon: <Settings size={16} />, run: () => router.push("/settings") },
      { id: "dark", title: "Тёмная тема", icon: <Moon size={16} />, run: () => setTheme("dark") },
      { id: "light", title: "Светлая тема", icon: <Sun size={16} />, run: () => setTheme("light") },
    ];
    const cmd = commands.filter((c) => !query || c.title.toLowerCase().includes(query));
    if (!query) return cmd.slice(0, 5);

    const leads = crm.leads
      .filter(
        (l) =>
          l.name.toLowerCase().includes(query) ||
          l.instagram?.toLowerCase().includes(query) ||
          l.email?.toLowerCase().includes(query) ||
          l.tags.some((t) => t.includes(query)) ||
          (digits.length >= 3 && l.phone?.replace(/\D/g, "").includes(digits)),
      )
      .slice(0, 8)
      .map<Item>((l) => {
        const stage = crm.stageById.get(l.stage_id);
        const pipeline = crm.pipelines.length > 1 ? crm.pipelines.find((p) => p.id === l.pipeline_id)?.name : null;
        return {
          id: l.id,
          title: l.name || formatPhone(l.phone) || "Без имени",
          hint: [pipeline, stage?.name, l.phone ? formatPhone(l.phone) : null, l.amount != null ? formatMoney(l.amount) : null].filter(Boolean).join(", "),
          color: stage?.color,
          run: () => crm.openLead(l.id),
        };
      });
    return [...leads, ...cmd];
  }, [q, crm, router]);

  const pick = (i: number) => {
    const it = items[i];
    if (!it) return;
    close();
    it.run();
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onMouseDown={close}>
      <div className="sheet-in w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            autoFocus
            className="w-full bg-transparent py-3.5 outline-none placeholder:text-muted/70"
            placeholder="Клиент, телефон, @ник, тег или действие"
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === "Enter") { e.preventDefault(); pick(active); }
            }}
          />
          <kbd className="shrink-0 rounded border border-line px-1.5 text-[0.6875rem] text-muted">Esc</kbd>
        </div>
        <ul className="scroll-thin max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
          {items.map((it, i) => (
            <li key={it.id} role="option" aria-selected={i === active}>
              <button
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === active ? "bg-accent-soft" : "hover:bg-ink/[0.04]"}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
              >
                {it.icon ? (
                  <span className="text-muted">{it.icon}</span>
                ) : (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.color }} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{it.title}</span>
                  {it.hint && !it.icon && <span className="block truncate text-xs text-muted">{it.hint}</span>}
                </span>
                {it.hint && it.icon && <kbd className="rounded border border-line px-1.5 text-[0.6875rem] text-muted">{it.hint}</kbd>}
              </button>
            </li>
          ))}
          {!items.length && <li className="px-3 py-6 text-center text-sm text-muted">Ничего не нашлось</li>}
        </ul>
      </div>
    </div>
  );
}
