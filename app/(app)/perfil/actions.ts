"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfileColor(color: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("profiles")
    .update({ color })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/perfil");
  revalidatePath("/calendario");
  revalidatePath("/tarefas");
  return { success: true };
}

export async function createFamilyGroup(name: string) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return { error: "Perfil não encontrado." };

  const { data: group, error: groupError } = await supabase
    .from("family_groups")
    .insert({ name: name.trim(), created_by: user.id })
    .select()
    .single();

  if (groupError || !group) return { error: groupError?.message ?? "Erro ao criar grupo." };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ family_group_id: group.id })
    .eq("id", profile.id);

  if (profileError) return { error: profileError.message };

  revalidatePath("/perfil");
  return { success: true };
}

export async function joinFamilyGroup(inviteCode: string) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return { error: "Perfil não encontrado." };

  const { data: group } = await supabase
    .from("family_groups")
    .select("id")
    .eq("invite_code", inviteCode.trim().toUpperCase())
    .single();

  if (!group) return { error: "Código inválido ou não encontrado." };

  const { error } = await supabase
    .from("profiles")
    .update({ family_group_id: group.id })
    .eq("id", profile.id);

  if (error) return { error: error.message };

  revalidatePath("/perfil");
  return { success: true };
}
