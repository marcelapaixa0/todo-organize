import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CalendarioClient from "./calendario-client";

export default async function CalendarioPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile?.family_group_id) redirect("/perfil");

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = `${year}-${String(month).padStart(2, "0")}-31`;

  const [eventsRes, tasksRes, membersRes] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("*, participants:event_participants(profile:profiles(*))")
      .eq("family_group_id", profile.family_group_id)
      .gte("date", firstDay)
      .lte("date", lastDay)
      .order("date")
      .order("start_time"),

    supabase
      .from("tasks")
      .select("*, category:categories(*), assignees:task_assignees(profile:profiles(*))")
      .eq("family_group_id", profile.family_group_id)
      .not("due_date", "is", null)
      .gte("due_date", firstDay)
      .lte("due_date", lastDay)
      .neq("status", "done"),

    supabase
      .from("profiles")
      .select("*")
      .eq("family_group_id", profile.family_group_id),
  ]);

  const events = (eventsRes.data ?? []).map((e: any) => ({
    ...e,
    participants: (e.participants ?? [])
      .map((p: any) => (Array.isArray(p.profile) ? p.profile[0] : p.profile))
      .filter(Boolean),
  }));

  const tasks = (tasksRes.data ?? []).map((t: any) => ({
    ...t,
    category: Array.isArray(t.category) ? t.category[0] ?? null : t.category,
    assignees: (t.assignees ?? [])
      .map((a: any) => (Array.isArray(a.profile) ? a.profile[0] : a.profile))
      .filter(Boolean),
  }));

  return (
    <CalendarioClient
      events={events}
      tasks={tasks}
      members={membersRes.data ?? []}
      currentProfile={profile}
    />
  );
}
