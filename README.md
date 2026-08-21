# LA Jet Charter — Site & Backend

Static site (`public/`) + Netlify Functions (`netlify/functions/`) backed by Airtable, deployed on Netlify with continuous deployment from this repo's `main` branch.

## What's already done

- **GitHub**: code committed and pushed to `Jusharra/nojetlag` main branch.
- **Netlify site created**: `la-jet-charter` (site ID `121f94b5-1966-4566-9217-81424726d514`), live at `http://la-jet-charter.netlify.app` once deployed. `AIRTABLE_BASE_ID` is already set as an env var on it.
- **Airtable base** "LA Jet Charter" (`app3WA0xCNH9axTRV`) — all six tables from the build spec (Operators, Customers, Signature Route Packages, Empty Legs, Bookings, Compliance Log), formulas, and seed/placeholder records.
- **Three Airtable automations** created as drafts — open the base's Automations tab and turn each on:
  - New Booking Request Alert
  - Booking Marked Paid Alert
  - Referral Credits Owed Changed
- **Empty-leg auto-expiry** is a live formula field ("Currently Live") instead of a cron automation — Airtable's automation date filters only support fixed dates, not "now", so a formula is the reliable way to make listings disappear the instant `Expiry` passes. The site only shows legs where this is true.
- **Public site**: home, three package pages, trust/compliance, terms, privacy, multi-step quote form.
- **Admin hub** (`/admin/`): password-gated page that links straight into the Airtable base's own grid views — Phase 1 admin portal is Airtable itself, not a hand-built CRUD app (more reliable for linked records/multi-selects than reinventing that UI).
- **Netlify Functions**: `quote-request` (writes to Airtable), `site-content` (reads Packages/Empty Legs/Compliance Log for the site), `stripe-webhook` (marks a booking Paid), `admin-login` / `admin-check` / `admin-logout` (the admin password gate).

## What you still need to do

### 1. Airtable Personal Access Token
The site's functions need their own token (separate from this session's Airtable connection).
1. Airtable → your avatar → **Developer Hub** → **Personal access tokens** → **Create token**.
2. Scopes: `data.records:read`, `data.records:write`, `schema.bases:read`.
3. Access: this base only ("LA Jet Charter").
4. Copy the token — you'll paste it into Netlify as `AIRTABLE_PAT` (step 4).

### 2. Code is already on GitHub
Already done — `main` is pushed to `Jusharra/nojetlag`.

### 3. Connect the Netlify site to GitHub for continuous deployment
The Netlify site (`la-jet-charter`) is already created, but linking it to a GitHub repo requires *your* GitHub authorization click — that's not something that can be done on your behalf via API. One-time step:
1. Go to `https://app.netlify.com/projects/la-jet-charter`.
2. **Site configuration → Build & deploy → Continuous deployment → Link repository** (or **Link site to Git**).
3. Choose **GitHub → `Jusharra/nojetlag` → branch `main`**.
4. Build settings are already defined in `netlify.toml` (publish directory `public`, functions directory `netlify/functions`, no build command needed) — Netlify should pick them up automatically; leave the defaults.
5. Save. Every push to `main` will now auto-deploy.

### 4. Set environment variables in Netlify
Site configuration → Environment variables → add:

| Key | Value |
|---|---|
| `AIRTABLE_PAT` | the token from step 1 |
| `AIRTABLE_BASE_ID` | `app3WA0xCNH9axTRV` |
| `ADMIN_PASSWORD` | pick a password for `/admin/` |
| `STRIPE_SECRET_KEY` | from Stripe (test mode key to start) |
| `STRIPE_WEBHOOK_SECRET` | from the Stripe webhook you create in step 6 |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | once you're ready to wire SMS (Phase 2) |

Copy `.env.example` to `.env` locally if you want to run `netlify dev` for local testing.

### 5. Custom domain (GoDaddy → Netlify)
1. Netlify → Domain management → Add a domain → enter your domain.
2. Netlify shows you the DNS records to add (usually an A record + CNAME, or Netlify DNS nameservers).
3. In GoDaddy → your domain → DNS → add those records (or switch nameservers if Netlify recommends that route).
4. DNS propagation can take a few hours.

### 6. Stripe (Phase 1: manual payment links)
Phase 1 keeps payment collection manual, matching the spec — no checkout code is needed yet:
1. Stripe Dashboard → **Payment Links** → create one per booking (or a reusable one) for the confirmed price.
2. Append `?client_reference_id=<Airtable Booking record ID>` to the link before sending it to the customer — the webhook uses this to know which booking to mark Paid.
3. Stripe Dashboard → **Developers → Webhooks** → add endpoint `https://<your-site>/api/stripe-webhook`, listening for `checkout.session.completed`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Start in **test mode** and flip to live once you've run a real test booking end to end.

### 7. Twilio (Phase 2)
Not wired yet — Airtable's native automations only send email. Once you're ready for SMS, add a Twilio "Send SMS" step to the relevant automations (or a small Netlify Function) using the Twilio env vars above.

### 8. Legal pages
`/terms.html` and `/privacy.html` are marked as draft placeholders on the page itself — have an attorney review both before the site goes live, especially the charter-broker liability/cancellation language and CCPA obligations.

### 9. Replace placeholder data
- Operators table has one placeholder record — replace with your first verified Part 135 operator.
- Compliance Log has a placeholder CST registration number and draft disclosure text — update both once you're registered.
- Signature Route Packages has placeholder starting prices for Vegas/Cabo/Aspen — adjust to your real numbers.

## Local development
```bash
npm install
npm i -g netlify-cli   # if you don't have it
netlify dev
```
This runs the static site and functions together at `http://localhost:8888`, using your local `.env`.

## Folder structure
```
public/              the static site (Netlify's publish directory)
  packages/           Vegas / Cabo / Aspen pages
  admin/              password-gated admin hub
  css/, js/
netlify/functions/    serverless functions (Airtable + Stripe + admin auth)
netlify.toml          build + redirect config
```
