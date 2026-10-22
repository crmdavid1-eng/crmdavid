# CRM — учёт заявок

Лёгкая CRM: воронки с канбаном, карточки лидов с комментариями, импорт/экспорт Excel, вебхук для входящих заявок.
Стек: Next.js 16 + Supabase (Postgres + Auth), хостинг — Vercel. Всё укладывается в бесплатные тарифы.

## Запуск с нуля

1. **Supabase** (supabase.com → New project, регион Frankfurt):
   - SQL Editor → выполнить по очереди `supabase/schema.sql` и всё из `supabase/migrations/` (по номерам).
   - Authentication → Sign In / Providers → Email: **выключить** «Allow new users to sign up».
   - Authentication → Users → Add user → email + пароль заказчика (галочка Auto Confirm).
   - Project Settings → API: скопировать URL, `anon` key и `service_role` key.
2. **Netlify** → Import из GitHub → Environment Variables (см. `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `WEBHOOK_SECRET` — любая длинная случайная строка.
3. Deploy. На телефоне: открыть сайт → «Поделиться» → «На экран Домой» — CRM работает как приложение.

Локально: `cp .env.example .env.local`, заполнить, `npm run dev`.

## Вебхук входящих заявок

`POST /api/leads/incoming?token=WEBHOOK_SECRET` — JSON или form-data.
Поля: `name, phone, instagram, email, source, amount, note, pipeline, stage, external_id`.
Неизвестные поля дописываются в заметку. Повтор с тем же телефоном не создаёт дубль — пишется в историю лида.
Готовый URL — в меню CRM → «Интеграции».

## Что умеет

- Воронки с канбаном, свои этапы с типами «в работе / успех / отказ»
- Следующий шаг по каждой заявке и раздел «Дела»: просрочено, сегодня, забытые
- Шаблоны сообщений WhatsApp с подстановкой {имя} и {сумма}
- Аналитика: заявки по дням, конверсия, выручка, источники
- Теги, поиск, фильтры, массовые действия, импорт и выгрузка Excel
- Новые заявки из вебхука появляются на доске сразу (Supabase Realtime)
- Светлая и тёмная тема, горячие клавиши N и /

## Дальше
- WhatsApp: входящие → лид + переписка в ленте (таблица `activities`, kind `message_in/out` уже предусмотрены).
