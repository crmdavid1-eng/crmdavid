"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, Check, CheckCheck, Clock3, ExternalLink, FileText, MessageCircle, Send, Settings } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { authedFetch } from "@/lib/api";
import { useCrm } from "@/lib/crm";
import type { Activity, Lead } from "@/lib/types";
import { fillTemplate, waLink } from "@/lib/format";
import { toast } from "@/lib/toast";

const WINDOW_MS = 24 * 3600_000;

type Msg = Activity & { pending?: boolean };

/** Переписка WhatsApp внутри карточки клиента. */
export function ChatPanel({ lead }: { lead: Lead }) {
  const crm = useCrm();
  const sb = supabase();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showTpl, setShowTpl] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const { wa } = crm;

  const [now, setNow] = useState(() => Date.now());

  const fetchMsgs = useCallback(
    () =>
      sb
        .from("activities")
        .select("*")
        .eq("lead_id", lead.id)
        .in("kind", ["message_in", "message_out"])
        .order("created_at", { ascending: true })
        .limit(500)
        .then(({ data }: { data: Activity[] | null }) => data ?? []),
    [sb, lead.id],
  );

  const load = useCallback(async () => {
    const data = await fetchMsgs();
    setMsgs((cur) => [...data, ...cur.filter((m) => m.pending)]);
    setLoaded(true);
    setNow(Date.now());
  }, [fetchMsgs]);

  // Новые сообщения: перечитываем при изменении последнего сообщения у лида (realtime / опрос)
  // и раз в 5 секунд, пока чат открыт
  useEffect(() => {
    let alive = true;
    const run = () =>
      fetchMsgs().then((data) => {
        if (!alive) return;
        setMsgs((cur) => [...data, ...cur.filter((m) => m.pending)]);
        setLoaded(true);
        setNow(Date.now());
      });
    run();
    const t = setInterval(run, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [fetchMsgs, lead.last_message_at]);

  // Чат открыт — непрочитанные сброшены, клиенту синие галочки
  const { updateLead } = crm;
  useEffect(() => {
    if (!lead.unread) return;
    if (wa.demo) updateLead(lead.id, { unread: 0 });
    else authedFetch("/api/whatsapp/read", { method: "POST", body: JSON.stringify({ leadId: lead.id }) }).then(() => updateLead(lead.id, { unread: 0 }));
  }, [lead.id, lead.unread, wa.demo, updateLead]);

  // Прокрутка вниз при новых сообщениях, если пользователь и так был внизу
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const lastIn = [...msgs].reverse().find((m) => m.kind === "message_in");
  const windowOpen = lastIn ? now - new Date(lastIn.created_at).getTime() < WINDOW_MS : false;
  const windowLeft = lastIn ? new Date(new Date(lastIn.created_at).getTime() + WINDOW_MS) : null;
  const canSend = wa.configured && Boolean(lead.phone) && (windowOpen || wa.demo);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    const temp: Msg = {
      id: `tmp-${Date.now()}`, lead_id: lead.id, kind: "message_out", body, meta: { status: "sending" }, created_at: new Date().toISOString(), pending: true,
    };
    atBottom.current = true;
    setMsgs((m) => [...m, temp]);

    if (wa.demo) {
      await sb.from("activities").insert({ lead_id: lead.id, kind: "message_out", body, meta: { channel: "whatsapp", status: "read" } });
      await updateLead(lead.id, { last_message: body, last_message_at: new Date().toISOString(), unread: 0 });
    } else {
      const res = await authedFetch("/api/whatsapp/send", { method: "POST", body: JSON.stringify({ leadId: lead.id, text: body }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json.error || "Не удалось отправить", { tone: "error" });
        setText(body);
      }
    }
    setMsgs((m) => m.filter((x) => x.id !== temp.id));
    await load();
    setSending(false);
  }

  if (!wa.configured) {
    return (
      <Empty>
        <MessageCircle size={28} className="text-wa" />
        <p className="font-medium">WhatsApp ещё не подключён</p>
        <p className="text-sm text-muted">
          После подключения здесь будет переписка с клиентом: новые сообщения приходят сами, отвечать можно прямо из CRM.
        </p>
        <Link href="/settings?s=sources" className="btn-outline mt-1" onClick={() => crm.openLead(null)}>
          <Settings size={16} /> Как подключить
        </Link>
        {lead.phone && (
          <a href={waLink(lead.phone)} target="_blank" rel="noreferrer" className="btn-ghost text-wa">
            <ExternalLink size={16} /> Открыть чат в WhatsApp
          </a>
        )}
      </Empty>
    );
  }

  if (!lead.phone) {
    return (
      <Empty>
        <p className="font-medium">У клиента не указан телефон</p>
        <p className="text-sm text-muted">Добавьте номер во вкладке «Карточка», чтобы переписываться в WhatsApp.</p>
      </Empty>
    );
  }

  return (
    <>
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="scroll-thin flex-1 overflow-y-auto bg-sunken px-3 py-4"
      >
        {loaded && !msgs.length && (
          <p className="mx-auto mt-10 max-w-xs text-center text-sm text-muted">
            Сообщений пока нет. Когда клиент напишет на ваш WhatsApp, переписка появится здесь.
          </p>
        )}
        {msgs.map((m, i) => {
          const day = dayLabel(m.created_at);
          const showDay = i === 0 || dayLabel(msgs[i - 1].created_at) !== day;
          return (
            <div key={m.id}>
              {showDay && (
                <p className="my-3 text-center">
                  <span className="rounded-full bg-panel px-2.5 py-0.5 text-[0.6875rem] text-muted shadow-sm">{day}</span>
                </p>
              )}
              <Bubble m={m} />
            </div>
          );
        })}
      </div>

      {!windowOpen && !wa.demo && (
        <div className="flex items-start gap-2 border-t border-line bg-warn-soft px-3 py-2 text-xs text-warn">
          <Clock3 size={14} className="mt-0.5 shrink-0" />
          <p className="flex-1">
            {lastIn
              ? "Клиент писал больше 24 часов назад. По правилам WhatsApp первым можно написать только с телефона или шаблоном Meta."
              : "Клиент ещё не писал на этот номер. Первое сообщение отправьте с телефона — дальше переписка пойдёт здесь."}
          </p>
          <a href={waLink(lead.phone)} target="_blank" rel="noreferrer" className="shrink-0 font-semibold underline-offset-2 hover:underline">
            Открыть WhatsApp
          </a>
        </div>
      )}
      {windowOpen && windowLeft && windowLeft.getTime() - now < 3 * 3600_000 && (
        <p className="border-t border-line bg-warn-soft px-3 py-1.5 text-xs text-warn">
          Окно для ответа закроется в {windowLeft.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="relative flex items-end gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {crm.templates.length > 0 && (
          <div className="relative">
            <button
              type="button"
              className="btn-ghost h-[2.625rem] w-[2.625rem] p-0 text-muted"
              onClick={() => setShowTpl(!showTpl)}
              disabled={!canSend}
              aria-label="Шаблоны"
              title="Шаблоны"
            >
              <FileText size={18} />
            </button>
            {showTpl && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowTpl(false)} />
                <div className="sheet-in absolute bottom-full left-0 z-20 mb-1 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-xl">
                  {crm.templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left hover:bg-ink/[0.04]"
                      onClick={() => { setText(fillTemplate(t.body, lead)); setShowTpl(false); }}
                    >
                      <span className="block text-sm font-medium">{t.title}</span>
                      <span className="line-clamp-2 text-xs text-muted">{fillTemplate(t.body, lead)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <textarea
          className="input max-h-40 min-h-[2.625rem] flex-1 resize-none"
          rows={1}
          value={text}
          disabled={!canSend}
          placeholder={canSend ? "Сообщение в WhatsApp" : "Ответить можно после сообщения клиента"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn h-[2.625rem] w-[2.625rem] bg-wa p-0 text-white hover:brightness-110" disabled={!canSend || !text.trim() || sending} aria-label="Отправить">
          <Send size={16} />
        </button>
      </form>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">{children}</div>;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Сегодня";
  if (d.toDateString() === y.toDateString()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function Bubble({ m }: { m: Msg }) {
  const out = m.kind === "message_out";
  const meta = (m.meta ?? {}) as { status?: string; media?: string; type?: string; mime?: string; error?: string; channel?: string };
  const time = new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  // Сообщения, отправленные через wa.me до подключения API, — только запись, без статуса
  const manual = out && !meta.channel;

  return (
    <div className={`mb-1.5 flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm shadow-[0_1px_1px_rgb(0_0_0/0.06)] ${
          out ? "rounded-br-md bg-wa-soft" : "rounded-bl-md bg-panel"
        } ${m.pending ? "opacity-70" : ""}`}
      >
        {meta.media && meta.type === "image" && <WaImage id={meta.media} />}
        {meta.media && meta.type && meta.type !== "image" && <WaFile id={meta.media} label={m.body} />}
        {!(meta.media && meta.type && meta.type !== "image") && <p className="break-words whitespace-pre-wrap">{m.body}</p>}
        <p className="mt-0.5 flex items-center justify-end gap-1 text-[0.6875rem] text-muted tabular-nums">
          {manual && <span>через телефон ·</span>}
          {time}
          {out && !manual && <StatusIcon status={meta.status} />}
        </p>
        {meta.status === "failed" && meta.error && <p className="text-xs text-danger">Не доставлено: {meta.error}</p>}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status?: string }) {
  if (status === "sending") return <Clock3 size={12} />;
  if (status === "failed") return <AlertCircle size={12} className="text-danger" />;
  if (status === "read") return <CheckCheck size={14} className="text-accent" />;
  if (status === "delivered") return <CheckCheck size={14} />;
  return <Check size={14} />;
}

/** Фото из WhatsApp: тянем через наш прокси с токеном и показываем как blob. */
function WaImage({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url: string | null = null;
    authedFetch(`/api/whatsapp/media/${id}`)
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => { url = URL.createObjectURL(b); setSrc(url); })
      .catch(() => setFailed(true));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [id]);
  if (failed) return <p className="text-xs text-muted">Фото недоступно (WhatsApp хранит файлы около 30 дней)</p>;
  if (!src) return <div className="mb-1 h-40 w-56 animate-pulse rounded-lg bg-ink/[0.06]" />;
  return (
    <a href={src} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Фото от клиента" className="mb-1 max-h-72 rounded-lg" />
    </a>
  );
}

function WaFile({ id, label }: { id: string; label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="flex items-center gap-2 text-left underline-offset-2 hover:underline disabled:opacity-60"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await authedFetch(`/api/whatsapp/media/${id}`);
        setBusy(false);
        if (!r.ok) return toast("Файл недоступен: WhatsApp хранит медиа около 30 дней", { tone: "error" });
        window.open(URL.createObjectURL(await r.blob()), "_blank");
      }}
    >
      <span className="whitespace-pre-wrap">{label}</span>
    </button>
  );
}
