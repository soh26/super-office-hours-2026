# Super Office Hours – Scaffold

Clean Astro rebuild of https://soh.takeoff-tokyo.com/

## Stack

- **Astro** – frontend
- **Cloudflare Pages** – hosting & serverless functions
- **Supabase** – database / registrations & questionnaire
- **Stripe** – payments & webhooks

## Getting started

```bash
cd soh-site
npm install
npm run dev
```

Open http://localhost:4321

### Testing Stripe Checkout locally

`functions/api/create-checkout.js` is a Cloudflare Pages Function — `astro dev` doesn't serve it, so the "Buy tickets" flow needs `wrangler`:

```bash
cp .dev.vars.example .dev.vars   # fill in STRIPE_SECRET_KEY — use a TEST key (sk_test_...), never a live key
npm run build                    # builds the static site into dist/
npm run dev:functions            # serves dist/ + functions/api/* together on :8787
```

Open **http://localhost:8787** (not 4321) to test the full checkout flow, since the success/cancel redirect URLs are built from the request's own origin.

> `wrangler pages dev`'s `--proxy` flag (forwarding to a separate `astro dev` on :4321 for live-reload while serving functions on :8787) is listed as deprecated and doesn't actually forward requests in current wrangler versions — it 404s on every route except `/api/*`. Build-then-serve is the reliable option; use plain `npm run dev` for frontend-only styling work, and rebuild before re-testing checkout.

⚠️ Always double-check `.dev.vars` has a **test** Stripe secret key (`sk_test_...`) before testing — a live key (`sk_live_...`) will create real, chargeable checkout sessions even from localhost.

### Ticket confirmation email (Brevo)

After a successful payment, the buyer is redirected back to the site with a "You're in!" popup, and `functions/api/stripe-webhook.js` sends an HTML ticket confirmation email (styled to match the site) via **Brevo (formerly Sendinblue)**'s transactional email REST API. The email is triggered by a **Stripe webhook** (`checkout.session.completed`), not by the browser landing on the success page — that way the email still sends even if the buyer closes the tab, and it cannot be triggered by guessing URLs.

Setup required:

1. **Brevo Account & API Key** — Sign up for a free [Brevo account](https://www.brevo.com/) (300 free emails/day). Generate an API key under [Settings → SMTP & API](https://app.brevo.com/settings/keys/api). Add `BREVO_API_KEY` to `.dev.vars` (local) and Cloudflare Pages secrets (production).
2. **Sender Email Authentication** — In Brevo, verify your sender email or domain (`tickets@takeoff-tokyo.com` or your company domain).
3. **Stripe webhook** — In the Stripe Dashboard, add an endpoint pointing at `https://<your-domain>/api/stripe-webhook`, subscribed to the `checkout.session.completed` event. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

To test the webhook locally, use the [Stripe CLI](https://docs.stripe.com/stripe-cli) to forward events to your local wrangler instance:

```bash
stripe listen --forward-to localhost:8787/api/stripe-webhook
```

### Automated and Manual Email Tests

1. **Run automated unit tests:**
   ```bash
   npm test
   ```
   Runs unit tests verifying HTML/text email rendering, Brevo API payload dispatch, Supabase records, and Stripe webhook handling.

2. **Send a live test email via Brevo:**
   ```bash
   # Dry-run preview in terminal:
   npm run test:email -- --dry-run

   # Send a real test email using .dev.vars BREVO_API_KEY:
   npm run test:email -- your-email@example.com
   ```

3. **Test Stripe Webhook Signature & Delivery:**
   ```bash
   # Dispatch a signed test checkout.session.completed event to local server:
   npm run test:webhook
   ```

### Supabase Setup

1. In your [Supabase Dashboard](https://supabase.com/dashboard), open the **SQL Editor** and run the contents of [`supabase/schema.sql`](file:///home/tk240009/dev/random/soh/supabase/schema.sql) to create the `registrations` and `sponsors` tables, indexes, and triggers.
2. In **Project Settings → API**, copy your **Project URL** and **`service_role`** secret key.
3. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` to `.dev.vars` (locally) and to Cloudflare Pages Environment Variables (production).

### Sponsor Custom URLs & Admin Dashboard

1. Configure `SPONSOR_ADMIN_PASSWORD` in `.dev.vars` / Cloudflare Pages environment variables.
2. Open **http://localhost:8787/admin/sponsors** (or `/admin`).
3. Enter the admin password to unlock the dashboard.
4. Input the **Sponsor Name**, custom **Slug**, and predetermined **Amount (JPY)** (e.g. Acme Corp -> `/thanks-acme-corp` for ¥500,000).
5. Share the generated link `https://<domain>/thanks-{{SPONSOR_NAME}}` directly with the sponsor.
6. The sponsor page contains a custom ticket box that launches a Stripe Checkout session.
7. Upon successful payment, a **separate Sponsor Thanks Email** is sent via Brevo and the sponsor record in Supabase is updated to `paid`.

## Project structure

```
supabase/
└── schema.sql           ← PostgreSQL table schema (registrations & sponsors), indexes, triggers

src/
├── components/
│   ├── Header.astro
│   ├── Hero.astro
│   ├── WhatYouGet.astro
│   ├── Story.astro
│   ├── Tickets.astro
│   ├── Footer.astro
│   └── TicketModal.astro   ← multi-step ticket & questionnaire flow
├── layouts/
│   └── Layout.astro
├── pages/
│   ├── admin/
│   │   ├── index.astro     ← redirect to /admin/sponsors
│   │   └── sponsors.astro  ← password-locked sponsor management & link generator
│   └── index.astro
└── styles/
    └── global.css

functions/
├── _middleware.js           ← dynamic routing for /thanks-{{SPONSOR_NAME}} checkout pages
├── api/
│   ├── create-checkout.js          ← creates pending registration & Stripe Checkout session
│   ├── create-sponsor-checkout.js  ← creates Stripe Checkout session for custom sponsor packages
│   ├── stripe-webhook.js           ← verifies webhook, records paid registration/sponsor, dispatches emails
│   └── admin/
│       ├── verify.js               ← admin password verification
│       └── sponsors.js             ← sponsor link CRUD API
└── lib/
    ├── email.js             ← HTML/text confirmation email templates (attendees & sponsors)
    └── supabase.js          ← fetch-based Supabase PostgREST client
```

## Current features

- Responsive dark theme matching the original feel
- Sticky header + Buy tickets CTAs
- Hero with stats (100 / 300 / 480 / 3 yrs)
- "What you get" cards
- Story section
- Ticket pricing cards
- Multi-step TicketModal:
  - Quantity selectors for Startup / Investor
  - Optional LP Dinner (¥25,000) when Investor selected
  - Contact form + startup/investor questionnaire
  - Confirmation step, also shown automatically on redirect back from Stripe (`?paid=1`)
- Stripe Checkout + webhook-driven HTML ticket confirmation email
- **Password-locked Sponsor Management (`/admin/sponsors`)**:
  - Secure password gate
  - Custom URL generator: `https://<domain>/thanks-{{SPONSOR_NAME}}`
  - Real-time slug preview & 1-click URL copying
  - Live table of existing sponsor links with pending/paid status
- **Dynamic Sponsor Checkout Pages (`/thanks-{{SPONSOR_NAME}}`)**:
  - Edge-rendered ticket box with predetermined sponsorship amount
  - Stripe payment initiation with custom sponsor metadata
  - Duplicate payment prevention
- **Dedicated Sponsor Thanks Email**:
  - High-touch appreciation email sent via Brevo upon payment completion
  - Covers next steps for asset submission and team passes
- Supabase persistent storage for pending and paid registrations & sponsors

