import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CalendarioClient from "./calendario-client";
import type { Task, CalendarEvent } from "@/lib/types";

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

  const [tasksRes, categoriesRes, membersRes, eventsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, category:categories(*), assignees:task_assignees(profile:profiles(*))")
      .eq("family_group_id", profile.family_group_id)
      .is("parent_task_id", null)
      .is("deleted_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
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

    supabase
      .from("calendar_events")
      .select("*, participants:event_participants(profile:profiles(*))")
      .eq("family_group_id", profile.family_group_id)
      .is("deleted_at", null)
      .order("date", { ascending: true }),
  ]);

  type RawRef = { profile: unknown };
  type RawTaskRow = { category: unknown; assignees: RawRef[] | null; [key: string]: unknown };
  type RawEventRow = { participants: RawRef[] | null; [key: string]: unknown };

  const tasks = ((tasksRes.data ?? []) as RawTaskRow[]).map((t) => ({
    ...t,
    category: Array.isArray(t.category) ? t.category[0] ?? null : t.category,
    assignees: (t.assignees ?? [])
      .map((a) => (Array.isArray(a.profile) ? (a.profile as unknown[])[0] : a.profile))
      .filter(Boolean),
  })) as Task[];

  const events = ((eventsRes.data ?? []) as RawEventRow[]).map((e) => ({
    ...e,
    participants: (e.participants ?? [])
      .map((p) => (Array.isArray(p.profile) ? (p.profile as unknown[])[0] : p.profile))
      .filter(Boolean),
  })) as CalendarEvent[];

  return (
    <CalendarioClient
      tasks={tasks}
      events={events}
      categories={categoriesRes.data ?? []}
      members={membersRes.data ?? []}
      currentProfile={profile}
    />
  );
}
