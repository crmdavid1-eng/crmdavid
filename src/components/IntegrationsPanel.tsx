"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/components/AuthGate";
import { WhatsAppSetup } from "@/components/WhatsAppSetup";

export function IntegrationsPanel() {
  const { demo } = useSession();
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (demo) return;
    supabase().auth.getSession().then(async ({ data }) => {
      const res = await fetch("/api/webhook-url", { headers: { authorization: `Bearer ${data.session?.access_token}` } });
      if (res.ok) setToken((await res.json()).token);
    });
  }, [demo]);

  const url = token && typeof window !== "undefined" ? `${window.location.origin}/api/leads/incoming?token=${token}` : "";

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6 text-sm">
      <WhatsAppSetup />

      <div>
        <h3 className="mb-1 font-semibold">Адрес для новых заявок</h3>
        <p className="mb-2 text-muted">
          Любой сервис, который умеет отправлять запрос на адрес (Make, Tilda, формы сайта), может создавать заявки.
          Они появятся в первом этапе первой воронки, а на доске сразу всплывёт уведомление.
        </p>
        {url ? (
          <div className="flex gap-2">
            <input readOnly className="input font-mono text-xs" value={url} onFocus={(e) => e.target.select()} />
            <button className="btn-outline shrink-0" onClick={copy}>
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
        ) : (
          <p className="rounded-lg bg-warn-soft p-3 text-warn">
            {demo
              ? "В демо-режиме адрес не работает: сначала подключите Supabase."
              : "Загружаем адрес… Если он не появился, проверьте переменную WEBHOOK_SECRET в Netlify."}
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          Поля: <code>name</code>, <code>phone</code>, <code>instagram</code>, <code>email</code>, <code>source</code>, <code>amount</code>,{" "}
          <code>note</code>, <code>pipeline</code>, <code>stage</code>. Повторная заявка с тем же телефоном не создаёт дубль, а пишется в историю клиента.
        </p>
      </div>

      <div>
        <h3 className="mb-1 font-semibold">Лид-формы Instagram и Facebook</h3>
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li>Зарегистрируйтесь в make.com (бесплатно до 1000 операций в месяц).</li>
          <li>Создайте сценарий «Facebook Lead Ads → Watch Leads», затем добавьте «HTTP → Make a request».</li>
          <li>В HTTP укажите адрес выше, метод POST, тело JSON с полями name, phone и source = Instagram.</li>
        </ol>
      </div>

      <div>
        <h3 className="mb-1 font-semibold">Tilda и формы на сайте</h3>
        <p className="text-muted">Tilda → Настройки сайта → Формы → Webhook → вставьте адрес. Поля Name, Phone и Email распознаются сами.</p>
      </div>

    </div>
  );
}
