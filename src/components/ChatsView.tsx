"use client";

import { useMemo, useState } from "react";
import { MessageCircle, PanelRightOpen, Search } from "lucide-react";
import { useCrm } from "@/lib/crm";
import { formatPhone } from "@/lib/format";
import { ChatPanel } from "@/components/ChatPanel";

/** Все переписки WhatsApp: свежие сверху, непрочитанные выделены. */
export function ChatsView() {
  const crm = useCrm();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const chats = useMemo(() => {
    const query = q.trim().toLowerCase();
    const digits = query.replace(/\D/g, "");
    return crm.leads
      .filter((l) => l.last_message_at)
      .filter(
        (l) =>
          !query ||
          l.name.toLowerCase().includes(query) ||
          (digits.length >= 3 && l.phone?.replace(/\D/g, "").includes(digits)) ||
          l.last_message?.toLowerCase().includes(query),
      )
      .sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
  }, [crm.leads, q]);

  const current = crm.leads.find((l) => l.id === selected) ?? null;
  const unreadTotal = chats.reduce((s, l) => s + l.unread, 0);

  function open(id: string) {
    // На телефоне — карточка во весь экран, на компьютере — справа
    if (window.matchMedia("(min-width: 768px)").matches) setSelected(id);
    else crm.openLead(id, "chat");
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[110rem] flex-1 md:p-6 md:pt-5">
      <div className="flex min-h-0 flex-1 overflow-hidden border-line bg-panel md:rounded-2xl md:border">
        {/* Список диалогов */}
        <section className="flex min-h-0 w-full flex-col md:w-[22rem] md:shrink-0 md:border-r md:border-line">
          <header className="px-4 pt-4 pb-3">
            <h1 className="flex items-baseline gap-2 text-xl font-semibold tracking-tight">
              Чаты
              {unreadTotal > 0 && <span className="text-sm font-medium text-wa">{unreadTotal} новых</span>}
            </h1>
            <div className="relative mt-3">
              <Search size={15} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
              <input className="input py-1.5 pl-8" placeholder="Имя, телефон или текст" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </header>
          <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            {chats.map((l) => {
              const stage = crm.stageById.get(l.stage_id);
              const on = l.id === selected;
              return (
                <li key={l.id}>
                  <button
                    onClick={() => open(l.id)}
                    className={`flex w-full items-start gap-3 border-b border-line/60 px-4 py-3 text-left transition ${on ? "bg-accent-soft" : "hover:bg-sunken"}`}
                  >
                    <Avatar name={l.name || l.phone || "?"} color={stage?.color} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={`flex-1 truncate ${l.unread ? "font-semibold" : "font-medium"}`}>
                          {l.name || formatPhone(l.phone) || "Без имени"}
                        </span>
                        <span className={`shrink-0 text-[0.6875rem] tabular-nums ${l.unread ? "font-semibold text-wa" : "text-muted"}`}>
                          {shortTime(l.last_message_at!)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className={`flex-1 truncate text-sm ${l.unread ? "text-ink" : "text-muted"}`}>{l.last_message}</span>
                        {l.unread > 0 && (
                          <span className="min-w-5 rounded-full bg-wa px-1.5 text-center text-[0.6875rem] leading-5 font-semibold text-white tabular-nums">
                            {l.unread}
                          </span>
                        )}
                      </span>
                      {stage && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[0.6875rem] text-muted">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: stage.color }} /> {stage.name}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
            {!chats.length && (
              <li className="px-6 py-10 text-center text-sm text-muted">
                {q
                  ? "Ничего не нашлось."
                  : crm.wa.configured
                    ? "Переписок пока нет. Когда клиент напишет на ваш WhatsApp, чат появится здесь, а клиент — в воронке."
                    : "Подключите WhatsApp в Настройках → Источники заявок: новые чаты будут появляться здесь и в воронке."}
              </li>
            )}
          </ul>
        </section>

        {/* Переписка — только на компьютере */}
        <section className="hidden min-w-0 flex-1 flex-col md:flex">
          {current ? (
            <>
              <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                <Avatar name={current.name || current.phone || "?"} color={crm.stageById.get(current.stage_id)?.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{current.name || "Без имени"}</p>
                  <p className="text-xs text-muted tabular-nums">{formatPhone(current.phone)}</p>
                </div>
                <button className="btn-outline" onClick={() => crm.openLead(current.id, "card")}>
                  <PanelRightOpen size={16} /> Карточка
                </button>
              </header>
              <div className="flex min-h-0 flex-1 flex-col">
                <ChatPanel key={current.id} lead={current} />
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted">
              <MessageCircle size={32} strokeWidth={1.5} />
              <p className="text-sm">Выберите чат слева</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Avatar({ name, color }: { name: string; color?: string }) {
  const letters = name
    .replace(/^\+/, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ background: color ?? "var(--c-muted)" }}
    >
      {letters}
    </span>
  );
}

function shortTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
