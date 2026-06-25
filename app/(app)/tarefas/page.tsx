import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TarefasClient from "./tarefas-client";
import type { Task, Profile } from "@/lib/types";

export default async function TarefasPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile?.family_group_id) {
    redirect("/perfil");
  }

  const [tasksRes, categoriesRes, membersRes] = await Promise.all([
    supabase
      .from("tasks")
      .select(`
        *,
        category:categories(*),
        assignees:task_assignees(profile:profiles(*)),
        checklist_items:task_checklist_items(*, assignee:profiles(*))
      `)
      .eq("family_group_id", profile.family_group_id)
      .eq("status", "todo")
      .is("due_date", null)
      .is("parent_task_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),

    supabase
      .from("categories")
      .select("*")
      .eq("family_group_id", profile.family_group_id)
      .order("name"),

    supabase
      .from("profiles")
      .select("*")
      .eq("family_group_id", profile.family_group_id),
  ]);

  type RawRef = { profile: unknown };
  type RawCI = { assignee: unknown; [key: string]: unknown };
  type RawTaskRow = { category: unknown; assignees: RawRef[] | null; checklist_items: RawCI[] | null; [key: string]: unknown };

  const tasks = ((tasksRes.data ?? []) as RawTaskRow[]).map((t) => ({
    ...t,
    assignees: (t.assignees ?? []).map((a) => (Array.isArray(a.profile) ? (a.profile as unknown[])[0] : a.profile)).filter(Boolean),
    checklist_items: (t.checklist_items ?? []).map((ci) => ({
      ...ci,
      assignee: Array.isArray(ci.assignee) ? (ci.assignee as unknown[])[0] ?? null : ci.assignee,
    })),
    category: Array.isArray(t.category) ? (t.category as unknown[])[0] ?? null : t.category,
  })) as Task[];

  return (
    <TarefasClient
      tasks={tasks}
      categories={categoriesRes.data ?? []}
      members={membersRes.data ?? []}
      currentProfile={profile as Profile}
    />
  );
}
