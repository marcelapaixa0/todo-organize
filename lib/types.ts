export type VisibilityType = "public" | "private";
export type TaskStatus = "todo" | "in_progress" | "on_hold" | "done";
export type TaskPriority = "high" | "medium" | "low";
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface FamilyGroup {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  family_group_id: string | null;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  family_group_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Task {
  id: string;
  family_group_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  visibility: VisibilityType;
  category_id: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
  assignees?: Profile[];
  checklist_items?: TaskChecklistItem[];
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  text: string;
  checked: boolean;
  assignee_id: string | null;
  position: number;
  created_at: string;
  assignee?: Profile;
}

export interface TaskDateHistory {
  id: string;
  task_id: string;
  changed_by: string;
  old_date: string | null;
  new_date: string | null;
  changed_at: string;
  changer?: Profile;
}

export interface CalendarEvent {
  id: string;
  family_group_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  visibility: VisibilityType;
  date: string;
  start_time: string;
  end_time: string;
  recurrence: RecurrenceType;
  reminder_minutes: number | null;
  created_at: string;
  updated_at: string;
  participants?: Profile[];
}
