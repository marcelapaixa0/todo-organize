"use client";

import { cn } from "@/lib/utils";

type Props = {
  onPickTask: () => void;
  onPickEvent: () => void;
  onClose: () => void;
};

export default function CreatePickerModal({ onPickTask, onPickEvent, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-base font-semibold text-slate-800 mb-6">
          Deseja criar uma tarefa ou um evento?
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onPickTask}
            className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-slate-100 bg-slate-50 active:scale-[0.97] transition-transform hover:border-indigo-200 hover:bg-indigo-50"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Tarefa</span>
          </button>

          <button
            onClick={onPickEvent}
            className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-slate-100 bg-slate-50 active:scale-[0.97] transition-transform hover:border-violet-200 hover:bg-violet-50"
          >
            <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Evento</span>
          </button>
        </div>
      </div>
    </div>
  );
}
