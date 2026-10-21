-- CRM David — схема БД. Выполнить один раз в Supabase → SQL Editor.
-- CRM однопользовательская: доступ есть у любого авторизованного пользователя
-- (регистрацию в Supabase нужно отключить, пользователь создаётся вручную).

create extension if not exists pgcrypto;

-- Воронки
create table if not exists pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Этапы воронки
create table if not exists stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists stages_pipeline_idx on stages(pipeline_id, position);

-- Лиды / заявки
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  stage_id uuid not null references stages(id) on delete restrict,
  name text not null default '',
  phone text,
  instagram text,
  email text,
  source text,
  amount numeric(14,2),
  note text,
  position double precision not null default 0,
  external_id text,           -- id во внешней системе (лид-форма, чат WhatsApp и т.п.)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_stage_idx on leads(stage_id, position);
create index if not exists leads_pipeline_idx on leads(pipeline_id);
create index if not exists leads_phone_idx on leads(phone);
create unique index if not exists leads_external_idx on leads(source, external_id) where external_id is not null;

-- Лента: комментарии, смены этапов, входящие сообщения
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  kind text not null default 'comment', -- comment | stage | created | message_in | message_out
  body text not null default '',
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activities_lead_idx on activities(lead_id, created_at desc);

-- updated_at
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists leads_touch on leads;
create trigger leads_touch before update on leads for each row execute function touch_updated_at();

-- Автолог смены этапа
create or replace function log_stage_change() returns trigger language plpgsql as $$
declare old_name text; new_name text;
begin
  if new.stage_id is distinct from old.stage_id then
    select name into old_name from stages where id = old.stage_id;
    select name into new_name from stages where id = new.stage_id;
    insert into activities(lead_id, kind, body, meta)
    values (new.id, 'stage', coalesce(old_name,'?') || ' → ' || coalesce(new_name,'?'),
            jsonb_build_object('from', old.stage_id, 'to', new.stage_id));
  end if;
  return new;
end $$;
drop trigger if exists leads_stage_log on leads;
create trigger leads_stage_log after update on leads for each row execute function log_stage_change();

-- RLS: только авторизованные
alter table pipelines enable row level security;
alter table stages enable row level security;
alter table leads enable row level security;
alter table activities enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pipelines','stages','leads','activities'] loop
    execute format('drop policy if exists "auth_all" on %I', t);
    execute format('create policy "auth_all" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Воронка по умолчанию
do $$
declare p uuid;
begin
  if not exists (select 1 from pipelines) then
    insert into pipelines(name, position) values ('Продажи', 0) returning id into p;
    insert into stages(pipeline_id, name, color, position) values
      (p, 'Новая заявка', '#3b82f6', 0),
      (p, 'Связались', '#8b5cf6', 1),
      (p, 'Думает', '#f59e0b', 2),
      (p, 'Оплата', '#10b981', 3),
      (p, 'Отказ', '#ef4444', 4);
  end if;
end $$;
