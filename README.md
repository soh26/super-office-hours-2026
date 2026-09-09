# Super Office Hours – Scaffold

Clean Astro rebuild of https://soh.takeoff-tokyo.com/

## Stack

- **Astro** – frontend
- **Cloudflare Pages** – hosting (recommended)
- **Supabase** – database / registrations (next step)
- **Stripe** – payments (next step)

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

### Ticket confirmation email

After a successful payment, the buyer is redirected back to the site with a "You're in!" popup, and `functions/api/stripe-webhook.js` sends an HTML ticket confirmation email (styled to match the site) from `tickets@takeoff-tokyo.com` via Google Workspace SMTP, using [`worker-mailer`](https://github.com/zou-yu/worker-mailer). The email is triggered by a **Stripe webhook** (`checkout.session.completed`), not by the browser landing on the success page — that way the email still sends even if the buyer closes the tab, and it can't be triggered by just guessing a URL.

Setup required (one-time, per environment):

1. **Cloudflare Pages compatibility flag** — `worker-mailer` needs Node API shims. In the Cloudflare Pages dashboard, go to **Settings → Functions → Compatibility flags** and add `nodejs_compat` for both **Production** and **Preview**. (Local dev already passes `--compatibility-flags nodejs_compat` via `npm run dev:functions`.)
2. **Google Workspace App Password** — the `tickets@takeoff-tokyo.com` account needs 2-Step Verification enabled, then generate an [App Password](https://myaccount.google.com/apppasswords) for it. Set `GMAIL_ADDRESS` and `GMAIL_APP_PASSWORD` (the app password, not the login password) as env vars/secrets — locally in `.dev.vars`, in production as Cloudflare Pages secrets.
3. **Stripe webhook** — in the Stripe Dashboard, add an endpoint pointing at `https://<your-domain>/api/stripe-webhook`, subscribed to the `checkout.session.completed` event. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

To test the webhook locally, use the [Stripe CLI](https://docs.stripe.com/stripe-cli) to forward events to your local wrangler instance (in a third terminal, alongside `npm run dev:functions`):

```bash
stripe listen --forward-to localhost:8787/api/stripe-webhook
```

`stripe listen` prints a webhook signing secret starting with `whsec_...` — use that as `STRIPE_WEBHOOK_SECRET` in `.dev.vars` while testing locally (it's different from the production endpoint's signing secret).

## Project structure

```
src/
├── components/
│   ├── Header.astro
│   ├── Hero.astro
│   ├── WhatYouGet.astro
│   ├── Story.astro
│   ├── Tickets.astro
│   ├── Footer.astro
│   └── TicketModal.astro   ← multi-step ticket flow
├── layouts/
│   └── Layout.astro
├── pages/
│   └── index.astro
└── styles/
    └── global.css

functions/
├── api/
│   ├── create-checkout.js   ← creates the Stripe Checkout session
│   └── stripe-webhook.js    ← verifies the webhook, sends the confirmation email
└── lib/
    └── email.js             ← HTML/text confirmation email template
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
  - Contact form step
  - Confirmation step, also shown automatically on redirect back from Stripe (`?paid=1`)
- Stripe Checkout + webhook-driven HTML ticket confirmation email (see above)

## Next steps (tell me which one)

1. Closer visual match + real images
2. Supabase schema + save registrations
3. Entry QR code + check-in tooling (explicitly out of scope for now)
4. Sector questionnaire (Yes/No like original)

Just say the number or describe what you want next.
