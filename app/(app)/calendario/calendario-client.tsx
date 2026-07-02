"use client";

import { useState, useTransition, useEffect } from "react";
import { usePullToRefresh } from "@/lib/use-pull-to-refresh";
import {
  format,
  isSameDay,
  isBefore,
  isToday,
  isTomorrow,
  parseISO,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  addYears,
  isSameMonth,
  isSameWeek,
  isAfter,
  differenceInCalendarWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Task, CalendarEvent, Profile, Category, TaskStatus } from "@/lib/types";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS, cn } from "@/lib/utils";
import TaskFormModal from "@/components/tarefas/task-form-modal";
import EventFormModal from "@/components/calendario/event-form-modal";
import CreatePickerModal from "@/components/create-picker-modal";
import {
  advanceTaskStatus, deleteTask,
  bulkDeleteTasks, bulkAdvanceStatus, bulkUpdateDueDate, bulkUpdateAssignees,
} from "../tarefas/actions";
import {
  deleteEvent,
  bulkDeleteEvents, bulkUpdateEventDate, bulkUpdateEventParticipants,
} from "./actions";
import MemberAvatar from "@/components/member-avatar";

type Props = {
  tasks: Task[];
  events: CalendarEvent[];
  categories: Category[];
  members: Profile[];
  currentProfile: Profile;
};

type StatusFilter = TaskStatus | "all";

const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

const PERIOD_LABELS: Record<string, string> = {
  "06:00": "Manhã",
  "12:00": "Tarde",
  "18:00": "Noite",
};

function periodLabel(startTime: string | null) {
  if (!startTime) return "Dia inteiro";
  return PERIOD_LABELS[startTime] ?? startTime;
}

function isBacklog(task: Task) {
  return task.status === "todo" && !task.due_date && (task.assignees?.length ?? 0) === 0;
}

// Expands recurring events into one virtual occurrence per matching day within [rangeStart, rangeEnd].
// Non-recurring events are returned as-is (their single `date` is already correct).
function expandEventOccurrences(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
  const occurrences: CalendarEvent[] = [];

  for (const ev of events) {
    if (!ev.recurrence || ev.recurrence === "none") {
      occurrences.push(ev);
      continue;
    }

    const baseDate = parseISO(ev.date);
    const config = ev.recurrence_config;
    const interval = Math.max(1, config?.interval ?? (ev.recurrence === "biweekly" ? 2 : 1));
    const unit = config?.unit ?? (ev.recurrence === "monthly" ? "month" : "week");

    if (ev.recurrence === "monthly" || (ev.recurrence === "custom" && unit === "month")) {
      let cursor = baseDate;
      let guard = 0;
      while (!isAfter(cursor, rangeEnd) && guard < 240) {
        if (!isBefore(cursor, rangeStart) || isSameDay(cursor, rangeStart)) {
          occurrences.push({ ...ev, date: format(cursor, "yyyy-MM-dd") });
        }
        cursor = addMonths(cursor, interval);
        guard++;
      }
    } else if (ev.recurrence === "yearly") {
      let cursor = baseDate;
      let guard = 0;
      while (!isAfter(cursor, rangeEnd) && guard < 50) {
        if (!isBefore(cursor, rangeStart) || isSameDay(cursor, rangeStart)) {
          occurrences.push({ ...ev, date: format(cursor, "yyyy-MM-dd") });
        }
        cursor = addYears(cursor, interval);
        guard++;
      }
    } else if (ev.recurrence === "daily") {
      let cursor = isBefore(baseDate, rangeStart) ? rangeStart : baseDate;
      let guard = 0;
      while (!isAfter(cursor, rangeEnd) && guard < 730) {
        occurrences.push({ ...ev, date: format(cursor, "yyyy-MM-dd") });
        cursor = addDays(cursor, 1);
        guard++;
      }
    } else {
      // weekly / biweekly / custom (unit: week)
      const weekdays = config?.days?.length ? config.days : [baseDate.getDay()];
      const windowStart = isBefore(rangeStart, baseDate) ? baseDate : rangeStart;
      if (!isAfter(windowStart, rangeEnd)) {
        const days = eachDayOfInterval({ start: windowStart, end: rangeEnd });
        for (const d of days) {
          if (!weekdays.includes(d.getDay())) continue;
          const weeksDiff = differenceInCalendarWeeks(d, baseDate, { weekStartsOn: 0 });
          if (weeksDiff < 0 || weeksDiff % interval !== 0) continue;
          occurrences.push({ ...ev, date: format(d, "yyyy-MM-dd") });
        }
      }
    }
  }

  return occurrences;
}

function dayLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return format(d, "d MMM '· Hoje ·' EEEE", { locale: ptBR });
  if (isTomorrow(d)) return format(d, "d MMM '· Amanhã ·' EEEE", { locale: ptBR });
  return format(d, "d MMM '·' EEEE", { locale: ptBR });
}

function cardStyle(assignees: Profile[] | undefined, overdue: boolean, status?: string): React.CSSProperties {
  if (status === "done") return { backgroundColor: "#86efac", borderColor: "#4ade80" };
  if (overdue) return { backgroundColor: "#fee2e2", borderColor: "#fecaca" };
  if (!assignees?.length) return {};
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
}

export default function CalendarioClient({ tasks, events, categories, members, currentProfile }: Props) {
  const { containerRef, pullY, refreshing, onTouchStart, onTouchMove, onTouchEnd } = usePullToRefresh();
  const [showPicker, setShowPicker] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>("");
  const [viewMonth, setViewMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [deletedEventIds, setDeletedEventIds] = useState<Set<string>>(new Set());
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<CalendarEvent | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [bulkPanel, setBulkPanel] = useState<"date" | "assignee" | "confirmDelete" | null>(null);
  const [bulkDate, setBulkDate] = useState("");
  const [bulkAssigneeIds, setBulkAssigneeIds] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  function openEditEvent(event: CalendarEvent) {
    setEditingEvent(event);
    setShowEventForm(true);
  }

  function handleDeleteEvent(event: CalendarEvent) {
    setConfirmDeleteEvent(event);
    setShowEventForm(false);
    setEditingEvent(null);
  }

  async function executeDeleteEvent(event: CalendarEvent) {
    await deleteEvent(event.id);
    setDeletedEventIds((prev) => new Set([...prev, event.id]));
    setConfirmDeleteEvent(null);
  }

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedTaskIds(new Set());
    setSelectedEventIds(new Set());
    setBulkPanel(null);
  }

  function toggleSelectTask(id: string) {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function toggleSelectEvent(id: string) {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  async function handleBulkAdvance() {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;
    await bulkAdvanceStatus(ids);
    showToast(`${ids.length} tarefa${ids.length > 1 ? "s" : ""} avançada${ids.length > 1 ? "s" : ""}`);
    exitSelectMode();
  }

  async function handleBulkDate() {
    const taskIds = Array.from(selectedTaskIds);
    const eventIds = Array.from(selectedEventIds);
    if (taskIds.length > 0) await bulkUpdateDueDate(taskIds, bulkDate || null);
    if (eventIds.length > 0 && bulkDate) await bulkUpdateEventDate(eventIds, bulkDate);
    showToast(`Data atualizada em ${taskIds.length + eventIds.length} item${taskIds.length + eventIds.length > 1 ? "s" : ""}`);
    setBulkPanel(null);
    setBulkDate("");
    exitSelectMode();
  }

  async function handleBulkAssignee() {
    const taskIds = Array.from(selectedTaskIds);
    const eventIds = Array.from(selectedEventIds);
    if (taskIds.length > 0) await bulkUpdateAssignees(taskIds, bulkAssigneeIds);
    if (eventIds.length > 0) await bulkUpdateEventParticipants(eventIds, bulkAssigneeIds);
    showToast(`Responsável atualizado em ${taskIds.length + eventIds.length} item${taskIds.length + eventIds.length > 1 ? "s" : ""}`);
    setBulkPanel(null);
    setBulkAssigneeIds([]);
    exitSelectMode();
  }

  async function handleBulkDelete() {
    const taskIds = Array.from(selectedTaskIds);
    const eventIds = Array.from(selectedEventIds);
    if (taskIds.length > 0) await bulkDeleteTasks(taskIds);
    if (eventIds.length > 0) await bulkDeleteEvents(eventIds);
    showToast(`${taskIds.length + eventIds.length} item${taskIds.length + eventIds.length > 1 ? "s" : ""} excluído${taskIds.length + eventIds.length > 1 ? "s" : ""}`);
    exitSelectMode();
  }

  function tryAdvance(task: Task) {
    const missing: string[] = [];
    if (!task.due_date) missing.push("data de vencimento");
    if ((task.assignees?.length ?? 0) === 0) missing.push("responsável");
    if (missing.length > 0) {
      setToastMsg(`Adicione ${missing.join(" e ")} para avançar o status`);
      setTimeout(() => setToastMsg(null), 3500);
      return;
    }
    startTransition(() => { void advanceTaskStatus(task.id, task.status); });
  }

  // Schedule browser reminders for tasks due today/tomorrow
  useEffect(() => {
    if (!("Notification" in window)) return;
    const now = Date.now();
    const tasksWithReminders = tasks.filter(
      (t) => t.reminder_minutes && t.due_date && t.status !== "done"
    );
    if (!tasksWithReminders.length) return;

    const schedule = async () => {
      if (Notification.permission !== "granted") return;

      for (const t of tasksWithReminders) {
        const due = parseISO(t.due_date!);
        const fireAt = new Date(due);
        if (t.reminder_minutes === 1440) fireAt.setDate(fireAt.getDate() - 1);
        fireAt.setHours(9, 0, 0, 0);

        const delay = fireAt.getTime() - now;
        if (delay > 0 && delay < 48 * 60 * 60 * 1000) {
          setTimeout(() => {
            new Notification("ToDo Organize", {
              body: `Lembrete: ${t.title}`,
              icon: "/icon.png",
            });
          }, delay);
        }
      }
    };

    schedule();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const todoTasks = tasks.filter((t) => !isBacklog(t));

  const today = startOfDay(new Date());
  const todayStr = format(today, "yyyy-MM-dd");

  // Calendar grid days based on viewMode
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const weekStart = startOfWeek(viewMonth, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(viewMonth, { weekStartsOn: 0 });

  const calStart = viewMode === "month"
    ? startOfWeek(monthStart, { weekStartsOn: 0 })
    : viewMode === "week"
    ? weekStart
    : viewMonth;
  const calEnd = viewMode === "month"
    ? endOfWeek(monthEnd, { weekStartsOn: 0 })
    : viewMode === "week"
    ? weekEnd
    : viewMonth;
  const calDays = viewMode === "day"
    ? [viewMonth]
    : eachDayOfInterval({ start: calStart, end: calEnd });

  // Recurring events get expanded into one virtual occurrence per matching day in the visible range
  const expandedEvents = expandEventOccurrences(events, calStart, calEnd);

  // Apply filters
  const filteredTasks = todoTasks.filter((t) => {
    const statusOk = statusFilter === "all" || t.status === statusFilter;
    const assigneeOk =
      assigneeFilter === "all" || t.assignees?.some((a) => a.id === assigneeFilter);
    const categoryOk = !categoryFilter || t.category?.id === categoryFilter;
    const priorityOk = !priorityFilter || t.priority === priorityFilter;
    return statusOk && assigneeOk && categoryOk && priorityOk;
  });

  function selectAll() {
    setSelectedTaskIds(new Set(filteredTasks.map((t) => t.id)));
    setSelectedEventIds(new Set(expandedEvents.map((e) => e.id)));
  }

  const selectedCount = selectedTaskIds.size + selectedEventIds.size;

  // Fix 1: done tasks never appear in "overdue"; scoped to current view period
  const overdue = filteredTasks.filter(
    (t) =>
      t.due_date &&
      t.status !== "done" &&
      isBefore(parseISO(t.due_date), today) &&
      !isSameDay(parseISO(t.due_date), today) &&
      !isBefore(parseISO(t.due_date), calStart) &&
      !isAfter(parseISO(t.due_date), calEnd)
  );

  // Fix 1: past done tasks appear in their date group; scoped to current view period
  const withDate = filteredTasks.filter(
    (t) =>
      t.due_date &&
      (!isBefore(parseISO(t.due_date), today) || t.status === "done") &&
      !isBefore(parseISO(t.due_date), calStart) &&
      !isAfter(parseISO(t.due_date), calEnd)
  );

  // Fix 2: combine tasks and events into date groups
  type DayItems = { tasks: Task[]; events: CalendarEvent[] };
  const dateGroups = withDate.reduce<Record<string, DayItems>>((acc, t) => {
    const key = t.due_date!.slice(0, 10);
    if (!acc[key]) acc[key] = { tasks: [], events: [] };
    acc[key].tasks.push(t);
    return acc;
  }, {});

  for (const ev of expandedEvents) {
    const key = ev.date.slice(0, 10);
    if (!dateGroups[key]) dateGroups[key] = { tasks: [], events: [] };
    if (!dateGroups[key].events.find((e) => e.id === ev.id)) {
      dateGroups[key].events.push(ev);
    }
  }

  const sortedDates = Object.keys(dateGroups).sort();

  const undated = filteredTasks.filter(
    (t) => !t.due_date && ((t.assignees?.length ?? 0) > 0 || t.status !== "todo")
  );

  function navigatePrev() {
    if (viewMode === "month") setViewMonth((m) => subMonths(m, 1));
    else if (viewMode === "week") setViewMonth((m) => subWeeks(m, 1));
    else setViewMonth((m) => subDays(m, 1));
  }
  function navigateNext() {
    if (viewMode === "month") setViewMonth((m) => addMonths(m, 1));
    else if (viewMode === "week") setViewMonth((m) => addWeeks(m, 1));
    else setViewMonth((m) => addDays(m, 1));
  }
  function navigateLabel() {
    if (viewMode === "month") return format(viewMonth, "MMMM yyyy", { locale: ptBR });
    if (viewMode === "week")
      return `${format(weekStart, "d MMM", { locale: ptBR })} – ${format(weekEnd, "d MMM yyyy", { locale: ptBR })}`;
    return format(viewMonth, "EEEE, d 'de' MMMM", { locale: ptBR });
  }

  // Fix 2: dots include both tasks and events
  const taskDateSet = todoTasks.reduce<Record<string, true>>((acc, t) => {
    if (t.due_date) acc[t.due_date.slice(0, 10)] = true;
    return acc;
  }, {});

  const eventDateSet = expandedEvents.reduce<Record<string, true>>((acc, e) => {
    acc[e.date.slice(0, 10)] = true;
    return acc;
  }, {});

  function openCreate(date?: string) {
    setEditingTask(null);
    setDefaultDate(date ?? todayStr);
    setShowPicker(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setDefaultDate(task.due_date?.slice(0, 10) ?? todayStr);
    setShowTaskForm(true);
  }

  // Fix 3: day click shows day panel
  function handleDayClick(dayStr: string) {
    setSelectedDay(dayStr);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white px-4 pt-4 pb-0">
        {/* Title + add button */}
        <div className="flex items-center justify-between mb-3">
          {selectMode ? (
            <>
              <div className="flex items-center gap-2">
                <button onClick={exitSelectMode} className="text-sm font-medium text-slate-500">Cancelar</button>
                <span className="text-sm font-semibold text-slate-800">
                  {selectedCount > 0 ? `${selectedCount} selecionado${selectedCount > 1 ? "s" : ""}` : "Selecione itens"}
                </span>
              </div>
              <button onClick={selectAll} className="text-sm font-medium text-indigo-600">Selecionar tudo</button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-slate-900">To Do</h1>
              <div className="flex items-center gap-2">
                {(filteredTasks.length > 0 || expandedEvents.length > 0) && (
                  <button
                    onClick={() => setSelectMode(true)}
                    className="text-xs font-medium text-slate-500 px-2.5 py-1.5 rounded-lg border border-slate-200"
                  >
                    Selecionar
                  </button>
                )}
                <button
                  onClick={() => openCreate()}
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

        {/* View mode selector */}
        <div className="flex items-center justify-center mb-3">
          <div className="flex bg-slate-100 rounded-xl p-0.5 gap-0.5">
            {(["month", "week", "day"] as const).map((mode) => {
              const labels = { month: "Mensal", week: "Semanal", day: "Diária" };
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "px-4 py-1.5 rounded-[10px] text-xs font-semibold transition-all",
                    viewMode === mode
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {labels[mode]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Period navigation */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={navigatePrev}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setViewMonth(new Date())}
            className="text-sm font-semibold text-slate-700 capitalize hover:text-indigo-600 transition-colors"
          >
            {navigateLabel()}
          </button>
          <button
            onClick={navigateNext}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day-of-week labels (not shown in daily mode) */}
        {viewMode !== "day" && (
          <div className="grid grid-cols-7 text-center mb-1">
            {DAY_LABELS.map((d, i) => (
              <span key={i} className="text-[10px] font-medium text-slate-400 uppercase">
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Calendar grid */}
        {viewMode === "day" ? (
          // Daily: single large day cell
          <div className="flex justify-center py-1">
            {calDays.map((day) => {
              const isT = isToday(day);
              const dayStr = format(day, "yyyy-MM-dd");
              const hasTask = taskDateSet[dayStr];
              const hasEvent = eventDateSet[dayStr];
              return (
                <button
                  key={dayStr}
                  onClick={() => handleDayClick(dayStr)}
                  className={cn(
                    "flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-colors",
                    isT ? "bg-indigo-600" : "bg-slate-50 hover:bg-slate-100"
                  )}
                >
                  <span className={cn("text-2xl font-bold leading-none", isT ? "text-white" : "text-slate-800")}>
                    {format(day, "d")}
                  </span>
                  <span className={cn("text-[10px] font-medium mt-1 capitalize", isT ? "text-indigo-200" : "text-slate-400")}>
                    {format(day, "EEE", { locale: ptBR })}
                  </span>
                  <div className="flex gap-0.5 mt-1 h-1 items-center">
                    {hasTask && <div className={cn("w-1.5 h-1.5 rounded-full", isT ? "bg-white/60" : "bg-indigo-400")} />}
                    {hasEvent && <div className={cn("w-1.5 h-1.5 rounded-full", isT ? "bg-white/60" : "bg-violet-400")} />}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          // Monthly / weekly grid
          <div className="grid grid-cols-7 gap-y-0.5">
            {calDays.map((day) => {
              const isT = isToday(day);
              const inMonth = viewMode === "week" ? true : isSameMonth(day, viewMonth);
              const inWeek = viewMode === "week" ? isSameWeek(day, viewMonth, { weekStartsOn: 0 }) : true;
              const dayStr = format(day, "yyyy-MM-dd");
              const hasTask = taskDateSet[dayStr];
              const hasEvent = eventDateSet[dayStr];
              const isSelected = selectedDay === dayStr;
              return (
                <button
                  key={dayStr}
                  onClick={() => handleDayClick(dayStr)}
                  className={cn(
                    "flex flex-col items-center py-1 rounded-lg transition-colors",
                    viewMode === "week" ? "py-2" : "",
                    isT ? "bg-indigo-600" : isSelected ? "bg-indigo-100" : (inMonth || inWeek) ? "hover:bg-slate-50" : ""
                  )}
                >
                  <span
                    className={cn(
                      "leading-none font-medium",
                      viewMode === "week" ? "text-sm" : "text-xs",
                      isT ? "text-white" : inMonth ? "text-slate-700" : "text-slate-300"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="flex gap-0.5 mt-0.5 h-1 items-center">
                    {hasTask && inMonth && (
                      <div className={cn("w-1 h-1 rounded-full", isT ? "bg-white/60" : "bg-indigo-400")} />
                    )}
                    {hasEvent && inMonth && (
                      <div className={cn("w-1 h-1 rounded-full", isT ? "bg-white/60" : "bg-violet-400")} />
                    )}
                    {!hasTask && !hasEvent && <div className="w-1 h-1" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

      {/* Filter bar */}
      <div
        className="flex items-center gap-2 -mx-4 px-4 pt-2.5 pb-2.5 border-b border-slate-100 overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="flex-shrink-0 w-32 text-xs font-medium bg-slate-100 text-slate-700 border-none rounded-xl px-3 py-2 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
        >
          <option value="all">Status</option>
          <option value="todo">{TASK_STATUS_LABELS["todo"]}</option>
          <option value="in_progress">{TASK_STATUS_LABELS["in_progress"]}</option>
          <option value="on_hold">{TASK_STATUS_LABELS["on_hold"]}</option>
          <option value="done">{TASK_STATUS_LABELS["done"]}</option>
        </select>

        {members.length > 0 && (
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="flex-shrink-0 w-32 text-xs font-medium bg-slate-100 text-slate-700 border-none rounded-xl px-3 py-2 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
          >
            <option value="all">Membro</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name.split(" ")[0]}</option>
            ))}
          </select>
        )}

        <select
          value={categoryFilter ?? ""}
          onChange={(e) => setCategoryFilter(e.target.value || null)}
          className="flex-shrink-0 w-32 text-xs font-medium bg-slate-100 text-slate-700 border-none rounded-xl px-3 py-2 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
        >
          <option value="">Categoria</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        <select
          value={priorityFilter ?? ""}
          onChange={(e) => setPriorityFilter(e.target.value || null)}
          className="flex-shrink-0 w-32 text-xs font-medium bg-slate-100 text-slate-700 border-none rounded-xl px-3 py-2 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
        >
          <option value="">Prioridade</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>
      </div>
      </div>

      {/* Agenda */}
      <div
        ref={containerRef}
        className={cn("flex-1 overflow-y-auto px-4 py-3 space-y-5", selectMode && "pb-36")}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{ height: refreshing ? 40 : pullY > 0 ? Math.min(pullY * 0.6, 40) : 0, transition: pullY === 0 ? "height 0.2s ease" : "none" }}
        >
          {refreshing ? (
            <svg className="w-5 h-5 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-slate-400"
              style={{ transform: `rotate(${Math.min((pullY / 64) * 180, 180)}deg)`, transition: "transform 0.1s" }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
        {filteredTasks.length === 0 && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <p className="text-sm font-medium">Nenhuma atividade encontrada</p>
            <p className="text-xs mt-1">Toque em + para adicionar ou ajuste os filtros</p>
          </div>
        )}

        {/* Fix 1: overdue excludes done tasks */}
        {overdue.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-rose-500 uppercase tracking-wide">Atrasadas</span>
              <span className="text-xs text-rose-400">{overdue.length}</span>
            </div>
            <div className="space-y-2">
              {overdue.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  overdue
                  onEdit={() => openEdit(task)}
                  onAdvance={() => tryAdvance(task)}
                  selectMode={selectMode}
                  selected={selectedTaskIds.has(task.id)}
                  onToggleSelect={() => toggleSelectTask(task.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Fix 2: date groups with tasks + events */}
        {sortedDates.map((dateStr) => {
          const { tasks: dayTasks, events: dayEvents } = dateGroups[dateStr];
          return (
            <section key={dateStr}>
              <div className="flex items-center justify-between mb-2">
                <span
                  className={cn(
                    "text-xs font-bold uppercase tracking-wide capitalize",
                    dateStr === todayStr ? "text-indigo-600" : "text-slate-500"
                  )}
                >
                  {dayLabel(dateStr)}
                </span>
                <button
                  onClick={() => openCreate(dateStr)}
                  className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                >
                  <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              <div className="space-y-2">
                {dayEvents.map((ev) => (
                  <EventRow
                    key={ev.id}
                    event={ev}
                    onEdit={() => openEditEvent(ev)}
                    onDelete={() => handleDeleteEvent(ev)}
                    selectMode={selectMode}
                    selected={selectedEventIds.has(ev.id)}
                    onToggleSelect={() => toggleSelectEvent(ev.id)}
                  />
                ))}
                {dayTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onEdit={() => openEdit(task)}
                    onAdvance={() => tryAdvance(task)}
                    selectMode={selectMode}
                    selected={selectedTaskIds.has(task.id)}
                    onToggleSelect={() => toggleSelectTask(task.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {/* Undated active tasks */}
        {undated.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                Em andamento · Sem data
              </span>
            </div>
            <div className="space-y-2">
              {undated.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onEdit={() => openEdit(task)}
                  onAdvance={() => tryAdvance(task)}
                  selectMode={selectMode}
                  selected={selectedTaskIds.has(task.id)}
                  onToggleSelect={() => toggleSelectTask(task.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Fix 3: day panel */}
      {selectedDay && (
        <DayPanel
          dateStr={selectedDay}
          tasks={todoTasks.filter((t) => t.due_date?.slice(0, 10) === selectedDay)}
          events={expandedEvents.filter((e) => e.date.slice(0, 10) === selectedDay)}
          onAdd={() => {
            setSelectedDay(null);
            openCreate(selectedDay);
          }}
          onEditTask={(task) => {
            setSelectedDay(null);
            openEdit(task);
          }}
          onAdvanceTask={(task) => tryAdvance(task)}
          onEditEvent={(ev) => { setSelectedDay(null); openEditEvent(ev); }}
          onDeleteEvent={(ev) => { setSelectedDay(null); handleDeleteEvent(ev); }}
          onClose={() => setSelectedDay(null)}
        />
      )}

      {/* ── Barra de ações em massa ─────────────────────── */}
      {selectMode && (
        <div className="fixed bottom-16 left-0 right-0 max-w-2xl mx-auto z-40 px-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            {bulkPanel === "confirmDelete" && (
              <div className="p-4 space-y-3 border-b border-slate-100">
                <p className="text-sm font-medium text-red-700 text-center">
                  Excluir {selectedCount} item{selectedCount > 1 ? "s" : ""}? Esta ação não pode ser desfeita.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setBulkPanel(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700">Cancelar</button>
                  <button onClick={handleBulkDelete} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white">Excluir</button>
                </div>
              </div>
            )}
            {bulkPanel === "date" && (
              <div className="p-4 space-y-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nova data para {selectedCount} item{selectedCount > 1 ? "s" : ""}</p>
                <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <div className="flex gap-2">
                  <button onClick={() => setBulkPanel(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700">Cancelar</button>
                  <button onClick={handleBulkDate} disabled={!bulkDate} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white disabled:opacity-50">Aplicar</button>
                </div>
              </div>
            )}
            {bulkPanel === "assignee" && (
              <div className="p-4 space-y-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Responsável para {selectedCount} item{selectedCount > 1 ? "s" : ""}</p>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => {
                    const active = bulkAssigneeIds.includes(m.id);
                    return (
                      <button key={m.id} type="button"
                        onClick={() => setBulkAssigneeIds((prev) => prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id])}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors ${active ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200"}`}
                        style={active ? { backgroundColor: m.color ?? "#6366f1" } : {}}
                      >
                        <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: m.color ?? "#6366f1" }}>
                          <MemberAvatar name={m.name} avatarUrl={m.avatar_url} />
                        </div>
                        {m.name.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setBulkPanel(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700">Cancelar</button>
                  <button onClick={handleBulkAssignee} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white">Aplicar</button>
                </div>
              </div>
            )}
            <div className="flex items-center divide-x divide-slate-100">
              <button disabled={selectedTaskIds.size === 0} onClick={() => { setBulkPanel(null); startTransition(() => { void handleBulkAdvance(); }); }} className="flex-1 flex flex-col items-center gap-0.5 py-3 text-slate-600 disabled:opacity-40 active:bg-slate-50">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                <span className="text-[10px] font-medium">Avançar</span>
              </button>
              <button disabled={selectedCount === 0} onClick={() => setBulkPanel(bulkPanel === "date" ? null : "date")} className={`flex-1 flex flex-col items-center gap-0.5 py-3 disabled:opacity-40 active:bg-slate-50 ${bulkPanel === "date" ? "text-indigo-600" : "text-slate-600"}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-[10px] font-medium">Data</span>
              </button>
              <button disabled={selectedCount === 0} onClick={() => setBulkPanel(bulkPanel === "assignee" ? null : "assignee")} className={`flex-1 flex flex-col items-center gap-0.5 py-3 disabled:opacity-40 active:bg-slate-50 ${bulkPanel === "assignee" ? "text-indigo-600" : "text-slate-600"}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <span className="text-[10px] font-medium">Responsável</span>
              </button>
              <button disabled={selectedCount === 0} onClick={() => setBulkPanel(bulkPanel === "confirmDelete" ? null : "confirmDelete")} className={`flex-1 flex flex-col items-center gap-0.5 py-3 disabled:opacity-40 active:bg-red-50 ${bulkPanel === "confirmDelete" ? "text-red-600" : "text-slate-600"}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
          onPickTask={() => {
            setShowPicker(false);
            setShowTaskForm(true);
          }}
          onPickEvent={() => {
            setShowPicker(false);
            setShowEventForm(true);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showTaskForm && (
        <TaskFormModal
          task={editingTask}
          categories={categories}
          members={members}
          currentProfile={currentProfile}
          defaultDate={defaultDate}
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
          event={editingEvent}
          events={events.filter((e) => !deletedEventIds.has(e.id))}
          members={members}
          currentProfile={currentProfile}
          defaultDate={defaultDate}
          onClose={() => { setShowEventForm(false); setEditingEvent(null); }}
          onDelete={editingEvent ? () => handleDeleteEvent(editingEvent) : undefined}
        />
      )}

      {confirmDeleteEvent && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-3">
            <p className="text-sm font-semibold text-slate-800 text-center">
              Excluir &ldquo;{confirmDeleteEvent.title}&rdquo;?
            </p>
            <p className="text-xs text-slate-500 text-center">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmDeleteEvent(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeDeleteEvent(confirmDeleteEvent)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TaskRow ─────────────────────────────────────────────────────────────────

type TaskRowProps = {
  task: Task;
  overdue?: boolean;
  onEdit: () => void;
  onAdvance: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
};

function TaskRow({ task, overdue = false, onEdit, onAdvance, selectMode = false, selected = false, onToggleSelect }: TaskRowProps) {
  const style = cardStyle(task.assignees, overdue, task.status);
  const assignees = task.assignees ?? [];

  const cardStyle2 = selected
    ? { backgroundColor: "#eef2ff", borderColor: "#6366f1" }
    : style;

  return (
    <div
      onClick={selectMode ? onToggleSelect : onEdit}
      style={cardStyle2}
      className={cn(
        "w-full text-left bg-white rounded-xl border shadow-sm px-3 py-2.5 min-h-[72px] flex items-start gap-2 active:scale-[0.99] transition-transform cursor-pointer",
        selected ? "border-indigo-400" : "border-slate-100"
      )}
    >
      {/* Task icon / checkbox */}
      <div className={cn(
        "w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5",
        selectMode
          ? selected ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-300"
          : "bg-white/70 border-slate-200"
      )}>
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

      {/* Title + meta */}
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
              overdue ? "text-rose-500" : "text-slate-500"
            )}>
              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {format(parseISO(task.due_date), "d MMM", { locale: ptBR })}
            </span>
          </div>
        )}
      </div>

      {/* Coluna direita: avatar(s) + status + seta */}
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
          <span className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap",
            TASK_STATUS_COLORS[task.status]
          )}>
            {TASK_STATUS_LABELS[task.status]}
          </span>
          {!selectMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onAdvance(); }}
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

// ─── EventRow ────────────────────────────────────────────────────────────────

type EventRowProps = {
  event: CalendarEvent;
  onEdit: () => void;
  onDelete: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
};

function EventRow({ event, onEdit, onDelete, selectMode = false, selected = false, onToggleSelect }: EventRowProps) {
  return (
    <div
      onClick={selectMode ? onToggleSelect : onEdit}
      className={cn(
        "w-full text-left rounded-xl border shadow-sm px-3 py-2.5 min-h-[72px] flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform",
        selected ? "bg-indigo-50 border-indigo-400" : "bg-violet-50 border-violet-100"
      )}
    >
      {/* Icon / checkbox */}
      <div className={cn(
        "w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0",
        selectMode
          ? selected ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-300"
          : "bg-violet-200 border-violet-200"
      )}>
        {selectMode ? (
          selected && (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )
        ) : (
          <svg className="w-3.5 h-3.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      {/* Title + período */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 leading-tight">{event.title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="flex items-center gap-1 text-xs font-semibold text-violet-500">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {periodLabel(event.start_time)}
          </span>
        </div>
      </div>

      {/* Participantes */}
      {(event.participants?.length ?? 0) > 0 && (
        <div className="flex -space-x-1 flex-shrink-0">
          {event.participants!.slice(0, 3).map((p) => (
            <div
              key={p.id}
              className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
              style={{ backgroundColor: p.color ?? "#7c3aed" }}
              title={p.name}
            >
              <MemberAvatar name={p.name} avatarUrl={p.avatar_url} />
            </div>
          ))}
        </div>
      )}

      {/* Lixeira (oculta no modo seleção) */}
      {!selectMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="w-6 h-6 rounded-full bg-white/80 border border-violet-200 flex items-center justify-center active:scale-95 transition-all hover:bg-red-50 hover:border-red-200 group flex-shrink-0"
          title="Excluir evento"
        >
          <svg className="w-3 h-3 text-violet-400 group-hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── DayPanel ─────────────────────────────────────────────────────────────────

type DayPanelProps = {
  dateStr: string;
  tasks: Task[];
  events: CalendarEvent[];
  onAdd: () => void;
  onEditTask: (task: Task) => void;
  onAdvanceTask: (task: Task) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (event: CalendarEvent) => void;
  onClose: () => void;
};

function DayPanel({ dateStr, tasks, events, onAdd, onEditTask, onAdvanceTask, onEditEvent, onDeleteEvent, onClose }: DayPanelProps) {
  const date = parseISO(dateStr);
  const isEmpty = tasks.length === 0 && events.length === 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-xl max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-1" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div>
            <p className="text-base font-bold text-slate-900 capitalize">
              {format(date, "EEEE", { locale: ptBR })}
            </p>
            <p className="text-xs text-slate-400 capitalize">
              {format(date, "d 'de' MMMM yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-full text-xs font-semibold active:scale-95 transition-transform"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Adicionar
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
              <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium">Nenhuma atividade</p>
              <p className="text-xs mt-1">Toque em Adicionar para criar</p>
            </div>
          ) : (
            <>
              {events.map((ev) => (
                <EventRow key={ev.id} event={ev} onEdit={() => onEditEvent(ev)} onDelete={() => onDeleteEvent(ev)} />
              ))}
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onEdit={() => onEditTask(task)}
                  onAdvance={() => onAdvanceTask(task)}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
