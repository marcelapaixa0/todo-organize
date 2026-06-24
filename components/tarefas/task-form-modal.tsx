"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { createTask, updateTask } from "@/app/(app)/tarefas/actions";
import type {
  Task, Profile, Category, TaskStatus, TaskPriority,
  RecurrenceType, TaskEditHistory,
} from "@/lib/types";
import {
  TASK_STATUS_LABELS, TASK_PRIORITY_LABELS,
  requiresAssigneeAndDate, cn,
} from "@/lib/utils";
import MemberAvatar from "@/components/member-avatar";

type Props = {
  task: Task | null;
  categories: Category[];
  members: Profile[];
  currentProfile: Profile;
  defaultDate?: string;
  onClose: () => void;
  onDelete?: () => void;
};

type Tab = "detalhes" | "historico";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "on_hold", "done"];
const PRIORITIES: TaskPriority[] = ["high", "medium", "low"];

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: "none",     label: "Sem recorrência" },
  { value: "daily",    label: "Diário" },
  { value: "weekly",   label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly",  label: "Mensal" },
  { value: "yearly",   label: "Anual" },
];

const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: "",     label: "Sem lembrete" },
  { value: "15",   label: "15 min antes" },
  { value: "30",   label: "30 min antes" },
  { value: "60",   label: "1 hora antes" },
  { value: "120",  label: "2 horas antes" },
  { value: "1440", label: "1 dia antes" },
];

const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  status: "Status",
  priority: "Prioridade",
  due_date: "Data limite",
  category_id: "Categoria",
  visibility: "Visibilidade",
  recurrence: "Recorrência",
  reminder_minutes: "Lembrete",
  assignees: "Responsáveis",
};

const RECURRENCE_LABELS: Record<string, string> = {
  none: "Sem recorrência", daily: "Diário", weekly: "Semanal",
  biweekly: "Quinzenal", monthly: "Mensal", yearly: "Anual",
};

const VISIBILITY_LABELS: Record<string, string> = {
  public: "Público", private: "Privado",
};

function formatHistoryValue(
  field: string, value: string | null,
  categories: Category[], members: Profile[]
): string {
  if (value === null || value === "") return "—";
  switch (field) {
    case "status":     return TASK_STATUS_LABELS[value as TaskStatus] ?? value;
    case "priority":   return TASK_PRIORITY_LABELS[value as TaskPriority] ?? value;
    case "recurrence": return RECURRENCE_LABELS[value] ?? value;
    case "visibility": return VISIBILITY_LABELS[value] ?? value;
    case "category_id": return categories.find((c) => c.id === value)?.name ?? value;
    case "due_date":   return format(parseISO(value), "d MMM yyyy", { locale: ptBR });
    case "reminder_minutes": {
      const map: Record<string, string> = { "15": "15 min", "30": "30 min", "60": "1 hora", "120": "2 horas", "1440": "1 dia" };
      return map[value] ?? `${value} min`;
    }
    case "assignees":
      return value.split(",")
        .map((id) => members.find((m) => m.id === id)?.name.split(" ")[0] ?? "?")
        .join(", ");
    default: return value || "—";
  }
}

export default function TaskFormModal({
  task, categories, members, currentProfile, defaultDate, onClose, onDelete,
}: Props) {
  const supabase = createClient();
  const isEditing = !!task;

  // ─── Tab ─────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("detalhes");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  // ─── Form state ──────────────────────────────────
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [title, setTitle]           = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">(task?.visibility ?? "public");
  const [categoryId, setCategoryId] = useState(task?.category_id ?? "");
  const [priority, setPriority]     = useState<TaskPriority>(task?.priority ?? "medium");
  const [status, setStatus]         = useState<TaskStatus>(task?.status ?? "todo");
  const [dueDate, setDueDate]       = useState(task?.due_date ?? defaultDate ?? "");
  const [recurrence, setRecurrence] = useState<RecurrenceType>(task?.recurrence ?? "none");
  const [reminderMinutes, setReminderMinutes] = useState<string>(
    task?.reminder_minutes != null ? String(task.reminder_minutes) : ""
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    task?.assignees?.map((a) => a.id) ?? []
  );
  const [checklistItems, setChecklistItems] = useState<{ text: string; assigneeId: string }[]>(
    task?.checklist_items?.map((ci) => ({ text: ci.text, assigneeId: ci.assignee_id ?? "" })) ?? []
  );

  // ─── History ─────────────────────────────────────
  const [history, setHistory]           = useState<TaskEditHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!task) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from("task_edit_history")
      .select("*, changer:profiles!changed_by(*)")
      .eq("task_id", task.id)
      .order("changed_at", { ascending: false });
    setHistory(
      (data ?? []).map((h: any) => ({
        ...h,
        changer: Array.isArray(h.changer) ? h.changer[0] : h.changer,
      }))
    );
    setLoadingHistory(false);
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === "historico") loadHistory();
  }, [activeTab, loadHistory]);

  // ─── Helpers ─────────────────────────────────────
  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function addChecklistItem() {
    setChecklistItems((prev) => [...prev, { text: "", assigneeId: "" }]);
  }

  function updateChecklistItem(i: number, field: "text" | "assigneeId", v: string) {
    setChecklistItems((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, [field]: v } : item))
    );
  }

  function removeChecklistItem(i: number) {
    setChecklistItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function validate(): string {
    if (!title.trim()) return "O título é obrigatório.";
    if (!categoryId) return "Selecione uma categoria.";
    if (requiresAssigneeAndDate(status)) {
      if (!dueDate) return `Para "${TASK_STATUS_LABELS[status]}", a data limite é obrigatória.`;
      if (assigneeIds.length === 0) return `Para "${TASK_STATUS_LABELS[status]}", adicione ao menos um responsável.`;
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
      recurrence,
      recurrence_config: null,
      reminder_minutes: reminderMinutes ? parseInt(reminderMinutes) : null,
      assignee_ids: assigneeIds,
      checklist_items: checklistItems
        .filter((i) => i.text.trim())
        .map((i, idx) => ({ text: i.text, assignee_id: i.assigneeId || null, position: idx })),
    };

    const result = task
      ? await updateTask(task.id, payload)
      : await createTask(payload);

    if (result.error) { setError(result.error); setLoading(false); return; }
    onClose();
  }

  // ─── Render helpers ──────────────────────────────

  const TABS: { id: Tab; label: string }[] = [
    { id: "detalhes",  label: "Detalhes" },
    { id: "historico", label: "Histórico" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-900">
            {isEditing ? "Editar tarefa" : "Nova tarefa"}
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs — only when editing */}
        {isEditing && (
          <div className="flex px-5 border-b border-slate-100 flex-shrink-0 overflow-x-auto scrollbar-none">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors",
                  activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── DETALHES TAB ── */}
          {(!isEditing || activeTab === "detalhes") && (
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
              )}

              {/* Title + description */}
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

              {/* Visibility */}
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

              {/* Category */}
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

              {/* Priority */}
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

              {/* Status */}
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

              {/* Due date + Recurrence + Reminder */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Data limite {requiresAssigneeAndDate(status) && "*"}
                </label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={dueDate}
                  onChange={(e) => { setDueDate(e.target.value); if (!e.target.value) setRecurrence("none"); }}
                />

                {dueDate && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Recorrência</p>
                      <select
                        value={recurrence}
                        onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        {RECURRENCE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Lembrete</p>
                      <select
                        value={reminderMinutes}
                        onChange={(e) => setReminderMinutes(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        {REMINDER_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Assignees */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Responsáveis {requiresAssigneeAndDate(status) && "*"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <button key={m.id} type="button" onClick={() => toggleAssignee(m.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors",
                        assigneeIds.includes(m.id)
                          ? "text-white border-transparent"
                          : "bg-white text-slate-600 border-slate-200"
                      )}
                      style={assigneeIds.includes(m.id) ? { backgroundColor: m.color ?? "#6366f1" } : {}}>
                      <div
                        className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center text-[8px] font-bold text-white"
                        style={{ backgroundColor: m.color ?? "#6366f1" }}
                      >
                        <MemberAvatar name={m.name} avatarUrl={m.avatar_url} />
                      </div>
                      {m.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Checklist</label>
                <div className="space-y-2">
                  {checklistItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder={`Item ${idx + 1}`}
                        value={item.text}
                        onChange={(e) => updateChecklistItem(idx, "text", e.target.value)}
                      />
                      <select
                        className="border border-slate-200 rounded-xl px-2 py-2 text-xs text-slate-600 focus:outline-none bg-white"
                        value={item.assigneeId}
                        onChange={(e) => updateChecklistItem(idx, "assigneeId", e.target.value)}
                      >
                        <option value="">Resp.</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>{m.name.split(" ")[0]}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => removeChecklistItem(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addChecklistItem}
                  className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:text-indigo-700 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Adicionar item
                </button>
              </div>

              {isEditing && onDelete ? (
                confirmDelete ? (
                  <div ref={confirmRef} className="rounded-xl bg-red-50 border border-red-100 p-3 space-y-2">
                    <p className="text-sm font-medium text-red-700 text-center">
                      Tem certeza? Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 active:scale-[0.98] transition-transform"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={onDelete}
                        disabled={loading}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white disabled:opacity-60 active:scale-[0.98] transition-transform"
                      >
                        Sim, excluir
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDelete(true);
                        setTimeout(() => confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
                      }}
                      className="px-4 py-3 rounded-xl text-sm font-medium bg-red-50 text-red-600 border border-red-100 active:scale-[0.98] transition-transform"
                    >
                      Excluir
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60 active:scale-[0.98] transition-transform"
                    >
                      {loading ? "Salvando..." : "Salvar alterações"}
                    </button>
                  </div>
                )
              ) : (
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60 active:scale-[0.98] transition-transform">
                  {loading ? "Salvando..." : "Criar tarefa"}
                </button>
              )}
            </form>
          )}

          {/* ── HISTÓRICO TAB ── */}
          {isEditing && activeTab === "historico" && (
            <div className="p-5 space-y-1">
              {/* Creation entry */}
              <div className="flex gap-2.5 pb-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1 flex-shrink-0" />
                  <div className="w-px flex-1 bg-slate-100 mt-1" />
                </div>
                <div className="pb-3">
                  <p className="text-xs font-semibold text-slate-700">Tarefa criada</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {format(new Date(task!.created_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {loadingHistory ? (
                <p className="text-sm text-slate-400 py-4 text-center">Carregando...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">Nenhuma edição registrada.</p>
              ) : (
                [...history].reverse().map((h, i) => (
                  <div key={h.id} className="flex gap-2.5">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-slate-300 mt-1 flex-shrink-0" />
                      {i < history.length - 1 && <div className="w-px flex-1 bg-slate-100 mt-1" />}
                    </div>
                    <div className="pb-4">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white overflow-hidden"
                          style={{ backgroundColor: h.changer?.color ?? "#6366f1" }}
                        >
                          {h.changer
                            ? <MemberAvatar name={h.changer.name} avatarUrl={h.changer.avatar_url} />
                            : "?"}
                        </div>
                        <span className="text-xs font-semibold text-slate-700">
                          {h.changer?.name.split(" ")[0] ?? "?"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          · {format(new Date(h.changed_at), "d MMM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {(h.changes as Array<{ field: string; old: string | null; new: string | null }>).map((change, ci) => (
                          <div key={ci} className="text-xs text-slate-600">
                            <span className="font-medium">{FIELD_LABELS[change.field] ?? change.field}</span>
                            {": "}
                            <span className="line-through text-slate-400">
                              {formatHistoryValue(change.field, change.old, categories, members)}
                            </span>
                            {" → "}
                            <span className="text-slate-800 font-medium">
                              {formatHistoryValue(change.field, change.new, categories, members)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
