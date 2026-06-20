"use client";

import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CalendarEvent, Task, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import EventFormModal from "@/components/calendario/event-form-modal";

type Props = {
  events: CalendarEvent[];
  tasks: Task[];
  members: Profile[];
  currentProfile: Profile;
};

type CalView = "month" | "agenda";

export default function CalendarioClient({ events, tasks, members, currentProfile }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [view, setView] = useState<CalView>("month");
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showForm, setShowForm] = useState(false);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startWeekday = getDay(monthStart);

  function getItemsForDay(date: Date) {
    const dateStr = format(date, "yyyy-MM-dd");
    return {
      dayEvents: events.filter((e) => e.date === dateStr),
      dayTasks: tasks.filter((t) => t.due_date === dateStr),
    };
  }

  const selectedItems = getItemsForDay(selectedDay);

  function openCreate() {
    setEditingEvent(null);
    setShowForm(true);
  }

  function openEdit(event: CalendarEvent) {
    setEditingEvent(event);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingEvent(null);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-base font-bold text-slate-900 capitalize">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {(["month", "agenda"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={cn("px-3 py-1.5 text-xs font-medium transition-colors",
                    view === v ? "bg-indigo-600 text-white" : "text-slate-600"
                  )}>
                  {v === "month" ? "Mês" : "Agenda"}
                </button>
              ))}
            </div>
            <button onClick={openCreate}
              className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center active:scale-95 transition-transform">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {view === "month" && (
          <>
            <div className="grid grid-cols-7 text-center mb-1">
              {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                <span key={i} className="text-[11px] font-medium text-slate-400">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {Array.from({ length: startWeekday }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {days.map((day) => {
                const { dayEvents, dayTasks } = getItemsForDay(day);
                const hasItems = dayEvents.length + dayTasks.length > 0;
                const isSelected = isSameDay(day, selectedDay);
                const isToday = isSameDay(day, new Date());

                return (
                  <button key={day.toISOString()} onClick={() => setSelectedDay(day)}
                    className={cn("flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors",
                      isSelected ? "bg-indigo-600" : isToday ? "bg-indigo-50" : "hover:bg-slate-50"
                    )}>
                    <span className={cn("text-sm font-medium",
                      isSelected ? "text-white" : isToday ? "text-indigo-600" : "text-slate-700"
                    )}>
                      {format(day, "d")}
                    </span>
                    {hasItems && (
                      <div className={cn("w-1 h-1 rounded-full", isSelected ? "bg-white/70" : "bg-indigo-400")} />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Day detail / Agenda */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {view === "month" && (
          <>
            <p className="text-sm font-semibold text-slate-600 mb-3 capitalize">
              {format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
            {selectedItems.dayEvents.length === 0 && selectedItems.dayTasks.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Nenhum item neste dia</p>
            ) : (
              <div className="space-y-2">
                {selectedItems.dayEvents.map((e) => (
                  <EventItem key={e.id} event={e} onEdit={() => openEdit(e)} />
                ))}
                {selectedItems.dayTasks.map((t) => (
                  <TaskItem key={t.id} task={t} />
                ))}
              </div>
            )}
          </>
        )}

        {view === "agenda" && (
          <div className="space-y-4">
            {days.map((day) => {
              const { dayEvents, dayTasks } = getItemsForDay(day);
              if (dayEvents.length + dayTasks.length === 0) return null;
              return (
                <div key={day.toISOString()}>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-2 capitalize">
                    {format(day, "EEE, d MMM", { locale: ptBR })}
                  </p>
                  <div className="space-y-2">
                    {dayEvents.map((e) => <EventItem key={e.id} event={e} onEdit={() => openEdit(e)} />)}
                    {dayTasks.map((t) => <TaskItem key={t.id} task={t} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <EventFormModal
          event={editingEvent}
          members={members}
          currentProfile={currentProfile}
          defaultDate={format(selectedDay, "yyyy-MM-dd")}
          onClose={closeForm}
        />
      )}
    </div>
  );
}

function EventItem({ event, onEdit }: { event: CalendarEvent; onEdit: () => void }) {
  return (
    <button onClick={onEdit}
      className="w-full text-left bg-white rounded-xl border border-slate-100 shadow-sm px-3 py-2.5 flex items-start gap-3 active:scale-[0.99] transition-transform">
      <div className="w-1 self-stretch rounded-full bg-indigo-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{event.title}</p>
        <p className="text-xs text-slate-500">{event.start_time.slice(0, 5)} – {event.end_time.slice(0, 5)}</p>
      </div>
      <svg className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function TaskItem({ task }: { task: Task }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-3 py-2.5 flex items-start gap-3">
      <div className="w-1 self-stretch rounded-full bg-amber-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{task.title}</p>
        <p className="text-xs text-slate-500">Tarefa</p>
      </div>
    </div>
  );
}
