"use client";

import { useState, useTransition } from "react";
import type { Task, Profile, Category } from "@/lib/types";
import TaskCard from "@/components/tarefas/task-card";
import TaskFormModal from "@/components/tarefas/task-form-modal";
import EventFormModal from "@/components/calendario/event-form-modal";
import CreatePickerModal from "@/components/create-picker-modal";
import MemberAvatar from "@/components/member-avatar";
import {
  advanceTaskStatus,
  deleteTask,
  bulkDeleteTasks,
  bulkAdvanceStatus,
  bulkUpdateDueDate,
  bulkUpdateAssignees,
} from "./actions";

type Props = {
  tasks: Task[];
  categories: Category[];
  members: Profile[];
  currentProfile: Profile;
};

export default function TarefasClient({ tasks, categories, members, currentProfile }: Props) {
  const [activeTab, setActiveTab] = useState<"backlog" | "todo">("backlog");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // ── Seleção múltipla ──────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Painéis de ação em massa ──────────────────────────────
  const [bulkPanel, setBulkPanel] = useState<"date" | "assignee" | "confirmDelete" | null>(null);
  const [bulkDate, setBulkDate] = useState("");
  const [bulkAssigneeIds, setBulkAssigneeIds] = useState<string[]>([]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkPanel(null);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(visibleTasks.map((t) => t.id)));
  }

  function tryAdvance(task: Task) {
    const missing: string[] = [];
    if (!task.due_date) missing.push("data de vencimento");
    if ((task.assignees?.length ?? 0) === 0) missing.push("responsável");
    if (missing.length > 0) {
      showToast(`Adicione ${missing.join(" e ")} para avançar o status`);
      return;
    }
    startTransition(() => { void advanceTaskStatus(task.id, task.status); });
  }

  // ── Ações em massa ────────────────────────────────────────
  async function handleBulkAdvance() {
    const ids = Array.from(selectedIds);
    await bulkAdvanceStatus(ids);
    showToast(`${ids.length} tarefas avançadas`);
    exitSelectMode();
  }

  async function handleBulkDate() {
    const ids = Array.from(selectedIds);
    await bulkUpdateDueDate(ids, bulkDate || null);
    showToast(`Data atualizada em ${ids.length} tarefas`);
    setBulkPanel(null);
    setBulkDate("");
    exitSelectMode();
  }

  async function handleBulkAssignee() {
    const ids = Array.from(selectedIds);
    await bulkUpdateAssignees(ids, bulkAssigneeIds);
    showToast(`Responsável atualizado em ${ids.length} tarefas`);
    setBulkPanel(null);
    setBulkAssigneeIds([]);
    exitSelectMode();
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    await bulkDeleteTasks(ids);
    showToast(`${ids.length} tarefas excluídas`);
    exitSelectMode();
  }

  // ── Filtragem ─────────────────────────────────────────────
  const backlogAll = tasks.filter((t) => (t.assignees?.length ?? 0) === 0);
  const todoAll = tasks.filter((t) => (t.assignees?.length ?? 0) > 0);

  const visibleTasks = (activeTab === "backlog" ? backlogAll : todoAll)
    .filter((t) => !categoryFilter || t.category?.id === categoryFilter)
    .filter((t) => !priorityFilter || t.priority === priorityFilter);

  function handleTabChange(tab: "backlog" | "todo") {
    setActiveTab(tab);
    setCategoryFilter(null);
    setPriorityFilter(null);
    exitSelectMode();
  }

  const tabDescription = activeTab === "backlog"
    ? "Tarefas sem data ou responsável"
    : "Tarefas com responsável atribuído";

  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 pt-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          {selectMode ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={exitSelectMode}
                  className="text-sm font-medium text-slate-500"
                >
                  Cancelar
                </button>
                <span className="text-sm font-semibold text-slate-800">
                  {selectedCount > 0 ? `${selectedCount} selecionada${selectedCount > 1 ? "s" : ""}` : "Selecione tarefas"}
                </span>
              </div>
              <button
                onClick={selectAll}
                className="text-sm font-medium text-indigo-600"
              >
                Selecionar tudo
              </button>
            </>
          ) : (
            <>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  {activeTab === "backlog" ? "Backlog" : "To Do"}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">{tabDescription}</p>
              </div>
              <div className="flex items-center gap-2">
                {visibleTasks.length > 0 && (
                  <button
                    onClick={() => setSelectMode(true)}
                    className="text-xs font-medium text-slate-500 px-2.5 py-1.5 rounded-lg border border-slate-200"
                  >
                    Selecionar
                  </button>
                )}
                <button
                  onClick={() => { setEditingTask(null); setShowPicker(true); }}
                  className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex -mx-4">
          {(["backlog", "todo"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === tab
                  ? "text-indigo-600 border-indigo-600"
                  : "text-slate-400 border-transparent"
              }`}
            >
              {tab === "backlog" ? "Backlog" : "To Do"}
            </button>
          ))}
        </div>

        {/* Filters */}
        {!selectMode && (
          <div className="flex gap-2 py-2.5">
            <select
              value={categoryFilter ?? ""}
              onChange={(e) => setCategoryFilter(e.target.value || null)}
              className="flex-1 min-w-0 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-colors"
            >
              <option value="">Todas as categorias</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <select
              value={priorityFilter ?? ""}
              onChange={(e) => setPriorityFilter(e.target.value || null)}
              className="flex-1 min-w-0 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-colors"
            >
              <option value="">Todas as prioridades</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-36">
        {visibleTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 6h16M4 10h16M4 14h10M4 18h7" />
            </svg>
            <p className="text-sm font-medium">
              {activeTab === "backlog" ? "Backlog vazio" : "Nenhuma tarefa"}
            </p>
            <p className="text-xs mt-1">
              {activeTab === "backlog"
                ? "Novas tarefas sem data ou responsável aparecem aqui"
                : "Tarefas com responsável atribuído aparecem aqui"}
            </p>
          </div>
        ) : (
          visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              compact={activeTab === "backlog"}
              onEdit={() => { setEditingTask(task); setShowTaskForm(true); }}
              onAdvanceStatus={() => tryAdvance(task)}
              selectMode={selectMode}
              selected={selectedIds.has(task.id)}
              onToggleSelect={() => toggleSelect(task.id)}
            />
          ))
        )}
      </div>

      {/* ── Barra de ações em massa ───────────────────────── */}
      {selectMode && (
        <div className="fixed bottom-16 left-0 right-0 max-w-2xl mx-auto z-40 px-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">

            {/* Painel: confirmação de exclusão */}
            {bulkPanel === "confirmDelete" && (
              <div className="p-4 space-y-3 border-b border-slate-100">
                <p className="text-sm font-medium text-red-700 text-center">
                  Excluir {selectedCount} tarefa{selectedCount > 1 ? "s" : ""}? Esta ação não pode ser desfeita.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBulkPanel(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )}

            {/* Painel: seletor de data */}
            {bulkPanel === "date" && (
              <div className="p-4 space-y-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Nova data para {selectedCount} tarefa{selectedCount > 1 ? "s" : ""}
                </p>
                <input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setBulkPanel(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBulkDate}
                    disabled={!bulkDate}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white disabled:opacity-50"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}

            {/* Painel: seletor de responsável */}
            {bulkPanel === "assignee" && (
              <div className="p-4 space-y-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Responsável para {selectedCount} tarefa{selectedCount > 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => {
                    const active = bulkAssigneeIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setBulkAssigneeIds((prev) =>
                            prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                          )
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors ${
                          active ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200"
                        }`}
                        style={active ? { backgroundColor: m.color ?? "#6366f1" } : {}}
                      >
                        <div
                          className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center text-[8px] font-bold text-white"
                          style={{ backgroundColor: m.color ?? "#6366f1" }}
                        >
                          <MemberAvatar name={m.name} avatarUrl={m.avatar_url} />
                        </div>
                        {m.name.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBulkPanel(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBulkAssignee}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}

            {/* Botões de ação */}
            <div className="flex items-center divide-x divide-slate-100">
              <button
                disabled={selectedCount === 0}
                onClick={() => { setBulkPanel(null); startTransition(() => { void handleBulkAdvance(); }); }}
                className="flex-1 flex flex-col items-center gap-0.5 py-3 text-slate-600 disabled:opacity-40 active:bg-slate-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                <span className="text-[10px] font-medium">Avançar</span>
              </button>

              <button
                disabled={selectedCount === 0}
                onClick={() => setBulkPanel(bulkPanel === "date" ? null : "date")}
                className={`flex-1 flex flex-col items-center gap-0.5 py-3 disabled:opacity-40 active:bg-slate-50 ${bulkPanel === "date" ? "text-indigo-600" : "text-slate-600"}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[10px] font-medium">Data</span>
              </button>

              <button
                disabled={selectedCount === 0}
                onClick={() => setBulkPanel(bulkPanel === "assignee" ? null : "assignee")}
                className={`flex-1 flex flex-col items-center gap-0.5 py-3 disabled:opacity-40 active:bg-slate-50 ${bulkPanel === "assignee" ? "text-indigo-600" : "text-slate-600"}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-[10px] font-medium">Responsável</span>
              </button>

              <button
                disabled={selectedCount === 0}
                onClick={() => setBulkPanel(bulkPanel === "confirmDelete" ? null : "confirmDelete")}
                className={`flex-1 flex flex-col items-center gap-0.5 py-3 disabled:opacity-40 active:bg-red-50 ${bulkPanel === "confirmDelete" ? "text-red-600" : "text-slate-600"}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="text-[10px] font-medium">Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-20 left-0 right-0 flex justify-center z-50 px-4 pointer-events-none">
          <div className="bg-slate-800 text-white text-sm font-medium px-4 py-2.5 rounded-2xl shadow-lg max-w-sm text-center">
            {toastMsg}
          </div>
        </div>
      )}

      {showPicker && (
        <CreatePickerModal
          onPickTask={() => { setShowPicker(false); setShowTaskForm(true); }}
          onPickEvent={() => { setShowPicker(false); setShowEventForm(true); }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showTaskForm && (
        <TaskFormModal
          task={editingTask}
          categories={categories}
          members={members}
          currentProfile={currentProfile}
          onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
          onDelete={editingTask ? async () => {
            await deleteTask(editingTask.id);
            setShowTaskForm(false);
            setEditingTask(null);
          } : undefined}
        />
      )}

      {showEventForm && (
        <EventFormModal
          members={members}
          currentProfile={currentProfile}
          onClose={() => setShowEventForm(false)}
        />
      )}
    </div>
  );
}
