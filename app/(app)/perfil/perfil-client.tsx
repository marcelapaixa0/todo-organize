"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createFamilyGroup, joinFamilyGroup } from "./actions";
import type { Profile, Category, FamilyGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  profile: Profile | null;
  familyGroup: FamilyGroup | null;
  members: Profile[];
  categories: Category[];
};

const CATEGORY_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#ef4444", "#3b82f6", "#f97316", "#14b8a6",
  "#8b5cf6", "#64748b",
];

export default function PerfilClient({ profile, familyGroup, members, categories }: Props) {
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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/entrar");
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
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
            : profile?.name.charAt(0).toUpperCase()
          }
        </div>
        <div>
          <p className="font-semibold text-slate-900">{profile?.name}</p>
        </div>
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
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt={m.name} className="w-full h-full object-cover" />
                      : m.name.charAt(0).toUpperCase()
                    }
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

      {/* Sign out */}
      <button onClick={handleSignOut}
        className="w-full py-3 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors">
        Sair da conta
      </button>
    </div>
  );
}
