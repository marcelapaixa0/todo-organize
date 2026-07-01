"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { RecurrenceType, RecurrenceConfig } from "@/lib/types";
import { sendPushToProfile } from "@/lib/push";

type EventPayload = {
  title: string;
  description: string | null;
  visibility: "public" | "private";
  date: string;
  start_time: string | null;
  end_time: string | null;
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
    for (const pid of participant_ids) {
      if (pid !== profile.id) {
        void sendPushToProfile(pid, {
          title: "Novo evento criado",
          body: event.title,
          url: "/calendario",
        });
      }
    }
  }

  revalidatePath("/calendario");
  return { success: true };
}

export async function updateEvent(eventId: string, payload: EventPayload) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const { participant_ids, ...eventData } = payload;

  const { error } = await supabase.from("calendar_events").update(eventData).eq("id", eventId);
  if (error) return { error: error.message };

  await supabase.from("event_participants").delete().eq("event_id", eventId);
  if (participant_ids.length > 0) {
    await supabase.from("event_participants").insert(
      participant_ids.map((pid) => ({ event_id: eventId, profile_id: pid }))
    );
    for (const pid of participant_ids) {
      if (pid !== profile?.id) {
        void sendPushToProfile(pid, {
          title: "Evento atualizado",
          body: eventData.title,
          url: "/calendario",
        });
      }
    }
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

export async function bulkDeleteEvents(eventIds: string[]) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("calendar_events")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", eventIds);

  if (error) return { error: error.message };
  revalidatePath("/calendario");
  revalidatePath("/perfil");
  return { success: true };
}

export async function bulkUpdateEventDate(eventIds: string[], date: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("calendar_events")
    .update({ date })
    .in("id", eventIds);

  if (error) return { error: error.message };
  revalidatePath("/calendario");
  return { success: true };
}

export async function bulkUpdateEventParticipants(eventIds: string[], participantIds: string[]) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  await supabase.from("event_participants").delete().in("event_id", eventIds);

  if (participantIds.length > 0) {
    const rows = eventIds.flatMap((eid) =>
      participantIds.map((pid) => ({ event_id: eid, profile_id: pid }))
    );
    await supabase.from("event_participants").insert(rows);
  }

  revalidatePath("/calendario");
  return { success: true };
}
