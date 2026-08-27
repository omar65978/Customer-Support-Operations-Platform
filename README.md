# Customer Support Operations Platform

A full-stack customer support platform with two connected frontend applications backed by a shared REST API.

## Applications

| App | Technology | Port | Purpose |
|---|---|---|---|
| **Backend** | JSON Server + json-server-auth | 3001 | Shared REST API with JWT auth + CORS |
| **Customer Portal** | React 19 + Vite + TypeScript + Tailwind CSS | 5173 | Customer-facing support portal |
| **Support Workspace** | Angular 18 + Angular Material | 4200 | Agent and Manager workspace |

---

## Project Structure

```
support-platform/
├── backend/           # json-server + json-server-auth (port 3001)
├── customer-portal/   # React 19 + Vite + TypeScript (port 5173)
└── support-workspace/ # Angular 18 + Angular Material (port 4200)
```

---

## Prerequisites

- Node.js 18+
- npm 9+

---

## Running the Project

Start **all three** services — each in a separate terminal.

### 1. Backend

```bash
cd backend
npm install
npm start
```

Runs on **http://localhost:3001**

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

---

## Test Accounts

All accounts use password: `password123`

| Email | Name | Role |
|-------|------|------|
| alice@example.com | Alice Johnson | Customer |
| bob@example.com | Bob Martinez | Customer |
| agent1@support.com | Sarah Chen | Agent |
| agent2@support.com | James Wright | Agent |
| manager@support.com | Maria Rodriguez | Manager |

---

## Running Tests

```bash
# React tests (Vitest)
cd customer-portal
npm test

# Angular tests (Karma/Jasmine)
cd support-workspace
npm test

# Production builds
cd customer-portal && npm run build
cd support-workspace && npm run build
```

## Test Results

- React (Vitest): **17/17 tests passed**
- Angular (Karma/Jasmine): **25/25 tests passed**
- Both production builds: **clean, zero errors**

---

## Features

### Customer Portal (React)
- JWT authentication via json-server-auth
- Server-side paginated request list with filters
- Customers see only their own requests
- Reply to open requests
- Internal agent notes are never exposed to customers
- File attachments with type/size validation

### Support Workspace (Angular)
- JWT authentication with role-based routing
- Agent view: only assigned requests visible
- Manager view: all requests across all agents
- Server-side search, filter, sort, pagination
- Status transitions with validation
- Agent assignment and reassignment
- Internal notes (hidden from customers)
- File upload and download

### Backend Security
- All routes require valid JWT
- Customers: read/write own requests and messages only
- Agents: read/write only their assigned requests
- Managers: unrestricted access
- Internal messages never returned to customers
- Cross-user URL manipulation returns 403
- Attachment download requires request ownership
