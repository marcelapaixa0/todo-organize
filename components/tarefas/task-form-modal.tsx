"use client";

import { useState } from "react";
import { createTask, updateTask } from "@/app/(app)/tarefas/actions";
import type { Task, Profile, Category, TaskStatus, TaskPriority } from "@/lib/types";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, requiresAssigneeAndDate, cn } from "@/lib/utils";

type Props = {
  task: Task | null;
  categories: Category[];
  members: Profile[];
  currentProfile: Profile;
  onClose: () => void;
};

const STATUSES: TaskStatus[] = ["todo", "in_progress", "on_hold", "done"];
const PRIORITIES: TaskPriority[] = ["high", "medium", "low"];

export default function TaskFormModal({ task, categories, members, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">(task?.visibility ?? "public");
  const [categoryId, setCategoryId] = useState(task?.category_id ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assignees?.map((a) => a.id) ?? []);
  const [error, setError] = useState("");

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function validate(): string {
    if (!title.trim()) return "O título é obrigatório.";
    if (!categoryId) return "Selecione uma categoria.";
    if (requiresAssigneeAndDate(status)) {
      if (!dueDate) return `Para status "${TASK_STATUS_LABELS[status]}", a data limite é obrigatória.`;
      if (assigneeIds.length === 0) return `Para status "${TASK_STATUS_LABELS[status]}", adicione ao menos um responsável.`;
    }
    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      visibility,
      category_id: categoryId,
      priority,
      status,
      due_date: dueDate || null,
      assignee_ids: assigneeIds,
    };

    const result = task
      ? await updateTask(task.id, payload)
      : await createTask(payload);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {task ? "Editar tarefa" : "Nova tarefa"}
            </h2>
            <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Atividade *</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Título da tarefa"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Descrição (opcional)"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Visibilidade *</label>
            <div className="flex gap-2">
              {(["public", "private"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setVisibility(v)}
                  className={cn("flex-1 py-2 rounded-xl text-sm font-medium border transition-colors",
                    visibility === v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
                  )}>
                  {v === "public" ? "Público" : "Privado"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Categoria *</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button key={cat.id} type="button" onClick={() => setCategoryId(cat.id)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors",
                    categoryId === cat.id ? "border-transparent text-white" : "border-transparent bg-slate-100 text-slate-600"
                  )}
                  style={categoryId === cat.id ? { backgroundColor: cat.color } : {}}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Prioridade *</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={cn("flex-1 py-2 rounded-xl text-sm font-medium border transition-colors",
                    priority === p ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
                  )}>
                  {TASK_PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Status *</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={cn("py-2 rounded-xl text-sm font-medium border transition-colors",
                    status === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
                  )}>
                  {TASK_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            {requiresAssigneeAndDate(status) && (
              <p className="text-xs text-amber-600">
                Data limite e responsável são obrigatórios para este status.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Data limite {requiresAssigneeAndDate(status) && "*"}
            </label>
            <input type="date"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Responsáveis {requiresAssigneeAndDate(status) && "*"}
            </label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <button key={m.id} type="button" onClick={() => toggleAssignee(m.id)}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors",
                    assigneeIds.includes(m.id) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
                  )}>
                  <div className="w-4 h-4 rounded-full bg-indigo-100 overflow-hidden flex items-center justify-center text-[8px] font-bold text-indigo-700">
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt={m.name} className="w-full h-full object-cover" />
                      : m.name.charAt(0).toUpperCase()}
                  </div>
                  {m.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60 active:scale-[0.98] transition-transform">
            {loading ? "Salvando..." : task ? "Salvar alterações" : "Criar tarefa"}
          </button>
        </form>
      </div>
    </div>
  );
}
