-- 004: WhatsApp — чаты в карточке, непрочитанные, последнее сообщение.
-- Выполнить в Supabase → SQL Editor. Можно запускать повторно.

-- Лид: непрочитанные и последнее сообщение (для списка чатов и бейджей)
alter table leads add column if not exists unread int not null default 0;
alter table leads add column if not exists last_message text;
alter table leads add column if not exists last_message_at timestamptz;
create index if not exists leads_last_message_idx on leads(last_message_at desc nulls last);

-- Сообщение: id в WhatsApp (wamid) — защита от дублей при повторной доставке вебхука
alter table activities add column if not exists external_id text;
create unique index if not exists activities_external_idx on activities(external_id) where external_id is not null;

-- Атомарно +1 к непрочитанным и обновить последнее сообщение
create or replace function bump_lead_message(p_lead uuid, p_text text, p_at timestamptz, p_incoming boolean)
returns void language sql security definer set search_path = public as $$
  update leads set
    unread = case when p_incoming then unread + 1 else 0 end,
    last_message = left(p_text, 200),
    last_message_at = greatest(coalesce(last_message_at, p_at), p_at)
  where id = p_lead;
$$;
revoke all on function bump_lead_message(uuid, text, timestamptz, boolean) from public, anon, authenticated;
