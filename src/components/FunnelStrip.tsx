"use client";

import type { Lead, Stage } from "@/lib/types";

/** Полоса воронки: доля заявок на каждом этапе. Клик — прокрутка к колонке. */
export function FunnelStrip({ stages, leads, onPick }: { stages: Stage[]; leads: Lead[]; onPick: (stageId: string) => void }) {
  const counts = new Map<string, number>();
  for (const l of leads) counts.set(l.stage_id, (counts.get(l.stage_id) ?? 0) + 1);
  const total = leads.length;

  return (
    <div className="flex h-9 w-full gap-[3px]" role="list" aria-label="Распределение заявок по этапам">
      {stages.map((s) => {
        const n = counts.get(s.id) ?? 0;
        return (
          <button
            key={s.id}
            role="listitem"
            onClick={() => onPick(s.id)}
            title={`${s.name}: ${n}`}
            className="group relative flex min-w-9 items-center overflow-hidden rounded-md px-2 text-left transition-[flex-grow] duration-500 first:rounded-l-lg last:rounded-r-lg"
            style={{ flexGrow: total ? Math.max(n, total * 0.04) : 1, flexBasis: 0, background: s.color + (n ? "" : "33") }}
          >
            <span className={`truncate text-xs font-semibold tabular-nums ${n ? "text-white" : "text-ink/50"}`}>
              {n}
              <span className="ml-1.5 font-medium opacity-80 max-md:hidden">{s.name}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
