create extension if not exists pg_trgm with schema extensions;
create schema if not exists private;
grant usage on schema public, private, storage to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'customer' check (role in ('customer', 'agent', 'manager')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('REQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  customer_id uuid not null references public.profiles(id),
  assigned_agent_id uuid references public.profiles(id),
  title text not null check (char_length(btrim(title)) between 5 and 100),
  description text not null check (char_length(btrim(description)) >= 20),
  category text not null check (category in ('billing', 'technical', 'account', 'general')),
  priority text not null check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  author_name text not null,
  author_role text not null check (author_role in ('customer', 'agent', 'manager')),
  content text not null check (char_length(btrim(content)) between 5 and 5000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  uploader_name text not null,
  uploader_role text not null check (uploader_role in ('customer', 'agent', 'manager')),
  original_name text not null check (char_length(original_name) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now()
);

create index if not exists requests_customer_updated_idx on public.requests (customer_id, updated_at desc);
create index if not exists requests_agent_updated_idx on public.requests (assigned_agent_id, updated_at desc);
create index if not exists requests_queue_idx on public.requests (status, priority, updated_at desc) where assigned_agent_id is null;
create index if not exists messages_request_created_idx on public.messages (request_id, created_at);
create index if not exists attachments_request_created_idx on public.attachments (request_id, created_at desc);
create index if not exists requests_title_trgm_idx on public.requests using gin (title extensions.gin_trgm_ops);
create index if not exists requests_description_trgm_idx on public.requests using gin (description extensions.gin_trgm_ops);
create index if not exists requests_reference_trgm_idx on public.requests using gin (reference extensions.gin_trgm_ops);

create or replace function private.current_support_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function private.can_access_request(request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.requests r
    where r.id = request_id
      and (
        private.current_support_role() = 'manager'
        or (private.current_support_role() = 'agent' and (
          r.assigned_agent_id = (select auth.uid())
          or (r.assigned_agent_id is null and r.status in ('open', 'in_progress', 'waiting_for_customer'))
        ))
        or (private.current_support_role() = 'customer' and r.customer_id = (select auth.uid()))
      )
  )
$$;

create or replace function private.can_upload_to_request(request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.requests r
    where r.id = request_id
      and r.status in ('open', 'in_progress', 'waiting_for_customer')
      and (
        private.current_support_role() = 'manager'
        or (private.current_support_role() = 'agent' and r.assigned_agent_id = (select auth.uid()))
        or (private.current_support_role() = 'customer' and r.customer_id = (select auth.uid()))
      )
  )
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1), 'Customer'),
    'customer'
  )
  on conflict (id) do update
  set full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_support_profile on auth.users;
create trigger on_auth_user_created_support_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, full_name, role)
select
  u.id,
  coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(u.email, ''), '@', 1), 'Customer'),
  'customer'
from auth.users u
on conflict (id) do nothing;

create or replace function public.guard_request_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
begin
  actor_role := private.current_support_role();

  if tg_op = 'INSERT' then
    if (select auth.uid()) is null then
      if current_user not in ('postgres', 'service_role', 'supabase_admin') then
        raise exception 'Authentication is required to create a request' using errcode = '42501';
      end if;
    elsif actor_role is distinct from 'customer' then
      raise exception 'Only customers may create requests' using errcode = '42501';
    else
      new.customer_id := (select auth.uid());
      new.assigned_agent_id := null;
      new.status := 'open';
      new.resolved_at := null;
    end if;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if new.id is distinct from old.id
    or new.reference is distinct from old.reference
    or new.customer_id is distinct from old.customer_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Request identity and ownership are immutable' using errcode = '42501';
  end if;

  if actor_role = 'customer' then
    if old.customer_id <> (select auth.uid())
      or not (
        (old.status in ('resolved', 'waiting_for_customer') and new.status = 'in_progress')
        or (old.status in ('open', 'in_progress', 'waiting_for_customer') and new.status = old.status)
      )
      or new.assigned_agent_id is distinct from old.assigned_agent_id
      or new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.category is distinct from old.category
      or new.priority is distinct from old.priority then
      raise exception 'Customers may only reactivate their own requests' using errcode = '42501';
    end if;
  elsif actor_role = 'agent' then
    if old.assigned_agent_id = (select auth.uid()) then
      if new.assigned_agent_id is distinct from old.assigned_agent_id then
        raise exception 'Agents cannot reassign requests' using errcode = '42501';
      end if;
    elsif old.assigned_agent_id is null
      and old.status in ('open', 'in_progress', 'waiting_for_customer')
      and new.assigned_agent_id = (select auth.uid())
      and new.status = (case when old.status = 'open' then 'in_progress' else old.status end) then
      null;
    else
      raise exception 'Agents may only update assigned requests or claim an open request' using errcode = '42501';
    end if;
  elsif actor_role = 'manager' then
    if old.status = 'closed' and new.assigned_agent_id is distinct from old.assigned_agent_id then
      raise exception 'Closed requests cannot be reassigned' using errcode = '23514';
    end if;
    if old.assigned_agent_id is not null and new.assigned_agent_id is null then
      raise exception 'A reassignment must select an agent' using errcode = '23514';
    end if;
    if new.assigned_agent_id is not null and not exists (
      select 1 from public.profiles p
      where p.id = new.assigned_agent_id and p.role = 'agent'
    ) then
      raise exception 'Requests may only be assigned to support agents' using errcode = '23514';
    end if;
  elsif (select auth.uid()) is not null then
    raise exception 'A valid support role is required' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'open' and new.status in ('in_progress', 'waiting_for_customer', 'closed'))
      or (old.status = 'in_progress' and new.status in ('waiting_for_customer', 'resolved', 'closed'))
      or (old.status = 'waiting_for_customer' and new.status in ('in_progress', 'resolved', 'closed'))
      or (old.status = 'resolved' and new.status in ('in_progress', 'closed'))
    ) then
      raise exception 'Invalid request status transition' using errcode = '23514';
    end if;
  end if;

  new.updated_at := now();
  if new.status = 'resolved' then
    new.resolved_at := coalesce(old.resolved_at, now());
  elsif new.status = 'in_progress' then
    new.resolved_at := null;
  else
    new.resolved_at := old.resolved_at;
  end if;

  return new;
end;
$$;

drop trigger if exists requests_guard_write on public.requests;
create trigger requests_guard_write
before insert or update on public.requests
for each row execute function public.guard_request_write();

create or replace function public.prepare_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  actor_name text;
  request_status text;
  customer_id uuid;
  assigned_agent_id uuid;
begin
  actor_role := private.current_support_role();
  select r.status, r.customer_id, r.assigned_agent_id
  into request_status, customer_id, assigned_agent_id
  from public.requests r where r.id = new.request_id;

  if request_status is null then
    raise exception 'Request not found' using errcode = '23503';
  end if;

  if request_status in ('resolved', 'closed') then
    raise exception 'Reactivate the request before sending a message' using errcode = '23514';
  end if;

  if actor_role = 'customer' then
    if customer_id <> (select auth.uid()) or new.is_internal then
      raise exception 'Customers may only send public messages on their own requests' using errcode = '42501';
    end if;
  elsif actor_role = 'agent' then
    if assigned_agent_id <> (select auth.uid()) then
      raise exception 'Agents may only message requests assigned to them' using errcode = '42501';
    end if;
  elsif actor_role = 'manager' then
    null;
  else
    raise exception 'A valid support role is required' using errcode = '42501';
  end if;

  select p.full_name into actor_name from public.profiles p where p.id = (select auth.uid());
  new.id := gen_random_uuid();
  new.author_id := (select auth.uid());
  new.author_name := coalesce(actor_name, 'Support User');
  new.author_role := actor_role;
  new.content := btrim(new.content);
  new.created_at := now();
  return new;
end;
$$;

create or replace function public.refresh_request_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.author_role = 'customer' then
    update public.requests
    set status = case when status = 'waiting_for_customer' then 'in_progress' else status end,
        updated_at = now()
    where id = new.request_id;
  elsif not new.is_internal then
    update public.requests
    set status = case when status in ('open', 'in_progress') then 'waiting_for_customer' else status end,
        updated_at = now()
    where id = new.request_id;
  else
    update public.requests set updated_at = now() where id = new.request_id;
  end if;
  return new;
end;
$$;

drop trigger if exists messages_prepare on public.messages;
create trigger messages_prepare
before insert on public.messages
for each row execute function public.prepare_message();

drop trigger if exists messages_refresh_request on public.messages;
create trigger messages_refresh_request
after insert on public.messages
for each row execute function public.refresh_request_activity();

create or replace function public.prepare_attachment()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  actor_role text;
  actor_name text;
  request_id_from_path uuid;
begin
  actor_role := private.current_support_role();
  request_id_from_path := split_part(new.storage_path, '/', 1)::uuid;

  if not private.can_upload_to_request(new.request_id) or request_id_from_path <> new.request_id then
    raise exception 'Attachment upload is not allowed for this request' using errcode = '42501';
  end if;

  if new.mime_type not in (
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
    'text/plain', 'text/csv', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) or new.size_bytes < 1 or new.size_bytes > 10485760 then
    raise exception 'Attachment type or size is not allowed' using errcode = '23514';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'attachments'
      and o.name = new.storage_path
      and o.owner_id = (select auth.uid())::text
  ) then
    raise exception 'Uploaded file was not found in the private attachments bucket' using errcode = '23503';
  end if;

  select p.full_name into actor_name from public.profiles p where p.id = (select auth.uid());
  new.id := gen_random_uuid();
  new.uploaded_by := (select auth.uid());
  new.uploader_name := coalesce(actor_name, 'Support User');
  new.uploader_role := actor_role;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists attachments_prepare on public.attachments;
create trigger attachments_prepare
before insert on public.attachments
for each row execute function public.prepare_attachment();

create or replace function public.refresh_attachment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.requests set updated_at = now() where id = new.request_id;
  return new;
end;
$$;

drop trigger if exists attachments_refresh_request on public.attachments;
create trigger attachments_refresh_request
after insert on public.attachments
for each row execute function public.refresh_attachment_activity();

create or replace function private.can_delete_attachment_object(object_path text, object_owner text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select object_owner = (select auth.uid())::text
    and private.can_access_request(split_part(object_path, '/', 1)::uuid)
    and not exists (select 1 from public.attachments a where a.storage_path = object_path)
$$;

alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'requests', 'messages', 'attachments')
  loop
    execute format('drop policy %I on %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  end loop;
end;
$$;

drop policy if exists profiles_select_self_or_staff on public.profiles;
create policy profiles_select_self_or_staff on public.profiles
for select to authenticated
using (id = (select auth.uid()) or private.current_support_role() in ('agent', 'manager'));

drop policy if exists requests_select_by_role on public.requests;
create policy requests_select_by_role on public.requests
for select to authenticated
using (
  private.current_support_role() = 'manager'
  or (private.current_support_role() = 'agent' and (
    assigned_agent_id = (select auth.uid())
    or (assigned_agent_id is null and status in ('open', 'in_progress', 'waiting_for_customer'))
  ))
  or (private.current_support_role() = 'customer' and customer_id = (select auth.uid()))
);

drop policy if exists requests_insert_customer on public.requests;
create policy requests_insert_customer on public.requests
for insert to authenticated
with check (
  private.current_support_role() = 'customer'
  and customer_id = (select auth.uid())
  and assigned_agent_id is null
  and status = 'open'
);

drop policy if exists requests_update_by_role on public.requests;
create policy requests_update_by_role on public.requests
for update to authenticated
using (
  private.current_support_role() = 'manager'
  or (private.current_support_role() = 'agent' and (
    assigned_agent_id = (select auth.uid())
    or (assigned_agent_id is null and status in ('open', 'in_progress', 'waiting_for_customer'))
  ))
  or (private.current_support_role() = 'customer'
    and customer_id = (select auth.uid())
    and status in ('resolved', 'waiting_for_customer'))
)
with check (
  private.current_support_role() = 'manager'
  or (private.current_support_role() = 'agent' and assigned_agent_id = (select auth.uid()))
  or (private.current_support_role() = 'customer'
    and customer_id = (select auth.uid())
    and status = 'in_progress')
);

drop policy if exists messages_select_by_role on public.messages;
create policy messages_select_by_role on public.messages
for select to authenticated
using (
  (not is_internal and exists (
    select 1 from public.requests r
    where r.id = request_id and r.customer_id = (select auth.uid())
      and private.current_support_role() = 'customer'
  ))
  or (private.current_support_role() in ('agent', 'manager') and private.can_access_request(request_id))
);

drop policy if exists messages_insert_by_role on public.messages;
create policy messages_insert_by_role on public.messages
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and (
    (private.current_support_role() = 'customer' and not is_internal and exists (
      select 1 from public.requests r
      where r.id = request_id and r.customer_id = (select auth.uid())
        and r.status in ('open', 'in_progress', 'waiting_for_customer')
    ))
    or (private.current_support_role() = 'agent' and exists (
      select 1 from public.requests r
      where r.id = request_id and r.assigned_agent_id = (select auth.uid())
        and r.status in ('open', 'in_progress', 'waiting_for_customer')
    ))
    or (private.current_support_role() = 'manager' and exists (
      select 1 from public.requests r
      where r.id = request_id and r.status in ('open', 'in_progress', 'waiting_for_customer')
    ))
  )
);

drop policy if exists attachments_select_by_role on public.attachments;
create policy attachments_select_by_role on public.attachments
for select to authenticated
using (private.can_access_request(request_id));

drop policy if exists attachments_insert_by_role on public.attachments;
create policy attachments_insert_by_role on public.attachments
for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and private.can_upload_to_request(request_id)
);

revoke all on public.profiles, public.requests, public.messages, public.attachments from anon;
revoke all on public.profiles, public.requests, public.messages, public.attachments from authenticated;
grant select on public.profiles to authenticated;
grant select, insert on public.requests to authenticated;
grant update (status, assigned_agent_id) on public.requests to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert on public.attachments to authenticated;

revoke all on function private.current_support_role() from public;
revoke all on function private.can_access_request(uuid) from public;
revoke all on function private.can_upload_to_request(uuid) from public;
revoke all on function private.can_delete_attachment_object(text, text) from public;
grant execute on function private.current_support_role() to authenticated;
grant execute on function private.can_access_request(uuid) to authenticated;
grant execute on function private.can_upload_to_request(uuid) to authenticated;
grant execute on function private.can_delete_attachment_object(text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  10485760,
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
    'text/plain', 'text/csv', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

 drop policy if exists support_attachments_read on storage.objects;
create policy support_attachments_read on storage.objects
for select to authenticated
using (
  bucket_id = 'attachments'
  and private.can_access_request((storage.foldername(name))[1]::uuid)
);

drop policy if exists support_attachments_upload on storage.objects;
create policy support_attachments_upload on storage.objects
for insert to authenticated
with check (
  bucket_id = 'attachments'
  and private.can_upload_to_request((storage.foldername(name))[1]::uuid)
);

drop policy if exists support_attachments_delete_own on storage.objects;
create policy support_attachments_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'attachments'
  and private.can_delete_attachment_object(name, owner_id)
);

drop policy if exists support_attachments_read_limit on storage.objects;
create policy support_attachments_read_limit on storage.objects
as restrictive for select to authenticated
using (
  bucket_id <> 'attachments'
  or private.can_access_request((storage.foldername(name))[1]::uuid)
);

drop policy if exists support_attachments_upload_limit on storage.objects;
create policy support_attachments_upload_limit on storage.objects
as restrictive for insert to authenticated
with check (
  bucket_id <> 'attachments'
  or private.can_upload_to_request((storage.foldername(name))[1]::uuid)
);

drop policy if exists support_attachments_delete_limit on storage.objects;
create policy support_attachments_delete_limit on storage.objects
as restrictive for delete to authenticated
using (
  bucket_id <> 'attachments'
  or private.can_delete_attachment_object(name, owner_id)
);

drop policy if exists support_attachments_update_limit on storage.objects;
create policy support_attachments_update_limit on storage.objects
as restrictive for update to authenticated
using (bucket_id <> 'attachments')
with check (bucket_id <> 'attachments');
