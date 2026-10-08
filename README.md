# Customer Support Operations Platform

A support platform with two browser applications that share one Supabase backend:

- **Customer Portal** (React 19 + Vite + TypeScript) for customers to submit and follow their requests.
- **Support Workspace** (Angular 18 + Angular Material) for support agents and managers.

Both apps talk to Supabase directly through its REST (`/rest/v1`), Auth (`/auth/v1`) and Storage (`/storage/v1`) APIs. Access rules live in the database (Row Level Security and triggers), so they hold even if a browser is modified.

## 🚀 Live Demo

<div align="center">

<a href="https://customer-support-operations-platfor-taupe.vercel.app/">
<img src="https://img.shields.io/badge/👤%20CUSTOMER%20PORTAL-2563EB?style=for-the-badge&logo=react&logoColor=white&labelColor=1E3A8A" alt="Customer Portal" width="320"/>
</a>

&nbsp;&nbsp;&nbsp;

<a href="https://customer-support-operations-platfor-murex.vercel.app/">
<img src="https://img.shields.io/badge/🛠️%20SUPPORT%20WORKSPACE-7C3AED?style=for-the-badge&logo=angular&logoColor=white&labelColor=4C1D95" alt="Support Workspace" width="320"/>
</a>

</div>

## Documentation

| Document | Contents |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | Supabase setup, test accounts, running locally, GitHub upload, Vercel deployment, demo walkthrough |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Roles, request lifecycle, permissions, security model, decisions, assumptions, limitations |
| [supabase/README.md](supabase/README.md) | Database migration, seed data and the security check script |
| [customer-portal/README.md](customer-portal/README.md) | React app: scripts, environment, structure |
| [support-workspace/README.md](support-workspace/README.md) | Angular app: scripts, environment, structure |

## Quick start

Requirements: Node.js 22 LTS (tested with 22.22.3, npm 10.9.8), Git, and a Supabase project.

```bash
# 1. Database: run supabase/migrations/20261008000000_support_platform_schema.sql in the Supabase SQL Editor
#    (then create the test accounts and run supabase/seed.sql; see docs/SETUP.md)

# 2. Customer Portal
cd customer-portal
cp .env.example .env.local      # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm ci
npm run dev                     # http://localhost:5173

# 3. Support Workspace (new terminal)
cd support-workspace
cp .env.example .env.local      # set NG_APP_SUPABASE_URL and NG_APP_SUPABASE_ANON_KEY
npm ci
npm start                       # http://localhost:4200
```

Test accounts (created in Supabase Authentication, password `password123`, demo only):

| Account | Role | Used in |
|---|---|---|
| alice@example.com | customer | Customer Portal |
| bob@example.com | customer | Customer Portal |
| agent1@support.com | agent (Sarah Chen) | Support Workspace |
| agent2@support.com | agent (James Wright) | Support Workspace |
| manager@support.com | manager (Maria Rodriguez) | Support Workspace |

## Checks

```bash
cd customer-portal && npm test      # Vitest: 47 tests in 10 files
cd customer-portal && npm run lint && npm run build
cd support-workspace && npm test    # Karma/Jasmine: 52 specs, headless Chrome
cd support-workspace && npm run build
```

The database checks in `supabase/tests/rls_checks.sql` (83 checks) run inside the Supabase SQL Editor after the migration and seed. See [supabase/README.md](supabase/README.md).

## Project structure

```
Customer-Support-Operations-Platform/
├── supabase/                 # Schema, RLS, workflow triggers, storage policies, seed, security checks
├── customer-portal/          # React customer app (Vite, Vitest)
├── support-workspace/        # Angular staff app (Karma/Jasmine)
├── docs/                     # Setup, architecture and review notes
└── backend/                  # Legacy json-server prototype. Not used by either app (see backend/README.md)
```

## Configuration and secrets

- Real values are never committed. `.env`, `.env.local` and the generated Angular `environment.ts` are git-ignored.
- Each app ships a `.env.example` with placeholders. The anon key is public by design. It never grants access, because Row Level Security applies to every request.
- Never put the Supabase `service_role` key in either frontend.

## Known limitations

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#known-limitations) for the full list. The most important: sessions end when the Supabase access token expires (about one hour by default) and the user signs in again; live updates use polling (every 15 to 30 seconds), not realtime; storage objects from a failed metadata save are not cleaned up automatically.
