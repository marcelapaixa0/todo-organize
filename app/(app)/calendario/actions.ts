"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { RecurrenceType, RecurrenceConfig } from "@/lib/types";

type EventPayload = {
  title: string;
  description: string | null;
  visibility: "public" | "private";
  date: string;
  start_time: string;
  end_time: string;
  recurrence: RecurrenceType;
  recurrence_config: RecurrenceConfig | null;
  reminder_minutes: number | null;
  participant_ids: string[];
};

export async function createEvent(payload: EventPayload) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, family_group_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.family_group_id) return { error: "Sem grupo familiar." };

  const { participant_ids, ...eventData } = payload;

  const { data: event, error } = await supabase
    .from("calendar_events")
    .insert({ ...eventData, family_group_id: profile.family_group_id, creator_id: profile.id })
    .select()
    .single();

  if (error || !event) return { error: error?.message ?? "Erro ao criar evento." };

  if (participant_ids.length > 0) {
    await supabase.from("event_participants").insert(
      participant_ids.map((pid) => ({ event_id: event.id, profile_id: pid }))
    );
  }

  revalidatePath("/calendario");
  return { success: true };
}

export async function updateEvent(eventId: string, payload: EventPayload) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { participant_ids, ...eventData } = payload;

  const { error } = await supabase.from("calendar_events").update(eventData).eq("id", eventId);
  if (error) return { error: error.message };

  await supabase.from("event_participants").delete().eq("event_id", eventId);
  if (participant_ids.length > 0) {
    await supabase.from("event_participants").insert(
      participant_ids.map((pid) => ({ event_id: eventId, profile_id: pid }))
    );
  }

  revalidatePath("/calendario");
  return { success: true };
}

export async function deleteEvent(eventId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("calendar_events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", eventId);

  if (error) return { error: error.message };
  revalidatePath("/calendario");
  revalidatePath("/perfil");
  return { success: true };
}

export async function restoreEvent(eventId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("calendar_events")
    .update({ deleted_at: null })
    .eq("id", eventId);

  if (error) return { error: error.message };
  revalidatePath("/calendario");
  revalidatePath("/perfil");
  return { success: true };
}
