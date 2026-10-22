import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "./client";
import { IS_DEMO } from "./mode";

type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>;
type Listener = (p: Payload) => void;

const listeners = new Set<Listener>();
let channel: RealtimeChannel | null = null;
let retry = 0;

/**
 * Одна подписка на изменения leads на всю вкладку. Канал не пересоздаётся при
 * перемонтировании компонентов (частые join/leave подряд теряли подписку), а при
 * таймауте или обрыве переподключается с паузой. Токен пользователя клиент
 * Supabase подставляет сам: ручной setAuth ломает join.
 */
function connect() {
  const sb = supabase();
  sb.auth.getSession().then(({ data }) => {
    if (!data.session) return;
    channel = sb
      .channel(`leads-live-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, (p: Payload) => listeners.forEach((l) => l(p)))
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") retry = 0;
        if (status === "TIMED_OUT" || status === "CHANNEL_ERROR") {
          const ch = channel;
          channel = null;
          if (ch) sb.removeChannel(ch);
          setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++));
        }
      });
  });
}

export function onLeadsChange(fn: Listener) {
  listeners.add(fn);
  if (!channel && !IS_DEMO && retry === 0) connect();
  return () => { listeners.delete(fn); };
}
