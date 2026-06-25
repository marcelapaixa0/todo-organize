import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PerfilClient from "./perfil-client";
import type { Profile, Category } from "@/lib/types";

type DeletedTask = { id: string; title: string; deleted_at: string; category?: { name: string; color: string } | null };
type DeletedEvent = { id: string; title: string; deleted_at: string; date: string };

export default async function PerfilPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  let familyGroup = null;
  let members: Profile[] = [];
  let categories: Category[] = [];
  let deletedTasks: DeletedTask[] = [];
  let deletedEvents: DeletedEvent[] = [];

  if (profile?.family_group_id) {
    const [groupRes, membersRes, categoriesRes, deletedTasksRes, deletedEventsRes] = await Promise.all([
      supabase.from("family_groups").select("*").eq("id", profile.family_group_id).single(),
      supabase.from("profiles").select("*").eq("family_group_id", profile.family_group_id),
      supabase.from("categories").select("*").eq("family_group_id", profile.family_group_id).order("name"),
      supabase.from("tasks").select("*, category:categories(name,color)").eq("family_group_id", profile.family_group_id).not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
      supabase.from("calendar_events").select("*").eq("family_group_id", profile.family_group_id).not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    ]);
    familyGroup = groupRes.data;
    members = membersRes.data ?? [];
    categories = categoriesRes.data ?? [];
    deletedTasks = ((deletedTasksRes.data ?? []) as Array<DeletedTask & { category: unknown }>).map((t) => ({
      ...t,
      category: Array.isArray(t.category) ? (t.category as Array<{ name: string; color: string }>)[0] ?? null : t.category as { name: string; color: string } | null,
    }));
    deletedEvents = (deletedEventsRes.data ?? []) as DeletedEvent[];
  }

  return (
    <PerfilClient
      profile={profile}
      familyGroup={familyGroup}
      members={members}
      categories={categories}
      deletedTasks={deletedTasks}
      deletedEvents={deletedEvents}
    />
  );
}
