# Customer Support Operations Platform

A full-stack customer support platform with two connected frontend applications backed by a shared REST API.

| App | Technology | Port | Purpose |
|---|---|---|---|
| **Backend** | JSON Server + json-server-auth | 3001 | Shared REST API with JWT auth |
| **Customer Portal** | React 19 + Vite + TypeScript + Tailwind CSS | 5173 | Customer-facing support portal |
| **Support Workspace** | Angular 18 + Angular Material | 4200 | Agent and Manager workspace |

---

## Architecture

```
support-platform/
├── backend/                    # JSON Server + json-server-auth
│   ├── server.js               # CORS, auth rewriter, server setup
│   ├── db.json                 # Seed data: users, requests, messages
│   └── package.json
│
├── customer-portal/            # React 19 + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── api/                # Axios API client modules
│   │   ├── components/         # Reusable UI, layout, and request components
│   │   ├── contexts/           # AuthContext — session management
│   │   ├── hooks/              # useRequests, useMessages
│   │   ├── pages/              # Login, Register, Dashboard, NewRequest, RequestDetail
│   │   ├── test/               # Vitest test suite
│   │   ├── types/              # TypeScript interfaces and types
│   │   └── utils/              # Status labels and display helpers
│   └── package.json
│
└── support-workspace/          # Angular 18 + Angular Material
    ├── src/app/
    │   ├── core/               # Models, services, guards, interceptors
    │   ├── features/           # Auth, Dashboard, Request Detail
    │   ├── layout/             # Shell with responsive sidenav
    │   └── shared/             # ConfirmDialog component
    └── package.json
```

---

## Prerequisites

- **Node.js** v18 or v20 LTS (recommended)
- **npm** v9+
- **Chrome** (required for Angular Karma tests)

---

## Installation

### 1. Backend

```bash
cd backend
npm install
```

### 2. Customer Portal (React)

```bash
cd customer-portal
npm install
```

### 3. Support Workspace (Angular)

```bash
cd support-workspace
npm install
```

---

## Running the Applications

All three services must run concurrently in separate terminals.

### Terminal 1 — Backend API

```bash
cd backend
npm start
```

API available at **http://localhost:3001**

### Terminal 2 — Customer Portal

```bash
cd customer-portal
npm run dev
```

Open **http://localhost:5173**

### Terminal 3 — Support Workspace

```bash
cd support-workspace
npm run start
```

Open **http://localhost:4200**

---

## Environment Variables

### Customer Portal

Copy `.env.example` to `.env`:

```bash
cp customer-portal/.env.example customer-portal/.env
```

| Variable | Description | Required |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | Yes |

Default value: `http://localhost:3001`

The Angular workspace reads its API URL from `src/environments/environment.ts`. No `.env` file is needed for Angular in development.

---

## Test Accounts

> All demo accounts use password: `password123`

| Role | Email | Application |
|---|---|---|
| Customer | alice@example.com | React portal — 3 pre-seeded requests |
| Customer | bob@example.com | React portal — 2 pre-seeded requests |
| Support Agent | agent1@support.com | Angular workspace |
| Support Agent | agent2@support.com | Angular workspace |
| Support Manager | manager@support.com | Angular workspace — full access |

Demo credentials are displayed on both login screens for reviewer convenience.

---

## Automated Tests

### React — Vitest + React Testing Library

```bash
cd customer-portal
npm run test
```

Test files in `src/test/`:

| File | Coverage |
|---|---|
| `AuthContext.test.tsx` | Session initialization, login, logout, corrupted localStorage |
| `ProtectedRoutes.test.tsx` | Route guards for authenticated and unauthenticated users |
| `NewRequestPage.test.tsx` | Form validation: empty fields, min-length, customer ID binding |
| `DataIsolation.test.ts` | Internal note filtering, customer-only message posting |

**Result: 16 tests, 4 suites — all pass**

### Angular — Jasmine + Karma

```bash
cd support-workspace
npm test -- --watch=false
```

Spec files:

| File | Coverage |
|---|---|
| `app.component.spec.ts` | Root component renders |
| `auth.service.spec.ts` | Login, logout, role assignment, observable emission |
| `auth.guard.spec.ts` | Guard allows authenticated users, redirects unauthenticated users |
| `requests.service.spec.ts` | CRUD operations, status transitions, assignment logic |
| `messages.service.spec.ts` | Message posting with correct isInternal flag |

**Result: 25 tests — all pass**

---

## Build Commands

### React production build

```bash
cd customer-portal
npm run build
```

### Angular production build

```bash
cd support-workspace
npm run build
```

---

## Data Model

### SupportRequest

| Field | Type | Description |
|---|---|---|
| id | string | Unique identifier |
| reference | string | Human-readable reference (REQ-001) |
| customerId | string | Owning customer ID |
| assignedAgentId | string \| null | Assigned support agent ID |
| title | string | Brief summary |
| description | string | Full description |
| category | billing \| technical \| account \| general | Issue category |
| priority | low \| medium \| high \| urgent | Urgency level |
| status | open \| in_progress \| waiting_for_customer \| resolved \| closed | Lifecycle state |
| createdAt | ISO datetime | Submission time |
| updatedAt | ISO datetime | Last modification |
| resolvedAt | ISO datetime \| null | Resolution time |

### Message

| Field | Type | Description |
|---|---|---|
| id | string | Unique identifier |
| requestId | string | Linked support request |
| authorId | string | Author's user ID |
| authorName | string | Author's display name |
| authorRole | customer \| agent \| manager | Author's role at time of writing |
| content | string | Message body |
| isInternal | boolean | True for support-team-only notes |
| createdAt | ISO datetime | Message timestamp |

### Request Lifecycle

```
open → in_progress          (agent claims request)
in_progress → waiting_for_customer   (agent requests information)
in_progress → resolved      (agent resolves)
waiting_for_customer → in_progress   (customer replies)
waiting_for_customer → resolved      (agent resolves directly)
resolved → in_progress      (customer reopens)
resolved → closed           (agent closes)
closed → (terminal state)
```

---

## Authorization Strategy

### Authentication

Both applications use the same JSON Server backend with `json-server-auth` providing `/login` and `/register` endpoints. Passwords are bcrypt-hashed. Successful login returns a JWT stored in `localStorage`.

The Angular JWT interceptor (`core/interceptors/jwt.interceptor.ts`) attaches the token to all API requests. The React axios client (`api/axios.ts`) does the same via a request interceptor.

### Route Protection

**React**: `ProtectedRoute` redirects unauthenticated users to `/login`. `PublicRoute` redirects authenticated users to `/dashboard`.

**Angular**: `authGuard` (`core/guards/auth.guard.ts`) is applied to all routes inside the shell layout, redirecting unauthenticated users to `/login`.

### Data Access Control

**Customer isolation**: The React `fetchMyRequests` function always queries `/requests?customerId={id}` using the authenticated user's ID. `RequestDetailPage` additionally checks `request.customerId !== user.id` and redirects if the IDs do not match.

**Internal notes**: The React `fetchMessages` function (`api/messages.ts`) filters `isInternal === true` messages from the API response before returning them to the UI. Customers can never post internal messages — `sendMessage` hardcodes `isInternal: false` and `authorRole: "customer"`.

**Role-based UI**: The Angular dashboard and request detail views show different actions depending on `currentUser.role`. The reassignment panel is only rendered for `manager` role users.

### Known Limitation

`json-server` does not support middleware-level row filtering. Internal note protection is enforced at the React API layer, not the database layer. A production system would enforce this in the backend with proper RLS policies.

---

## Assumptions and Decisions

1. **JSON Server** is used as the shared backend — minimal infrastructure, repeatable seed data, bcrypt authentication via `json-server-auth`
2. The Angular workspace has no self-registration flow — agents and managers are pre-seeded in `db.json`
3. JWT tokens are stored in `localStorage` — appropriate for this assignment scope
4. Real-time updates are not implemented — pages refetch data on mount and navigation
5. Pagination is implemented client-side in the Angular dashboard for the current data volume

---

## Known Limitations

- `json-server` does not enforce relational integrity
- Backend-level internal note filtering is not possible without custom middleware
- No pagination on the backend — all requests are loaded and paginated client-side
- Password reset flow is not implemented
- No file attachment support

---

## Production Considerations

- Replace `json-server` with a production backend (Node.js + PostgreSQL, or Supabase)
- Move JWT storage to `httpOnly` cookies to prevent XSS attacks
- Implement proper Row Level Security policies at the database layer
- Add refresh token rotation
- Enable HTTPS and configure CORS for production domains only
