-- 002: следующий шаг, теги, типы этапов, шаблоны сообщений, realtime.
-- Выполнить в Supabase → SQL Editor. Можно запускать повторно.

-- Лиды: следующий шаг, теги, когда попал на текущий этап
alter table leads add column if not exists next_action text;
alter table leads add column if not exists next_action_at timestamptz;
alter table leads add column if not exists tags text[] not null default '{}';
alter table leads add column if not exists stage_changed_at timestamptz not null default now();
update leads set stage_changed_at = coalesce(updated_at, created_at) where stage_changed_at is null;
create index if not exists leads_next_action_idx on leads(next_action_at) where next_action_at is not null;

-- Этапы: open | won | lost — для конверсии и аналитики
alter table stages add column if not exists kind text not null default 'open';
do $$ begin
  alter table stages add constraint stages_kind_check check (kind in ('open','won','lost'));
exception when duplicate_object then null; end $$;
update stages set kind = 'won'  where kind = 'open' and lower(name) in ('оплата','успешно','оплачено','продажа');
update stages set kind = 'lost' where kind = 'open' and lower(name) in ('отказ','потерян','не целевой');

-- Время смены этапа
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.stage_id is distinct from old.stage_id then new.stage_changed_at = now(); end if;
  return new;
end $$;

-- Шаблоны сообщений
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table templates enable row level security;
drop policy if exists "auth_all" on templates;
create policy "auth_all" on templates for all to authenticated using (true) with check (true);

insert into templates(title, body, position)
select * from (values
  ('Первое касание', 'Здравствуйте, {имя}! Получили вашу заявку. Удобно сейчас обсудить детали?', 0),
  ('Напоминание', '{имя}, добрый день! Напоминаю о нашем разговоре. Остались вопросы?', 1),
  ('Реквизиты для оплаты', '{имя}, отправляю реквизиты для оплаты. После оплаты пришлите, пожалуйста, чек.', 2)
) v(title, body, position)
where not exists (select 1 from templates);

-- Realtime: новые заявки появляются на доске сами
do $$ begin
  alter publication supabase_realtime add table leads;
exception when duplicate_object then null; when undefined_object then null; end $$;
