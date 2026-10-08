# Setup guide

This guide covers the Supabase project, the test accounts, running both apps on your computer, uploading the project to GitHub, and deploying both apps to Vercel.

## 1. What you need

- Node.js 22 LTS (tested with 22.22.3) and npm 10 (tested with 10.9.8)
- Git
- A Supabase project (free tier is enough). Its URL and anon key are under **Project Settings > API**.
- For the Support Workspace tests: Google Chrome or Chromium. Karma runs the tests in headless Chrome.

## 2. Create the database

1. Open your Supabase project, then **SQL Editor > New query**.
2. Paste the contents of `supabase/migrations/20261008000000_support_platform_schema.sql` and run it.
   - It creates the tables (`users`, `requests`, `messages`, `attachments`), the workflow triggers, Row Level Security policies, and the private `attachments` storage bucket.
   - It can be run again safely.
   - It replaces any policies already present on those four tables. If your project already has tables with these names and different column types, the script will stop with an error. Review the error before retrying; do not drop tables you need.
3. Optional but recommended: **Authentication > Providers > Email**. For a quick local demo, turn off "Confirm email". With it on, new customers must click a confirmation link before they can sign in. The Customer Portal handles both cases.
4. **Authentication > URL Configuration**: set *Site URL* to the Customer Portal address (`http://localhost:5173` while developing; the Vercel address in production). Confirmation links use this address.

## 3. Create the test accounts

The migration creates a `public.users` profile automatically for every new Auth user. The role is set from `app_metadata` only. Anything sent in sign-up metadata is ignored, so a browser cannot make itself staff.

1. **Authentication > Users > Add user > Create new user**. Create these five accounts with password `password123`, and tick the option that confirms the email automatically (*Auto Confirm User*):

   | Email | Intended role | Display name |
   |---|---|---|
   | alice@example.com | customer | Alice Johnson |
   | bob@example.com | customer | Bob Martinez |
   | agent1@support.com | agent | Sarah Chen |
   | agent2@support.com | agent | James Wright |
   | manager@support.com | manager | Maria Rodriguez |

2. **SQL Editor**: run `supabase/seed.sql`. It sets the staff roles and display names above and adds six demo requests, with messages, an internal note, and one unassigned request. If the accounts do not exist yet, it only prints a notice, so you can run it again later.

These passwords are for demonstration only. Change them or delete the accounts before real use.

**Creating your own staff accounts:** create the Auth user as above, then run this in the SQL Editor (it bypasses row security, which is what you want for administration):

```sql
update public.users set role = 'agent', name = 'Full Name' where email = 'person@company.com';
-- or 'manager'
```

Customers never need this step.

## 4. Run the security checks (optional)

Run `supabase/tests/rls_checks.sql` in the SQL Editor after the seed. It wraps all checks in a transaction that rolls back, so no data changes. A passing run prints 83 `PASS` notices. The script stops with an error naming the first failed check.

## 5. Run both apps on your computer

Get the code first (see section 7 for GitHub). Then:

**Customer Portal (React)**

```bash
cd customer-portal
cp .env.example .env.local
# Edit .env.local:
#   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon public key>
npm ci
npm run dev          # http://localhost:5173
```

**Support Workspace (Angular)**

```bash
cd support-workspace
cp .env.example .env.local
# Edit .env.local:
#   NG_APP_SUPABASE_URL=https://<your-project-ref>.supabase.co
#   NG_APP_SUPABASE_ANON_KEY=<anon public key>
npm ci
npm start            # http://localhost:4200 (also generates src/environments/environment.ts)
```

Use the **anon public** key only. Do not use the `service_role` key anywhere in these projects.

Tests and checks:

```bash
cd customer-portal && npm test && npm run lint && npm run build
cd support-workspace && npm test && npm run build
```

Notes:
- `npm test` in the Support Workspace runs once, in headless Chrome. If Chrome is not found, set `CHROME_BIN` to its path. In restricted containers, set `KARMA_CHROME_EXTRA_FLAGS="--no-zygote --single-process"`.
- The unit tests do not call Supabase, so `npm test` works without `.env.local`.
- `npm run build` in the Support Workspace needs network access, because Angular inlines the Google Fonts used by Material at build time.

## 6. Demo walkthrough

Use two browsers or a normal window plus a private window.

**Customer (Customer Portal, alice@example.com):**
1. Sign in. The list shows only Alice's three requests.
2. Use the tabs *Active / Awaiting your reply / Completed*, search, the urgency filter, and sorting.
3. Open REQ-000101 (awaiting your reply). The conversation shows public messages only. Internal notes are never shown.
4. Send a reply. It stays in the box if sending fails.
5. Attach a PDF or image, then download it.
6. Try a URL for someone else's request (for example `/requests/<id of Bob's request>`). It reports that the request was not found.

**Customer reopening (bob@example.com):** open REQ-000104 (Completed) and press *Reopen Request*.

**Agent (Support Workspace, agent1@support.com):**
1. Sign in. The work queue shows your assignments and unassigned requests. Views: *Needs attention*, *Unassigned*, *Urgent*, *Assigned to me*, with counts.
2. Open REQ-000106 or REQ-000105 (unassigned) and take it.
3. Use the *Internal note* tab to add a note, and the *Reply to customer* tab to answer. Each has its own box.
4. Change the status along the lifecycle, then upload an attachment.
5. Try to reassign or unassign a request: the agent controls are not offered, and the database refuses the change.

**Manager (manager@support.com):** open *Overview* for counts and the workload per agent. Open any request and reassign it.

**Staff account in the customer portal:** signing in as agent1 there is refused with a message that points to the Support Workspace.

## 7. Upload the project to GitHub

The repository is `https://github.com/omar65978/Customer-Support-Operations-Platform`. The working branch for this work is `arena/6d8b65ec-customer-support-operations-pl`.

**Check before pushing**

```bash
git status                      # no .env, .env.local, node_modules or dist should appear
git log --oneline -5            # the commits you expect
```

`.gitignore` already excludes local env files, `node_modules`, `dist` and the generated Angular environment file. Never commit a `.env.local` file or a `service_role` key.

**Option A: push the working branch to the existing repository (recommended)**

```bash
git push -u origin arena/6d8b65ec-customer-support-operations-pl
```

Then open a pull request into `main`, either on GitHub or with GitHub CLI:

```bash
gh pr create --base main --head arena/6d8b65ec-customer-support-operations-pl --title "Customer support platform: Supabase security, workflows and UI" --body-file docs/ARCHITECTURE.md
gh pr view --web
```

**Option B: a new repository you own**

```bash
# 1. Create an empty repository on github.com (no README, no .gitignore)
# 2. In the project folder:
git remote remove origin        # only if an origin already exists and you want a new one
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin arena/6d8b65ec-customer-support-operations-pl
git push origin arena/6d8b65ec-customer-support-operations-pl:main   # optional: make it the default branch
```

If `git` asks for credentials, sign in with GitHub CLI (`gh auth login`) or a personal access token stored in your credential manager. Do not paste tokens into files or chat.

**Using a downloaded copy:** unzip it, then `git init`, add the remote and push as in Option B. Or `git clone` the repository and check out the branch with `git checkout arena/6d8b65ec-customer-support-operations-pl`.

## 8. Deploy to Vercel

You deploy two Vercel projects from the same GitHub repository. Each has its own *Root Directory*.

**Customer Portal**

1. Vercel > **Add New > Project** > import the repository.
2. *Root Directory*: `customer-portal`. Framework: Vite (detected automatically). Build command: `npm run build`. Output directory: `dist`.
3. *Environment Variables* (Production and Preview): `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. **Deploy.**

**Support Workspace**

1. **Add New > Project** > import the same repository again.
2. *Root Directory*: `support-workspace`. Framework: Angular (detected automatically). Build command: `npm run build`. Output directory: `dist/support-workspace/browser`.
3. *Environment Variables*: `NG_APP_SUPABASE_URL` and `NG_APP_SUPABASE_ANON_KEY`. The build script writes them into the app.
4. **Deploy.**

Both projects include a `vercel.json` that rewrites routes to `index.html`, so deep links such as `/requests/...` work.

**After deploying**

- Supabase > **Authentication > URL Configuration**: set *Site URL* to the Customer Portal's Vercel address, and add both Vercel addresses under *Redirect URLs*.
- Environment variables are read at build time. After changing them, trigger a new deployment (*Deployments > Redeploy*).
- If the Customer Portal shows *Configuration required*, the environment variables are missing in that project.
- If the live project was set up before this migration, run the migration first. The new frontends rely on the `urgency_rank` column, the triggers and the policies it creates.

## 9. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| "Configuration required" in the Customer Portal | `.env.local` is missing or its values are empty. Restart `npm run dev` after editing. |
| `Missing Supabase settings` when starting the Support Workspace | Create `support-workspace/.env.local` with the `NG_APP_` values. |
| The app suddenly talks to `test-project.supabase.co` | `npm test` ran without `.env.local` and wrote placeholder values into the shared generated file. Create `.env.local` and run `npm start` again. |
| "Invalid email or password" | The account does not exist, or the password is different. Check **Authentication > Users**. |
| "Please confirm your email address first" | Confirm via the email link, or turn off *Confirm email* for the demo. |
| "This portal is for customers" / "This workspace is for support staff" | The account has the wrong role. Use the SQL in section 3 to set the role. |
| "Your session has expired" | The Supabase access token ended (about one hour by default). Sign in again. |
| Support Workspace tests fail with "No binary for ChromeHeadless" | Install Chrome or Chromium, then set `CHROME_BIN`. |
| `npm run build` in the Support Workspace fails offline | Google Fonts are inlined at build time. Build with network access. |
