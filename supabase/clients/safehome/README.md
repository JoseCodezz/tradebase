# Safe Home Roofing — client-specific setup

Applied to the Safe Home Roofing Supabase project, which also runs safehomeroofs.com.
Run after the generic migrations in `supabase/migrations/`.

- `01_website_and_meta_intake.sql` — creates the Safe Home workspace and turns every new row in the
  website's `contact_submissions`, `quote_leads` and `meta_ad_leads` tables into a CRM lead.
  Only works because the CRM shares a database with the website.
- `02_website_images_admin_only.sql` — locks the website's media buckets to website admins.

When the CRM moves to its own project for multiple companies, replace 01 with a per-company
intake endpoint (webhook + company key) instead of database triggers.
