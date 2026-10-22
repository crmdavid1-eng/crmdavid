"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { onLeadsChange } from "@/lib/supabase/live";
import { authedFetch } from "@/lib/api";
import { IS_DEMO } from "@/lib/supabase/mode";
import { toast } from "@/lib/toast";
import type { Lead, Pipeline, Stage, StageKind, Template } from "@/lib/types";

const PIPELINE_KEY = "crm.pipeline";

export type WaStatus = { configured: boolean; ok?: boolean; number?: string; name?: string; error?: string; secured?: boolean; demo?: boolean };

/** Позиция для новой карточки: новые всегда сверху колонки. */
export const topPosition = () => -Date.now() / 1000;

export type LeadInput = Partial<Omit<Lead, "id" | "created_at" | "updated_at">>;

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < page) return out;
  }
}

/** Приводит строку из БД к Lead — терпимо к отсутствующим колонкам. */
export function normalizeLead(l: Partial<Lead> & { id: string }): Lead {
  return {
    ...(l as Lead),
    amount: l.amount == null ? null : Number(l.amount),
    tags: l.tags ?? [],
    next_action: l.next_action ?? null,
    next_action_at: l.next_action_at ?? null,
    lost_reason: l.lost_reason ?? null,
    unread: l.unread ?? 0,
    last_message: l.last_message ?? null,
    last_message_at: l.last_message_at ?? null,
    stage_changed_at: l.stage_changed_at ?? l.created_at ?? new Date().toISOString(),
  };
}

const normalizeStage = (s: Stage): Stage => ({ ...s, kind: s.kind ?? "open" });

function useCrmState() {
  const sb = supabase();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [allStages, setAllStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pipelineId, setPipelineIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI, общий для всех страниц
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<"card" | "chat">("card");
  const [wa, setWa] = useState<WaStatus>({ configured: IS_DEMO, demo: IS_DEMO });
  const [newLead, setNewLead] = useState<{ stageId?: string } | null>(null);
  const [lostAsk, setLostAsk] = useState<{ id: string; stageId: string; position?: number } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Растёт после каждой записи в историю — открытая карточка перечитывает ленту
  const [activityTick, setActivityTick] = useState(0);

  const fail = useCallback((e: unknown) => {
    const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
    setError(msg);
    console.error(e);
  }, []);

  const loadStructure = useCallback(async () => {
    const [p, s] = await Promise.all([
      sb.from("pipelines").select("*").order("position").order("created_at"),
      sb.from("stages").select("*").order("position"),
    ]);
    if (p.error) throw p.error;
    if (s.error) throw s.error;
    setPipelines(p.data);
    setAllStages((s.data as Stage[]).map(normalizeStage));
    return p.data as Pipeline[];
  }, [sb]);

  const loadLeads = useCallback(async () => {
    const rows = await fetchAll<Lead>((from, to) => sb.from("leads").select("*").order("position").range(from, to));
    setLeads(rows.map(normalizeLead));
  }, [sb]);

  const loadTemplates = useCallback(async () => {
    const { data, error } = await sb.from("templates").select("*").order("position");
    if (!error) setTemplates(data ?? []); // таблицы может не быть до миграции 002
  }, [sb]);

  useEffect(() => {
    (async () => {
      try {
        const [ps] = await Promise.all([loadStructure(), loadLeads(), loadTemplates()]);
        let saved: string | null = null;
        try { saved = localStorage.getItem(PIPELINE_KEY); } catch {}
        setPipelineIdState(ps.find((p) => p.id === saved)?.id ?? ps[0]?.id ?? null);
      } catch (e) {
        fail(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadStructure, loadLeads, loadTemplates, fail]);

  // Realtime: заявки из вебхука и с других устройств
  const leadsRef = useRef(leads);
  useEffect(() => { leadsRef.current = leads; }, [leads]);
  useEffect(
    () =>
      onLeadsChange((payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id?: string }).id;
          setLeads((ls) => ls.filter((l) => l.id !== id));
          return;
        }
        const row = normalizeLead(payload.new as unknown as Lead);
        const known = leadsRef.current.some((l) => l.id === row.id);
        setLeads((ls) => (ls.some((l) => l.id === row.id) ? ls.map((l) => (l.id === row.id ? row : l)) : [row, ...ls]));
        if (payload.eventType === "INSERT" && !known) {
          toast(`Новая заявка: ${row.name || row.phone || "без имени"}`, {
            action: { label: "Открыть", run: () => setOpenLeadId(row.id) },
          });
        }
      }),
    [],
  );

  // Подключён ли WhatsApp Cloud API (в демо — имитация)
  useEffect(() => {
    if (IS_DEMO) return;
    authedFetch("/api/whatsapp/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setWa(s))
      .catch(() => {});
  }, []);

  // Запасной путь к свежим данным, если realtime не подключился (на бесплатном тарифе
  // подписка бывает нестабильной): раз в минуту и при возврате на вкладку перечитываем
  // заявки и показываем уведомление о новых.
  useEffect(() => {
    if (IS_DEMO) return;
    let last = Date.now();
    const refresh = async (force = false) => {
      if (document.visibilityState !== "visible" || (!force && Date.now() - last < 20_000)) return;
      last = Date.now();
      const before = new Set(leadsRef.current.map((l) => l.id));
      const rows = await fetchAll<Lead>((from, to) => sb.from("leads").select("*").order("position").range(from, to)).catch(() => null);
      if (!rows) return;
      setLeads(rows.map(normalizeLead));
      const fresh = rows.filter((r) => !before.has(r.id));
      if (fresh.length === 1) {
        const row = fresh[0];
        toast(`Новая заявка: ${row.name || row.phone || "без имени"}`, { action: { label: "Открыть", run: () => setOpenLeadId(row.id) } });
      } else if (fresh.length > 1) {
        toast(`Новых заявок: ${fresh.length}`);
      }
    };
    const onVisible = () => refresh();
    const timer = setInterval(() => refresh(true), 60_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [sb]);

  const setPipelineId = useCallback((pid: string) => {
    setPipelineIdState(pid);
    try { localStorage.setItem(PIPELINE_KEY, pid); } catch {}
  }, []);

  const stages = useMemo(
    () => allStages.filter((s) => s.pipeline_id === pipelineId).sort((a, b) => a.position - b.position),
    [allStages, pipelineId],
  );
  const stageById = useMemo(() => new Map(allStages.map((s) => [s.id, s])), [allStages]);
  const pipelineLeads = useMemo(() => leads.filter((l) => l.pipeline_id === pipelineId), [leads, pipelineId]);

  // ---------- Лиды ----------

  const createLead = useCallback(
    async (input: LeadInput) => {
      const pid = input.pipeline_id ?? pipelineId;
      if (!pid) return null;
      const firstStage = allStages.filter((s) => s.pipeline_id === pid).sort((a, b) => a.position - b.position)[0];
      const row = { pipeline_id: pid, stage_id: input.stage_id ?? firstStage?.id, position: topPosition(), ...input };
      const { data, error } = await sb.from("leads").insert(row).select().single();
      if (error) { fail(error); return null; }
      const lead = normalizeLead(data);
      setLeads((ls) => (ls.some((l) => l.id === lead.id) ? ls : [lead, ...ls]));
      await sb.from("activities").insert({ lead_id: lead.id, kind: "created", body: "Заявка создана вручную" });
      return lead;
    },
    [sb, pipelineId, allStages, fail],
  );

  const updateLead = useCallback(
    async (id: string, patch: LeadInput) => {
      const extra: LeadInput = {};
      const current = leadsRef.current.find((l) => l.id === id);
      if (patch.stage_id && current && patch.stage_id !== current.stage_id) extra.stage_changed_at = new Date().toISOString();
      setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch, ...extra } : l)));
      const { error } = await sb.from("leads").update(patch).eq("id", id);
      if (error) fail(error);
      else if (extra.stage_changed_at) setActivityTick((t) => t + 1); // триггер записал смену этапа
    },
    [sb, fail],
  );

  /**
   * Смена этапа. При переносе в этап «Отказ» сначала спрашиваем причину (окно в Shell);
   * пока пользователь не ответил, карточка остаётся на месте.
   */
  const changeStage = useCallback(
    (id: string, stageId: string, position?: number) => {
      const lead = leadsRef.current.find((l) => l.id === id);
      const target = stageById.get(stageId);
      if (!lead || lead.stage_id === stageId) {
        if (lead && position != null) return updateLead(id, { position });
        return Promise.resolve();
      }
      if (target?.kind === "lost" && stageById.get(lead.stage_id)?.kind !== "lost") {
        setLostAsk({ id, stageId, position });
        return Promise.resolve();
      }
      const patch: LeadInput = { stage_id: stageId, ...(position != null ? { position } : {}) };
      if (target?.kind !== "lost" && lead.lost_reason) patch.lost_reason = null;
      return updateLead(id, patch);
    },
    [stageById, updateLead],
  );

  const moveLead = useCallback(
    (id: string, stageId: string, position: number) => changeStage(id, stageId, position),
    [changeStage],
  );

  const deleteLeads = useCallback(
    async (ids: string[]) => {
      setLeads((ls) => ls.filter((l) => !ids.includes(l.id)));
      const { error } = await sb.from("leads").delete().in("id", ids);
      if (error) fail(error);
    },
    [sb, fail],
  );

  const logActivity = useCallback(
    async (leadId: string, kind: string, body: string) => {
      await sb.from("activities").insert({ lead_id: leadId, kind, body });
      setActivityTick((t) => t + 1);
    },
    [sb],
  );

  const confirmLost = useCallback(
    async (reason: string | null) => {
      if (!lostAsk) return;
      const { id, stageId, position } = lostAsk;
      setLostAsk(null);
      await updateLead(id, {
        stage_id: stageId,
        lost_reason: reason,
        next_action: null,
        next_action_at: null,
        ...(position != null ? { position } : {}),
      });
      if (reason) await logActivity(id, "comment", `Причина отказа: ${reason}`);
    },
    [lostAsk, updateLead, logActivity],
  );


  /** Закрыть следующий шаг: пишем в историю и очищаем. */
  const completeAction = useCallback(
    async (lead: Lead) => {
      await updateLead(lead.id, { next_action: null, next_action_at: null });
      await logActivity(lead.id, "task", `Сделано: ${lead.next_action || "следующий шаг"}`);
    },
    [updateLead, logActivity],
  );

  const importLeads = useCallback(
    async (rows: LeadInput[]) => {
      if (!pipelineId || !rows.length) return 0;
      const base = topPosition();
      const prepared = rows.map((r, i) => ({
        pipeline_id: pipelineId,
        stage_id: stages[0]?.id,
        position: base + i * 0.001,
        ...r,
      }));
      for (let i = 0; i < prepared.length; i += 500) {
        const { error } = await sb.from("leads").insert(prepared.slice(i, i + 500));
        if (error) { fail(error); break; }
      }
      await loadLeads();
      return prepared.length;
    },
    [sb, pipelineId, stages, loadLeads, fail],
  );

  // ---------- Воронки и этапы ----------

  const createPipeline = useCallback(
    async (name: string) => {
      const { data, error } = await sb.from("pipelines").insert({ name, position: pipelines.length }).select().single();
      if (error) return fail(error);
      await sb.from("stages").insert([
        { pipeline_id: data.id, name: "Новая заявка", color: "#3b82f6", position: 0 },
        { pipeline_id: data.id, name: "В работе", color: "#8b5cf6", position: 1 },
        { pipeline_id: data.id, name: "Успешно", color: "#10b981", position: 2, kind: "won" },
        { pipeline_id: data.id, name: "Отказ", color: "#ef4444", position: 3, kind: "lost" },
      ]);
      await loadStructure();
      setPipelineId(data.id);
    },
    [sb, pipelines.length, loadStructure, setPipelineId, fail],
  );

  const renamePipeline = useCallback(
    async (id: string, name: string) => {
      setPipelines((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)));
      const { error } = await sb.from("pipelines").update({ name }).eq("id", id);
      if (error) fail(error);
    },
    [sb, fail],
  );

  const deletePipeline = useCallback(
    async (id: string) => {
      const { error } = await sb.from("pipelines").delete().eq("id", id);
      if (error) return fail(error);
      setLeads((ls) => ls.filter((l) => l.pipeline_id !== id));
      const ps = await loadStructure();
      if (id === pipelineId && ps[0]) setPipelineId(ps[0].id);
    },
    [sb, pipelineId, loadStructure, setPipelineId, fail],
  );

  const createStage = useCallback(
    async (name: string, color: string) => {
      if (!pipelineId) return;
      const position = (stages.at(-1)?.position ?? -1) + 1;
      const { data, error } = await sb.from("stages").insert({ pipeline_id: pipelineId, name, color, position }).select().single();
      if (error) return fail(error);
      setAllStages((ss) => [...ss, normalizeStage(data)]);
    },
    [sb, pipelineId, stages, fail],
  );

  const updateStage = useCallback(
    async (id: string, patch: Partial<Pick<Stage, "name" | "color" | "kind">>) => {
      setAllStages((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      const { error } = await sb.from("stages").update(patch).eq("id", id);
      if (error) fail(error);
    },
    [sb, fail],
  );

  const reorderStages = useCallback(
    async (orderedIds: string[]) => {
      setAllStages((ss) => ss.map((s) => (orderedIds.includes(s.id) ? { ...s, position: orderedIds.indexOf(s.id) } : s)));
      const results = await Promise.all(orderedIds.map((id, i) => sb.from("stages").update({ position: i }).eq("id", id)));
      const err = results.find((r) => r.error)?.error;
      if (err) fail(err);
    },
    [sb, fail],
  );

  const deleteStage = useCallback(
    async (id: string, moveTo: string | null) => {
      if (moveTo) {
        const { error } = await sb.from("leads").update({ stage_id: moveTo }).eq("stage_id", id);
        if (error) return fail(error);
        setLeads((ls) => ls.map((l) => (l.stage_id === id ? { ...l, stage_id: moveTo } : l)));
      }
      const { error } = await sb.from("stages").delete().eq("id", id);
      if (error) return fail(error);
      setAllStages((ss) => ss.filter((s) => s.id !== id));
    },
    [sb, fail],
  );

  // ---------- Шаблоны ----------

  const saveTemplate = useCallback(
    async (t: Partial<Template> & { title: string; body: string }) => {
      if (t.id) {
        setTemplates((ts) => ts.map((x) => (x.id === t.id ? { ...x, ...t } : x)));
        const { error } = await sb.from("templates").update({ title: t.title, body: t.body }).eq("id", t.id);
        if (error) fail(error);
        return;
      }
      const { data, error } = await sb
        .from("templates")
        .insert({ title: t.title, body: t.body, position: templates.length })
        .select()
        .single();
      if (error) return fail(error);
      setTemplates((ts) => [...ts, data]);
    },
    [sb, templates.length, fail],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      setTemplates((ts) => ts.filter((t) => t.id !== id));
      const { error } = await sb.from("templates").delete().eq("id", id);
      if (error) fail(error);
    },
    [sb, fail],
  );

  const reload = useCallback(async () => {
    try {
      await Promise.all([loadStructure(), loadLeads(), loadTemplates()]);
    } catch (e) {
      fail(e);
    }
  }, [loadStructure, loadLeads, loadTemplates, fail]);

  return {
    loading,
    error,
    clearError: () => setError(null),
    pipelines,
    pipelineId,
    pipeline: pipelines.find((p) => p.id === pipelineId) ?? null,
    setPipelineId,
    stages,
    allStages,
    stageById,
    leads,
    pipelineLeads,
    templates,
    createLead,
    updateLead,
    moveLead,
    changeStage,
    lostAsk,
    confirmLost,
    cancelLost: () => setLostAsk(null),
    paletteOpen,
    setPaletteOpen,
    activityTick,
    deleteLeads,
    deleteLead: (id: string) => deleteLeads([id]),
    logActivity,
    completeAction,
    importLeads,
    createPipeline,
    renamePipeline,
    deletePipeline,
    createStage,
    updateStage,
    reorderStages,
    deleteStage,
    saveTemplate,
    deleteTemplate,
    reload,
    openLeadId,
    openLead: (id: string | null, tab: "card" | "chat" = "card") => {
      setDrawerTab(tab);
      setOpenLeadId(id);
    },
    drawerTab,
    setDrawerTab,
    wa,
    newLead,
    openNewLead: (stageId?: string) => setNewLead({ stageId }),
    closeNewLead: () => setNewLead(null),
  };
}

export type Crm = ReturnType<typeof useCrmState>;
export type { StageKind };

const Ctx = createContext<Crm | null>(null);

export function CrmProvider({ children }: { children: React.ReactNode }) {
  const crm = useCrmState();
  return <Ctx.Provider value={crm}>{children}</Ctx.Provider>;
}

export function useCrm() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCrm вне CrmProvider");
  return c;
}
