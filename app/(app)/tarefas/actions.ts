"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { TaskStatus, TaskPriority } from "@/lib/types";

type TaskPayload = {
  title: string;
  description: string | null;
  visibility: "public" | "private";
  category_id: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  assignee_ids: string[];
};

export async function createTask(payload: TaskPayload) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, family_group_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.family_group_id) return { error: "Sem grupo familiar." };

  const { assignee_ids, ...taskData } = payload;

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({ ...taskData, family_group_id: profile.family_group_id, creator_id: profile.id })
    .select()
    .single();

  if (error || !task) return { error: error?.message ?? "Erro ao criar tarefa." };

  if (assignee_ids.length > 0) {
    await supabase.from("task_assignees").insert(
      assignee_ids.map((pid) => ({ task_id: task.id, profile_id: pid }))
    );
  }

  revalidatePath("/tarefas");
  revalidatePath("/calendario");
  return { success: true };
}

export async function updateTask(taskId: string, payload: TaskPayload) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { assignee_ids, ...taskData } = payload;

  const { error } = await supabase.from("tasks").update(taskData).eq("id", taskId);
  if (error) return { error: error.message };

  await supabase.from("task_assignees").delete().eq("task_id", taskId);
  if (assignee_ids.length > 0) {
    await supabase.from("task_assignees").insert(
      assignee_ids.map((pid) => ({ task_id: taskId, profile_id: pid }))
    );
  }

  revalidatePath("/tarefas");
  revalidatePath("/calendario");
  return { success: true };
}
