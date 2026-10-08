# Architecture, decisions and review notes

This document explains how the platform meets the milestone requirements, which rules the database enforces, the assumptions made where the requirements were open, and the known limitations.

## 1. Approach

- The existing project was extended, not rebuilt. Both frontends are kept, their folder structure is unchanged, and existing components and hooks/services were reused where they fitted.
- Both apps talk to the same Supabase project directly through `/rest/v1`, `/auth/v1` and `/storage/v1`. No backend proxy and no endpoint rerouting were added.
- The legacy json-server prototype in `backend/` is no longer used by either app. It is kept for reference (see `backend/README.md`).
- Security is enforced in the database: Row Level Security (RLS), triggers, column privileges and storage policies. The frontend guards and filters improve the experience and add a second layer, but they are not the enforcement point.

## 2. Requirement coverage

| Requirement | Implementation | Where | Status |
|---|---|---|---|
| Customers and staff sign in and out | Supabase password sign-in; sign-out clears the local session and revokes the token | `customer-portal/src/api/auth.ts`, `support-workspace/src/app/core/services/auth.service.ts` | Implemented |
| Roles customer, agent, manager, shared by both apps | `public.users.role` is the single source; both apps read it after sign-in | `supabase/migrations/…`, both `auth` modules | Implemented |
| Customers see only their own requests | RLS `requests_select`, plus `customer_id=eq.<id>` in every customer query | migration §7, `customer-portal/src/api/requests.ts` | Implemented (SQL checks A1–A3) |
| Internal notes never visible to customers | RLS on `messages`; the customer query asks for `is_internal=eq.false`; the client filters again | migration §7, `customer-portal/src/api/messages.ts` | Implemented (checks B1, G2) |
| Security enforced server-side | RLS, triggers, column grants, storage policies | migration | Implemented |
| Invalid actions handled safely | Lifecycle and permission rules raise readable errors; the UI shows them and keeps the user's input | migration §4, both apps' error helpers | Implemented |
| Loading, empty, validation, failure and success states | Both apps show each state; forms explain problems; success banners and snackbars | all pages and components | Implemented |
| Request model (reference, description, category, urgency, status, customer, owner, activity) | `requests` (+ `messages` as activity, `updated_at`, `resolved_at`) | migration §1 | Implemented |
| Lifecycle open, in progress, waiting for customer, resolved, closed; closed may reopen | Transition table enforced by the database; reopening from resolved | migration §4, `STATUS_TRANSITIONS` in both apps | Implemented (closed is final; see §14) |
| Agents find urgent and unassigned work, claim, message, add notes, progress, complete | Work-queue views *Needs attention*, *Unassigned*, *Urgent*, *Assigned to me*; claim with a conditional update; reply and internal-note boxes; status changes | `support-workspace/src/app/features/dashboard`, `request-detail` | Implemented |
| Managers review the whole workload and reassign | Manager sees all requests; *Overview* shows counts and workload per agent; reassign from the request page | `features/manager`, `request-detail` | Implemented |
| Search, filter, sort and pagination on the server | `and=(…)`/`or=(…)` filters, `order`, `Range`, `count=exact` | `buildStaffRequestParams`, `buildCustomerRequestParams` | Implemented |
| Attachments: who uploads and views, accepted types, invalid files, protected storage | Private bucket; type and size checks in the app and in the database; authenticated download (no token in URLs) | §8 below | Implemented |
| Honest failed and optimistic updates | Status, claim and assignment only apply if the current value matches; otherwise a conflict message and a refresh. Failed sends keep the draft | `requests.service.ts`, `request-detail.component.ts`, `RequestDetailPage.tsx` | Implemented |
| Current data without duplicates | Polling (15–30 s) that merges by `id`; stale responses are ignored | §9 below | Implemented (polling, not realtime) |
| Manager summary without loading the whole dataset | Counts with `Range: 0-0` and `Prefer: count=exact`; per-agent counts | `stats.service.ts` | Implemented |
| Responsive layout | Checked at 1280 px and 390 px in both apps (screens reviewed) | CSS in components | Implemented |
| Keyboard and semantic accessibility | Real buttons and labels; tabs with arrow keys; live regions for messages and status; visible focus | `RequestList.tsx`, `MessageThread.tsx`, Angular templates | Partially (no assistive-technology audit) |
| Tests | React: 47 Vitest tests; Angular: 52 Karma specs; database: 78 SQL checks | §13 | Implemented |
| README and run instructions | Root README, per-app READMEs, `docs/SETUP.md` | docs | Implemented |
| Safe environment examples | `.env.example` files with placeholders; generated and local env files are git-ignored | both apps, `.gitignore` | Implemented |
| Test users or documented creation steps | Five demo accounts, `seed.sql`, role SQL | `docs/SETUP.md` §3 | Implemented |
| Meaningful Git history | Commits by topic: database, customer portal, workspace, documentation | git log | Implemented |

## 3. Roles

| Role | Used in | Can |
|---|---|---|
| Customer | Customer Portal | Submit requests, see only their requests, reply, reopen a resolved request, attach and download files on their requests |
| Agent | Support Workspace | See their own requests and unassigned ones, take an unassigned request, reply and add internal notes on their requests, change status, attach files |
| Manager | Support Workspace | See all requests, take or reassign any request, reply on any active request, close resolved requests, see the team overview |

Where the role comes from:
- `public.users.role` (values `customer`, `agent`, `manager`) is the only source of truth. Both apps read it after sign-in with `GET /rest/v1/users?id=eq.<id>`.
- A trigger creates the profile when an Auth user is created. It takes the role only from `app_metadata`, which the service role or the database owner sets. The `user_metadata` sent at sign-up is ignored. A test (S0) confirms this.
- Users can read their own profile and update only their display name (column grant). Staff can read profiles, which is needed for assignment and names.
- The Customer Portal refuses staff accounts, and the Support Workspace refuses customer accounts. Both messages point to the right application.

## 4. Request model

| Column | Notes |
|---|---|
| `id` | UUID, primary key |
| `reference` | Unique, `REQ-` followed by a six-digit sequence set by the database |
| `title` | 5 to 100 characters; cannot change after submission |
| `description` | 20 to 5000 characters; cannot change after submission |
| `category` | `billing`, `technical`, `account`, `general`; cannot change after submission |
| `priority` | Shown as **Urgency**: `low`, `medium`, `high`, `urgent`. Staff can change it |
| `status` | Lifecycle state (§5) |
| `customer_id` | Owner of the request (the customer); cannot change |
| `assigned_agent_id` | Current owner, empty until claimed. Cannot be cleared once set |
| `created_at`, `updated_at`, `resolved_at` | Maintained by the database. `updated_at` also changes when a message is added |
| `urgency_rank` | Generated from `priority`, used for sorting |

Messages (`messages`) are append-only. They carry the author's id, name and role, set by the database, plus `is_internal`. Attachments (`attachments`) are append-only metadata for files in the private bucket.

## 5. Lifecycle

| From | To | Who | Notes |
|---|---|---|---|
| (new) | Open | Customer creates | Unassigned |
| Open | In progress | Agent or manager | Taking the request also moves it to In progress |
| In progress | Waiting for customer | Assigned agent or manager | |
| Waiting for customer | In progress | Automatic | A customer reply moves it back, inside the same transaction as the message |
| In progress, Waiting for customer | Resolved | Assigned agent or manager | Sets `resolved_at` |
| Resolved | In progress | Customer (reopen) or assigned staff | Clears `resolved_at` |
| Resolved | Closed | Assigned agent or manager, with confirmation | Closed is final |

Other rules:
- Replies, internal notes and attachments are accepted only while the request is Open, In progress or Waiting for customer. Resolved and Closed requests are read-only until reopened.
- Status changes require an owner. An unassigned request cannot change status.
- Staff labels are *Open, In Progress, Waiting for Customer, Resolved, Closed*. Customer labels are friendlier (*Submitted, Being Handled, Awaiting Your Reply, Resolved, Closed*) for the same states.

## 6. Permission matrix

| Action | Customer (own request) | Agent (own) | Agent (unassigned) | Manager |
|---|---|---|---|---|
| See the request | Yes | Yes | Yes | Yes |
| Create a request | Yes | No | No | No |
| Read public messages | Yes | Yes | Yes | Yes |
| Read internal notes | No | Yes | No | Yes |
| Reply to the customer | Yes, if active | Yes, if active | No | Yes, if active |
| Add an internal note | No | Yes, if active | No | Yes, if active |
| Take the request | No | Not applicable | Yes (for self) | Yes |
| Change status | Only Resolved → In progress | Yes, along the table | No | Yes, along the table |
| Assign or reassign | No | No | No | Yes (to an agent or manager; never clears the owner) |
| Close a resolved request | No | Yes | No | Yes |
| Upload an attachment | Yes, if active | Yes, if active | No | Yes, if active |
| Download an attachment | Own requests | Own requests | Unassigned requests | All requests |

Attachments are visible to the customer whether the customer or staff uploaded them. This follows from the request visibility rules (see §14).

## 7. Security model

Layers, from the outside in:

1. **Authentication.** Supabase Auth issues a JWT. The anon key is public and does not grant access on its own.
2. **Row Level Security.** Policies on `users`, `requests`, `messages`, `attachments`, and on `storage.objects` for the `attachments` bucket. Anything not allowed by a policy is invisible or rejected.
3. **Triggers.** `requests_guard` enforces the lifecycle, claim and reassignment rules and keeps core fields immutable. `messages_before_insert` sets the author from the session, and `attachments_before_insert` sets the uploader and checks the file. The client cannot forge who wrote a message or uploaded a file.
4. **Column privileges.** Users can change only their display name in `users`. They cannot change their own role.
5. **Storage policies.** Upload only into a request folder the user can post to. Download only for files whose metadata the user can see. The path must start with the request id, enforced by a check constraint.
6. **Client guards and filters.** Route guards, role checks, `customer_id` filters and the client-side internal-note filter. These improve the experience and reduce load; they are not relied on.
7. **Concurrency rules.** Claim, assignment and status changes include the value the screen expects, so stale screens cannot overwrite newer changes.
8. **Errors.** Database messages that are written for users are shown as they are. Technical details are replaced with plain text. A 401 signs the user out. A 403 shows "You do not have permission" and keeps the session.

Threats addressed, each covered by a check in `supabase/tests/rls_checks.sql`:
- Reading another customer's request by URL or by query (A2, H10, H11)
- Reading internal notes as a customer (B1, G2)
- Writing an internal note as a customer (B3)
- Posting on another person's request (B4, D5, H14)
- Forging the author name or role (B7, D7)
- Granting a role through sign-up metadata (S0)
- Changing one's own role (A6)
- Agents reassigning, unassigning or taking another agent's request (D10, D11, E2, E1)
- Racing two agents for the same request (E1)
- Skipping lifecycle steps and reopening closed requests (D12, G7, G13, G15)
- Writing to closed or resolved requests (G8, G14, H15)
- Attaching metadata for a file that was not uploaded (H6), for a disallowed type (H8), or for an oversized file (H9)
- Attaching a file to someone else's folder (H2, H3)

The token is never placed in a URL. Downloads use an authenticated request and a blob. The search text is cleaned before it is placed in a filter, so user input cannot change the query structure.

## 8. Attachments

- Accepted types: `.jpg .jpeg .png .gif .webp .pdf .txt .csv .doc .docx .xls .xlsx`, with matching content types. Maximum size 10 MB. Empty files are refused.
- Checks run in the app (before upload) and in the database (type, size, path, and that the file exists). The bucket is private and has the same limits.
- Who can upload: customers on their own active requests; the assigned agent and managers on active requests.
- Who can view and download: anyone who can see the request.
- Storage path: `<request id>/<random id><extension>`. The file name typed by the user is stored separately and not used in the path.
- Upload order: file to Storage, then metadata. Metadata for a missing file is rejected.

Limitations: no malware scanning; no deletion; a file uploaded but whose metadata fails to save stays in Storage without a record (a cleanup job would be needed); no internal-only attachments yet.

## 9. Freshness and concurrency

- Customer detail page: request and conversation refresh every 15 seconds; attachments every 30 seconds. Customer lists refresh every 30 seconds.
- Staff detail page: the same 15-second refresh. The work queue and overview refresh every 30 seconds.
- Polling pauses while the browser tab is hidden.
- Responses are merged by `id`, so refreshes never duplicate a message, note or attachment. In the React app, only the newest list request can update the screen. In Angular, `switchMap` cancels older loads.
- After a message is saved, the request is reloaded, because the database may have changed its status.
- Claim, assignment and status changes use conditional updates. If the current value no longer matches, nothing changes, and the user sees a conflict message and the latest state.

## 10. Search, filters, sorting and pagination

- All of this runs on the server. The client sends `Range` and `Prefer: count=exact` and reads the total from `content-range`.
- Search matches the title or the reference, case-insensitively. Commas, parentheses, quotes, wildcards and backslashes are removed from the search text.
- Work-queue views: *Needs attention* = open or in-progress requests that are unassigned or urgent/high; *Unassigned*; *Urgent*; *Assigned to me*. Each view shows its count.
- Sorting: last updated, created, urgency (urgent first, then last updated), reference and title where offered.
- Indexes on the columns used by filters and sorts are created by the migration.
- Pages hold 5 requests (customer portal) or 10 (workspace), with 10, 25 and 50 options in the workspace.

## 11. Manager overview

- Counts for each status, unassigned, urgent and total. Each count reads only the number of matching rows.
- Workload per agent: active, waiting for customer and urgent requests.
- The overview polls every 30 seconds. A failed refresh keeps the last values and polling continues.

## 12. Accessibility and responsive layout

Implemented:
- Native buttons, links, labelled form fields and `aria-invalid`/`aria-describedby` on the composer.
- Tabs for lifecycle groups (React) and reply and internal-note boxes (Angular) with arrow-key navigation where applicable.
- `role="log"` with `aria-live="polite"` for the conversation; live regions for counts and upload status; `role="alert"` for errors.
- Visible focus styles on the main controls; icon-only buttons have accessible names.

Checked: both apps were captured at 1280 px and 390 px. The sidebar in the workspace collapses on phones. Columns that matter less are hidden on phones. Titles wrap rather than truncate.

Not done: a screen-reader or colour-contrast audit.

## 13. Testing and verification

| Check | Command or location | Result |
|---|---|---|
| Customer Portal unit tests | `npm test` in `customer-portal` (Vitest, jsdom) | 47 tests in 10 files, passing |
| Customer Portal lint and build | `npm run lint`, `npm run build` | Build passes; one existing lint warning (`useAuth` exported from a component file, unchanged from before) |
| Support Workspace specs | `npm test` in `support-workspace` (Karma, headless Chrome) | 52 specs, passing |
| Support Workspace build | `npm run build` (development build verified; production build verified in a scratch copy without the Google Fonts links, which the sandbox cannot reach) | Passing |
| Database security and workflow checks | `supabase/tests/rls_checks.sql` on PostgreSQL 17 with a local Supabase stand-in for roles, `auth` and `storage` | 78 checks, passing, rolled back |
| Migration idempotency | Migration applied twice | Passing |
| Browser checks against a local mock of the Supabase APIs | Scripted in a sandbox, not committed | 19 checks passing: sign-in, scoped lists, reopen, reply, draft handling, upload, download, claim, internal note separation, manager workload, no page errors |

What could not be verified in this environment:
- The live Supabase project (the sandbox cannot reach it). Run the migration, the seed and `rls_checks.sql` there, then test the demo steps in `docs/SETUP.md` §6.
- PostgREST itself. Its binary is not available here, so the database checks use PostgreSQL directly and the query strings were reviewed against PostgREST's filter syntax.
- Vercel deployment. Follow `docs/SETUP.md` §8.

## 14. Assumptions and open questions

These were open in the requirements. The assumption used is listed with the effect if the answer is different.

| Question | Assumption used | If the answer differs |
|---|---|---|
| Should agents see every unassigned request, or only those for their team or category? | All unassigned requests are visible to all agents, so they can claim work | Add a `team` column and narrow the `requests_select` policy |
| Can an agent reassign or hand back a request? | No. Only managers reassign. An owner cannot be cleared | Relax the rule in `requests_guard` |
| Can a customer reopen a closed request? | No. Closed is final; the customer submits a new request | Add `closed → in_progress` for customers |
| Can staff add internal notes to resolved requests? | No. Reopen first | Allow `resolved` in `can_post_to_request` |
| Should customers see the assigned agent's name? | No. They see "A support agent" | Expose a name through a view |
| Should files uploaded by staff be visible to customers? | Yes. Attachments follow the request, not the message | Add an `is_internal` flag to `attachments` and a UI toggle |
| Who creates staff accounts? | An administrator, in Supabase Auth, then the role SQL in `docs/SETUP.md` | Add an admin screen that calls the Auth admin API from a secure backend |
| Is polling acceptable, or is realtime required? | Polling (15–30 s) | Subscribe to Supabase Realtime on `messages` and `requests` |
| Session length | Supabase default (about one hour). The user signs in again | Add refresh-token renewal in both apps |
| Is email confirmation required? | Either. The Customer Portal handles both | Set it in Supabase Authentication settings |
| Is the legacy `backend/` folder still needed? | No, but it is kept | Delete it once confirmed |
| Names: "Priority" or "Urgency"? | UI says Urgency; the database column stays `priority` | Rename the label only |

## 15. Known limitations

- Sessions end when the Supabase access token expires (about one hour by default). Users sign in again; their unsent draft is lost unless it was sent.
- Live data uses polling, so changes can take up to 15–30 seconds to appear.
- A file whose metadata failed to save stays in Storage without a record. No cleanup job exists.
- No malware scanning for uploads.
- No activity log beyond `updated_at` and the messages themselves; status and assignment changes are not recorded with their author.
- No screens for creating users, changing roles or managing attachments.
- Conversations load in full; very long threads would need paging.
- Accessibility and colour contrast were not audited with assistive technology.
- The Support Workspace production build needs network access, because Angular inlines the Material fonts from Google Fonts.
- The live project must be migrated by hand. The new frontends depend on the migration.

## 16. Review guide

Read in this order:
1. `supabase/migrations/20261008000000_support_platform_schema.sql`: §4 (lifecycle rules), §7 (policies), §9 (storage).
2. `supabase/tests/rls_checks.sql`: what each check proves.
3. `customer-portal/src/api/` (`requests.ts`, `messages.ts`, `attachments.ts`, `auth.ts`) and `customer-portal/src/hooks/`.
4. `support-workspace/src/app/core/services/` (`requests.service.ts`, `auth.service.ts`, `attachments.service.ts`) and `core/interceptors/jwt.interceptor.ts`.
5. The pages: `RequestDetailPage.tsx`, `request-detail.component.ts`, `dashboard.component.ts`, `manager-dashboard.component.ts`.
