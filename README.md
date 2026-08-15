# Customer Support Platform

A full-stack customer support platform consisting of:

| App | Tech | Port | Purpose |
|---|---|---|---|
| **Backend** | JSON Server + json-server-auth | 3001 | Shared REST API + JWT auth |
| **Customer Portal** | React 18 + Vite + Tailwind CSS | 5173 | Customer-facing support portal |
| **Support Workspace** | Angular 18 + Angular Material | 4200 | Agent/Manager workspace |

---

## Prerequisites

- **Node.js** v18+ (v20 LTS recommended)
- **npm** v9+

---

## Quick Start

### 1. Start the Backend (required first)

```bash
cd backend
npm install
npm start
```

The API will be available at **http://localhost:3001**

### 2. Start the React Customer Portal

Open a new terminal:

```bash
cd customer-portal
npm install
npm run dev
```

Open **http://localhost:5173**

### 3. Start the Angular Support Workspace

Open another terminal:

```bash
cd support-workspace
npm install
npm run start
```

Open **http://localhost:4200**

---

## Test Accounts

> **All accounts use password:** `password123`

| Role | Email | Access |
|---|---|---|
| Customer | alice@example.com | React portal — 3 pre-seeded requests |
| Customer | bob@example.com | React portal — 2 pre-seeded requests |
| Agent | agent1@support.com | Angular workspace — owns requests R1, R2 |
| Agent | agent2@support.com | Angular workspace — owns request R4 |
| Manager | manager@support.com | Angular workspace — full access + reassign |

---

## Shared Business Workflow Demo

1. **Login as Alice** (React portal) → see her 3 requests across different statuses
2. **Submit a new request** → appears immediately in the Angular workspace
3. **Login as agent1** (Angular workspace) → claim the new request
4. **Reply to customer** and set status to *Waiting for Customer*
5. **Login as Alice** (React portal) → see the reply and respond → status auto-returns to *In Progress*
6. **Agent resolves** the request → customer sees resolution message
7. **Login as manager** (Angular workspace) → reassign any request to another agent

---

## Architecture

```
support-platform/
├── backend/                 # JSON Server + json-server-auth
│   ├── server.js            # CORS + auth setup
│   ├── db.json              # Seed data (users, requests, messages)
│   └── package.json
│
├── customer-portal/         # React 18 + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── api/             # Axios API client modules
│   │   ├── components/      # UI + layout + request components
│   │   ├── contexts/        # AuthContext (JWT + localStorage)
│   │   ├── hooks/           # useRequests, useMessages
│   │   ├── pages/           # Login, Register, Dashboard, NewRequest, RequestDetail
│   │   ├── types/           # All TypeScript interfaces
│   │   └── utils/           # Status labels, colors
│   └── package.json
│
└── support-workspace/       # Angular 18 + TypeScript + Angular Material
    ├── src/app/
    │   ├── core/            # Models, services, guards, interceptors
    │   ├── features/        # Auth, Dashboard, Request Detail
    │   ├── layout/          # Shell with responsive sidenav
    │   └── shared/          # ConfirmDialog component
    └── package.json
```

---

## Data Model

### SupportRequest
| Field | Type | Description |
|---|---|---|
| id | string | Unique identifier |
| reference | string | Human-readable (REQ-001) |
| customerId | string | Owner customer |
| assignedAgentId | string\|null | Assigned support agent |
| title | string | Brief summary |
| description | string | Full description |
| category | billing\|technical\|account\|general | Issue category |
| priority | low\|medium\|high\|urgent | Urgency level |
| status | open\|in_progress\|waiting_for_customer\|resolved\|closed | Current state |
| createdAt | ISO datetime | Submission time |
| updatedAt | ISO datetime | Last modification |
| resolvedAt | ISO datetime\|null | Resolution time |

### Status State Machine

```
open → in_progress (agent claims)
in_progress → waiting_for_customer (agent asks for info)
in_progress → resolved (agent resolves)
waiting_for_customer → in_progress (customer replies)
waiting_for_customer → resolved (agent resolves directly)
resolved → in_progress (customer reopens)
resolved → closed (agent closes)
closed → (terminal — no further transitions)
```

---

## Security Notes

- JWT tokens stored in `localStorage` — suitable for this assignment scope
- Internal notes (`isInternal: true`) are filtered in the React app at the frontend level
- `json-server-auth` uses bcrypt for password hashing
- Route-level protection via Angular `CanActivateFn` and React `ProtectedRoute`
- Each customer can only see their own requests (filtered by `customerId`)

---

## Assumptions & Decisions

1. **JSON Server** is used as the shared backend — zero backend code, easy repeatable setup
2. **json-server-auth** (v2.1.0) provides `/register` and `/login` with bcrypt + JWT
3. Internal notes are filtered **client-side** in the React app (acceptable for assignment scope; a real deployment would add server-side filtering)
4. The Angular workspace has no registration flow — agents and managers are pre-seeded
5. No file attachments implemented (optional enhancement, out of scope)
6. Real-time updates are out of scope; pages refetch on mount/navigation
7. The `assignedAgentId` field stores the agent's ID string — in a real system this would be a foreign key resolved to a user object
8. Angular standalone components are used throughout (Angular 18 default)

---

## Known Limitations

- JSON Server does not enforce relational integrity — deleting a user would not clean up their requests
- `json-server-auth` route guards (640/660 rules) provide basic protection; a production backend would use proper middleware
- No pagination on the backend — all requests are loaded client-side and paginated in the Angular table
- Password reset flow not implemented

---

## Optional Enhancements (Not Implemented)

- Live updates (WebSocket / Server-Sent Events)
- File attachments on requests
- Manager workload summary widget
- Saved filters for agents
- Push notifications for new replies
- Customer satisfaction feedback after resolution
- Full accessibility audit (ARIA, keyboard nav)
- Deployed demo environment
