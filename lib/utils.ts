import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TaskPriority, TaskStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "A fazer",
  in_progress: "Em andamento",
  on_hold: "Em espera",
  done: "Concluída",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  on_hold: "bg-amber-100 text-amber-700",
  done: "bg-green-100 text-green-700",
};

export const TASK_STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  on_hold: "bg-amber-500",
  done: "bg-green-500",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: "text-red-600",
  medium: "text-amber-600",
  low: "text-slate-500",
};

export const RECURRENCE_LABELS = {
  none: "Não repete",
  daily: "Diariamente",
  weekly: "Semanalmente",
  monthly: "Mensalmente",
  yearly: "Anualmente",
};

export const REMINDER_OPTIONS = [
  { value: 0, label: "Na hora" },
  { value: 15, label: "15 minutos antes" },
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 1440, label: "1 dia antes" },
];

export function requiresAssigneeAndDate(status: TaskStatus): boolean {
  return status === "in_progress" || status === "done";
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}
