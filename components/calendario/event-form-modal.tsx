"use client";

import { useEffect, useState } from "react";
import { createEvent, updateEvent } from "@/app/(app)/calendario/actions";
import type { CalendarEvent, Profile, RecurrenceType } from "@/lib/types";
import { cn } from "@/lib/utils";
import MemberAvatar from "@/components/member-avatar";

// ─── Period ───────────────────────────────────────────────────
type Period = "manha" | "tarde" | "noite";

const PERIOD_LABELS: Record<Period, string> = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };
const PERIOD_TIMES: Record<Period, { start: string; end: string }> = {
  manha: { start: "06:00", end: "12:00" },
  tarde: { start: "12:00", end: "18:00" },
  noite: { start: "18:00", end: "23:00" },
};
const PERIOD_ICONS: Record<Period, string> = { manha: "🌅", tarde: "☀️", noite: "🌙" };

function timeToPeriod(startTime?: string | null): Period {
  if (!startTime) return "manha";
  const h = parseInt(startTime.slice(0, 2), 10);
  if (h >= 18) return "noite";
  if (h >= 12) return "tarde";
  return "manha";
}

// ─── Recorrência ──────────────────────────────────────────────
type RecurrenceFreq = "weekly" | "biweekly" | "monthly" | "custom";

// D S T Q Q S S  (índice 0–6, Domingo → Sábado)
const DAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];
const DAY_NAMES   = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

const FREQ_OPTIONS: { freq: RecurrenceFreq; label: string }[] = [
  { freq: "weekly",   label: "Semanal" },
  { freq: "biweekly", label: "Quinzenal" },
  { freq: "monthly",  label: "Mensal" },
  { freq: "custom",   label: "Personalizado" },
];

function getDayOfWeek(dateStr: string): number {
  if (!dateStr) return 0;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function getDayOfMonth(dateStr: string): number {
  if (!dateStr) return 1;
  return parseInt(dateStr.split("-")[2], 10);
}

function eventRecurrenceToFreq(r: string): RecurrenceFreq | null {
  if (r === "weekly")   return "weekly";
  if (r === "biweekly") return "biweekly";
  if (r === "monthly")  return "monthly";
  if (r === "custom")   return "custom";
  return null;
}

// ─── Props ────────────────────────────────────────────────────
type Props = {
  event?: CalendarEvent | null;
  events?: CalendarEvent[];
  members: Profile[];
  currentProfile: Profile;
  defaultDate?: string;
  onClose: () => void;
  onDelete?: () => void;
};

export default function EventFormModal({ event, events = [], members, defaultDate, onClose, onDelete }: Props) {
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [conflictMessage, setConflictMessage] = useState("");

  // Campos básicos
  const [title, setTitle]   = useState(event?.title ?? "");
  const [date, setDate]     = useState(event?.date ?? defaultDate ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">(event?.visibility ?? "public");
  const [hasTime, setHasTime] = useState(Boolean(event?.start_time && event?.end_time));
  const [period, setPeriod] = useState<Period>(timeToPeriod(event?.start_time));
  const [participantIds, setParticipantIds] = useState<string[]>(
    event?.participants?.map((p) => p.id) ?? []
  );

  // Recorrência
  const [recurrenceFreq, setRecurrenceFreq] = useState<RecurrenceFreq | null>(
    event ? eventRecurrenceToFreq(event.recurrence) : null
  );
  // Estado "Personalizado"
  const [customDays, setCustomDays]         = useState<number[]>(
    event?.recurrence_config?.days ?? []
  );
  const [customInterval, setCustomInterval] = useState<number>(
    event?.recurrence_config?.interval ?? 1
  );
  const [customUnit, setCustomUnit]         = useState<"week" | "month">(
    event?.recurrence_config?.unit ?? "week"
  );

  // Trava o scroll da página por trás enquanto o modal está aberto,
  // evitando que o gesto de rolar dentro do modal "vaze" para o app.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, []);

  // ─── Helpers ───────────────────────────────────────────────
  function toggleParticipant(id: string) {
    setParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleDay(d: number) {
    setCustomDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  }

  function handleFreqChange(freq: RecurrenceFreq) {
    setRecurrenceFreq(freq);
    // Ao entrar em "custom", pré-seleciona o dia derivado da data
    if (freq === "custom" && customDays.length === 0 && date) {
      setCustomDays([getDayOfWeek(date)]);
    }
  }

  // ─── Conflito de horário ─────────────────────────────────────
  function findConflicts(start: string, end: string): CalendarEvent[] {
    return events.filter((e) => {
      if (event && e.id === event.id) return false;
      if (e.date.slice(0, 10) !== date) return false;
      if (!e.start_time || !e.end_time) return false;
      const sharesParticipant = (e.participants ?? []).some((p) => participantIds.includes(p.id));
      if (!sharesParticipant) return false;
      return start < e.end_time && e.start_time < end;
    });
  }

  // ─── Submit ────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent, skipConflictCheck = false) {
    e.preventDefault();
    if (!title.trim())             { setError("O título é obrigatório."); return; }
    if (!date)                     { setError("A data é obrigatória."); return; }
    if (participantIds.length === 0) { setError("Adicione ao menos um participante."); return; }
    if (recurrenceFreq === "custom" && customDays.length === 0) {
      setError("Selecione ao menos um dia da semana para a recorrência personalizada.");
      return;
    }

    const { start, end } = hasTime ? PERIOD_TIMES[period] : { start: null, end: null };

    if (!skipConflictCheck && start && end) {
      const conflicts = findConflicts(start, end);
      if (conflicts.length > 0) {
        setConflictMessage(
          `Conflito de horário com "${conflicts.map((c) => c.title).join(", ")}". Deseja salvar mesmo assim?`
        );
        return;
      }
    }

    setError("");
    setConflictMessage("");
    setLoading(true);

    const recurrenceConfig =
      recurrenceFreq === "custom"
        ? { days: customDays, interval: customInterval, unit: customUnit }
        : null;

    const payload = {
      title: title.trim(),
      description: null,
      visibility,
      date,
      start_time: start,
      end_time: end,
      recurrence: (recurrenceFreq ?? "none") as RecurrenceType,
      recurrence_config: recurrenceConfig,
      reminder_minutes: null,
      participant_ids: participantIds,
    };

    const result = event
      ? await updateEvent(event.id, payload)
      : await createEvent(payload);

    if (result.error) { setError(result.error); setLoading(false); return; }
    onClose();
  }

  // ─── Render ────────────────────────────────────────────────
  const dayOfWeek  = date ? getDayOfWeek(date) : -1;
  const dayOfMonth = date ? getDayOfMonth(date) : 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[90dvh] flex flex-col"
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-2 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-900">
            {event ? "Editar evento" : "Novo evento"}
          </h2>
          <div className="flex items-center gap-2">
            {event && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Excluir evento"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-4 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          {conflictMessage && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 space-y-2">
              <p>{conflictMessage}</p>
              <button
                type="button"
                onClick={(e) => handleSubmit(e as unknown as React.FormEvent, true)}
                className="text-xs font-semibold text-amber-800 underline"
              >
                Salvar mesmo assim
              </button>
            </div>
          )}

          {/* Título */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Atividade *</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Título do evento"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Data */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Data *</label>
            <input
              type="date"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Visibilidade */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Visibilidade</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={cn(
                  "py-2.5 rounded-xl border-2 text-xs font-medium transition-colors",
                  visibility === "public"
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-slate-600 border-slate-200"
                )}
              >
                🌐 Público (grupo familiar)
              </button>
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={cn(
                  "py-2.5 rounded-xl border-2 text-xs font-medium transition-colors",
                  visibility === "private"
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-slate-600 border-slate-200"
                )}
              >
                🔒 Privado (só eu)
              </button>
            </div>
          </div>

          {/* Período */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Horário</label>
              <button
                type="button"
                onClick={() => setHasTime((prev) => !prev)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                  hasTime ? "bg-violet-600" : "bg-slate-200"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    hasTime ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
            {hasTime && (
              <div className="grid grid-cols-3 gap-2">
                {(["manha", "tarde", "noite"] as Period[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-medium transition-colors",
                      period === p
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white text-slate-600 border-slate-200"
                    )}
                  >
                    <span className="text-lg">{PERIOD_ICONS[p]}</span>
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Recorrência ── */}
          <div className="space-y-3">
            {/* Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Recorrência</label>
              <button
                type="button"
                onClick={() =>
                  setRecurrenceFreq((prev) => {
                    if (prev) return null;
                    if (date && customDays.length === 0) setCustomDays([getDayOfWeek(date)]);
                    return "weekly";
                  })
                }
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                  recurrenceFreq ? "bg-violet-600" : "bg-slate-200"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    recurrenceFreq ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            {recurrenceFreq && (
              <div className="space-y-3">

                {/* Grade 2×2 de frequência */}
                <div className="grid grid-cols-2 gap-2">
                  {FREQ_OPTIONS.map(({ freq, label }) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => handleFreqChange(freq)}
                      className={cn(
                        "py-2.5 rounded-xl border-2 text-xs font-medium transition-colors",
                        recurrenceFreq === freq
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white text-slate-600 border-slate-200"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Resumo — Semanal */}
                {recurrenceFreq === "weekly" && dayOfWeek >= 0 && (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
                    Repete toda{" "}
                    <span className="font-medium text-slate-700">{DAY_NAMES[dayOfWeek]}</span>
                  </p>
                )}

                {/* Resumo — Quinzenal */}
                {recurrenceFreq === "biweekly" && dayOfWeek >= 0 && (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
                    Repete toda{" "}
                    <span className="font-medium text-slate-700">{DAY_NAMES[dayOfWeek]}</span>
                    , a cada duas semanas
                  </p>
                )}

                {/* Resumo — Mensal */}
                {recurrenceFreq === "monthly" && date && (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
                    Repete todo{" "}
                    <span className="font-medium text-slate-700">dia {dayOfMonth}</span>{" "}
                    do mês
                  </p>
                )}

                {/* ── Personalizado ── */}
                {recurrenceFreq === "custom" && (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">

                    {/* Dias da semana */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-slate-600">Dias da semana</p>
                      <div className="flex gap-1.5">
                        {DAY_LETTERS.map((letter, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleDay(idx)}
                            className={cn(
                              "flex-1 h-9 rounded-lg text-xs font-bold border-2 transition-colors",
                              customDays.includes(idx)
                                ? "bg-violet-600 text-white border-violet-600"
                                : "bg-white text-slate-500 border-slate-200"
                            )}
                          >
                            {letter}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Intervalo */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-slate-600">Frequência</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 whitespace-nowrap">A cada</span>
                        <input
                          type="number"
                          min={1}
                          max={52}
                          value={customInterval}
                          onChange={(e) =>
                            setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))
                          }
                          className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                        />
                        <select
                          value={customUnit}
                          onChange={(e) => setCustomUnit(e.target.value as "week" | "month")}
                          className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                        >
                          <option value="week">
                            {customInterval === 1 ? "Semana" : "Semanas"}
                          </option>
                          <option value="month">
                            {customInterval === 1 ? "Mês" : "Meses"}
                          </option>
                        </select>
                      </div>
                    </div>

                    {/* Resumo custom */}
                    {customDays.length > 0 && (
                      <p className="text-xs text-slate-500">
                        Repete a cada{" "}
                        <span className="font-medium text-slate-700">
                          {customInterval} {customUnit === "week"
                            ? customInterval === 1 ? "semana" : "semanas"
                            : customInterval === 1 ? "mês" : "meses"}
                        </span>{" "}
                        nas{" "}
                        <span className="font-medium text-slate-700">
                          {customDays.map((d) => DAY_NAMES[d]).join(", ")}
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Participantes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Participantes *</label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleParticipant(m.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors",
                    participantIds.includes(m.id)
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-white text-slate-600 border-slate-200"
                  )}
                >
                  <div className="w-4 h-4 rounded-full bg-violet-100 overflow-hidden flex items-center justify-center text-[8px] font-bold text-violet-700">
                    <MemberAvatar name={m.name} avatarUrl={m.avatar_url} />
                  </div>
                  {m.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submit — fixo fora da área rolável, sempre acessível */}
        <div className="flex-shrink-0 p-5 pt-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-violet-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60 active:scale-[0.98] transition-transform"
          >
            {loading ? "Salvando..." : event ? "Salvar alterações" : "Criar evento"}
          </button>
        </div>
      </form>
    </div>
  );
}
