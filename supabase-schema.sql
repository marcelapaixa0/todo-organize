-- ============================================================
-- ToDo Organize — Supabase Schema (idempotente — pode rodar várias vezes)
-- Run this in the Supabase SQL Editor for your project
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- TYPES (drop e recria para ser idempotente)
-- ============================================================
do $$ begin
  create type task_status as enum ('todo', 'in_progress', 'on_hold', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('high', 'medium', 'low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type visibility_type as enum ('public', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recurrence_type as enum ('none', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly', 'custom');
exception when duplicate_object then null; end $$;

-- Migration (run once if enum already exists):
-- ALTER TYPE recurrence_type ADD VALUE IF NOT EXISTS 'biweekly';
-- ALTER TYPE recurrence_type ADD VALUE IF NOT EXISTS 'custom';

-- ============================================================
-- FAMILY GROUPS
-- ============================================================
create table if not exists family_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text unique not null default upper(substring(gen_random_uuid()::text, 1, 8)),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid unique not null references auth.users(id) on delete cascade,
  family_group_id uuid references family_groups(id) on delete set null,
  name            text not null,
  avatar_url      text,
  color           text not null default '#6366f1',
  created_at      timestamptz not null default now()
);

-- Migration (run once on existing databases):
-- alter table profiles add column if not exists color text not null default '#6366f1';

-- ============================================================
-- CATEGORIES
-- ============================================================
create table if not exists categories (
  id              uuid primary key default gen_random_uuid(),
  family_group_id uuid not null references family_groups(id) on delete cascade,
  name            text not null,
  color           text not null default '#6366f1',
  created_at      timestamptz not null default now(),
  unique (family_group_id, name)
);

-- ============================================================
-- TASKS
-- ============================================================
create table if not exists tasks (
  id                uuid primary key default gen_random_uuid(),
  family_group_id   uuid not null references family_groups(id) on delete cascade,
  creator_id        uuid not null references profiles(id) on delete cascade,
  parent_task_id    uuid references tasks(id) on delete set null,
  title             text not null,
  description       text,
  visibility        visibility_type not null default 'public',
  category_id       uuid not null references categories(id) on delete restrict,
  priority          task_priority not null,
  status            task_status not null default 'todo',
  due_date          date,
  recurrence        recurrence_type not null default 'none',
  recurrence_config jsonb,
  reminder_minutes  int,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Migrations (run once on existing databases):
-- alter table tasks add column if not exists parent_task_id uuid references tasks(id) on delete set null;
-- alter table tasks add column if not exists recurrence recurrence_type not null default 'none';
-- alter table tasks add column if not exists recurrence_config jsonb;
-- alter table tasks add column if not exists reminder_minutes int;
-- alter table tasks add column if not exists deleted_at timestamptz;

-- ============================================================
-- TASK ASSIGNEES (many-to-many)
-- ============================================================
create table if not exists task_assignees (
  task_id    uuid not null references tasks(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (task_id, profile_id)
);

-- ============================================================
-- TASK COMMENTS
-- ============================================================
create table if not exists task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TASK EDIT HISTORY
-- ============================================================
create table if not exists task_edit_history (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  changed_by uuid not null references profiles(id) on delete cascade,
  changes    jsonb not null,
  changed_at timestamptz not null default now()
);

-- ============================================================
-- TASK CHECKLIST ITEMS
-- ============================================================
create table if not exists task_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  text        text not null,
  checked     boolean not null default false,
  assignee_id uuid references profiles(id) on delete set null,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- TASK DATE HISTORY
-- ============================================================
create table if not exists task_date_history (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  changed_by  uuid not null references profiles(id) on delete cascade,
  old_date    date,
  new_date    date,
  changed_at  timestamptz not null default now()
);

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================
create table if not exists calendar_events (
  id               uuid primary key default gen_random_uuid(),
  family_group_id  uuid not null references family_groups(id) on delete cascade,
  creator_id       uuid not null references profiles(id) on delete cascade,
  title            text not null,
  description      text,
  visibility       visibility_type not null default 'public',
  date             date not null,
  start_time       time,
  end_time         time,
  recurrence         recurrence_type not null default 'none',
  recurrence_config  jsonb,
  reminder_minutes   int,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Migration (run once on existing databases):
-- alter table calendar_events add column if not exists deleted_at timestamptz;
-- alter table calendar_events alter column start_time drop not null;
-- alter table calendar_events alter column end_time drop not null;

-- ============================================================
-- EVENT PARTICIPANTS (many-to-many)
-- ============================================================
create table if not exists event_participants (
  event_id   uuid not null references calendar_events(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (event_id, profile_id)
);

-- ============================================================
-- TRIGGER: auto-create profile on first Google login
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (user_id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- TRIGGER: auto-create default categories when group is created
-- ============================================================
create or replace function create_default_categories()
returns trigger language plpgsql as $$
declare
  defaults text[] := array['Casa','Filho','Casal','Compras','Saúde','Exercícios','Estudos','Alimentação'];
  colors   text[] := array['#f59e0b','#ec4899','#8b5cf6','#10b981','#ef4444','#3b82f6','#f97316','#14b8a6'];
  i int;
begin
  for i in 1..array_length(defaults, 1) loop
    insert into categories (family_group_id, name, color)
    values (new.id, defaults[i], colors[i])
    on conflict (family_group_id, name) do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists on_family_group_created on family_groups;
create trigger on_family_group_created
  after insert on family_groups
  for each row execute procedure create_default_categories();

-- ============================================================
-- TRIGGER: record due_date changes on tasks
-- ============================================================
create or replace function record_due_date_change()
returns trigger language plpgsql as $$
begin
  if old.due_date is distinct from new.due_date then
    insert into task_date_history (task_id, changed_by, old_date, new_date)
    values (
      new.id,
      (select id from profiles where user_id = auth.uid()),
      old.due_date,
      new.due_date
    );
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists on_task_due_date_changed on tasks;
create trigger on_task_due_date_changed
  before update on tasks
  for each row execute procedure record_due_date_change();

-- ============================================================
-- TRIGGER: set completed_at when status → done
-- ============================================================
create or replace function set_task_completed_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and old.status <> 'done' then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists on_task_status_done on tasks;
create trigger on_task_status_done
  before update on tasks
  for each row execute procedure set_task_completed_at();

-- ============================================================
-- RLS
-- ============================================================
alter table family_groups        enable row level security;
alter table profiles             enable row level security;
alter table categories           enable row level security;
alter table tasks                enable row level security;
alter table task_assignees       enable row level security;
alter table task_checklist_items enable row level security;
alter table task_date_history    enable row level security;
alter table calendar_events      enable row level security;
alter table event_participants   enable row level security;

-- Helper functions
create or replace function my_family_group_id()
returns uuid language sql security definer stable as $$
  select family_group_id from profiles where user_id = auth.uid() limit 1;
$$;

create or replace function my_profile_id()
returns uuid language sql security definer stable as $$
  select id from profiles where user_id = auth.uid() limit 1;
$$;

-- ============================================================
-- POLICIES (drop antes de recriar para evitar duplicatas)
-- ============================================================

-- family_groups
drop policy if exists "member sees own group"         on family_groups;
drop policy if exists "auth user lookup by invite"    on family_groups;
drop policy if exists "member updates own group"      on family_groups;
drop policy if exists "anyone can create group"       on family_groups;
-- members can see their own group; any authenticated user can look up a group by invite_code (needed to join)
create policy "member sees own group"         on family_groups for select using (id = my_family_group_id());
create policy "auth user lookup by invite"    on family_groups for select using (auth.uid() is not null);
create policy "member updates own group"      on family_groups for update using (id = my_family_group_id());
create policy "anyone can create group"       on family_groups for insert with check (auth.uid() is not null);

-- profiles
drop policy if exists "members see group profiles" on profiles;
drop policy if exists "own profile insert"         on profiles;
drop policy if exists "own profile update"         on profiles;
create policy "members see group profiles" on profiles for select using (family_group_id = my_family_group_id() or user_id = auth.uid());
create policy "own profile insert"         on profiles for insert with check (user_id = auth.uid());
create policy "own profile update"         on profiles for update using (user_id = auth.uid());

-- categories
drop policy if exists "group members see categories"    on categories;
drop policy if exists "group members manage categories" on categories;
create policy "group members see categories"    on categories for select using (family_group_id = my_family_group_id());
create policy "group members manage categories" on categories for all    using (family_group_id = my_family_group_id());

-- tasks
drop policy if exists "group members see public tasks" on tasks;
drop policy if exists "group members insert tasks"     on tasks;
drop policy if exists "group members update tasks"     on tasks;
drop policy if exists "creator deletes task"           on tasks;
create policy "group members see public tasks" on tasks for select using (family_group_id = my_family_group_id() and (visibility = 'public' or creator_id = my_profile_id()));
create policy "group members insert tasks"     on tasks for insert with check (family_group_id = my_family_group_id());
create policy "group members update tasks"     on tasks for update using (family_group_id = my_family_group_id());
create policy "creator deletes task"           on tasks for delete using (creator_id = my_profile_id());

-- task_assignees
drop policy if exists "group members see assignees"    on task_assignees;
drop policy if exists "group members manage assignees" on task_assignees;
create policy "group members see assignees"    on task_assignees for select using (exists (select 1 from tasks t where t.id = task_id and t.family_group_id = my_family_group_id()));
create policy "group members manage assignees" on task_assignees for all    using (exists (select 1 from tasks t where t.id = task_id and t.family_group_id = my_family_group_id()));

-- task_checklist_items
drop policy if exists "group members see checklist"    on task_checklist_items;
drop policy if exists "group members manage checklist" on task_checklist_items;
create policy "group members see checklist"    on task_checklist_items for select using (exists (select 1 from tasks t where t.id = task_id and t.family_group_id = my_family_group_id()));
create policy "group members manage checklist" on task_checklist_items for all    using (exists (select 1 from tasks t where t.id = task_id and t.family_group_id = my_family_group_id()));

-- task_date_history
drop policy if exists "group members see date history" on task_date_history;
drop policy if exists "system inserts date history"    on task_date_history;
create policy "group members see date history" on task_date_history for select using (exists (select 1 from tasks t where t.id = task_id and t.family_group_id = my_family_group_id()));
create policy "system inserts date history"    on task_date_history for insert with check (true);

-- task_comments
alter table task_comments enable row level security;
drop policy if exists "group members see task comments"    on task_comments;
drop policy if exists "group members insert task comments" on task_comments;
drop policy if exists "author deletes own comment"         on task_comments;
create policy "group members see task comments"    on task_comments for select using (exists (select 1 from tasks t where t.id = task_id and t.family_group_id = my_family_group_id()));
create policy "group members insert task comments" on task_comments for insert with check (exists (select 1 from tasks t where t.id = task_id and t.family_group_id = my_family_group_id()));
create policy "author deletes own comment"         on task_comments for delete using (profile_id = my_profile_id());

-- task_edit_history
alter table task_edit_history enable row level security;
drop policy if exists "group members see edit history"    on task_edit_history;
drop policy if exists "system inserts edit history"       on task_edit_history;
create policy "group members see edit history"    on task_edit_history for select using (exists (select 1 from tasks t where t.id = task_id and t.family_group_id = my_family_group_id()));
create policy "system inserts edit history"       on task_edit_history for insert with check (true);

-- calendar_events
drop policy if exists "group members see public events" on calendar_events;
drop policy if exists "group members insert events"     on calendar_events;
drop policy if exists "creator updates events"          on calendar_events;
drop policy if exists "creator deletes events"          on calendar_events;
create policy "group members see public events" on calendar_events for select using (family_group_id = my_family_group_id() and (visibility = 'public' or creator_id = my_profile_id()));
create policy "group members insert events"     on calendar_events for insert with check (family_group_id = my_family_group_id());
create policy "creator updates events"          on calendar_events for update using (creator_id = my_profile_id());
create policy "creator deletes events"          on calendar_events for delete using (creator_id = my_profile_id());

-- event_participants
drop policy if exists "group members see participants" on event_participants;
drop policy if exists "creator manages participants"   on event_participants;
create policy "group members see participants" on event_participants for select using (exists (select 1 from calendar_events e where e.id = event_id and e.family_group_id = my_family_group_id()));
create policy "creator manages participants"   on event_participants for all    using (exists (select 1 from calendar_events e where e.id = event_id and e.creator_id = my_profile_id()));
