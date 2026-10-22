export type Pipeline = { id: string; name: string; position: number };

export type StageKind = "open" | "won" | "lost";

export type Stage = {
  id: string;
  pipeline_id: string;
  name: string;
  color: string;
  position: number;
  kind: StageKind;
};

export type Lead = {
  id: string;
  pipeline_id: string;
  stage_id: string;
  name: string;
  phone: string | null;
  instagram: string | null;
  email: string | null;
  source: string | null;
  amount: number | null;
  note: string | null;
  position: number;
  external_id: string | null;
  next_action: string | null;
  next_action_at: string | null;
  tags: string[];
  stage_changed_at: string;
  created_at: string;
  updated_at: string;
};

export type ActivityKind = "comment" | "stage" | "created" | "message_in" | "message_out" | "task";

export type Activity = {
  id: string;
  lead_id: string;
  kind: ActivityKind;
  body: string;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export type Template = { id: string; title: string; body: string; position: number };

export const SOURCES = ["Instagram", "WhatsApp", "Реклама", "Сайт", "Рекомендация", "Звонок", "Другое"];

export const STAGE_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#14b8a6", "#ef4444", "#64748b", "#0ea5e9", "#84cc16",
];

export const STAGE_KIND_LABEL: Record<StageKind, string> = {
  open: "В работе",
  won: "Успех",
  lost: "Отказ",
};
