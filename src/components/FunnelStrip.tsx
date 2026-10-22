"use client";

import type { Lead, Stage } from "@/lib/types";

/** Полоса воронки: доля заявок на каждом этапе. Клик — прокрутка к колонке. */
export function FunnelStrip({ stages, leads, onPick }: { stages: Stage[]; leads: Lead[]; onPick: (stageId: string) => void }) {
  const counts = new Map<string, number>();
  for (const l of leads) counts.set(l.stage_id, (counts.get(l.stage_id) ?? 0) + 1);
  const total = leads.length;

  return (
    <div className="flex w-full gap-1" role="list" aria-label="Распределение заявок по этапам">
      {stages.map((s) => {
        const n = counts.get(s.id) ?? 0;
        return (
          <button
            key={s.id}
            role="listitem"
            onClick={() => onPick(s.id)}
            title={`${s.name}: ${n}`}
            className="group min-w-12 text-left transition-[flex-grow] duration-500"
            style={{ flexGrow: total ? Math.max(n, total * 0.06) : 1, flexBasis: 0 }}
          >
            <span className="flex items-baseline gap-1.5 truncate pb-1.5 text-xs">
              <span className="font-semibold tabular-nums">{n}</span>
              <span className="truncate text-muted group-hover:text-ink max-sm:hidden">{s.name}</span>
            </span>
            <span
              className="block h-1.5 rounded-full transition-[height] group-hover:h-2"
              style={{ background: n ? s.color : `color-mix(in srgb, ${s.color} 25%, transparent)` }}
            />
          </button>
        );
      })}
    </div>
  );
}
