"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Lead, Pipeline, Stage } from "@/lib/types";

const PIPELINE_KEY = "crm.pipeline";

/** Позиция для новой карточки: новые всегда сверху колонки. */
export const topPosition = () => -Date.now() / 1000;

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

export type LeadInput = Partial<Omit<Lead, "id" | "created_at" | "updated_at">>;

export function useCrm() {
  const sb = supabase();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pipelineId, setPipelineIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    setStages(s.data);
    return p.data as Pipeline[];
  }, [sb]);

  const loadLeads = useCallback(
    async (pid: string) => {
      const rows = await fetchAll<Lead>((from, to) =>
        sb.from("leads").select("*").eq("pipeline_id", pid).order("position").range(from, to),
      );
      setLeads(rows.map((l) => ({ ...l, amount: l.amount == null ? null : Number(l.amount) })));
    },
    [sb],
  );

  useEffect(() => {
    (async () => {
      try {
        const ps = await loadStructure();
        let saved: string | null = null;
        try { saved = localStorage.getItem(PIPELINE_KEY); } catch {}
        const pid = ps.find((p) => p.id === saved)?.id ?? ps[0]?.id ?? null;
        setPipelineIdState(pid);
        if (pid) await loadLeads(pid);
      } catch (e) {
        fail(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadStructure, loadLeads, fail]);

  const setPipelineId = useCallback(
    async (pid: string) => {
      setPipelineIdState(pid);
      try { localStorage.setItem(PIPELINE_KEY, pid); } catch {}
      setLeads([]);
      try { await loadLeads(pid); } catch (e) { fail(e); }
    },
    [loadLeads, fail],
  );

  const pipelineStages = useMemo(
    () => stages.filter((s) => s.pipeline_id === pipelineId).sort((a, b) => a.position - b.position),
    [stages, pipelineId],
  );

  // ---------- Лиды ----------

  const createLead = useCallback(
    async (input: LeadInput) => {
      if (!pipelineId) return null;
      const row = {
        pipeline_id: pipelineId,
        stage_id: input.stage_id ?? pipelineStages[0]?.id,
        position: topPosition(),
        ...input,
      };
      const { data, error } = await sb.from("leads").insert(row).select().single();
      if (error) { fail(error); return null; }
      await sb.from("activities").insert({ lead_id: data.id, kind: "created", body: "Заявка создана вручную" });
      setLeads((ls) => [{ ...data, amount: data.amount == null ? null : Number(data.amount) }, ...ls]);
      return data as Lead;
    },
    [sb, pipelineId, pipelineStages, fail],
  );

  const updateLead = useCallback(
    async (id: string, patch: LeadInput) => {
      setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      const { error } = await sb.from("leads").update(patch).eq("id", id);
      if (error) fail(error);
    },
    [sb, fail],
  );

  const moveLead = useCallback(
    (id: string, stageId: string, position: number) => updateLead(id, { stage_id: stageId, position }),
    [updateLead],
  );

  const deleteLead = useCallback(
    async (id: string) => {
      setLeads((ls) => ls.filter((l) => l.id !== id));
      const { error } = await sb.from("leads").delete().eq("id", id);
      if (error) fail(error);
    },
    [sb, fail],
  );

  const importLeads = useCallback(
    async (rows: LeadInput[]) => {
      if (!pipelineId || !rows.length) return 0;
      const base = topPosition();
      const prepared = rows.map((r, i) => ({
        pipeline_id: pipelineId,
        stage_id: pipelineStages[0]?.id,
        position: base + i * 0.001,
        ...r,
      }));
      for (let i = 0; i < prepared.length; i += 500) {
        const { error } = await sb.from("leads").insert(prepared.slice(i, i + 500));
        if (error) { fail(error); break; }
      }
      await loadLeads(pipelineId);
      return prepared.length;
    },
    [sb, pipelineId, pipelineStages, loadLeads, fail],
  );

  // ---------- Воронки и этапы ----------

  const createPipeline = useCallback(
    async (name: string) => {
      const { data, error } = await sb
        .from("pipelines")
        .insert({ name, position: pipelines.length })
        .select()
        .single();
      if (error) return fail(error);
      await sb.from("stages").insert([
        { pipeline_id: data.id, name: "Новая заявка", color: "#3b82f6", position: 0 },
        { pipeline_id: data.id, name: "В работе", color: "#8b5cf6", position: 1 },
        { pipeline_id: data.id, name: "Успешно", color: "#10b981", position: 2 },
        { pipeline_id: data.id, name: "Отказ", color: "#ef4444", position: 3 },
      ]);
      await loadStructure();
      await setPipelineId(data.id);
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
      const ps = await loadStructure();
      if (id === pipelineId && ps[0]) await setPipelineId(ps[0].id);
    },
    [sb, pipelineId, loadStructure, setPipelineId, fail],
  );

  const createStage = useCallback(
    async (name: string, color: string) => {
      if (!pipelineId) return;
      const position = (pipelineStages.at(-1)?.position ?? -1) + 1;
      const { data, error } = await sb
        .from("stages")
        .insert({ pipeline_id: pipelineId, name, color, position })
        .select()
        .single();
      if (error) return fail(error);
      setStages((ss) => [...ss, data]);
    },
    [sb, pipelineId, pipelineStages, fail],
  );

  const updateStage = useCallback(
    async (id: string, patch: Partial<Pick<Stage, "name" | "color">>) => {
      setStages((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      const { error } = await sb.from("stages").update(patch).eq("id", id);
      if (error) fail(error);
    },
    [sb, fail],
  );

  const reorderStages = useCallback(
    async (orderedIds: string[]) => {
      setStages((ss) =>
        ss.map((s) => {
          const i = orderedIds.indexOf(s.id);
          return i === -1 ? s : { ...s, position: i };
        }),
      );
      const results = await Promise.all(
        orderedIds.map((id, i) => sb.from("stages").update({ position: i }).eq("id", id)),
      );
      const err = results.find((r) => r.error)?.error;
      if (err) fail(err);
    },
    [sb, fail],
  );

  /** Удаляет этап, перенося его лиды в moveTo. */
  const deleteStage = useCallback(
    async (id: string, moveTo: string | null) => {
      if (moveTo) {
        const { error } = await sb.from("leads").update({ stage_id: moveTo }).eq("stage_id", id);
        if (error) return fail(error);
        setLeads((ls) => ls.map((l) => (l.stage_id === id ? { ...l, stage_id: moveTo } : l)));
      }
      const { error } = await sb.from("stages").delete().eq("id", id);
      if (error) return fail(error);
      setStages((ss) => ss.filter((s) => s.id !== id));
    },
    [sb, fail],
  );

  const reload = useCallback(async () => {
    try {
      await loadStructure();
      if (pipelineId) await loadLeads(pipelineId);
    } catch (e) {
      fail(e);
    }
  }, [loadStructure, loadLeads, pipelineId, fail]);

  return {
    loading,
    error,
    clearError: () => setError(null),
    pipelines,
    pipelineId,
    pipeline: pipelines.find((p) => p.id === pipelineId) ?? null,
    setPipelineId,
    stages: pipelineStages,
    leads,
    createLead,
    updateLead,
    moveLead,
    deleteLead,
    importLeads,
    createPipeline,
    renamePipeline,
    deletePipeline,
    createStage,
    updateStage,
    reorderStages,
    deleteStage,
    reload,
  };
}

export type Crm = ReturnType<typeof useCrm>;
