"use client";

import { isBefore, parseISO, startOfDay, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Task } from "@/lib/types";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS, cn } from "@/lib/utils";
import MemberAvatar from "@/components/member-avatar";

const PRIORITY_BAR: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

type Props = {
  task: Task;
  compact?: boolean;
  onEdit: () => void;
  onAdvanceStatus: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
};

export default function TaskCard({
  task,
  compact = false,
  onEdit,
  onAdvanceStatus,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: Props) {
  const checkedCount = task.checklist_items?.filter((i) => i.checked).length ?? 0;
  const totalCount = task.checklist_items?.length ?? 0;

  const isOverdue =
    !!task.due_date &&
    task.status !== "done" &&
    isBefore(parseISO(task.due_date), startOfDay(new Date()));

  const assignees = task.assignees ?? [];

  const inlineStyle = (): React.CSSProperties => {
    if (selected) return { backgroundColor: "#eef2ff", borderColor: "#6366f1" };
    if (isOverdue) return { backgroundColor: "#fee2e2", borderColor: "#fecaca" };
    if (task.status === "done") return { backgroundColor: "#86efac", borderColor: "#4ade80" };
    if (assignees.length === 1 && assignees[0].color) {
      return {
        backgroundColor: assignees[0].color + "20",
        borderColor: assignees[0].color + "40",
      };
    }
    if (assignees.length >= 2) {
      return { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" };
    }
    return {};
  };

  function handleClick() {
    if (selectMode) {
      onToggleSelect?.();
    } else {
      onEdit();
    }
  }

  return (
    <div
      onClick={handleClick}
      style={inlineStyle()}
      className={cn(
        "w-full text-left bg-white rounded-xl border shadow-sm px-3 py-2.5 min-h-[72px] flex gap-2 active:scale-[0.99] transition-transform cursor-pointer overflow-hidden relative",
        compact ? "items-center" : "items-start",
        selected ? "border-indigo-400" : "border-slate-100"
      )}
    >
      {/* Barra de prioridade */}
      <span
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl"
        style={{ backgroundColor: PRIORITY_BAR[task.priority] }}
      />

      {/* Ícone / checkbox */}
      <div
        className={cn(
          "w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0",
          selectMode
            ? selected
              ? "bg-indigo-600 border-indigo-600"
              : "bg-white border-slate-300"
            : "bg-white/70 border-slate-200",
          !compact && "mt-0.5"
        )}
      >
        {selectMode ? (
          selected && (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )
        ) : (
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        )}
      </div>

      {/* Título + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className={cn(
            "font-bold text-base leading-tight",
            task.status === "done" ? "line-through text-slate-400" : "text-slate-900"
          )}>
            {task.title}
          </p>
          {task.category && (
            <span
              className="text-[8px] font-semibold px-1 py-px rounded-full text-white flex-shrink-0"
              style={{ backgroundColor: task.category.color }}
            >
              {task.category.name}
            </span>
          )}
        </div>

        {task.due_date && (
          <div className="mt-1">
            <span className={cn(
              "flex items-center gap-1 text-xs font-semibold",
              isOverdue ? "text-rose-500" : "text-slate-500"
            )}>
              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {format(parseISO(task.due_date), "d MMM", { locale: ptBR })}
            </span>
          </div>
        )}

        {totalCount > 0 && (
          <div className="mt-1.5 space-y-0.5">
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${(checkedCount / totalCount) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400">{checkedCount}/{totalCount}</span>
          </div>
        )}
      </div>

      {/* Coluna direita: avatares + status + seta */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        {assignees.length > 0 && (
          <div className="flex -space-x-1">
            {assignees.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
                style={{ backgroundColor: a.color ?? "#6366f1" }}
                title={a.name}
              >
                <MemberAvatar name={a.name} avatarUrl={a.avatar_url} />
              </div>
            ))}
            {assignees.length > 3 && (
              <div className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] text-slate-500">
                +{assignees.length - 3}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1">
          {task.priority && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap text-white"
              style={{ backgroundColor: PRIORITY_BAR[task.priority] }}
            >
              {PRIORITY_LABEL[task.priority]}
            </span>
          )}
          <span className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap",
            TASK_STATUS_COLORS[task.status]
          )}>
            {TASK_STATUS_LABELS[task.status]}
          </span>
          {!selectMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onAdvanceStatus(); }}
              className="w-4 h-4 rounded-full bg-white/80 border border-slate-200 flex items-center justify-center active:scale-95 transition-all hover:bg-slate-100"
              title="Avançar status"
            >
              <svg className="w-2.5 h-2.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
