# Customer Support Operations Platform

HEAD
A full-stack customer support platform with two connected frontend applications backed by Supabase.

### 🚀 Live Demos & Source Code

  <a href="https://customer-support-operations-platfor-taupe.vercel.app/">
    <img src="https://img.shields.io/badge/Customer%20Portal%20%28React%29-Live%20Demo-007ACC?style=for-the-badge&logo=react&logoColor=white" alt="Customer Portal Demo" width="420" />
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="./customer-portal">
    <img src="https://img.shields.io/badge/Customer%20Portal%20%28React%29-Source%20Code-24292e?style=for-the-badge&logo=github&logoColor=white" alt="Customer Portal Code" width="420" />
  </a>
  
  <br/><br/>

  <a href="https://customer-support-operations-platfor-murex.vercel.app/">
    <img src="https://img.shields.io/badge/%20Support%20Workspace%20%28Angular%29-Live%20Demo-DD0031?style=for-the-badge&logo=angular&logoColor=white" alt="Support Workspace Demo" width="420" />
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="./support-workspace">
    <img src="https://img.shields.io/badge/%20Support%20Workspace%20%28Angular%29-Source%20Code-24292e?style=for-the-badge&logo=github&logoColor=white" alt="Support Workspace Code" width="420" />
  </a>
</p>A full-stack customer support platform with two connected frontend applications backed by a shared REST API.

| App | Technology | Port | Purpose |
|---|---|---|---|
| **Backend** | JSON Server + json-server-auth | 3001 | Shared REST API with JWT auth + CORS |
| **Customer Portal** | React 19 + Vite + TypeScript + Tailwind CSS | 5173 | Customer-facing support portal |
| **Support Workspace** | Angular 18 + Angular Material | 4200 | Agent and Manager workspace |

---

## Architecture

## Project Structure
 bc5739a (fix: backend role-based security enforcement, fix manager password, assign test requests, update README)

```
support-platform/
├── backend/          # json-server + json-server-auth (port 3001)
├── customer-portal/  # React 18 + Vite + TypeScript (port 5173)
└── support-workspace/ # Angular 17 + Angular Material (port 4200)
```

## Prerequisites

- Node.js 18+
- npm 9+

## Running the Project

### 1. Backend

```bash
cd backend
npm install
npm start
```

Backend runs on **http://localhost:3001**

### 2. Customer Portal (React)

```bash
cd customer-portal
npm install
npm run dev
```

Opens at **http://localhost:5173**

### 3. Support Workspace (Angular)

```bash
cd support-workspace
npm install
npm start
```

Opens at **http://localhost:4200**

## Test Accounts (password: `password123`)

| Email | Name | Role |
|-------|------|------|
| alice@example.com | Alice Johnson | Customer |
| bob@example.com | Bob Martinez | Customer |
| agent1@support.com | Sarah Chen | Agent |
| agent2@support.com | James Wright | Agent |
| manager@support.com | Maria Rodriguez | Manager |

## Running Tests

```bash
# React tests
cd customer-portal && npm test

# Angular tests
cd support-workspace && npm test

# Production builds
cd customer-portal && npm run build
cd support-workspace && npm run build
```

## Test Results

- React (Vitest): **17/17 tests passed**
- Angular (Karma/Jasmine): **25/25 tests passed**
- Both production builds: **clean, zero errors**

## Features Implemented

### Customer Portal
- JWT authentication via json-server-auth (no Supabase)
- Server-side paginated request list (5 per page)
- Filter by status, priority, category
- Auto-assign new requests to a random available agent
- Customers can only view and reply to their own requests
- Internal agent notes are never shown to customers

### Support Workspace
- JWT authentication via json-server-auth
- Agent-scoped dashboard: agents only see their assigned requests
- Manager dashboard: sees all requests across all agents
- Assigned To column shows agent name (not ID)
- Agent name resolved in request detail view
- Filters: search, status, priority, category
- Quick filters removed
- Pagination via Angular Material paginator
- Status transitions, assignment, internal notes

### Backend Security
- Role-based access enforced at the API layer
- Agents: can only read/write their assigned requests
- Customers: can only read/write their own requests
- Managers: unrestricted access
- Cross-agent URL manipulation returns 403
- Internal messages never returned to customers
