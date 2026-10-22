"use client";

import { useMemo, useState } from "react";
import { useCrm } from "@/lib/crm";
import type { Lead } from "@/lib/types";
import { formatMoney, plural } from "@/lib/format";

const PERIODS = [
  { days: 7, label: "7 дней" },
  { days: 30, label: "30 дней" },
  { days: 90, label: "90 дней" },
  { days: 0, label: "Всё время" },
] as const;

const DAY = 864e5;
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function AnalyticsView() {
  const crm = useCrm();
  const [days, setDays] = useState<number>(30);
  const [pid, setPid] = useState<string>("all");

  const data = useMemo(() => {
    const now = new Date();
    const leads = pid === "all" ? crm.leads : crm.leads.filter((l) => l.pipeline_id === pid);
    const firstLead = leads.reduce((m, l) => Math.min(m, new Date(l.created_at).getTime()), now.getTime());
    const from = days ? new Date(now.getTime() - (days - 1) * DAY) : new Date(firstLead);
    from.setHours(0, 0, 0, 0);
    const inPeriod = (iso: string) => new Date(iso).getTime() >= from.getTime();
    const kind = (l: Lead) => crm.stageById.get(l.stage_id)?.kind ?? "open";

    const created = leads.filter((l) => inPeriod(l.created_at));
    const won = leads.filter((l) => kind(l) === "won" && inPeriod(l.stage_changed_at));
    const lost = leads.filter((l) => kind(l) === "lost" && inPeriod(l.stage_changed_at));
    const revenue = won.reduce((s, l) => s + (l.amount ?? 0), 0);
    const createdWon = created.filter((l) => kind(l) === "won").length;
    const conversion = created.length ? Math.round((createdWon / created.length) * 100) : 0;

    // Заявки по дням (или по неделям, если период длинный)
    const span = Math.ceil((now.getTime() - from.getTime()) / DAY);
    const weekly = span > 92;
    const buckets: { label: string; full: string; count: number; start: Date }[] = [];
    const counts = new Map<string, number>();
    for (const l of created) {
      const d = new Date(l.created_at);
      if (weekly) d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      d.setHours(0, 0, 0, 0);
      counts.set(dayKey(d), (counts.get(dayKey(d)) ?? 0) + 1);
    }
    const cursor = new Date(from);
    if (weekly) cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
    while (cursor.getTime() <= now.getTime()) {
      const d = new Date(cursor);
      buckets.push({
        start: d,
        count: counts.get(dayKey(d)) ?? 0,
        label: d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", ""),
        full: weekly
          ? `Неделя с ${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`
          : d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long" }),
      });
      cursor.setDate(cursor.getDate() + (weekly ? 7 : 1));
    }

    // Источники
    const bySource = new Map<string, { leads: number; won: number; revenue: number }>();
    for (const l of created) {
      const k = l.source || "Не указан";
      const r = bySource.get(k) ?? { leads: 0, won: 0, revenue: 0 };
      r.leads++;
      if (kind(l) === "won") { r.won++; r.revenue += l.amount ?? 0; }
      bySource.set(k, r);
    }
    const sources = [...bySource.entries()].map(([name, r]) => ({ name, ...r })).sort((a, b) => b.leads - a.leads);

    // Воронка: где сейчас открытые заявки (по выбранной воронке)
    const funnelPid = pid === "all" ? crm.pipelineId : pid;
    const funnel = crm.allStages
      .filter((s) => s.pipeline_id === funnelPid)
      .sort((a, b) => a.position - b.position)
      .map((s) => {
        const ls = crm.leads.filter((l) => l.stage_id === s.id);
        return { stage: s, count: ls.length, amount: ls.reduce((x, l) => x + (l.amount ?? 0), 0) };
      });

    return { created, won, lost, revenue, conversion, buckets, weekly, sources, funnel, avg: won.length ? revenue / won.length : 0 };
  }, [crm.leads, crm.stageById, crm.allStages, crm.pipelineId, days, pid]);

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 pt-4 pb-10 md:px-6 md:pt-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-2xl font-semibold tracking-tight md:text-3xl">Аналитика</h1>
          {crm.pipelines.length > 1 && (
            <select value={pid} onChange={(e) => setPid(e.target.value)} className="rounded-lg border border-line bg-panel px-2 py-1.5 text-sm outline-none" aria-label="Воронка">
              <option value="all">Все воронки</option>
              {crm.pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <div className="flex rounded-lg bg-ink/[0.06] p-0.5 text-sm" role="group" aria-label="Период">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                aria-pressed={days === p.days}
                className={`rounded-md px-2.5 py-1 transition ${days === p.days ? "bg-panel font-medium shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Показатели */}
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
          <Stat label="Новых заявок" value={String(data.created.length)} />
          <Stat
            label="Оплат"
            value={String(data.won.length)}
            sub={data.lost.length ? `отказов: ${data.lost.length}` : undefined}
          />
          <Stat label="Выручка" value={formatMoney(data.revenue) || "0 ₸"} sub={data.avg ? `средний чек ${formatMoney(Math.round(data.avg))}` : undefined} money />
          <Stat label="Конверсия в оплату" value={`${data.conversion}%`} sub="из новых заявок за период" />
        </div>

        {/* Заявки по времени */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold">{data.weekly ? "Заявки по неделям" : "Заявки по дням"}</h2>
          <BarsOverTime buckets={data.buckets} />
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Источники */}
          <section>
            <h2 className="text-sm font-semibold">Источники</h2>
            <p className="text-xs text-muted">Откуда пришли новые заявки и сколько из них оплатили</p>
            {data.sources.length ? (
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="pb-2 font-medium">Источник</th>
                    <th className="pb-2 text-right font-medium">Заявки</th>
                    <th className="pb-2 text-right font-medium">Оплаты</th>
                    <th className="pb-2 text-right font-medium">Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sources.map((s) => {
                    const max = data.sources[0].leads;
                    return (
                      <tr key={s.name} className="border-t border-line">
                        <td className="py-2 pr-2">
                          <span className="block">{s.name}</span>
                          <span className="mt-1 block h-1.5 rounded-full bg-accent/80" style={{ width: `${Math.max(4, (s.leads / max) * 100)}%` }} />
                        </td>
                        <td className="py-2 text-right tabular-nums">{s.leads}</td>
                        <td className="py-2 text-right tabular-nums">
                          {s.won}
                          <span className="ml-1 text-xs text-muted">{Math.round((s.won / s.leads) * 100)}%</span>
                        </td>
                        <td className="py-2 text-right whitespace-nowrap text-money tabular-nums">{s.revenue ? formatMoney(s.revenue) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <Empty />
            )}
          </section>

          {/* Воронка сейчас */}
          <section>
            <h2 className="text-sm font-semibold">Где сейчас заявки</h2>
            <p className="text-xs text-muted">
              Воронка «{crm.pipelines.find((p) => p.id === (pid === "all" ? crm.pipelineId : pid))?.name}», все заявки на сегодня
            </p>
            <ul className="mt-3 space-y-2.5">
              {data.funnel.map(({ stage, count, amount }) => {
                const max = Math.max(1, ...data.funnel.map((f) => f.count));
                return (
                  <li key={stage.id} className="text-sm">
                    <div className="flex items-baseline gap-2">
                      <span className="flex-1 truncate">{stage.name}</span>
                      {amount > 0 && <span className="text-xs text-muted tabular-nums">{formatMoney(amount)}</span>}
                      <span className="w-8 text-right font-semibold tabular-nums">{count}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-ink/[0.05]">
                      <div className="h-2 rounded-full" style={{ width: `${(count / max) * 100}%`, background: stage.color, minWidth: count ? 6 : 0 }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, money }: { label: string; value: string; sub?: string; money?: boolean }) {
  return (
    <div className="bg-panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums md:text-3xl ${money ? "text-money" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Empty() {
  return <p className="mt-3 text-sm text-muted">За этот период заявок нет.</p>;
}

function BarsOverTime({ buckets }: { buckets: { label: string; full: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((s, b) => s + b.count, 0);
  // Подписи оси: не больше ~8
  const every = Math.max(1, Math.ceil(buckets.length / 7));
  const h = hover != null ? buckets[hover] : null;

  if (!total) return <Empty />;

  return (
    <div className="mt-3">
      <div className="relative h-44 rounded-xl border border-line bg-panel px-3 pt-6 pb-2">
        {/* Сетка: только максимум */}
        <div className="pointer-events-none absolute inset-x-3 top-6 border-t border-dashed border-line" />
        <span className="pointer-events-none absolute top-1 right-3 text-[11px] text-muted tabular-nums">{max}</span>

        <div className="flex h-full items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
          {buckets.map((b, i) => (
            <div
              key={i}
              className="group relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHover(i)}
              onClick={() => setHover(i)}
            >
              <div
                className={`w-full rounded-t-[4px] transition-colors ${hover === i ? "bg-accent" : "bg-accent/70"}`}
                style={{ height: b.count ? `${Math.max(3, (b.count / max) * 100)}%` : 0 }}
              />
            </div>
          ))}
        </div>

        {h && hover != null && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg"
            style={{ left: `calc(12px + (100% - 24px) * ${(hover + 0.5) / buckets.length})` }}
          >
            <span className="text-muted">{h.full}: </span>
            <b className="tabular-nums">{h.count}</b> {plural(h.count, "заявка", "заявки", "заявок")}
          </div>
        )}
      </div>
      <div className="relative mx-3 mt-1 h-4 text-[11px] text-muted">
        {buckets.map((b, i) =>
          i % every === 0 ? (
            <span
              key={i}
              className="absolute -translate-x-1/2 whitespace-nowrap tabular-nums"
              style={{ left: `${((i + 0.5) / buckets.length) * 100}%` }}
            >
              {b.label}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
