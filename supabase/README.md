# Supabase database

Everything the apps need in the database lives here.

| File | Purpose | When to run |
|---|---|---|
| `migrations/20261008000000_support_platform_schema.sql` | Tables, workflow triggers, Row Level Security, storage bucket and policies | Once per project, in the SQL Editor, before using the apps. Safe to run again |
| `seed.sql` | Staff roles and names for the five demo accounts, six demo requests with messages | After creating the demo accounts (see `docs/SETUP.md` §3). Demo projects only |
| `tests/rls_checks.sql` | 83 checks that run as an authenticated user with simulated sign-in claims, then roll back | After the seed. Expect 83 `PASS` notices and no error |

Notes:
- The migration keeps the security rules in the database. The apps do not need a server of their own.
- Users cannot change their own role. Roles are changed by the database owner (SQL Editor) only.
- Storage bucket `attachments` is private. Files are downloaded through the authenticated Storage API.
- The migration removes older policies on the four tables and older policies on `storage.objects` that mention `attachments`. Check the Supabase Policies page afterwards.
