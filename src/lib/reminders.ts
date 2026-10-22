"use client";

import { useEffect } from "react";
import type { Lead } from "@/lib/types";
import { toast } from "@/lib/toast";

const KEY = "crm.reminded";

function remembered(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(KEY) ?? "[]")); } catch { return new Set(); }
}
function remember(ids: Set<string>) {
  try { sessionStorage.setItem(KEY, JSON.stringify([...ids].slice(-500))); } catch {}
}

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

/**
 * Пока CRM открыта: когда наступает срок следующего шага — системное уведомление
 * (если разрешено) или всплывашка внутри приложения. Каждое дело напоминается один раз.
 */
export function useReminders(leads: Lead[], open: (id: string) => void) {
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const seen = remembered();
      for (const l of leads) {
        if (!l.next_action_at) continue;
        const at = new Date(l.next_action_at).getTime();
        const key = `${l.id}:${l.next_action_at}`;
        // напоминаем о сроках, наступивших за последние 10 минут — старые просрочки не спамим
        if (at > now || now - at > 10 * 60_000 || seen.has(key)) continue;
        seen.add(key);
        const title = `Пора: ${l.next_action || "связаться"}`;
        const body = l.name || l.phone || "Заявка";
        if (notificationsSupported() && Notification.permission === "granted" && document.visibilityState !== "visible") {
          const n = new Notification(title, { body, tag: key, icon: "/icon-192.png" });
          n.onclick = () => { window.focus(); open(l.id); n.close(); };
        } else {
          toast(`${title} — ${body}`, { action: { label: "Открыть", run: () => open(l.id) } });
        }
      }
      remember(seen);
    };
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [leads, open]);
}
