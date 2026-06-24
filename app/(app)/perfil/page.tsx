import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PerfilClient from "./perfil-client";

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
  let members: any[] = [];
  let categories: any[] = [];
  let deletedTasks: any[] = [];
  let deletedEvents: any[] = [];

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
    deletedTasks = (deletedTasksRes.data ?? []).map((t: any) => ({
      ...t,
      category: Array.isArray(t.category) ? t.category[0] ?? null : t.category,
    }));
    deletedEvents = deletedEventsRes.data ?? [];
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
