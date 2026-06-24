"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { parseISO, addDays, addWeeks, addMonths, addYears, format } from "date-fns";
import type { TaskStatus, TaskPriority, RecurrenceType, RecurrenceConfig } from "@/lib/types";

type ChecklistItemPayload = {
  text: string;
  assignee_id: string | null;
  position: number;
};

type TaskPayload = {
  title: string;
  description: string | null;
  visibility: "public" | "private";
  category_id: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  recurrence: RecurrenceType;
  recurrence_config?: RecurrenceConfig | null;
  reminder_minutes: number | null;
  assignee_ids: string[];
  checklist_items?: ChecklistItemPayload[];
};

const TRACKABLE_FIELDS = [
  "title", "description", "status", "priority", "due_date",
  "category_id", "visibility", "recurrence", "reminder_minutes",
] as const;

function calculateNextDate(currentDate: string, recurrence: RecurrenceType): string | null {
  if (recurrence === "none" || recurrence === "custom") return null;
  const d = parseISO(currentDate);
  switch (recurrence) {
    case "daily":    return format(addDays(d, 1), "yyyy-MM-dd");
    case "weekly":   return format(addWeeks(d, 1), "yyyy-MM-dd");
    case "biweekly": return format(addWeeks(d, 2), "yyyy-MM-dd");
    case "monthly":  return format(addMonths(d, 1), "yyyy-MM-dd");
    case "yearly":   return format(addYears(d, 1), "yyyy-MM-dd");
    default:         return null;
  }
}

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

  const { assignee_ids, checklist_items, ...taskData } = payload;

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

  const items = (checklist_items ?? []).filter((i) => i.text.trim());
  if (items.length > 0) {
    await supabase.from("task_checklist_items").insert(
      items.map((i) => ({
        task_id: task.id,
        text: i.text.trim(),
        assignee_id: i.assignee_id,
        position: i.position,
        checked: false,
      }))
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return { error: "Perfil não encontrado." };

  const { assignee_ids, checklist_items, ...taskData } = payload;

  // Read current state before mutating (for history)
  const [currentTaskRes, currentAssigneesRes] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", taskId).single(),
    supabase.from("task_assignees").select("profile_id").eq("task_id", taskId),
  ]);

  const { error } = await supabase.from("tasks").update(taskData).eq("id", taskId);
  if (error) return { error: error.message };

  await supabase.from("task_assignees").delete().eq("task_id", taskId);
  if (assignee_ids.length > 0) {
    await supabase.from("task_assignees").insert(
      assignee_ids.map((pid) => ({ task_id: taskId, profile_id: pid }))
    );
  }

  await supabase.from("task_checklist_items").delete().eq("task_id", taskId);
  const items = (checklist_items ?? []).filter((i) => i.text.trim());
  if (items.length > 0) {
    await supabase.from("task_checklist_items").insert(
      items.map((i) => ({
        task_id: taskId,
        text: i.text.trim(),
        assignee_id: i.assignee_id || null,
        position: i.position,
        checked: false,
      }))
    );
  }

  // Record edit history
  if (currentTaskRes.data) {
    const current = currentTaskRes.data as Record<string, unknown>;
    const changes: Array<{ field: string; old: string | null; new: string | null }> = [];

    for (const field of TRACKABLE_FIELDS) {
      const oldVal = current[field] != null ? String(current[field]) : null;
      const newVal = (taskData as Record<string, unknown>)[field] != null
        ? String((taskData as Record<string, unknown>)[field])
        : null;
      if (oldVal !== newVal) {
        changes.push({ field, old: oldVal, new: newVal });
      }
    }

    const oldAssignees = (currentAssigneesRes.data ?? []).map((a) => a.profile_id).sort().join(",");
    const newAssignees = [...assignee_ids].sort().join(",");
    if (oldAssignees !== newAssignees) {
      changes.push({ field: "assignees", old: oldAssignees || null, new: newAssignees || null });
    }

    if (changes.length > 0) {
      await supabase.from("task_edit_history").insert({
        task_id: taskId,
        changed_by: profile.id,
        changes,
      });
    }
  }

  revalidatePath("/tarefas");
  revalidatePath("/calendario");
  return { success: true };
}

export async function deleteTask(taskId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) return { error: error.message };
  revalidatePath("/tarefas");
  revalidatePath("/calendario");
  revalidatePath("/perfil");
  return { success: true };
}

export async function restoreTask(taskId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: null })
    .eq("id", taskId);

  if (error) return { error: error.message };
  revalidatePath("/tarefas");
  revalidatePath("/calendario");
  revalidatePath("/perfil");
  return { success: true };
}

const STATUS_CYCLE: Record<string, string> = {
  todo: "in_progress",
  in_progress: "on_hold",
  on_hold: "done",
  done: "todo",
};

export async function bulkDeleteTasks(taskIds: string[]) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", taskIds);

  if (error) return { error: error.message };
  revalidatePath("/tarefas");
  revalidatePath("/calendario");
  revalidatePath("/perfil");
  return { success: true };
}

export async function bulkAdvanceStatus(taskIds: string[]) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, status")
    .in("id", taskIds);

  if (!tasks) return { error: "Erro ao buscar tarefas." };

  for (const t of tasks) {
    const nextStatus = STATUS_CYCLE[t.status as string] as TaskStatus;
    await supabase.from("tasks").update({ status: nextStatus }).eq("id", t.id);
  }

  revalidatePath("/tarefas");
  revalidatePath("/calendario");
  return { success: true };
}

export async function bulkUpdateDueDate(taskIds: string[], dueDate: string | null) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("tasks")
    .update({ due_date: dueDate })
    .in("id", taskIds);

  if (error) return { error: error.message };
  revalidatePath("/tarefas");
  revalidatePath("/calendario");
  return { success: true };
}

export async function bulkUpdateAssignees(taskIds: string[], assigneeIds: string[]) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  await supabase.from("task_assignees").delete().in("task_id", taskIds);

  if (assigneeIds.length > 0) {
    const rows = taskIds.flatMap((tid) =>
      assigneeIds.map((pid) => ({ task_id: tid, profile_id: pid }))
    );
    await supabase.from("task_assignees").insert(rows);
  }

  revalidatePath("/tarefas");
  revalidatePath("/calendario");
  return { success: true };
}

export async function advanceTaskStatus(taskId: string, currentStatus: TaskStatus) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const nextStatus = STATUS_CYCLE[currentStatus] as TaskStatus;

  const { error } = await supabase
    .from("tasks")
    .update({ status: nextStatus })
    .eq("id", taskId);

  if (error) return { error: error.message };

  // When completing a recurring task, create the next occurrence
  if (nextStatus === "done") {
    const { data: task } = await supabase
      .from("tasks")
      .select("*, assignees:task_assignees(profile_id)")
      .eq("id", taskId)
      .single();

    if (task?.recurrence && task.recurrence !== "none" && task.due_date) {
      const nextDate = calculateNextDate(task.due_date, task.recurrence as RecurrenceType);
      if (nextDate) {
        const { data: newTask } = await supabase
          .from("tasks")
          .insert({
            family_group_id: task.family_group_id,
            creator_id: task.creator_id,
            title: task.title,
            description: task.description,
            visibility: task.visibility,
            category_id: task.category_id,
            priority: task.priority,
            status: "todo",
            due_date: nextDate,
            recurrence: task.recurrence,
            recurrence_config: task.recurrence_config,
            reminder_minutes: task.reminder_minutes,
          })
          .select()
          .single();

        const assignees = (task.assignees ?? []) as Array<{ profile_id: string }>;
        if (newTask && assignees.length > 0) {
          await supabase.from("task_assignees").insert(
            assignees.map((a) => ({ task_id: newTask.id, profile_id: a.profile_id }))
          );
        }
      }
    }
  }

  revalidatePath("/tarefas");
  revalidatePath("/calendario");
  return { success: true };
}
