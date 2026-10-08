# Customer Portal (React)

Customers sign in, submit requests, follow their conversation, reply, reopen resolved requests, and attach or download files.

## Run

```bash
cp .env.example .env.local    # VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm ci
npm run dev                   # http://localhost:5173
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Vitest unit tests (47 tests) |
| `npm run lint` | oxlint |
| `npm run build` | Type check and production build into `dist/` |

## Structure

```
src/
├── config/supabase.ts        # Supabase URL, anon key and the REST/Auth/Storage paths
├── api/                      # Calls to Supabase: auth, requests, messages, attachments, errors
├── contexts/AuthContext.tsx  # Session state; accepts customer accounts only
├── hooks/                    # Lists, request, conversation, attachments, polling
├── pages/                    # Login, register, dashboard, new request, request detail
└── components/               # Message thread, attachment panel, lifecycle tabs, cards
```

Configuration is read from Vite variables, so the values are never written into the source. Deployment notes are in `docs/SETUP.md` §8.
