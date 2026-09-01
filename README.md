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
  - Confirmation step

## Next steps (tell me which one)

1. Closer visual match + real images
2. Supabase schema + save registrations
3. Stripe Checkout integration
4. Cloudflare Pages deployment setup
5. Sector questionnaire (Yes/No like original)
6. Email + QR confirmation flow

Just say the number or describe what you want next.
