-- =============================================================================
-- Customer Support Operations Platform: schema, workflow rules and security
-- =============================================================================
-- Apply in the Supabase SQL Editor (or with `supabase db push`) as the postgres
-- role. Both frontends call this schema directly through Supabase's REST
-- (/rest/v1), Auth (/auth/v1) and Storage (/storage/v1) APIs.
--
-- Security model (enforced here, not only in the UI):
--   * Row Level Security (RLS) decides which rows a signed-in user can read or write.
--   * Triggers enforce the request lifecycle, claim/reassign rules and the
--     server-side author/uploader identity, so no client can forge them.
--   * Roles come from public.users.role, which only the database owner can change.
--     Users cannot change their own role (see the column grant at the bottom).
--
-- The script is re-runnable: it creates missing objects, replaces functions and
-- triggers, and replaces the policies on the four tables it manages.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

-- Profile row for every Supabase Auth user. id = auth.users.id.
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  name text not null default '',
  role text not null default 'customer',
  created_at timestamptz not null default now(),
  constraint users_role_check check (role in ('customer', 'agent', 'manager')),
  constraint users_name_length check (char_length(name) <= 100)
);

create index if not exists users_role_idx on public.users (role);

create sequence if not exists public.request_reference_seq start with 1001;

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique
    default ('REQ-' || lpad(nextval('public.request_reference_seq')::text, 6, '0')),
  title text not null,
  description text not null,
  category text not null,
  priority text not null default 'medium',
  status text not null default 'open',
  customer_id uuid not null references public.users (id) on delete restrict,
  assigned_agent_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint requests_title_length check (char_length(title) between 5 and 100),
  constraint requests_description_length check (char_length(description) between 20 and 5000),
  constraint requests_category_check check (category in ('billing', 'technical', 'account', 'general')),
  constraint requests_priority_check check (priority in ('low', 'medium', 'high', 'urgent')),
  constraint requests_status_check check (
    status in ('open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed')
  )
);

-- Sortable urgency (urgent first when sorted descending). Generated, so it cannot drift.
alter table public.requests add column if not exists urgency_rank smallint
  generated always as (
    case priority when 'urgent' then 4 when 'high' then 3 when 'medium' then 2 else 1 end
  ) stored;

create index if not exists requests_customer_updated_idx on public.requests (customer_id, updated_at desc);
create index if not exists requests_agent_status_idx on public.requests (assigned_agent_id, status);
create index if not exists requests_status_updated_idx on public.requests (status, updated_at desc);
create index if not exists requests_unassigned_idx on public.requests (status, updated_at desc)
  where assigned_agent_id is null;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  author_id uuid references public.users (id) on delete set null,
  author_name text not null default '',
  author_role text not null default 'customer',
  content text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  constraint messages_content_length check (char_length(content) between 1 and 5000),
  constraint messages_author_role_check check (author_role in ('customer', 'agent', 'manager')),
  -- Internal notes can only be written by staff.
  constraint messages_internal_staff_only check (not is_internal or author_role <> 'customer')
);

create index if not exists messages_request_created_idx on public.messages (request_id, created_at);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  uploaded_by uuid references public.users (id) on delete set null,
  uploader_name text not null default '',
  uploader_role text not null default 'customer',
  original_name text not null,
  stored_name text not null unique,
  mime_type text not null,
  size bigint not null,
  created_at timestamptz not null default now(),
  constraint attachments_uploader_role_check check (uploader_role in ('customer', 'agent', 'manager')),
  constraint attachments_original_name_length check (char_length(original_name) between 1 and 255),
  constraint attachments_size_check check (size > 0 and size <= 10485760),
  -- Object path must be "<request id>/<file>" so files stay grouped by request.
  constraint attachments_stored_name_prefix check (stored_name like (request_id::text || '/%'))
);

create index if not exists attachments_request_created_idx on public.attachments (request_id, created_at);

-- -----------------------------------------------------------------------------
-- 2. Helper functions (SECURITY DEFINER so policies can read users/requests safely)
-- -----------------------------------------------------------------------------

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.role from public.users u where u.id = auth.uid()
$$;

create or replace function public.request_id_from_path(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
      then substring(p_name from 1 for 36)::uuid
  end
$$;

-- A signed-in user may add a message/attachment to a request only while the
-- request is active, and only if they are its customer, its assigned agent or a manager.
create or replace function public.can_post_to_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.requests r
    where r.id = p_request_id
      and r.status in ('open', 'in_progress', 'waiting_for_customer')
      and (
        (public.current_app_role() = 'customer' and r.customer_id = auth.uid())
        or (public.current_app_role() = 'agent' and r.assigned_agent_id = auth.uid())
        or public.current_app_role() = 'manager'
      )
  )
$$;

create or replace function public.attachment_allowed_mime_types()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
$$;

-- -----------------------------------------------------------------------------
-- 3. Profile creation for new Auth users
-- -----------------------------------------------------------------------------
-- The role is read from app_metadata, which only the service role or the database
-- owner can write. Anything a user sends in user_metadata (e.g. at sign-up) is ignored.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app_role text := coalesce(new.raw_app_meta_data ->> 'role', '');
  v_name text := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    left(v_name, 100),
    case when v_app_role in ('agent', 'manager') then v_app_role else 'customer' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill profiles for Auth users that already exist.
insert into public.users (id, email, name, role)
select
  u.id,
  coalesce(u.email, ''),
  left(coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(u.email, ''), '@', 1)
  ), 100),
  case when coalesce(u.raw_app_meta_data ->> 'role', '') in ('agent', 'manager')
    then u.raw_app_meta_data ->> 'role' else 'customer' end
from auth.users u
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 4. Request lifecycle and assignment rules
-- -----------------------------------------------------------------------------
-- Lifecycle: open -> in_progress -> waiting_for_customer <-> in_progress
--            in_progress/waiting_for_customer -> resolved -> closed
--            resolved or closed -> in_progress (reopen)
-- Rules enforced below for signed-in users (SQL editor/service role bypass them):
--   * Customers submit open, unassigned requests and may only reopen a resolved or closed one.
--   * Agents may claim an unassigned request for themselves; only managers reassign.
--   * Requests cannot be unassigned, and their status cannot change until assigned.
--   * Core details (title, description, category, customer) never change.

create or replace function public.requests_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_target_role text;
  v_system boolean := coalesce(current_setting('app.system_update', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if v_uid is not null then
      select u.role into v_role from public.users u where u.id = v_uid;
      if v_role is distinct from 'customer' or new.customer_id is distinct from v_uid then
        raise exception 'Only customers can submit a request for themselves' using errcode = '42501';
      end if;
      new.status := 'open';
      new.assigned_agent_id := null;
    end if;
    if new.status = 'resolved' and new.resolved_at is null then
      new.resolved_at := now();
    end if;
    return new;
  end if;

  -- Trusted internal updates (message triggers), SQL editor and service role skip client rules.
  if not v_system and v_uid is not null then
    select u.role into v_role from public.users u where u.id = v_uid;
    if v_role is null then
      raise exception 'Your account is not set up for support access' using errcode = '42501';
    end if;

    if new.id is distinct from old.id
      or new.reference is distinct from old.reference
      or new.customer_id is distinct from old.customer_id
      or new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.category is distinct from old.category
      or new.created_at is distinct from old.created_at then
      raise exception 'Core request details cannot be changed after submission' using errcode = '42501';
    end if;

    if v_role = 'customer' then
      if new.priority is distinct from old.priority
        or new.assigned_agent_id is distinct from old.assigned_agent_id
        or not (old.status in ('resolved', 'closed') and new.status = 'in_progress') then
        raise exception 'Customers can only reopen a resolved or closed request' using errcode = 'P0001';
      end if;
    elsif v_role in ('agent', 'manager') then
      if new.assigned_agent_id is distinct from old.assigned_agent_id then
        if old.assigned_agent_id is not null and v_role <> 'manager' then
          raise exception 'Only managers can reassign a request' using errcode = '42501';
        end if;
        if old.assigned_agent_id is null and v_role = 'agent' and new.assigned_agent_id is distinct from v_uid then
          raise exception 'Agents can only claim requests for themselves' using errcode = '42501';
        end if;
        if new.assigned_agent_id is null then
          raise exception 'A request cannot be unassigned once it has an owner' using errcode = 'P0001';
        end if;
        select u.role into v_target_role from public.users u where u.id = new.assigned_agent_id;
        if v_target_role is distinct from 'agent' and v_target_role is distinct from 'manager' then
          raise exception 'Requests can only be assigned to support staff' using errcode = 'P0001';
        end if;
        -- Claiming starts work on an open request.
        if old.assigned_agent_id is null and old.status = 'open' then
          new.status := 'in_progress';
        end if;
      end if;
    else
      raise exception 'Your account has no support role' using errcode = '42501';
    end if;

    if new.status is distinct from old.status then
      if new.assigned_agent_id is null then
        raise exception 'Claim the request before changing its status' using errcode = 'P0001';
      end if;
      if not (
        (old.status = 'open' and new.status = 'in_progress')
        or (old.status = 'in_progress' and new.status in ('waiting_for_customer', 'resolved'))
        or (old.status = 'waiting_for_customer' and new.status in ('in_progress', 'resolved'))
        or (old.status = 'resolved' and new.status in ('in_progress', 'closed'))
        or (old.status = 'closed' and new.status = 'in_progress')
      ) then
        raise exception 'A request cannot move from % to %', old.status, new.status using errcode = 'P0001';
      end if;
    end if;
  end if;

  new.updated_at := now();
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_at := now();
  elsif new.status in ('open', 'in_progress', 'waiting_for_customer') then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists requests_guard_trg on public.requests;
create trigger requests_guard_trg
  before insert or update on public.requests
  for each row execute function public.requests_guard();

-- -----------------------------------------------------------------------------
-- 5. Messages: server-side author identity, customer reply reopens waiting requests
-- -----------------------------------------------------------------------------

create or replace function public.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_name text;
begin
  if v_uid is not null then
    select u.role, u.name into v_role, v_name from public.users u where u.id = v_uid;
    if v_role is null then
      raise exception 'Your account is not set up for support access' using errcode = '42501';
    end if;
    if v_role = 'customer' and new.is_internal then
      raise exception 'Customers cannot write internal notes' using errcode = '42501';
    end if;
    new.author_id := v_uid;
    new.author_role := v_role;
    new.author_name := coalesce(nullif(btrim(v_name), ''), 'User');
  end if;
  new.content := btrim(new.content);
  return new;
end;
$$;

create or replace function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.system_update', 'on', true);
  if new.author_role = 'customer' and not new.is_internal then
    update public.requests
       set status = 'in_progress'
     where id = new.request_id
       and status = 'waiting_for_customer';
  end if;
  update public.requests set updated_at = now() where id = new.request_id;
  perform set_config('app.system_update', 'off', true);
  return null;
end;
$$;

drop trigger if exists messages_before_insert_trg on public.messages;
create trigger messages_before_insert_trg
  before insert on public.messages
  for each row execute function public.messages_before_insert();

drop trigger if exists messages_after_insert_trg on public.messages;
create trigger messages_after_insert_trg
  after insert on public.messages
  for each row execute function public.messages_after_insert();

-- -----------------------------------------------------------------------------
-- 6. Attachments: server-side uploader identity and file checks
-- -----------------------------------------------------------------------------

create or replace function public.attachments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_name text;
begin
  if v_uid is not null then
    select u.role, u.name into v_role, v_name from public.users u where u.id = v_uid;
    if v_role is null then
      raise exception 'Your account is not set up for support access' using errcode = '42501';
    end if;
    new.uploaded_by := v_uid;
    new.uploader_role := v_role;
    new.uploader_name := coalesce(nullif(btrim(v_name), ''), 'User');
    -- The file is uploaded to Storage first; metadata is only accepted for an existing object.
    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'attachments' and o.name = new.stored_name
    ) then
      raise exception 'The uploaded file could not be found. Please upload it again.' using errcode = 'P0001';
    end if;
  end if;

  if lower(new.mime_type) <> all (public.attachment_allowed_mime_types()) then
    raise exception 'This file type is not allowed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists attachments_before_insert_trg on public.attachments;
create trigger attachments_before_insert_trg
  before insert on public.attachments
  for each row execute function public.attachments_before_insert();

-- -----------------------------------------------------------------------------
-- 7. Row Level Security policies
-- -----------------------------------------------------------------------------
-- Remove any policies created earlier by hand; permissive leftovers would be OR-ed
-- with the policies below and weaken them.

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and tablename in ('users', 'requests', 'messages', 'attachments')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$$;

alter table public.users enable row level security;
alter table public.requests enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;

-- Users: read your own profile; staff can read profiles (for assignment and names).
create policy users_select_self_or_staff on public.users
  for select to authenticated
  using (id = auth.uid() or public.current_app_role() in ('agent', 'manager'));

create policy users_update_own_name on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Requests: customers see their own; agents see their own and unassigned work;
-- managers see everything. Column-level rules are in requests_guard().
create policy requests_select on public.requests
  for select to authenticated
  using (
    (public.current_app_role() = 'customer' and customer_id = auth.uid())
    or public.current_app_role() = 'manager'
    or (public.current_app_role() = 'agent' and (assigned_agent_id = auth.uid() or assigned_agent_id is null))
  );

create policy requests_insert on public.requests
  for insert to authenticated
  with check (
    public.current_app_role() = 'customer' and customer_id = auth.uid()
  );

create policy requests_update on public.requests
  for update to authenticated
  using (
    (public.current_app_role() = 'customer' and customer_id = auth.uid())
    or public.current_app_role() = 'manager'
    or (public.current_app_role() = 'agent' and (assigned_agent_id = auth.uid() or assigned_agent_id is null))
  )
  with check (
    (public.current_app_role() = 'customer' and customer_id = auth.uid())
    or public.current_app_role() = 'manager'
    or (public.current_app_role() = 'agent' and assigned_agent_id = auth.uid())
  );

-- Messages: visible when the request is visible; internal notes are staff-only.
-- Messages are append-only (no update or delete policy).
create policy messages_select on public.messages
  for select to authenticated
  using (
    exists (select 1 from public.requests r where r.id = messages.request_id)
    and (not messages.is_internal or public.current_app_role() in ('agent', 'manager'))
  );

create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.can_post_to_request(messages.request_id)
    and (not messages.is_internal or public.current_app_role() in ('agent', 'manager'))
  );

-- Attachments: same visibility as the request; append-only.
create policy attachments_select on public.attachments
  for select to authenticated
  using (exists (select 1 from public.requests r where r.id = attachments.request_id));

create policy attachments_insert on public.attachments
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.can_post_to_request(attachments.request_id)
  );

-- -----------------------------------------------------------------------------
-- 8. Grants (defence in depth on top of RLS)
-- -----------------------------------------------------------------------------

revoke all on public.users, public.requests, public.messages, public.attachments from anon;
revoke all on public.users, public.requests, public.messages, public.attachments from authenticated;

grant select on public.users to authenticated;
-- Users may change their own display name only, never their role.
grant update (name) on public.users to authenticated;

grant select, insert, update on public.requests to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert on public.attachments to authenticated;
grant usage, select on sequence public.request_reference_seq to authenticated;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.can_post_to_request(uuid) to authenticated;
grant execute on function public.request_id_from_path(text) to authenticated;
grant execute on function public.attachment_allowed_mime_types() to authenticated;

-- Trigger functions are not meant to be called through the API.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.requests_guard() from public, anon, authenticated;
revoke execute on function public.messages_before_insert() from public, anon, authenticated;
revoke execute on function public.messages_after_insert() from public, anon, authenticated;
revoke execute on function public.attachments_before_insert() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 9. Private attachment bucket (files are never public)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  10485760,
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Remove earlier object policies for this bucket, then add the rules below.
do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') like '%attachments%' or coalesce(with_check, '') like '%attachments%')
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end
$$;

-- Download: only files whose attachment record the user can see.
create policy attachments_bucket_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and exists (select 1 from public.attachments a where a.stored_name = storage.objects.name)
  );

-- Upload: only into a request folder the user may post to.
create policy attachments_bucket_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and public.can_post_to_request(public.request_id_from_path(storage.objects.name))
  );
