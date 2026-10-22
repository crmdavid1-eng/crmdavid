"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Check, Copy } from "lucide-react";
import { Modal } from "@/components/Modal";

export function IntegrationsModal({ demo, onClose }: { demo?: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (demo) return;
    supabase().auth.getSession().then(async ({ data }) => {
      const res = await fetch("/api/webhook-url", { headers: { authorization: `Bearer ${data.session?.access_token}` } });
      if (res.ok) setToken((await res.json()).token);
    });
  }, [demo]);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/api/leads/incoming?token=${token}`;

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal title="Источники заявок" onClose={onClose} wide>
      <div className="space-y-5 text-sm">
        <section>
          <h3 className="mb-1 font-semibold">Вебхук для новых заявок</h3>
          <p className="mb-2 text-muted">
            Любой сервис, который умеет отправлять POST-запрос, может создавать заявки в CRM. Заявка попадёт в первый этап первой воронки.
          </p>
          {token ? (
            <div className="flex gap-2">
              <input readOnly className="input font-mono text-xs" value={url} onFocus={(e) => e.target.select()} />
              <button className="btn-outline shrink-0" onClick={copy}>
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Скопировано" : "Копировать"}
              </button>
            </div>
          ) : (
            <p className="rounded-lg bg-amber-50 p-3 text-amber-800">{demo ? "В демо-режиме вебхук не работает: сначала подключите Supabase." : "Адрес загружается. Если он не появился, проверьте переменную WEBHOOK_SECRET в настройках Netlify."}</p>
          )}
          <p className="mt-2 text-xs text-muted">
            Поля: <code>name</code>, <code>phone</code>, <code>instagram</code>, <code>email</code>, <code>source</code>,{" "}
            <code>amount</code>, <code>note</code>, <code>pipeline</code>, <code>stage</code>. Повторная заявка с тем же телефоном не создаёт дубль, а
            добавляется в историю.
          </p>
        </section>

        <section>
          <h3 className="mb-1 font-semibold">Instagram / Facebook лид-формы</h3>
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>Зарегистрируйтесь в make.com (бесплатно, 1000 операций в месяц).</li>
            <li>Создайте сценарий: «Facebook Lead Ads → Watch Leads» → «HTTP → Make a request».</li>
            <li>В HTTP укажите URL выше, метод POST, тело JSON: name, phone, source = Instagram.</li>
          </ol>
        </section>

        <section>
          <h3 className="mb-1 font-semibold">Tilda и формы на сайте</h3>
          <p className="text-muted">Tilda → Настройки сайта → Формы → Webhook → вставьте URL. Поля Name, Phone, Email распознаются автоматически.</p>
        </section>

        <section className="rounded-lg bg-black/[0.03] p-3">
          <h3 className="mb-1 font-semibold">WhatsApp</h3>
          <p className="text-muted">Скоро: входящие сообщения будут автоматически создавать заявку и сохраняться в истории.</p>
        </section>
      </div>
    </Modal>
  );
}
