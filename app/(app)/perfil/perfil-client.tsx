"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createFamilyGroup, joinFamilyGroup, updateProfileColor } from "./actions";
import { restoreTask } from "../tarefas/actions";
import { restoreEvent } from "../calendario/actions";
import type { Profile, Category, FamilyGroup } from "@/lib/types";
import { cn } from "@/lib/utils";
import MemberAvatar from "@/components/member-avatar";

type DeletedTask = { id: string; title: string; deleted_at: string; category?: { name: string; color: string } | null };
type DeletedEvent = { id: string; title: string; deleted_at: string; date: string };

type Props = {
  profile: Profile | null;
  familyGroup: FamilyGroup | null;
  members: Profile[];
  categories: Category[];
  deletedTasks: DeletedTask[];
  deletedEvents: DeletedEvent[];
};

const CATEGORY_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#ef4444", "#3b82f6", "#f97316", "#14b8a6",
  "#8b5cf6", "#64748b",
];

const PROFILE_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#3b82f6",
  "#f97316", "#14b8a6", "#8b5cf6", "#84cc16",
  "#06b6d4", "#64748b",
];

export default function PerfilClient({ profile, familyGroup, members, categories, deletedTasks, deletedEvents }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createError, setCreateError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileColor, setProfileColor] = useState(profile?.color ?? PROFILE_COLORS[0]);
  const [colorSaved, setColorSaved] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!groupName.trim()) return;
    setCreateError("");
    setLoading(true);
    const result = await createFamilyGroup(groupName);
    if (result.error) {
      setCreateError(result.error);
      setLoading(false);
    }
    // revalidatePath no server action atualiza a página automaticamente
  }

  async function handleJoinGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoinError("");
    setLoading(true);
    const result = await joinFamilyGroup(inviteCode);
    if (result.error) {
      setJoinError(result.error);
      setLoading(false);
    }
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim() || !familyGroup) return;
    await supabase.from("categories").insert({
      family_group_id: familyGroup.id,
      name: newCatName.trim(),
      color: newCatColor,
    });
    setNewCatName("");
    router.refresh();
  }

  async function handleDeleteCategory(cat: Category) {
    const { error } = await supabase.from("categories").delete().eq("id", cat.id);
    if (error) alert("Não é possível excluir: categoria em uso por tarefas.");
    else router.refresh();
  }

  async function handleColorChange(color: string) {
    setProfileColor(color);
    await updateProfileColor(color);
    setColorSaved(true);
    setTimeout(() => setColorSaved(false), 2000);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/entrar");
  }

  async function handleRestoreTask(id: string) {
    await restoreTask(id);
    router.refresh();
  }

  async function handleRestoreEvent(id: string) {
    await restoreEvent(id);
    router.refresh();
  }

  function copyInviteCode() {
    if (!familyGroup) return;
    navigator.clipboard.writeText(familyGroup.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="px-4 py-5 space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Perfil</h1>

      {/* User info */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-indigo-100 overflow-hidden flex items-center justify-center text-xl font-bold text-indigo-700">
          {profile && <MemberAvatar name={profile.name} avatarUrl={profile.avatar_url} />}
        </div>
        <div>
          <p className="font-semibold text-slate-900">{profile?.name}</p>
        </div>
      </div>

      {/* Profile color */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">Minha cor</p>
          <p className="text-xs text-slate-400 mt-0.5">Aparece nos cards de tarefas atribuídas a você</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {PROFILE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleColorChange(c)}
              className={cn(
                "w-8 h-8 rounded-full transition-transform active:scale-95",
                profileColor === c && "ring-2 ring-offset-2 ring-slate-400 scale-110"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        {colorSaved && <p className="text-xs text-emerald-600 font-medium">Cor salva!</p>}
      </div>

      {/* No group yet */}
      {!familyGroup ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Criar novo grupo familiar</p>
            {createError && <p className="text-xs text-red-600">{createError}</p>}
            <form onSubmit={handleCreateGroup} className="flex gap-2">
              <input
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Nome do grupo"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <button type="submit" disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-60">
                {loading ? "..." : "Criar"}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Entrar em um grupo</p>
            {joinError && <p className="text-xs text-red-600">{joinError}</p>}
            <form onSubmit={handleJoinGroup} className="flex gap-2">
              <input
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase tracking-widest"
                placeholder="Código do grupo"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
              <button type="submit" disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-60">
                {loading ? "..." : "Entrar"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <>
          {/* Family group */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Grupo familiar</p>
            <p className="font-bold text-slate-900">{familyGroup.name}</p>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                <p className="text-xs text-slate-400 mb-0.5">Código de convite</p>
                <p className="font-mono font-bold text-slate-800 tracking-widest">{familyGroup.invite_code}</p>
              </div>
              <button onClick={copyInviteCode}
                className={cn("px-3 py-2 rounded-xl text-sm font-medium border transition-colors",
                  copied ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-600 border-slate-200"
                )}>
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>

            {/* Members */}
            <div className="space-y-2">
              <p className="text-xs text-slate-400 font-medium">Membros ({members.length})</p>
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 overflow-hidden flex items-center justify-center text-xs font-bold text-indigo-700">
                    <MemberAvatar name={m.name} avatarUrl={m.avatar_url} />
                  </div>
                  <p className="text-sm text-slate-700">{m.name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Categorias</p>

            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: cat.color }}>
                  {cat.name}
                  <button onClick={() => handleDeleteCategory(cat)}
                    className="ml-0.5 opacity-70 hover:opacity-100 transition-opacity">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Add category */}
            <form onSubmit={handleAddCategory} className="space-y-2">
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Nova categoria"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
              <div className="flex gap-2 items-center flex-wrap">
                {CATEGORY_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setNewCatColor(c)}
                    className={cn("w-6 h-6 rounded-full transition-transform", newCatColor === c && "ring-2 ring-offset-1 ring-slate-400 scale-110")}
                    style={{ backgroundColor: c }} />
                ))}
                <button type="submit" disabled={!newCatName.trim()}
                  className="ml-auto px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-medium disabled:opacity-60">
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Itens excluídos */}
      {(deletedTasks.length > 0 || deletedEvents.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowDeleted((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <p className="text-sm font-semibold text-slate-700">Itens excluídos</p>
              <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {deletedTasks.length + deletedEvents.length}
              </span>
            </div>
            <svg
              className={cn("w-4 h-4 text-slate-400 transition-transform", showDeleted && "rotate-180")}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDeleted && (
            <div className="border-t border-slate-100 divide-y divide-slate-50">
              {deletedTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 line-through truncate">{task.title}</p>
                    {task.category && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: task.category.color }}>
                        {task.category.name}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRestoreTask(task.id)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors flex-shrink-0"
                  >
                    Restaurar
                  </button>
                </div>
              ))}

              {deletedEvents.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 line-through truncate">{ev.title}</p>
                    <p className="text-[10px] text-slate-400">{ev.date}</p>
                  </div>
                  <button
                    onClick={() => handleRestoreEvent(ev.id)}
                    className="text-xs font-medium text-violet-600 hover:text-violet-800 px-2 py-1 rounded-lg hover:bg-violet-50 transition-colors flex-shrink-0"
                  >
                    Restaurar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sign out */}
      <button onClick={handleSignOut}
        className="w-full py-3 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors">
        Sair da conta
      </button>
    </div>
  );
}
