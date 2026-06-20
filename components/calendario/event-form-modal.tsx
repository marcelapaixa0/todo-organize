"use client";

import { useState } from "react";
import { createEvent, updateEvent } from "@/app/(app)/calendario/actions";
import type { CalendarEvent, Profile, RecurrenceType } from "@/lib/types";
import { RECURRENCE_LABELS, REMINDER_OPTIONS, cn } from "@/lib/utils";

type Props = {
  event?: CalendarEvent | null;
  members: Profile[];
  currentProfile: Profile;
  defaultDate?: string;
  onClose: () => void;
};

const RECURRENCES: RecurrenceType[] = ["none", "daily", "weekly", "monthly", "yearly"];

export default function EventFormModal({ event, members, defaultDate, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">(event?.visibility ?? "public");
  const [date, setDate] = useState(event?.date ?? defaultDate ?? "");
  const [startTime, setStartTime] = useState(event?.start_time?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(event?.end_time?.slice(0, 5) ?? "");
  const [recurrence, setRecurrence] = useState<RecurrenceType>(event?.recurrence ?? "none");
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(event?.reminder_minutes ?? null);
  const [participantIds, setParticipantIds] = useState<string[]>(event?.participants?.map((p) => p.id) ?? []);
  const [error, setError] = useState("");

  function toggleParticipant(id: string) {
    setParticipantIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("O título é obrigatório."); return; }
    if (!date) { setError("A data é obrigatória."); return; }
    if (!startTime) { setError("O horário de início é obrigatório."); return; }
    if (!endTime) { setError("O horário de fim é obrigatório."); return; }
    if (endTime <= startTime) { setError("O horário de fim deve ser após o início."); return; }
    setError("");
    setLoading(true);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      visibility,
      date,
      start_time: startTime,
      end_time: endTime,
      recurrence,
      reminder_minutes: reminderMinutes,
      participant_ids: participantIds,
    };

    const result = event
      ? await updateEvent(event.id, payload)
      : await createEvent(payload);

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
              {event ? "Editar evento" : "Novo evento"}
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
              placeholder="Título do evento"
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
            <label className="text-sm font-medium text-slate-700">Data *</label>
            <input type="date"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Início *</label>
              <input type="time"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Fim *</label>
              <input type="time"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Repetição</label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}>
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Lembrete</label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              value={reminderMinutes ?? ""}
              onChange={(e) => setReminderMinutes(e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">Sem lembrete</option>
              {REMINDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Participantes</label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <button key={m.id} type="button" onClick={() => toggleParticipant(m.id)}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors",
                    participantIds.includes(m.id) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
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
            {loading ? "Salvando..." : event ? "Salvar alterações" : "Criar evento"}
          </button>
        </form>
      </div>
    </div>
  );
}
