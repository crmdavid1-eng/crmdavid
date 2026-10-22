-- 003: причина отказа. Выполнить в Supabase → SQL Editor. Можно запускать повторно.
alter table leads add column if not exists lost_reason text;
