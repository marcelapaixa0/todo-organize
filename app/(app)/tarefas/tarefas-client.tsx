"use client";

import { useState } from "react";
import type { Task, Profile, Category, TaskStatus } from "@/lib/types";
import { TASK_STATUS_LABELS, TASK_STATUS_DOT, cn } from "@/lib/utils";
import TaskCard from "@/components/tarefas/task-card";
import TaskFormModal from "@/components/tarefas/task-form-modal";

type Props = {
  tasks: Task[];
  categories: Category[];
  members: Profile[];
  currentProfile: Profile;
};

const STATUS_TABS: TaskStatus[] = ["todo", "in_progress", "on_hold"];

export default function TarefasClient({ tasks, categories, members, currentProfile }: Props) {
  const [activeStatus, setActiveStatus] = useState<TaskStatus | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const filtered = activeStatus === "all"
    ? tasks
    : tasks.filter((t) => t.status === activeStatus);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 pt-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-slate-900">Tarefas</h1>
          <button
            onClick={() => { setEditingTask(null); setShowForm(true); }}
            className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center shadow-sm active:scale-95 transition-transform"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-3 scrollbar-hide">
          {(["all", ...STATUS_TABS] as const).map((s) => (
            <button
              key={s}
              onClick={() => setActiveStatus(s)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                activeStatus === s
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              {s !== "all" && (
                <span className={cn("w-1.5 h-1.5 rounded-full", TASK_STATUS_DOT[s])} />
              )}
              {s === "all" ? "Todas" : TASK_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">Nenhuma tarefa aqui</p>
          </div>
        ) : (
          filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={() => { setEditingTask(task); setShowForm(true); }}
            />
          ))
        )}
      </div>

      {showForm && (
        <TaskFormModal
          task={editingTask}
          categories={categories}
          members={members}
          currentProfile={currentProfile}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
