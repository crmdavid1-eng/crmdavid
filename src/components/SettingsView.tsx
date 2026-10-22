"use client";

import { useState } from "react";
import { Bell, Columns3, FileSpreadsheet, LogOut, MessageSquareText, Monitor, Moon, Palette, Plug, Plus, Sun, Trash2, UserRound } from "lucide-react";
import { useCrm } from "@/lib/crm";
import { supabase } from "@/lib/supabase/client";
import { fillTemplate } from "@/lib/format";
import { setTheme, useTheme, type Theme } from "@/lib/theme";
import { toast } from "@/lib/toast";
import { notificationsSupported } from "@/lib/reminders";
import { useSession } from "@/components/AuthGate";
import { PipelineSettings } from "@/components/PipelineSettings";
import { ImportPanel } from "@/components/ImportPanel";
import { IntegrationsPanel } from "@/components/IntegrationsPanel";

const SECTIONS = [
  { id: "pipelines", label: "Воронки и этапы", icon: Columns3 },
  { id: "templates", label: "Шаблоны сообщений", icon: MessageSquareText },
  { id: "sources", label: "Источники заявок", icon: Plug },
  { id: "excel", label: "Excel", icon: FileSpreadsheet },
  { id: "look", label: "Оформление и уведомления", icon: Palette },
  { id: "account", label: "Аккаунт", icon: UserRound },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function SettingsView() {
  const [section, setSection] = useState<SectionId>("pipelines");
  const current = SECTIONS.find((s) => s.id === section)!;

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 pt-4 pb-10 md:px-6 md:pt-8">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Настройки</h1>

        <div className="mt-5 md:mt-6 md:grid md:grid-cols-[200px_1fr] md:gap-8">
          <nav className="scroll-thin -mx-4 flex gap-1 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-col md:px-0" aria-label="Разделы настроек">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                aria-current={section === s.id ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  section === s.id ? "bg-panel font-medium shadow-sm" : "text-muted hover:bg-ink/[0.04] hover:text-ink"
                }`}
              >
                <s.icon size={16} /> {s.label}
              </button>
            ))}
          </nav>

          <section className="mt-4 rounded-2xl border border-line bg-panel p-4 md:mt-0 md:p-6" aria-label={current.label}>
            <h2 className="mb-5 text-lg font-semibold">{current.label}</h2>
            {section === "pipelines" && <PipelineSettings />}
            {section === "templates" && <TemplatesPanel />}
            {section === "sources" && <IntegrationsPanel />}
            {section === "excel" && <ImportPanel />}
            {section === "look" && <LookPanel />}
            {section === "account" && <AccountPanel />}
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------- Шаблоны ---------- */

function TemplatesPanel() {
  const crm = useCrm();
  const [draft, setDraft] = useState<{ id?: string; title: string; body: string } | null>(null);
  const sample = { name: "Айгерим Касымова", amount: 50000 };

  async function save() {
    if (!draft?.title.trim() || !draft.body.trim()) return;
    await crm.saveTemplate({ ...draft, title: draft.title.trim(), body: draft.body.trim() });
    setDraft(null);
    toast("Шаблон сохранён");
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Готовые тексты для WhatsApp. В карточке клиента нажмите WhatsApp и выберите шаблон: чат откроется с этим текстом.
        Пишите <code className="rounded bg-sunken px-1">{"{имя}"}</code> и <code className="rounded bg-sunken px-1">{"{сумма}"}</code>, они заменятся данными клиента.
      </p>

      <ul className="space-y-2">
        {crm.templates.map((t) =>
          draft?.id === t.id ? null : (
            <li key={t.id} className="group rounded-xl border border-line p-3">
              <div className="flex items-start gap-2">
                <button className="min-w-0 flex-1 text-left" onClick={() => setDraft({ id: t.id, title: t.title, body: t.body })}>
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted">{t.body}</p>
                </button>
                <button
                  onClick={() => confirm(`Удалить шаблон «${t.title}»?`) && crm.deleteTemplate(t.id)}
                  className="btn-ghost p-1.5 text-muted hover:text-danger"
                  aria-label="Удалить шаблон"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ),
        )}
      </ul>

      {draft ? (
        <div className="mt-3 space-y-2 rounded-xl border border-accent/40 p-3">
          <input className="input" placeholder="Название, например «Первое касание»" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus />
          <textarea className="input min-h-28" placeholder="Здравствуйте, {имя}! …" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          {draft.body && (
            <p className="rounded-lg bg-wa-soft p-2.5 text-sm">
              <span className="mb-0.5 block text-xs text-muted">Так увидит клиент:</span>
              {fillTemplate(draft.body, sample)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setDraft(null)}>Отмена</button>
            <button className="btn-accent" onClick={save} disabled={!draft.title.trim() || !draft.body.trim()}>Сохранить шаблон</button>
          </div>
        </div>
      ) : (
        <button className="btn-outline mt-3" onClick={() => setDraft({ title: "", body: "" })}>
          <Plus size={16} /> Новый шаблон
        </button>
      )}
    </div>
  );
}

/* ---------- Оформление ---------- */

function LookPanel() {
  const theme = useTheme();
  const options: { id: Theme; label: string; icon: typeof Sun }[] = [
    { id: "light", label: "Светлая", icon: Sun },
    { id: "dark", label: "Тёмная", icon: Moon },
    { id: "system", label: "Как в системе", icon: Monitor },
  ];
  return (
    <div>
      <p className="mb-3 text-sm text-muted">Тема</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => setTheme(o.id)}
            aria-pressed={theme === o.id}
            className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition ${
              theme === o.id ? "border-accent bg-accent-soft font-medium text-accent" : "border-line hover:border-ink/30"
            }`}
          >
            <o.icon size={20} />
            {o.label}
          </button>
        ))}
      </div>
      <NotificationsToggle />

      <p className="mt-6 mb-2 text-sm text-muted">Горячие клавиши</p>
      <ul className="space-y-1.5 text-sm">
        <li><Kbd>Ctrl+K</Kbd> найти клиента или перейти в раздел</li>
        <li><Kbd>N</Kbd> новая заявка</li>
        <li><Kbd>/</Kbd> поиск по заявкам</li>
        <li><Kbd>Esc</Kbd> закрыть карточку или окно</li>
      </ul>
    </div>
  );
}

function NotificationsToggle() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(() =>
    notificationsSupported() ? Notification.permission : "unsupported",
  );
  return (
    <div className="mt-6">
      <p className="mb-2 text-sm text-muted">Напоминания о делах</p>
      {perm === "granted" ? (
        <p className="flex items-center gap-2 text-sm"><Bell size={16} className="text-money" /> Включены: когда наступит срок дела, придёт уведомление, даже если вкладка CRM в фоне.</p>
      ) : perm === "denied" ? (
        <p className="text-sm text-muted">Уведомления запрещены в браузере. Разрешите их в настройках сайта (значок замка в адресной строке).</p>
      ) : perm === "unsupported" ? (
        <p className="text-sm text-muted">Этот браузер не поддерживает уведомления. Напоминания будут всплывать внутри CRM.</p>
      ) : (
        <button className="btn-outline" onClick={() => Notification.requestPermission().then(setPerm)}>
          <Bell size={16} /> Включить уведомления
        </button>
      )}
      <p className="mt-2 text-xs text-muted">Напоминания работают, пока CRM открыта в браузере или установлена как приложение.</p>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="mr-2 inline-block min-w-7 rounded-md border border-line bg-sunken px-1.5 py-0.5 text-center text-xs font-semibold">{children}</kbd>;
}

/* ---------- Аккаунт ---------- */

function AccountPanel() {
  const { login, demo } = useSession();
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const mismatch = pass2.length > 0 && pass !== pass2;

  async function change(e: React.FormEvent) {
    e.preventDefault();
    if (pass.length < 8 || mismatch) return;
    setBusy(true);
    const { error } = await supabase().auth.updateUser({ password: pass });
    setBusy(false);
    if (error) return toast(`Пароль не изменён: ${error.message}`, { tone: "error" });
    setPass("");
    setPass2("");
    toast("Пароль изменён");
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">Вы вошли как</p>
        <p className="text-lg font-semibold">{login}</p>
      </div>

      {!demo && (
        <form onSubmit={change} className="max-w-sm space-y-2">
          <h3 className="text-sm font-semibold">Сменить пароль</h3>
          <input className="input" type="password" autoComplete="new-password" placeholder="Новый пароль, от 8 символов" value={pass} onChange={(e) => setPass(e.target.value)} />
          <input className="input" type="password" autoComplete="new-password" placeholder="Повторите пароль" value={pass2} onChange={(e) => setPass2(e.target.value)} />
          {mismatch && <p className="text-xs text-danger">Пароли не совпадают</p>}
          <button className="btn-primary" disabled={busy || pass.length < 8 || pass !== pass2}>
            {busy ? "Сохраняем…" : "Сменить пароль"}
          </button>
        </form>
      )}

      {!demo && (
        <button className="btn-outline text-danger" onClick={() => supabase().auth.signOut()}>
          <LogOut size={16} /> Выйти
        </button>
      )}
    </div>
  );
}
