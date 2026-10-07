# Customer Support Operations Platform

A shared Supabase-backed support workflow with two role-specific frontends:

- **Customer Portal** — React 19, Vite, TypeScript, and Tailwind CSS.
- **Support Workspace** — Angular 18 and Angular Material for agents and managers.

Both browser apps call the same Supabase Auth, PostgREST, and Storage services directly. Request ownership, staff roles, lifecycle transitions, internal-note visibility, and private attachments are enforced by the Supabase schema, RLS, triggers, and Storage policies—not by hiding frontend controls.

## Repository layout

```text
customer-portal/       React customer portal
support-workspace/     Angular agent/manager workspace
supabase/migrations/   Shared tables, RLS, triggers, and private Storage setup
backend/               Legacy JSON Server prototype; not used by the Supabase apps
```

## Supabase setup and local run

Prerequisites: Node.js 20.19 or later (or Node.js 22.12 or later) and npm. Use a dedicated Supabase project for this platform.

1. Create a dedicated Supabase project.
2. Apply `supabase/migrations/202610070001_support_platform.sql` from its SQL Editor after reviewing the existing project/schema and taking a backup.
3. Copy `customer-portal/.env.example` to `customer-portal/.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Copy `support-workspace/.env.example` to `support-workspace/.env` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
5. Create customer, agent, and manager Auth users. Customer registration creates a customer profile; an administrator assigns the `agent` or `manager` role in `public.profiles`.
6. Install and start each app in a separate terminal:

```bash
cd customer-portal
npm ci
npm run dev
```

```bash
cd support-workspace
npm ci
npm start
```

The React app uses port 5173 and Angular uses port 4200 by default. The frontends do not require the legacy local JSON Server. Only the public Supabase anon key belongs in browser configuration; never use a Supabase `service_role` or secret key in either frontend.

See [Supabase setup, roles, security, and workflow demo](docs/supabase-setup.md) for full setup instructions, staff-role assignment, negative security checks, test-user creation, and known limitations.

## Tests and builds

```bash
cd customer-portal
npm test
npm run build
npm run lint
```

```bash
cd support-workspace
npm run build
npm test -- --watch=false --browsers=ChromeHeadless
```

Angular's Karma test command needs ChromeHeadless installed. For environments without a browser, run `npx tsc -p tsconfig.spec.json --noEmit` from `support-workspace` as a test-source type check.
