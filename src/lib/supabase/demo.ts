/* Демо-режим: если Supabase не настроен, данные живут в localStorage браузера.
   Реализует только тот кусок API supabase-js, который использует приложение. */

type Row = Record<string, unknown> & { id: string };
type Db = Record<string, Row[]>;

const KEY = "crm.demo.db.v3";
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function seed(): Db {
  const p = uid();
  const stages = (
    [
      ["Новая заявка", "#3b82f6", "open"], ["Связались", "#8b5cf6", "open"], ["Думает", "#f59e0b", "open"],
      ["Оплата", "#10b981", "won"], ["Отказ", "#ef4444", "lost"],
    ] as const
  ).map(([name, color, kind], i) => ({ id: uid(), pipeline_id: p, name, color, kind, position: i, created_at: now() }));
  const H = 36e5;
  const at = (hours: number) => new Date(Date.now() + hours * H).toISOString();
  const people = [
    // имя, источник, сумма, заметка, этап, создана (ч назад), шаг, срок (ч), теги
    ["Айгерим Касымова", "Instagram", 120000, "Интересует курс, просила перезвонить вечером", 1, 30, "Перезвонить, обсудить тариф", -3, ["vip"]],
    ["Данияр Сейткали", "WhatsApp", 50000, null, 0, 2, "Первое касание", 2, []],
    ["Асель Бекова", "Реклама", 75000, null, 2, 120, "Отправить КП", 20, ["рассрочка"]],
    ["Ержан Нурланов", "Instagram", null, "Спрашивал про рассрочку", 1, 75, null, null, ["рассрочка"]],
    ["Мадина Ахметова", "WhatsApp", 125000, null, 2, 200, "Напомнить про оплату", -28, []],
    ["Алихан Бекжанов", "Реклама", 150000, null, 3, 260, null, null, ["vip"]],
    ["Камила Омарова", "Instagram", null, null, 0, 6, "Написать в WhatsApp", 5, []],
    ["Нурлан Садыков", "Рекомендация", 200000, "От Айгерим", 3, 400, null, null, []],
    ["Тимур Жумабаев", "Instagram", 60000, "Дорого", 4, 300, null, null, []],
    ["Сабина Ерланова", "Реклама", 90000, null, 1, 50, "Созвон в 15:00", 75, []],
  ] as const;
  const leads = people.map(([name, source, amount, note, st, ago, step, due, tags], i) => ({
    id: uid(), pipeline_id: p, stage_id: stages[st].id, name,
    phone: `+7701${(1234567 + i * 7919).toString().slice(0, 7)}`, instagram: i % 2 ? null : `@${name.split(" ")[0].toLowerCase()}`,
    email: null, source, amount, note, position: i, external_id: null,
    next_action: step, next_action_at: due == null ? null : at(due), tags: [...tags],
    lost_reason: st === 4 ? "Дорого" : null,
    stage_changed_at: at(-ago * 0.6), created_at: at(-ago), updated_at: now(),
  }));
  const activities = leads.flatMap((l) => [
    { id: uid(), lead_id: l.id, kind: "created", body: `Заявка пришла: ${l.source}`, meta: null, created_at: l.created_at },
  ]);
  activities.push({ id: uid(), lead_id: leads[0].id, kind: "comment", body: "Позвонила, ждёт КП до пятницы", meta: null, created_at: now() });
  const templates = [
    ["Первое касание", "Здравствуйте, {имя}! Получили вашу заявку. Удобно сейчас обсудить детали?"],
    ["Напоминание", "{имя}, добрый день! Напоминаю о нашем разговоре. Остались вопросы?"],
    ["Реквизиты для оплаты", "{имя}, отправляю реквизиты для оплаты {сумма}. После оплаты пришлите, пожалуйста, чек."],
  ].map(([title, body], i) => ({ id: uid(), title, body, position: i, created_at: now() }));
  return {
    pipelines: [{ id: p, name: "Продажи", position: 0, created_at: now() }],
    stages, leads, activities, templates,
  };
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const db = seed();
  save(db);
  return db;
}

function save(db: Db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
}

/** Каскады и триггеры, как в schema.sql */
function onDelete(db: Db, table: string, removed: Row[]) {
  const ids = new Set(removed.map((r) => r.id));
  if (table === "pipelines") {
    const st = db.stages.filter((s) => ids.has(s.pipeline_id as string));
    const ld = db.leads.filter((l) => ids.has(l.pipeline_id as string));
    db.stages = db.stages.filter((s) => !st.includes(s));
    db.leads = db.leads.filter((l) => !ld.includes(l));
    onDelete(db, "leads", ld);
  }
  if (table === "leads") db.activities = db.activities.filter((a) => !ids.has(a.lead_id as string));
}

function query(table: string) {
  const filters: [string, unknown][] = [];
  const inFilters: [string, unknown[]][] = [];
  let op: "select" | "insert" | "update" | "delete" = "select";
  let payload: Row | Row[] | Record<string, unknown> | undefined;
  let single = false;
  const orders: [string, boolean][] = [];
  let range: [number, number] | null = null;
  let limit: number | null = null;

  const b = {
    select: () => b,
    eq: (k: string, v: unknown) => { filters.push([k, v]); return b; },
    in: (k: string, vs: unknown[]) => { inFilters.push([k, vs]); return b; },
    order: (k: string, o?: { ascending?: boolean }) => { orders.push([k, o?.ascending !== false]); return b; },
    range: (from: number, to: number) => { range = [from, to]; return b; },
    limit: (n: number) => { limit = n; return b; },
    single: () => { single = true; return b; },
    maybeSingle: () => { single = true; return b; },
    insert: (p: Record<string, unknown> | Record<string, unknown>[]) => { op = "insert"; payload = p as Row; return b; },
    update: (p: Record<string, unknown>) => { op = "update"; payload = p; return b; },
    delete: () => { op = "delete"; return b; },
    then<T>(resolve: (r: { data: unknown; error: null }) => T) {
      const db = load();
      db[table] ??= [];
      const match = (r: Row) => filters.every(([k, v]) => r[k] === v) && inFilters.every(([k, vs]) => vs.includes(r[k]));
      let data: unknown = null;

      if (op === "insert") {
        const rows = (Array.isArray(payload) ? payload : [payload]).map((r) => ({
          id: uid(), created_at: now(), updated_at: now(), meta: null, ...r,
        })) as Row[];
        db[table].push(...rows);
        data = rows;
      } else if (op === "update") {
        const changed = db[table].filter(match);
        for (const r of changed) {
          if (table === "leads" && payload && "stage_id" in payload && payload.stage_id !== r.stage_id) {
            const name = (id: unknown) => db.stages.find((s) => s.id === id)?.name ?? "?";
            db.activities.push({
              id: uid(), lead_id: r.id, kind: "stage", body: `${name(r.stage_id)} → ${name(payload.stage_id)}`,
              meta: null, created_at: now(),
            });
            r.stage_changed_at = now();
          }
          Object.assign(r, payload, table === "leads" ? { updated_at: now() } : {});
        }
      } else if (op === "delete") {
        const removed = db[table].filter(match);
        db[table] = db[table].filter((r) => !match(r));
        onDelete(db, table, removed);
      } else {
        let rows = db[table].filter(match);
        if (orders.length) {
          rows = [...rows].sort((a, c) => {
            for (const [k, asc] of orders) {
              const x = a[k] as string | number, y = c[k] as string | number;
              if (x !== y) return (x > y ? 1 : -1) * (asc ? 1 : -1);
            }
            return 0;
          });
        }
        if (range) rows = rows.slice(range[0], range[1] + 1);
        if (limit != null) rows = rows.slice(0, limit);
        data = rows;
      }

      if (op !== "select") save(db);
      if (single) data = Array.isArray(data) ? (data[0] ?? null) : data;
      return Promise.resolve({ data: data == null ? null : structuredClone(data), error: null }).then(resolve);
    },
  };
  return b;
}

export const demoClient = {
  from: query,
  auth: {
    signInWithPassword: async () => ({ error: null }),
    getSession: async () => ({ data: { session: { user: { email: "демо-режим" } } } }),
  },
};

export function resetDemo() {
  try { localStorage.removeItem(KEY); } catch {}
}
