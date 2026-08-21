# Customer Support Operations Platform

A full-stack customer support platform with two connected frontend applications backed by Supabase.

### 🚀 Live Demos & Source Code

  <a href="https://customer-support-operations-platfor-taupe.vercel.app/">
    <img src="https://img.shields.io/badge/customer--portal-Live_Demo-007ACC?style=for-the-badge&logo=react&logoColor=white" alt="Customer Portal Demo" width="300" />
  </a>
  <a href="./customer-portal">
    <img src="https://img.shields.io/badge/customer--portal-Source_Code-24292e?style=for-the-badge&logo=github&logoColor=white" alt="Customer Portal Code" width="300" />
  </a>
  
  <br/><br/>

  <a href="https://customer-support-operations-platfor-murex.vercel.app/">
    <img src="https://img.shields.io/badge/support--workspace-Live_Demo-DD0031?style=for-the-badge&logo=angular&logoColor=white" alt="Support Workspace Demo" width="300" />
  </a>
  <a href="./support-workspace">
    <img src="https://img.shields.io/badge/support--workspace-Source_Code-24292e?style=for-the-badge&logo=github&logoColor=white" alt="Support Workspace Code" width="300" />
  </a>
</p>
A full-stack customer support platform with two connected frontend applications backed by a shared REST API.

| App | Technology | Port | Purpose |
|---|---|---|---|
| **Backend** | JSON Server + json-server-auth | 3001 | Shared REST API with JWT auth + CORS |
| **Customer Portal** | React 19 + Vite + TypeScript + Tailwind CSS | 5173 | Customer-facing support portal |
| **Support Workspace** | Angular 18 + Angular Material | 4200 | Agent and Manager workspace |

---

## Architecture

```
support-platform/
├── backend/                    # JSON Server + json-server-auth
│   ├── server.js               # CORS, auth rewriter rules (640), server setup
│   ├── db.json                 # Seed data: users, requests, messages
│   └── package.json
│
├── customer-portal/            # React 19 + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── api/                # Axios client with JWT interceptor
│   │   ├── components/         # UI, layout, request, message components
│   │   ├── contexts/           # AuthContext — session management
│   │   ├── hooks/              # useRequests, useMessages
│   │   ├── pages/              # Login, Register, Dashboard, NewRequest, RequestDetail
│   │   ├── test/               # Vitest test suite (17 tests)
│   │   ├── types/              # TypeScript interfaces
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

- **Node.js** v18 or v20 LTS
- **npm** v9+
- **Chrome** (required for Angular Karma tests)

---

## Installation

```bash
cd backend && npm install
cd customer-portal && npm install
cd support-workspace && npm install
```

---

## Running the Applications

Open three separate terminals.

### Terminal 1 — Backend API

```bash
cd backend
npm start
```

API available at **http://localhost:3001**

### Terminal 2 — Customer Portal (React)

```bash
cd customer-portal
npm run dev
```

Open **http://localhost:5173**

### Terminal 3 — Support Workspace (Angular)

```bash
cd support-workspace
npm run start
```

Open **http://localhost:4200**

---

## Environment Variables

### Customer Portal

The file `customer-portal/.env` is already configured. No changes needed for local development.

```
VITE_API_URL=http://localhost:3001
```

Copy `customer-portal/.env.example` if you need to reset it.

The Angular workspace reads from `src/environments/environment.ts`. No `.env` file required.

---

## Test Accounts

All passwords: `password123`

| Role | Email | Application |
|---|---|---|
| Customer | alice@example.com | React portal — 3 pre-seeded requests |
| Customer | bob@example.com | React portal — 2 pre-seeded requests |
| Support Agent | agent1@support.com | Angular workspace |
| Support Agent | agent2@support.com | Angular workspace |
| Support Manager | manager@support.com | Angular workspace — full access |

Demo credentials are shown on both login screens.

---

## Automated Tests

### React — Vitest + React Testing Library

```bash
cd customer-portal
npm run test
```

| File | Tests |
|---|---|
| `AuthContext.test.tsx` | Session init, login, logout, localStorage restore, corrupted storage |
| `ProtectedRoutes.test.tsx` | Unauthenticated redirect, authenticated access, public route redirect |
| `NewRequestPage.test.tsx` | Form validation: empty, too-short, and valid submission |
| `DataIsolation.test.ts` | Internal note filtering, customer-only posting, auth response format |

**Result: 17 tests, 4 suites — all pass**

### Angular — Jasmine + Karma

```bash
cd support-workspace
npm test -- --watch=false
```

| File | Tests |
|---|---|
| `app.component.spec.ts` | Root component renders |
| `auth.service.spec.ts` | Login (nested response format), logout, role assignment, localStorage |
| `auth.guard.spec.ts` | Allows authenticated users, redirects unauthenticated users |
| `requests.service.spec.ts` | CRUD, status transitions, assignment logic |
| `messages.service.spec.ts` | Message posting with correct isInternal flag |

**Result: 25 tests — all pass**

---

## Build Commands

```bash
cd customer-portal && npm run build
cd support-workspace && npm run build
```

Both build cleanly with zero TypeScript errors.

---

## Authentication

Both applications use `json-server-auth` which provides `/login` and `/register` endpoints. Passwords are bcrypt-hashed. On successful login, the server returns:

```json
{
  "accessToken": "<jwt>",
  "user": { "id": "u1", "email": "...", "name": "...", "role": "customer" }
}
```

The JWT is stored in `localStorage` and attached to all subsequent API requests via an Axios interceptor (React) and an `HttpInterceptor` (Angular). A 401 response automatically clears the session and redirects to `/login`.

---

## Authorization

### Backend Protection

All `/users`, `/requests`, and `/messages` endpoints require a valid JWT (rule `640`). Unauthenticated requests receive `401 Missing authorization header`.

### Customer Data Isolation

- React `fetchMyRequests` always queries `/requests?customerId={userId}` using the authenticated user's own ID
- `RequestDetailPage` checks `request.customerId !== user.id` and redirects if the IDs do not match — preventing access via direct URL manipulation
- The customer cannot access the Angular workspace (different application, different port)

### Internal Notes

- React `fetchMessages` filters `isInternal === true` records before returning them to the UI
- React `sendMessage` hardcodes `isInternal: false` and `authorRole: "customer"` — customers cannot post internal notes

### Route Guards

- **React**: `ProtectedRoute` redirects unauthenticated users to `/login`. `PublicRoute` redirects authenticated users away from `/login`
- **Angular**: `authGuard` is applied to the shell layout, redirecting unauthenticated users to `/login`

---

## Data Model

### SupportRequest

| Field | Type |
|---|---|
| id | string |
| reference | string (REQ-001) |
| customerId | string |
| assignedAgentId | string \| null |
| title | string |
| description | string |
| category | billing \| technical \| account \| general |
| priority | low \| medium \| high \| urgent |
| status | open \| in_progress \| waiting_for_customer \| resolved \| closed |
| createdAt | ISO datetime |
| updatedAt | ISO datetime |
| resolvedAt | ISO datetime \| null |

### Message

| Field | Type |
|---|---|
| id | string |
| requestId | string |
| authorId | string |
| authorName | string |
| authorRole | customer \| agent \| manager |
| content | string |
| isInternal | boolean |
| createdAt | ISO datetime |

---

## Known Limitations

- `json-server` does not support field-level row filtering (no native RLS). Customer isolation uses `?customerId=` query params and frontend ownership checks. A production system would enforce this in the database layer.
- JWT tokens expire after 1 hour (json-server-auth default). No refresh token flow is implemented.
- No pagination at the backend — all requests are loaded and paginated client-side in the Angular dashboard.
- The Angular workspace has no self-registration — agents and managers are pre-seeded in `db.json`.

---

## Production Considerations

- Replace `json-server` with a production backend enforcing RLS policies
- Move JWT to `httpOnly` cookies to prevent XSS
- Add refresh token rotation
- Enforce HTTPS and restrict CORS to production domains only
