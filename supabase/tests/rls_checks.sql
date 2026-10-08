-- =============================================================================
-- Security and workflow checks for the support platform database.
-- =============================================================================
-- Run after the migration and the demo seed (supabase/seed.sql).
-- The script runs in one transaction and ends with ROLLBACK, so no data is kept.
-- Each check prints PASS, or raises an exception naming the failed check.
--
-- Run in the Supabase SQL Editor, or with: psql "<connection string>" -f supabase/tests/rls_checks.sql
-- =============================================================================

begin;

-- Session helpers. They exist only for this session (pg_temp).
create or replace function pg_temp.uid(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from public.users u where u.email = p_email
$$;

create or replace function pg_temp.rid(p_reference text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.id from public.requests r where r.reference = p_reference
$$;

-- Simulates the JWT that Supabase Auth issues for a signed-in user.
create or replace function pg_temp.as_user(p_email text)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', pg_temp.uid(p_email), 'role', 'authenticated')::text,
    true
  );
end
$$;

create or replace function pg_temp.expect_blocked(p_label text, p_sql text)
returns void
language plpgsql
as $$
declare
  v_blocked boolean := false;
  v_message text;
begin
  begin
    execute p_sql;
  exception when others then
    v_blocked := true;
    v_message := sqlerrm;
  end;
  if not v_blocked then
    raise exception 'FAIL: % was allowed but must be blocked', p_label;
  end if;
  raise notice 'PASS: % (blocked: %)', p_label, v_message;
end
$$;

create or replace function pg_temp.expect_rows(p_label text, p_sql text, p_expected bigint)
returns void
language plpgsql
as $$
declare
  v_rows bigint;
begin
  execute p_sql;
  get diagnostics v_rows = row_count;
  if v_rows <> p_expected then
    raise exception 'FAIL: % changed % row(s), expected %', p_label, v_rows, p_expected;
  end if;
  raise notice 'PASS: % (% row(s))', p_label, v_rows;
end
$$;

create or replace function pg_temp.expect_count(p_label text, p_sql text, p_expected bigint)
returns void
language plpgsql
as $$
declare
  v_count bigint;
begin
  execute p_sql into v_count;
  if v_count is distinct from p_expected then
    raise exception 'FAIL: % returned %, expected %', p_label, v_count, p_expected;
  end if;
  raise notice 'PASS: % (= %)', p_label, v_count;
end
$$;

-- -----------------------------------------------------------------------------
-- 0. Accounts and roles (administrator view)
-- -----------------------------------------------------------------------------
select pg_temp.expect_count(
  'S0 user_metadata cannot grant a role (alice has role=manager in metadata)',
  $q$select count(*) from public.users where email = 'alice@example.com' and role = 'customer'$q$, 1);
select pg_temp.expect_count(
  'S0 app_metadata role is applied (agent1 is an agent)',
  $q$select count(*) from public.users where email = 'agent1@support.com' and role = 'agent'$q$, 1);

set local role authenticated;

-- -----------------------------------------------------------------------------
-- A. Customer alice: sees only her own requests and profile
-- -----------------------------------------------------------------------------
select pg_temp.as_user('alice@example.com');

select pg_temp.expect_count('A1 customer sees only own requests',
  $q$select count(*) from public.requests$q$, 3);
select pg_temp.expect_count('A2 customer cannot read another customer request by id',
  format($q$select count(*) from public.requests where id = %L$q$, pg_temp.rid('REQ-000104')), 0);
select pg_temp.expect_rows('A3 customer update of another customer request affects no rows',
  format($q$update public.requests set priority = 'low' where id = %L$q$, pg_temp.rid('REQ-000104')), 0);
select pg_temp.expect_count('A4 customer cannot read another user profile',
  $q$select count(*) from public.users where email = 'bob@example.com'$q$, 0);
select pg_temp.expect_count('A5 customer reads own profile',
  $q$select count(*) from public.users where email = 'alice@example.com'$q$, 1);
select pg_temp.expect_blocked('A6 customer cannot change own role',
  $q$update public.users set role = 'manager' where email = 'alice@example.com'$q$);
select pg_temp.expect_rows('A7 customer can change own display name',
  $q$update public.users set name = 'Alice J.' where email = 'alice@example.com'$q$, 1);
select pg_temp.expect_blocked('A8 customer cannot delete a request',
  $q$delete from public.requests where reference = 'REQ-000102'$q$);

-- -----------------------------------------------------------------------------
-- B. Messages: internal notes stay with staff; customers post only on their own active requests
-- -----------------------------------------------------------------------------
select pg_temp.expect_count('B1 customer never sees internal notes',
  format($q$select count(*) from public.messages where request_id = %L and is_internal$q$, pg_temp.rid('REQ-000101')), 0);
select pg_temp.expect_count('B2 customer sees the public messages of own request',
  format($q$select count(*) from public.messages where request_id = %L$q$, pg_temp.rid('REQ-000101')), 3);
select pg_temp.expect_blocked('B3 customer cannot write an internal note',
  format($q$insert into public.messages (request_id, author_id, author_name, author_role, content, is_internal)
            values (%L, pg_temp.uid('alice@example.com'), 'x', 'customer', 'Try to write a note', true)$q$, pg_temp.rid('REQ-000101')));
select pg_temp.expect_blocked('B4 customer cannot post on another customer request',
  format($q$insert into public.messages (request_id, author_id, author_name, author_role, content, is_internal)
            values (%L, pg_temp.uid('alice@example.com'), 'x', 'customer', 'Not my request', false)$q$, pg_temp.rid('REQ-000104')));
select pg_temp.expect_rows('B5 customer reply on own waiting request is accepted',
  format($q$insert into public.messages (request_id, author_id, author_name, author_role, content, is_internal)
            values (%L, pg_temp.uid('alice@example.com'), 'x', 'customer', 'Firefox 129 on Windows, about 10:30 today', false)$q$, pg_temp.rid('REQ-000101')), 1);
select pg_temp.expect_count('B6 customer reply moves a waiting request back to in progress',
  $q$select count(*) from public.requests where reference = 'REQ-000101' and status = 'in_progress'$q$, 1);
select pg_temp.expect_count('B7 author name and role come from the server, not the client',
  $q$select count(*) from public.messages where content = 'Firefox 129 on Windows, about 10:30 today' and author_role = 'customer' and author_name = 'Alice J.'$q$, 1);

-- -----------------------------------------------------------------------------
-- C. Customer alice: request-level rules
-- -----------------------------------------------------------------------------
select pg_temp.expect_rows('C1 customer can submit an open, unassigned request',
  format($q$insert into public.requests (title, description, category, priority, customer_id)
            values ('Checks: new unassigned request', 'Created by the RLS check script', 'general', 'low', %L)$q$, pg_temp.uid('alice@example.com')), 1);
select pg_temp.expect_count('C2 new request is open and unassigned whatever the client sends',
  $q$select count(*) from public.requests where title = 'Checks: new unassigned request' and status = 'open' and assigned_agent_id is null$q$, 1);
select pg_temp.expect_blocked('C3 customer cannot submit a request for another customer',
  format($q$insert into public.requests (title, description, category, priority, customer_id)
            values ('Checks: spoofed owner', 'Created by the RLS check script', 'general', 'low', %L)$q$, pg_temp.uid('bob@example.com')));
select pg_temp.expect_blocked('C4 customer cannot change priority',
  $q$update public.requests set priority = 'urgent' where reference = 'REQ-000102'$q$);
select pg_temp.expect_blocked('C5 customer cannot close an active request',
  $q$update public.requests set status = 'closed' where reference = 'REQ-000102'$q$);
select pg_temp.expect_blocked('C6 customer cannot change request title',
  $q$update public.requests set title = 'Checks: renamed' where reference = 'REQ-000102'$q$);

-- -----------------------------------------------------------------------------
-- D. Agent sarah: sees own and unassigned work, claims, notes
-- -----------------------------------------------------------------------------
select pg_temp.as_user('agent1@support.com');

select pg_temp.expect_count('D1 agent sees own and unassigned requests only',
  $q$select count(*) from public.requests$q$, 4);
select pg_temp.expect_count('D2 agent cannot see another agent request',
  $q$select count(*) from public.requests where reference = 'REQ-000103'$q$, 0);
select pg_temp.expect_count('D3 agent sees internal notes on own request',
  format($q$select count(*) from public.messages where request_id = %L and is_internal$q$, pg_temp.rid('REQ-000101')), 1);
select pg_temp.expect_rows('D4 agent posts an internal note on own request',
  format($q$insert into public.messages (request_id, author_id, author_name, author_role, content, is_internal)
            values (%L, pg_temp.uid('agent1@support.com'), 'x', 'agent', 'Checks: internal note from Sarah', true)$q$, pg_temp.rid('REQ-000101')), 1);
select pg_temp.expect_blocked('D5 agent cannot post on another agent request',
  format($q$insert into public.messages (request_id, author_id, author_name, author_role, content, is_internal)
            values (%L, pg_temp.uid('agent1@support.com'), 'x', 'agent', 'Not my request', false)$q$, pg_temp.rid('REQ-000103')));
select pg_temp.expect_blocked('D6 agent cannot post on an unclaimed request',
  format($q$insert into public.messages (request_id, author_id, author_name, author_role, content, is_internal)
            values (%L, pg_temp.uid('agent1@support.com'), 'x', 'agent', 'Claim first', false)$q$, pg_temp.rid('REQ-000105')));
select pg_temp.expect_count('D7 agent message author is set by the server',
  $q$select count(*) from public.messages where content = 'Checks: internal note from Sarah' and author_name = 'Sarah Chen' and author_role = 'agent'$q$, 1);
select pg_temp.expect_rows('D8 agent claims an unassigned request',
  $q$update public.requests set assigned_agent_id = pg_temp.uid('agent1@support.com') where reference = 'REQ-000105' and assigned_agent_id is null$q$, 1);
select pg_temp.expect_count('D9 claiming moves an open request to in progress',
  $q$select count(*) from public.requests where reference = 'REQ-000105' and status = 'in_progress' and assigned_agent_id = pg_temp.uid('agent1@support.com')$q$, 1);
select pg_temp.expect_blocked('D10 agent cannot reassign own request',
  format($q$update public.requests set assigned_agent_id = %L where reference = 'REQ-000101'$q$, pg_temp.uid('agent2@support.com')));
select pg_temp.expect_blocked('D11 agent cannot unassign own request',
  $q$update public.requests set assigned_agent_id = null where reference = 'REQ-000101'$q$);
select pg_temp.expect_blocked('D12 agent cannot skip the lifecycle (in progress -> closed)',
  $q$update public.requests set status = 'closed' where reference = 'REQ-000101'$q$);
select pg_temp.expect_blocked('D13 agent cannot change request title',
  $q$update public.requests set title = 'Checks: agent rename' where reference = 'REQ-000101'$q$);
select pg_temp.expect_rows('D14 agent moves own request to waiting for customer',
  $q$update public.requests set status = 'waiting_for_customer' where reference = 'REQ-000101'$q$, 1);

-- -----------------------------------------------------------------------------
-- E. Agent james: cannot take another agent work or claim for someone else
-- -----------------------------------------------------------------------------
select pg_temp.as_user('agent2@support.com');

select pg_temp.expect_rows('E1 second agent cannot see or claim an already claimed request',
  $q$update public.requests set assigned_agent_id = pg_temp.uid('agent2@support.com') where reference = 'REQ-000105'$q$, 0);
select pg_temp.expect_blocked('E2 agent cannot claim a request for another agent',
  format($q$update public.requests set assigned_agent_id = %L where title = 'Checks: new unassigned request'$q$, pg_temp.uid('agent1@support.com')));
select pg_temp.expect_rows('E3 agent claims an unassigned request for self',
  format($q$update public.requests set assigned_agent_id = %L where title = 'Checks: new unassigned request'$q$, pg_temp.uid('agent2@support.com')), 1);
select pg_temp.as_user('alice@example.com');
select pg_temp.expect_rows('E4a customer submits a second unassigned request',
  format($q$insert into public.requests (title, description, category, priority, customer_id)
            values ('Checks: second unassigned request', 'Created by the RLS check script', 'general', 'low', %L)$q$, pg_temp.uid('alice@example.com')), 1);

select pg_temp.as_user('agent2@support.com');
select pg_temp.expect_blocked('E4 agent cannot change the status of an unclaimed request',
  $q$update public.requests set status = 'waiting_for_customer' where title = 'Checks: second unassigned request'$q$);

-- -----------------------------------------------------------------------------
-- F. Manager maria: full view, reassignment, closing
-- -----------------------------------------------------------------------------
select pg_temp.as_user('manager@support.com');

select pg_temp.expect_count('F1 manager sees every request',
  $q$select count(*) from public.requests$q$, 7);
select pg_temp.expect_rows('F2 manager reassigns a request',
  format($q$update public.requests set assigned_agent_id = %L where reference = 'REQ-000103'$q$, pg_temp.uid('agent1@support.com')), 1);
select pg_temp.expect_blocked('F3 manager cannot unassign a request',
  $q$update public.requests set assigned_agent_id = null where reference = 'REQ-000103'$q$);
select pg_temp.expect_blocked('F4 manager cannot assign a customer as owner',
  format($q$update public.requests set assigned_agent_id = %L where reference = 'REQ-000103'$q$, pg_temp.uid('bob@example.com')));
select pg_temp.expect_rows('F5 manager claims an unassigned request',
  $q$update public.requests set assigned_agent_id = pg_temp.uid('manager@support.com') where title = 'Checks: second unassigned request' and assigned_agent_id is null$q$, 1);
select pg_temp.expect_count('F6 manager claim of an open request moves it to in progress',
  $q$select count(*) from public.requests where title = 'Checks: second unassigned request' and status = 'in_progress'$q$, 1);

-- -----------------------------------------------------------------------------
-- G. Customer bob: reopen, closed states
-- -----------------------------------------------------------------------------
select pg_temp.as_user('bob@example.com');

select pg_temp.expect_count('G1 bob sees only his own requests',
  $q$select count(*) from public.requests$q$, 2);
select pg_temp.expect_count('G2 bob cannot read internal notes on his request',
  format($q$select count(*) from public.messages where request_id = %L and is_internal$q$, pg_temp.rid('REQ-000104')), 0);
select pg_temp.expect_blocked('G3 bob cannot reassign his request',
  format($q$update public.requests set assigned_agent_id = %L where reference = 'REQ-000104'$q$, pg_temp.uid('agent1@support.com')));
select pg_temp.expect_rows('G4 bob reopens a resolved request',
  $q$update public.requests set status = 'in_progress' where reference = 'REQ-000104' and status = 'resolved'$q$, 1);

select pg_temp.as_user('agent2@support.com');
select pg_temp.expect_rows('G5 james resolves his request',
  $q$update public.requests set status = 'resolved' where reference = 'REQ-000104' and status = 'in_progress'$q$, 1);
select pg_temp.expect_count('G6 resolving sets resolved_at',
  $q$select count(*) from public.requests where reference = 'REQ-000104' and status = 'resolved' and resolved_at is not null$q$, 1);
select pg_temp.expect_blocked('G7 resolved request cannot go back to waiting',
  $q$update public.requests set status = 'waiting_for_customer' where reference = 'REQ-000104'$q$);
select pg_temp.expect_blocked('G8 resolved request does not accept new messages',
  format($q$insert into public.messages (request_id, author_id, author_name, author_role, content, is_internal)
            values (%L, pg_temp.uid('agent2@support.com'), 'x', 'agent', 'Message on a resolved request', false)$q$, pg_temp.rid('REQ-000104')));

select pg_temp.as_user('bob@example.com');
select pg_temp.expect_rows('G9 bob reopens his resolved request',
  $q$update public.requests set status = 'in_progress' where reference = 'REQ-000104' and status = 'resolved'$q$, 1);
select pg_temp.expect_count('G10 reopening clears resolved_at',
  $q$select count(*) from public.requests where reference = 'REQ-000104' and resolved_at is null$q$, 1);

select pg_temp.as_user('manager@support.com');
select pg_temp.expect_rows('G11 manager closes a request after resolution',
  $q$update public.requests set status = 'resolved' where reference = 'REQ-000104' and status = 'in_progress'$q$, 1);
select pg_temp.expect_rows('G12 manager closes the resolved request',
  $q$update public.requests set status = 'closed' where reference = 'REQ-000104' and status = 'resolved'$q$, 1);
select pg_temp.expect_blocked('G13 closed request does not accept messages',
  format($q$insert into public.messages (request_id, author_id, author_name, author_role, content, is_internal)
            values (%L, pg_temp.uid('manager@support.com'), 'x', 'manager', 'Message on a closed request', false)$q$, pg_temp.rid('REQ-000104')));

select pg_temp.as_user('bob@example.com');
select pg_temp.expect_rows('G14 customer reopens a closed request',
  $q$update public.requests set status = 'in_progress' where reference = 'REQ-000104' and status = 'closed'$q$, 1);
select pg_temp.expect_count('G15 reopening clears resolved_at',
  $q$select count(*) from public.requests where reference = 'REQ-000104' and status = 'in_progress' and resolved_at is null$q$, 1);
select pg_temp.expect_blocked('G16 customer cannot close a reopened request',
  $q$update public.requests set status = 'closed' where reference = 'REQ-000104'$q$);

select pg_temp.as_user('manager@support.com');
select pg_temp.expect_blocked('G17 a request cannot skip resolution (in progress -> closed)',
  $q$update public.requests set status = 'closed' where reference = 'REQ-000104'$q$);
select pg_temp.expect_rows('G18 manager resolves the reopened request',
  $q$update public.requests set status = 'resolved' where reference = 'REQ-000104' and status = 'in_progress'$q$, 1);
select pg_temp.expect_rows('G19 manager closes it again',
  $q$update public.requests set status = 'closed' where reference = 'REQ-000104' and status = 'resolved'$q$, 1);
select pg_temp.expect_blocked('G20 a closed request cannot move straight to resolved',
  $q$update public.requests set status = 'resolved' where reference = 'REQ-000104'$q$);

-- -----------------------------------------------------------------------------
-- H. Attachments and private storage
-- -----------------------------------------------------------------------------
select pg_temp.as_user('alice@example.com');

select pg_temp.expect_rows('H1 customer uploads a file into own active request folder',
  format($q$insert into storage.objects (bucket_id, name) values ('attachments', %L)$q$,
    pg_temp.rid('REQ-000101')::text || '/checks-invoice.pdf'), 1);
select pg_temp.expect_blocked('H2 customer cannot upload into another customer folder',
  format($q$insert into storage.objects (bucket_id, name) values ('attachments', %L)$q$,
    pg_temp.rid('REQ-000104')::text || '/checks-not-mine.pdf'));
select pg_temp.expect_blocked('H3 upload path must start with a request id',
  $q$insert into storage.objects (bucket_id, name) values ('attachments', 'loose-file.pdf')$q$);
select pg_temp.expect_rows('H4 customer registers metadata for an uploaded file',
  format($q$insert into public.attachments (request_id, original_name, stored_name, mime_type, size)
            values (%L, 'invoice.pdf', %L, 'application/pdf', 20480)$q$,
    pg_temp.rid('REQ-000101'), pg_temp.rid('REQ-000101')::text || '/checks-invoice.pdf'), 1);
select pg_temp.expect_count('H5 attachment records the uploader from the server',
  $q$select count(*) from public.attachments where original_name = 'invoice.pdf' and uploaded_by = pg_temp.uid('alice@example.com') and uploader_role = 'customer'$q$, 1);
select pg_temp.expect_blocked('H6 metadata for a file that was never uploaded is rejected',
  format($q$insert into public.attachments (request_id, original_name, stored_name, mime_type, size)
            values (%L, 'ghost.pdf', %L, 'application/pdf', 100)$q$,
    pg_temp.rid('REQ-000101'), pg_temp.rid('REQ-000101')::text || '/ghost.pdf'));
select pg_temp.expect_rows('H7 a disallowed file type can be stored in the bucket',
  format($q$insert into storage.objects (bucket_id, name) values ('attachments', %L)$q$,
    pg_temp.rid('REQ-000101')::text || '/checks-program.exe'), 1);
select pg_temp.expect_blocked('H8 metadata with a disallowed file type is rejected',
  format($q$insert into public.attachments (request_id, original_name, stored_name, mime_type, size)
            values (%L, 'program.exe', %L, 'application/x-msdownload', 100)$q$,
    pg_temp.rid('REQ-000101'), pg_temp.rid('REQ-000101')::text || '/checks-program.exe'));
select pg_temp.expect_blocked('H9 metadata larger than 10 MB is rejected',
  format($q$insert into public.attachments (request_id, original_name, stored_name, mime_type, size)
            values (%L, 'huge.pdf', %L, 'application/pdf', 10485761)$q$,
    pg_temp.rid('REQ-000101'), pg_temp.rid('REQ-000101')::text || '/checks-invoice.pdf'));

select pg_temp.as_user('bob@example.com');
select pg_temp.expect_count('H10 other customers cannot list attachments of a request',
  format($q$select count(*) from public.attachments where request_id = %L$q$, pg_temp.rid('REQ-000101')), 0);
select pg_temp.expect_count('H11 other customers cannot download a file object',
  format($q$select count(*) from storage.objects where bucket_id = 'attachments' and name like %L$q$, pg_temp.rid('REQ-000101')::text || '/%'), 0);

select pg_temp.as_user('agent1@support.com');
select pg_temp.expect_count('H12 assigned agent can list and download the attachment',
  format($q$select count(*) from public.attachments where request_id = %L$q$, pg_temp.rid('REQ-000101')), 1);

select pg_temp.as_user('agent2@support.com');
select pg_temp.expect_count('H13 agent without access to the request sees no attachment',
  format($q$select count(*) from public.attachments where request_id = %L$q$, pg_temp.rid('REQ-000101')), 0);
select pg_temp.expect_blocked('H14 agent cannot upload to a request that is not theirs',
  format($q$insert into storage.objects (bucket_id, name) values ('attachments', %L)$q$,
    pg_temp.rid('REQ-000101')::text || '/checks-agent2.pdf'));

select pg_temp.as_user('manager@support.com');
select pg_temp.expect_blocked('H15 closed request does not accept attachments',
  format($q$insert into storage.objects (bucket_id, name) values ('attachments', %L)$q$,
    pg_temp.rid('REQ-000104')::text || '/checks-after-close.pdf'));

rollback;
