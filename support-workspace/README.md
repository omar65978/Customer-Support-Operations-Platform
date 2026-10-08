# Support Workspace (Angular)

Agents and managers work the queue: they take requests, reply, add internal notes, change status and attach files. Managers also see the team overview, and reassign requests.

## Run

```bash
cp .env.example .env.local    # NG_APP_SUPABASE_URL and NG_APP_SUPABASE_ANON_KEY
npm ci
npm start                     # http://localhost:4200
```

`npm start`, `npm run build`, `npm run watch` and `npm test` first run `scripts/generate-environment.mjs`, which writes `src/environments/environment.ts` from the settings above (or from the environment variables on Vercel). That generated file is git-ignored.

## Scripts

| Script | What it does |
|---|---|
| `npm start` | Development server |
| `npm test` | Karma/Jasmine specs (52) in headless Chrome, runs once |
| `npm run build` | Production build into `dist/support-workspace/browser` |
| `npm run watch` | Development build that rebuilds on change |

## Structure

```
src/app/
├── core/
│   ├── services/     # auth, requests (queues, claims, status), messages, attachments, stats
│   ├── guards/       # sign-in and manager guards
│   ├── interceptors/ # API key, session token, expiry handling
│   ├── models/       # types, labels, lifecycle transitions
│   └── utils/        # errors, search cleaning, attachment rules
├── features/
│   ├── auth/login/
│   ├── dashboard/                # Work queue
│   ├── requests/request-detail/  # Conversation, internal notes, actions, attachments
│   └── manager/                  # Overview and team workload
└── layout/shell/                 # Navigation and user menu
```
