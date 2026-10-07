# Supabase setup and workflow checks

## 1. Create a project and configure both apps

Use a dedicated Supabase project for this support platform. The React customer portal and Angular support workspace talk directly to the same Supabase Auth, PostgREST, and Storage endpoints. The repository's legacy JSON Server is not used by either frontend.

From the Supabase project dashboard, copy the project URL and the public `anon` key. Never use a `service_role` or secret key in either browser app, a checked-in file, or a `VITE_` variable.

Configure the customer portal:

```bash
cd customer-portal
cp .env.example .env
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `customer-portal/.env`.

Configure the support workspace in another terminal:

```bash
cd support-workspace
cp .env.example .env
```

Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `support-workspace/.env`. Its start/build script writes the public values to an ignored runtime config file. The anon key is intentionally public and safe for browser use; authorization comes from user JWTs and database/storage policies, not from hiding this key.

## 2. Install the shared schema and security policies

Back up any existing Supabase project before applying schema changes. Open the Supabase SQL Editor and run `supabase/migrations/202610070001_support_platform.sql`.

This migration creates the shared `profiles`, `requests`, `messages`, and `attachments` tables, indexes, an account-profile trigger, a private `attachments` bucket, and RLS policies. It also removes existing policies on those four public support tables before creating the platform policies, so their access rules cannot accidentally be widened by an earlier permissive policy. Use a dedicated project; review and migrate existing data and policies rather than running this migration blindly against another application's tables. The migration does not import the repository's old JSON seed data or any unknown remote schema.

The database is authoritative for roles. A new Auth account always receives the `customer` role in `profiles`; signup metadata cannot grant agent or manager access. The authenticated user and support role are looked up from `auth.uid()` and `public.profiles`, not from browser storage or editable `user_metadata`. Customer ownership, agent assignment/claim, manager reassignment, status transitions, message authorship, and request activity timestamps are checked or derived in database triggers and RLS.

The key protections are:

- Customers can select only their own requests and public messages. An internal message row is excluded by RLS, even if a customer queries PostgREST directly.
- Agents can view their assigned work and unassigned active requests; they may claim an open, in-progress, or customer-waiting unassigned request atomically. Claiming an open request starts it, while claiming other active work preserves its status. They cannot reassign work or read requests assigned to a different agent.
- Managers can review all requests and assign/reassign them to actual agent profiles.
- Inserts derive customer, author, uploader, role, reference, IDs, and activity fields from the authenticated database session. The browser does not select these values.
- Requests have server-validated lifecycle transitions. Customers can reactivate their own resolved/waiting request, and normal messages are rejected for resolved or closed requests until reactivated.
- Internal-note visibility and protected file access are enforced by database RLS and private Storage-object policies. A restrictive Storage policy also constrains other permissive policies for the `attachments` bucket.

The migration restricts table grants and policies for the platform tables. The `service_role` bypasses RLS by design and must remain on trusted server-side systems only.

## 3. Create test users

Create separate users in **Authentication → Users** for two customers, one agent, and one manager. Use unique test-only passwords and, preferably, a non-production project. A sign-up through the React portal creates a customer profile automatically; an agent or manager should be created by an administrator, not by changing customer signup metadata.

After creating a staff Auth user, promote its profile in the SQL Editor. Replace each test email with an account that you created:

```sql
update public.profiles p
set role = 'agent'
from auth.users u
where p.id = u.id and u.email = 'agent@example.test';

update public.profiles p
set role = 'manager'
from auth.users u
where p.id = u.id and u.email = 'manager@example.test';
```

Verify the profiles and roles before testing:

```sql
select u.email, p.full_name, p.role
from auth.users u
join public.profiles p on p.id = u.id
where u.email in ('customer-one@example.test', 'customer-two@example.test', 'agent@example.test', 'manager@example.test');
```

The project intentionally does not ship shared passwords or claim that pre-existing demo accounts exist.

## 4. Run locally

Install dependencies once in each frontend:

```bash
cd customer-portal && npm ci
cd ../support-workspace && npm ci
```

Start both apps in separate terminals after setting their `.env` files:

```bash
cd customer-portal && npm run dev
cd support-workspace && npm start
```

The customer portal runs on Vite's default port 5173. The support workspace runs on Angular's default port 4200. No local JSON Server process is required for the supported Supabase workflow.

## 5. Demonstrate the shared workflow

1. Sign in to React as customer one and submit a request with a category and urgency.
2. Sign in to Angular as an agent. The open, unassigned request appears in the available-work list. Open it and claim it.
3. Send a customer-visible reply, then add an internal note. The agent can see both in the workspace.
4. Sign in as customer one. Confirm the public reply appears and the internal note does not. Reply to the agent; the request returns to active work.
5. Set the request to resolved in Angular. In React, confirm the resolution and use **Reopen Request**; the agent can then continue the conversation.
6. Sign in as customer two and attempt to open customer one's request ID directly. RLS returns no accessible request; direct messages and attachment queries remain protected as well.
7. Sign in as manager, review the summary and full paginated list, and reassign the request to another agent.
8. Upload an allowed file smaller than 10 MB from an active request. Try a disallowed extension, an oversized file, and an inaccessible request as negative cases.

The list and detail views re-fetch from Supabase every 30 seconds while the tab is visible. Server-side Range pagination, filtering, sorting, exact counts, and database indexes avoid loading the complete request list into either browser. The manager summary uses count-only PostgREST queries rather than downloading all rows.

## 6. Checks

```bash
cd customer-portal
npm test
npm run build
npm run lint

cd ../support-workspace
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

Angular's Karma tests require ChromeHeadless to be installed in the environment. Browserless Angular builds and TypeScript checks can still be run with `npm run build` and `npx tsc -p tsconfig.spec.json --noEmit`.

## 7. Assumptions and limitations

- The migration defines a fresh normalized Supabase schema. There is no checked-in schema or authoritative inventory of existing remote Supabase tables in this repository, so existing live data is not automatically converted; plan and validate any import separately.
- Role changes are administrative actions made to `profiles.role` in the Supabase dashboard/SQL Editor. Browser signup cannot create staff accounts or promote roles.
- Search covers request reference, title, and description. `pg_trgm` indexes support substring searching; the browser only fetches the selected page.
- Updates are reconciled by 30-second polling, not Supabase Realtime. New rows are de-duplicated by replacing the visible page with the latest server result.
- Accepted attachment types are JPEG/PNG/GIF/WebP, PDF, plain text/CSV, Word, and Excel; the bucket enforces the 10 MB limit. Browser-supplied MIME types and file extensions are not malware scanning or content-signature inspection. Add a trusted scanning service before accepting untrusted files in production.
- Authenticated access tokens are stored in browser local storage because the apps call Supabase directly. Protect against XSS and configure Supabase Auth session lifetimes appropriately.
- This environment cannot apply the SQL migration to the hosted Supabase project; an administrator must run it and configure the two local env files before an end-to-end live demonstration.
