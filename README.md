# tradebase CRM

Sales pipeline + job tracker for roofing and trade companies. One app, many companies:
every company (Safe Home Roofing first) gets its own private workspace.

## What's in v1
- **Today** — follow-ups due/overdue with one-tap "done + how it went", today's appointments,
  who's behind on follow-ups (for the office to nudge), sold and collected this month.
- **Pipeline** — drag-and-drop board: New → Contacted → Appointment → Estimate sent, then
  Sold → Scheduled → In progress → Completed → Paid, plus Lost (with a reason).
- **Lead page** — contact info, stage, assigned rep, follow-up checklist, notes timeline,
  photos (before / damage / during / after), payments (cash, check, card, financing, insurance),
  crew assignment with pay owed + paid-out tracking, scope of work and "do NOT" warnings.
- **Automatic follow-ups** — a "first call" task on every new lead; follow-ups on days
  1, 3, 7, 10, 14 after an estimate is sent (editable); closed out automatically when sold/lost.
- **Team & stats** — per rep: leads, estimates, sold, close rate, revenue, collected, overdue.
  Lead source breakdown. Invite people by email with a role.
- **Roles** — Owner, Office, Sales rep, Crew. Crew only see jobs assigned to them
  (scope + photos), never payments or other leads. Enforced in the database, not just the UI.

## Safe Home Roofing setup (done)
- Database: Supabase project "Safe Home Roofing" (styzepgvdbqacojyxwil), generic migrations plus `supabase/clients/safehome/` applied.
- Every new website form (contact_submissions, quote_leads) and Meta lead (meta_ad_leads) becomes a CRM lead
  automatically, with a first-call follow-up. 92 past website leads were imported with their original dates.
- Owner account: jpguaman2024@gmail.com (sign in with the same password as the website admin).
- .env already points at the Safe Home project (publishable key only; never put the service_role key here).

## Deploy to Cloudflare Pages (no GitHub needed)
1. Cloudflare dashboard → Workers & Pages → Create → Pages → **Upload assets**.
2. Name it `safehome-crm`, then drag in the contents of `tradebase-dist.zip` (or run `npm run build` and upload `dist/`).
3. Optional: Custom domains → add `crm.safehomeroofs.com`.
4. Supabase → Authentication → URL Configuration: add the Pages URL (and crm.safehomeroofs.com) to Redirect URLs.
5. Supabase → Authentication → Providers → Email: turn off "Confirm email" if you want teammates to sign in right away.

## Run it locally
```bash
npm install
npm run dev          # no .env → demo mode with sample data
```

## Go live (about 15 minutes)
1. **Supabase project.** Your free plan allows 2 active projects and both slots are used.
   Pause one you don't need (Supabase dashboard → project → Settings → Pause), or upgrade,
   then create a project named `tradebase-crm`.
2. **Database.** In the new project open SQL Editor and run, in order:
   every file in `supabase/migrations/` in order.
3. **Keys.** Copy `.env.example` to `.env` and fill in the project URL and the
   publishable/anon key (Project Settings → API).
4. **Deploy to Cloudflare Pages.** Push this folder to GitHub, create a Pages project from it,
   build command `npm run build`, output folder `dist`, and add the two `VITE_` variables
   under Settings → Environment variables.
5. **First login.** Open the site, create your account, and create "Safe Home Roofing".
   Then go to Team & stats → Invite and add Barion, Logan, the office, and crews by email.
   They sign up with that email and land straight in the company.

Tip: in Supabase → Authentication → Providers → Email, you can turn off "Confirm email"
so new teammates can sign in immediately.

## Adding another company later
Nothing to rebuild. The owner of the new company signs up and clicks "Create company".
Their data is fully separated from Safe Home's by row-level security.

## Next up (not built yet)
- Website form → lead created automatically + text alert to the assigned rep
- Text/email reminders when follow-ups are due
- Per-company branding colors and logo
- Hide job prices from crew at the database level (today they're hidden in the app only)
