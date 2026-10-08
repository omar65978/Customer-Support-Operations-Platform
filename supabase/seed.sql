-- =============================================================================
-- Demo data for local development and the live demo project.
-- =============================================================================
-- Run AFTER the migration and AFTER creating the five test accounts listed in
-- docs/SETUP.md (Authentication > Users in the Supabase dashboard).
-- If the accounts do not exist yet, this script only prints a notice.
-- It is safe to run again: existing demo requests are skipped.
--
-- Test passwords are for local/demo use only. Change them or delete the
-- accounts before using the project with real customer data.
-- =============================================================================

do $$
declare
  v_alice uuid;
  v_bob uuid;
  v_sarah uuid;
  v_james uuid;
  v_maria uuid;
  v_req uuid;
begin
  select id into v_alice from public.users where email = 'alice@example.com';
  select id into v_bob from public.users where email = 'bob@example.com';
  select id into v_sarah from public.users where email = 'agent1@support.com';
  select id into v_james from public.users where email = 'agent2@support.com';
  select id into v_maria from public.users where email = 'manager@support.com';

  if v_alice is null or v_bob is null or v_sarah is null or v_james is null or v_maria is null then
    raise notice 'Demo accounts are missing. Create the five test users in Authentication > Users, then run this seed again.';
    return;
  end if;

  -- Staff roles and display names. Customers keep the default role 'customer'.
  update public.users set role = 'agent', name = 'Sarah Chen' where id = v_sarah;
  update public.users set role = 'agent', name = 'James Wright' where id = v_james;
  update public.users set role = 'manager', name = 'Maria Rodriguez' where id = v_maria;
  update public.users set name = 'Alice Johnson' where id = v_alice;
  update public.users set name = 'Bob Martinez' where id = v_bob;

  -- REQ-000101: active billing issue, waiting for the customer (has an internal note).
  if not exists (select 1 from public.requests where reference = 'REQ-000101') then
    insert into public.requests (reference, title, description, category, priority, status, customer_id, assigned_agent_id, created_at, updated_at)
    values ('REQ-000101', 'Cannot access my billing history',
      'I have been trying to access my billing history for the past week but the page keeps showing an error. I need to download invoices for my accounting records urgently.',
      'billing', 'high', 'in_progress', v_alice, v_sarah, now() - interval '3 days', now() - interval '3 days')
    returning id into v_req;

    insert into public.messages (request_id, author_id, author_name, author_role, content, is_internal, created_at) values
      (v_req, v_alice, 'Alice Johnson', 'customer', 'I have been trying to access my billing history for the past week but the page keeps showing an error. I need to download invoices for my accounting records urgently.', false, now() - interval '3 days'),
      (v_req, v_sarah, 'Sarah Chen', 'agent', 'Hi Alice, thank you for contacting us. I have taken ownership of your case and am looking into the billing history issue. Which browser are you using?', false, now() - interval '2 days'),
      (v_req, v_sarah, 'Sarah Chen', 'agent', 'Internal: the billing service logs show a database migration that locked the billing_history table for part of the account range. Do not share this with the customer until the hotfix is confirmed.', true, now() - interval '2 days'),
      (v_req, v_sarah, 'Sarah Chen', 'agent', 'Thanks for your patience. Could you tell me which browser you are using and roughly when you last saw the error?', false, now() - interval '1 day');

    update public.requests set status = 'waiting_for_customer', updated_at = now() - interval '1 day' where id = v_req;
  end if;

  -- REQ-000102: urgent account issue, actively being handled.
  if not exists (select 1 from public.requests where reference = 'REQ-000102') then
    insert into public.requests (reference, title, description, category, priority, status, customer_id, assigned_agent_id, created_at, updated_at)
    values ('REQ-000102', 'Two-factor authentication not working',
      'After enabling 2FA on my account last Tuesday, I stopped receiving the verification codes by SMS. I am locked out of my dashboard.',
      'account', 'urgent', 'in_progress', v_alice, v_sarah, now() - interval '1 day', now() - interval '1 day')
    returning id into v_req;

    insert into public.messages (request_id, author_id, author_name, author_role, content, is_internal, created_at) values
      (v_req, v_alice, 'Alice Johnson', 'customer', 'After enabling 2FA on my account last Tuesday, I stopped receiving the verification codes by SMS. I am locked out of my dashboard.', false, now() - interval '1 day'),
      (v_req, v_sarah, 'Sarah Chen', 'agent', 'I am reviewing your 2FA issue now. Could you confirm the country code of the phone number on the account?', false, now() - interval '1 day');
  end if;

  -- REQ-000103: technical issue assigned to James.
  if not exists (select 1 from public.requests where reference = 'REQ-000103') then
    insert into public.requests (reference, title, description, category, priority, status, customer_id, assigned_agent_id, created_at, updated_at)
    values ('REQ-000103', 'API rate limiting causing integration failures',
      'Our integration is hitting rate limits even though we are well within the documented quota. Requests fail with HTTP 429 during the nightly sync.',
      'technical', 'medium', 'in_progress', v_alice, v_james, now() - interval '5 days', now() - interval '5 days')
    returning id into v_req;

    insert into public.messages (request_id, author_id, author_name, author_role, content, is_internal, created_at) values
      (v_req, v_alice, 'Alice Johnson', 'customer', 'Our integration is hitting rate limits even though we are well within the documented quota. Requests fail with HTTP 429 during the nightly sync.', false, now() - interval '5 days'),
      (v_req, v_james, 'James Wright', 'agent', 'We are checking the rate-limit counters for your workspace and will confirm the quota that applies to it.', false, now() - interval '4 days');
  end if;

  -- REQ-000104: refund request, resolved (customer can reopen it).
  if not exists (select 1 from public.requests where reference = 'REQ-000104') then
    insert into public.requests (reference, title, description, category, priority, status, customer_id, assigned_agent_id, created_at, updated_at)
    values ('REQ-000104', 'Refund not processed after 10 business days',
      'I cancelled my subscription on July 20th and was told the refund would arrive within 10 business days. It has not appeared yet.',
      'billing', 'high', 'in_progress', v_bob, v_james, now() - interval '10 days', now() - interval '10 days')
    returning id into v_req;

    insert into public.messages (request_id, author_id, author_name, author_role, content, is_internal, created_at) values
      (v_req, v_bob, 'Bob Martinez', 'customer', 'I cancelled my subscription on July 20th and was told the refund would arrive within 10 business days. It has not appeared yet.', false, now() - interval '10 days'),
      (v_req, v_james, 'James Wright', 'agent', 'I have investigated your refund. Our payment processor shows the refund as pending.', false, now() - interval '9 days'),
      (v_req, v_james, 'James Wright', 'agent', 'Internal: finance confirmed the refund was reprocessed and will settle within 3 to 5 business days.', true, now() - interval '8 days'),
      (v_req, v_james, 'James Wright', 'agent', 'Good news, Bob: your refund has been reprocessed and should appear within 3 to 5 business days.', false, now() - interval '8 days');

    update public.requests set status = 'resolved', updated_at = now() - interval '8 days' where id = v_req;
  end if;

  -- REQ-000105: new, unassigned request. Agents can find it and claim it.
  if not exists (select 1 from public.requests where reference = 'REQ-000105') then
    insert into public.requests (reference, title, description, category, priority, status, customer_id, assigned_agent_id, created_at, updated_at)
    values ('REQ-000105', 'Dashboard widgets not loading on Safari',
      'All dashboard widgets show a spinning loader indefinitely when I open the dashboard in Safari 17. Chrome works fine.',
      'technical', 'medium', 'open', v_bob, null, now() - interval '2 hours', now() - interval '2 hours')
    returning id into v_req;

    insert into public.messages (request_id, author_id, author_name, author_role, content, is_internal, created_at) values
      (v_req, v_bob, 'Bob Martinez', 'customer', 'All dashboard widgets show a spinning loader indefinitely when I open the dashboard in Safari 17. Chrome works fine.', false, now() - interval '2 hours');
  end if;
end
$$;
