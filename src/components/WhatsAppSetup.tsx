"use client";

import { useState } from "react";
import { Check, CircleAlert, CircleCheck, Copy } from "lucide-react";
import { useCrm } from "@/lib/crm";

/** Статус и пошаговое подключение WhatsApp Cloud API. */
export function WhatsAppSetup() {
  const { wa } = useCrm();
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const webhook = `${origin}/api/whatsapp/webhook`;
  const privacy = `${origin}/privacy`;

  return (
    <div className="rounded-xl border border-line p-4">
      <h3 className="mb-1 font-semibold">WhatsApp</h3>
      <Status />
      <p className="mt-3 text-muted">
        Официальный WhatsApp Business API от Meta. Новый номер, написавший в WhatsApp, сразу становится заявкой в воронке
        (если клиент пришёл из рекламы Instagram, это видно в источнике). Переписка идёт прямо в карточке клиента и в разделе «Чаты».
        Входящие бесплатны, ответы клиенту в течение 24 часов после его сообщения бесплатны в пределах лимита Meta (1000 в месяц).
      </p>

      {!wa.ok && !wa.demo && (
        <>
          <h4 className="mt-4 mb-2 font-medium">Как подключить (один раз, ~30 минут)</h4>
          <ol className="list-decimal space-y-2 pl-5 text-muted">
            <li>
              Нужен номер, который <b className="text-ink">не зарегистрирован в приложении WhatsApp</b> (новая SIM или номер, с которого
              удалили аккаунт WhatsApp). После подключения писать с него можно будет только из CRM.
            </li>
            <li>
              Откройте <Ext href="https://developers.facebook.com/apps">developers.facebook.com/apps</Ext> → «Создать приложение» → сценарий
              «Связь с клиентами через WhatsApp» → привяжите бизнес-портфолио (Meta Business).
            </li>
            <li>В приложении: WhatsApp → «Настройка API» → «Добавить номер телефона», подтвердите номер по SMS.</li>
            <li>
              Там же скопируйте <b className="text-ink">Phone number ID</b> → переменная <Code>WHATSAPP_PHONE_NUMBER_ID</Code>.
            </li>
            <li>
              Постоянный токен: <Ext href="https://business.facebook.com/settings/system-users">Настройки компании → Системные пользователи</Ext> →
              добавить (роль «Администратор») → «Назначить ресурсы» → ваше приложение → «Создать токен», срок «Никогда», разрешения{" "}
              <Code>whatsapp_business_messaging</Code> и <Code>whatsapp_business_management</Code> → переменная <Code>WHATSAPP_TOKEN</Code>.
            </li>
            <li>
              Приложение → Настройки → Основное: «Секрет приложения» → <Code>WHATSAPP_APP_SECRET</Code>. Там же укажите ссылку на политику
              конфиденциальности: <CopyText text={privacy} />
            </li>
            <li>
              Придумайте любое слово-пароль → <Code>WHATSAPP_VERIFY_TOKEN</Code>. Добавьте все 4 переменные в Netlify (Project configuration →
              Environment variables) и запустите деплой.
            </li>
            <li>
              WhatsApp → Конфигурация → Webhook: адрес обратного вызова <CopyText text={webhook} />, маркер подтверждения — то же слово из
              WHATSAPP_VERIFY_TOKEN. Нажмите «Подтвердить» и подпишитесь на поле <Code>messages</Code>.
            </li>
            <li>Переключите приложение в режим «Опубликовано» (Live). Готово — напишите на номер с другого телефона, чат появится в CRM.</li>
          </ol>
          <h4 className="mt-4 mb-1 font-medium">Реклама в Instagram → WhatsApp</h4>
          <p className="text-muted">
            В Ads Manager выберите цель «Сообщения» → место назначения WhatsApp → этот номер. Клиент нажимает кнопку в рекламе, пишет в WhatsApp,
            и в CRM появляется заявка с источником Instagram и названием объявления.
          </p>
        </>
      )}
    </div>
  );
}

function Status() {
  const { wa } = useCrm();
  if (wa.demo) return <p className="flex items-center gap-1.5 text-warn"><CircleAlert size={16} /> Демо-режим: переписка имитируется.</p>;
  if (wa.ok)
    return (
      <p className="flex items-center gap-1.5 text-money">
        <CircleCheck size={16} /> Подключён: {wa.number}
        {wa.name ? `, ${wa.name}` : ""}
        {!wa.secured && <span className="text-warn">. Добавьте WHATSAPP_APP_SECRET для проверки подписи</span>}
      </p>
    );
  if (wa.configured)
    return <p className="flex items-center gap-1.5 text-danger"><CircleAlert size={16} /> Ошибка подключения: {wa.error}. Проверьте WHATSAPP_TOKEN и WHATSAPP_PHONE_NUMBER_ID.</p>;
  return <p className="flex items-center gap-1.5 text-muted"><CircleAlert size={16} /> Не подключён.</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-sunken px-1 text-[0.8125rem] text-ink">{children}</code>;
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">{children}</a>;
}

function CopyText({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="inline-flex max-w-full items-center gap-1 rounded bg-sunken px-1.5 py-0.5 align-middle font-mono text-xs text-ink hover:bg-ink/[0.08]"
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
      title="Скопировать"
    >
      <span className="truncate">{text}</span>
      {done ? <Check size={12} className="shrink-0 text-money" /> : <Copy size={12} className="shrink-0" />}
    </button>
  );
}
