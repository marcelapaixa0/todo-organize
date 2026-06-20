import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TarefasClient from "./tarefas-client";
import type { Task, Profile, Category } from "@/lib/types";

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
      .neq("status", "done")
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

  const tasks = (tasksRes.data ?? []).map((t: any) => ({
    ...t,
    assignees: (t.assignees ?? []).map((a: any) => (Array.isArray(a.profile) ? a.profile[0] : a.profile)).filter(Boolean),
    checklist_items: (t.checklist_items ?? []).map((ci: any) => ({
      ...ci,
      assignee: Array.isArray(ci.assignee) ? ci.assignee[0] ?? null : ci.assignee,
    })),
    category: Array.isArray(t.category) ? t.category[0] ?? null : t.category,
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
