"use client";

import type { Task } from "@/lib/types";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  formatDate,
  cn,
} from "@/lib/utils";

type Props = {
  task: Task;
  onEdit: () => void;
};

export default function TaskCard({ task, onEdit }: Props) {
  const checkedCount = task.checklist_items?.filter((i) => i.checked).length ?? 0;
  const totalCount = task.checklist_items?.length ?? 0;

  return (
    <button
      onClick={onEdit}
      className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 active:scale-[0.99] transition-transform"
    >
      {/* Top row: status + priority */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", TASK_STATUS_COLORS[task.status])}>
          {TASK_STATUS_LABELS[task.status]}
        </span>
        <span className={cn("text-xs font-medium", TASK_PRIORITY_COLORS[task.priority])}>
          {TASK_PRIORITY_LABELS[task.priority]}
        </span>
        {task.visibility === "private" && (
          <span className="text-xs text-slate-400 ml-auto flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Privado
          </span>
        )}
      </div>

      {/* Title */}
      <div>
        <p className="font-semibold text-slate-900 leading-snug">{task.title}</p>
        {task.description && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{task.description}</p>
        )}
      </div>

      {/* Bottom row: category, due date, assignees */}
      <div className="flex items-center gap-2 flex-wrap">
        {task.category && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: task.category.color }}
          >
            {task.category.name}
          </span>
        )}

        {task.due_date && (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDate(task.due_date)}
          </span>
        )}

        {(task.assignees?.length ?? 0) > 0 && (
          <div className="flex -space-x-1 ml-auto">
            {task.assignees!.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-700 overflow-hidden"
              >
                {a.avatar_url ? (
                  <img src={a.avatar_url} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  a.name.charAt(0).toUpperCase()
                )}
              </div>
            ))}
            {(task.assignees?.length ?? 0) > 3 && (
              <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] text-slate-500">
                +{task.assignees!.length - 3}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Checklist progress */}
      {totalCount > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Checklist</span>
            <span>{checkedCount}/{totalCount}</span>
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}
