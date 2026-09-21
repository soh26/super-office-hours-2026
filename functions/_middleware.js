import { getSponsorBySlug } from "./lib/supabase.js";
import { formatYen, escapeHtml } from "./lib/email.js";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  // Match /thanks-:slug or /thanks/:slug (excluding asset extensions like .js, .css, .png, etc.)
  const match = pathname.match(/^\/thanks-([^/?#.]+)/) || pathname.match(/^\/thanks\/([^/?#.]+)/);

  if (match) {
    const rawSlug = match[1];
    const slug = decodeURIComponent(rawSlug).toLowerCase();
    return await renderSponsorPage(context, slug, url);
  }

  return context.next();
}

async function renderSponsorPage(context, slug, url) {
  const isPaidParam = url.searchParams.get("paid") === "1";
  const isCanceledParam = url.searchParams.get("canceled") === "1";

  let sponsor = await getSponsorBySlug(context.env, slug);

  // If sponsor not in database, check for mock/fallback in development
  if (!sponsor) {
    if (context.env.DEBUG === "true" || slug.startsWith("test-")) {
      sponsor = {
        name: slug.replace(/^test-/, "").replace(/-/g, " ").toUpperCase() || "Test Sponsor",
        slug,
        amount: 100000,
        description: "Super Office Hours Partnership & Sponsorship Package",
        status: "pending",
      };
    }
  }

  if (!sponsor) {
    return new Response(renderNotFoundHtml(slug), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const isAlreadyPaid = sponsor.status === "paid" || isPaidParam;
  const safeName = escapeHtml(sponsor.name);
  const safeSlug = escapeHtml(sponsor.slug);
  const explicitPerks = Array.isArray(sponsor.metadata?.perks)
    ? sponsor.metadata.perks.map((p) => String(p || "").trim()).filter(Boolean)
    : (sponsor.description ? String(sponsor.description).split("\n").map((p) => p.trim()).filter(Boolean) : []);
  const safeDesc = escapeHtml(sponsor.description || `${safeName} Sponsorship`);
  const formattedAmount = formatYen(sponsor.amount);

  const perksHtml = explicitPerks.length > 0
    ? `<ul>${explicitPerks.map((perk) => `<li>${escapeHtml(perk)}</li>`).join("")}</ul>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeName} — Super Office Hours Sponsorship</title>
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
    rel="stylesheet"
  />
  <style>
    @font-face {
      font-family: "TT Lakes Neue Expanded";
      src: url("/fonts/TT-Lakes-Neue-Trial-Expanded-Bold.ttf") format("truetype");
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "TT Lakes Neue Expanded";
      src: url("/fonts/TT-Lakes-Neue-Trial-Expanded-Black.ttf") format("truetype");
      font-weight: 900;
      font-style: normal;
      font-display: swap;
    }

    :root {
      --bg: #0a0a0c;
      --bg-card: #1c1c22;
      --bg-card-hover: #24242c;
      --text: #ffffff;
      --text-muted: rgba(255, 255, 255, 0.6);
      --text-dim: rgba(255, 255, 255, 0.4);
      --accent: #2dd4bf;
      --accent-hover: #14b8a6;
      --accent-glow: rgba(45, 212, 191, 0.25);
      --border: rgba(255, 255, 255, 0.08);
      --radius: 12px;
      --font-sans: "Inter", system-ui, -apple-system, sans-serif;
      --font-display: "TT Lakes Neue Expanded", "Barlow Condensed", sans-serif;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--font-sans);
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(45, 212, 191, 0.08), transparent 45%),
        radial-gradient(circle at 85% 30%, rgba(168, 85, 247, 0.06), transparent 50%);
      background-attachment: fixed;
    }

    img { max-width: 100%; display: block; }
    a { color: inherit; text-decoration: none; }
    button { font-family: inherit; cursor: pointer; border: none; background: none; }

    /* Container */
    .container {
      width: 100%;
      max-width: 820px;
      margin: 0 auto;
      padding: 0 1.25rem;
    }

    /* Site Header matching Header.astro */
    .site-header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(10, 10, 12, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 68px;
      max-width: 1100px;
      margin: 0 auto;
      padding: 0 1.25rem;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .logo img {
      height: 28px;
      width: auto;
      display: block;
    }
    .header-meta {
      font-size: 0.82rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(45, 212, 191, 0.12);
      border: 1px solid rgba(45, 212, 191, 0.3);
      color: var(--accent);
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.03em;
    }

    /* Hero matching Hero.astro */
    .hero {
      padding: 3.5rem 0 2.5rem;
      text-align: center;
    }
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.9rem;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 1.5rem;
    }
    .hero-badge-logo {
      height: 14px;
      width: auto;
      display: inline-block;
      vertical-align: middle;
    }
    .hero-title {
      font-family: var(--font-display);
      font-weight: 900;
      font-stretch: 125%;
      font-size: clamp(2.2rem, 5vw, 3.2rem);
      text-transform: uppercase;
      line-height: 1.05;
      letter-spacing: -0.02em;
      margin-bottom: 0.5rem;
    }
    .hero-meta {
      color: var(--text-muted);
      font-size: 1.05rem;
      margin-bottom: 1.5rem;
    }

    /* Sponsor Welcoming Card */
    .partner-banner {
      background: linear-gradient(180deg, rgba(45, 212, 191, 0.1) 0%, rgba(28, 28, 34, 0.7) 100%);
      border: 1px solid rgba(45, 212, 191, 0.3);
      border-radius: 16px;
      padding: 1.75rem 2rem;
      text-align: center;
      margin-bottom: 2.5rem;
      box-shadow: 0 8px 30px -10px var(--accent-glow);
    }
    .partner-tag {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 0.5rem;
    }
    .partner-title {
      font-size: clamp(1.4rem, 3.5vw, 1.85rem);
      font-weight: 800;
      color: #fff;
      margin-bottom: 0.5rem;
    }
    .partner-desc {
      color: var(--text-muted);
      font-size: 0.95rem;
      max-width: 580px;
      margin: 0 auto;
      line-height: 1.6;
    }

    /* Stats strip matching main site */
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      max-width: 520px;
      margin: 0 auto 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      text-align: center;
    }
    .stat-value {
      font-family: var(--font-display);
      font-weight: 700;
      font-stretch: 125%;
      font-size: 1.6rem;
      color: #fff;
    }
    .stat-label {
      font-size: 0.85rem;
      color: var(--text-dim);
      margin-top: 0.15rem;
    }

    /* Ticket Box Card (Styled like Tickets.astro featured card) */
    .ticket-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2.25rem 2rem;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6);
      position: relative;
    }
    .ticket-card.featured {
      border-color: var(--accent);
      box-shadow: 0 0 35px -10px var(--accent-glow), 0 20px 40px -15px rgba(0, 0, 0, 0.6);
    }
    .ticket-badge {
      display: inline-block;
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
      margin-bottom: 0.5rem;
    }
    .ticket-heading {
      font-size: 1.65rem;
      font-weight: 800;
      color: #fff;
      margin-bottom: 0.5rem;
    }
    .ticket-price-strip {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid var(--border);
      padding: 1.25rem 1.5rem;
      border-radius: 10px;
      margin: 1.25rem 0 1.75rem;
    }
    .price-label {
      color: var(--text-muted);
      font-size: 0.95rem;
      font-weight: 500;
    }
    .price {
      font-family: var(--font-display);
      font-size: 2.25rem;
      font-weight: 700;
      color: #fff;
      font-stretch: 125%;
    }
    .price span {
      font-size: 1rem;
      color: var(--accent);
      font-weight: 700;
      margin-left: 0.35rem;
    }

    /* Features List */
    .ticket-card ul {
      list-style: none;
      margin-bottom: 2rem;
    }
    .ticket-card li {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      font-size: 0.92rem;
      color: var(--text-muted);
      margin-bottom: 0.6rem;
      line-height: 1.5;
    }
    .ticket-card li::before {
      content: "✓";
      color: var(--accent);
      font-weight: 800;
    }

    /* Form Fields matching TicketModal.astro */
    .form-section-title {
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-dim);
      margin-bottom: 1rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
    }
    .field-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 600px) {
      .field-row { grid-template-columns: 1fr; }
    }
    .field {
      display: flex;
      flex-direction: column;
      margin-bottom: 1rem;
      text-align: left;
    }
    .field label {
      font-size: 0.8rem;
      color: var(--text-muted);
      font-weight: 600;
      margin-bottom: 0.4rem;
    }
    .field input, .field textarea {
      padding: 0.75rem 0.95rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: rgba(10, 10, 12, 0.6);
      color: white;
      font-size: 0.95rem;
      font-family: inherit;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .field input:focus, .field textarea:focus {
      border-color: var(--accent);
      outline: none;
      box-shadow: 0 0 0 2px rgba(45, 212, 191, 0.25);
    }
    .field input::placeholder {
      color: var(--text-dim);
    }

    /* Buttons matching global.css */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.85rem 1.75rem;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 1rem;
      transition: all 0.2s ease;
    }
    .btn-primary {
      background: white;
      color: #0a0a0c;
    }
    .btn-primary:hover:not(:disabled) {
      background: #f0f0f0;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(255, 255, 255, 0.15);
    }
    .btn-accent {
      background: var(--accent);
      color: #0a0a0c;
      width: 100%;
      padding: 1.1rem;
      font-size: 1.05rem;
      box-shadow: 0 4px 20px -4px var(--accent-glow);
    }
    .btn-accent:hover:not(:disabled) {
      background: var(--accent-hover);
      transform: translateY(-2px);
      box-shadow: 0 8px 25px -2px var(--accent-glow);
    }
    .btn-accent:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-accent .spinner {
      display: none;
      width: 18px;
      height: 18px;
      border: 2px solid rgba(0,0,0,0.2);
      border-top-color: #000;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .security-note {
      text-align: center;
      margin-top: 1rem;
      font-size: 0.8rem;
      color: var(--text-dim);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
    }

    /* Alerts */
    .alert {
      padding: 0.9rem 1.25rem;
      border-radius: 10px;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.9rem;
    }
    .alert-warning {
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #fbbf24;
    }
    .alert-error {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
    }

    /* Paid State Card */
    .paid-card {
      text-align: center;
      padding: 3.5rem 2rem;
    }
    .paid-icon {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      background: rgba(45, 212, 191, 0.15);
      border: 2px solid var(--accent);
      color: var(--accent);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 2.2rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 0 30px var(--accent-glow);
    }
    .paid-title {
      font-family: var(--font-display);
      font-size: 2.2rem;
      font-weight: 900;
      color: #fff;
      margin-bottom: 0.5rem;
      font-stretch: 125%;
    }
    .paid-desc {
      color: var(--text-muted);
      font-size: 1.05rem;
      max-width: 500px;
      margin: 0 auto 2rem;
      line-height: 1.6;
    }
    .paid-summary {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      max-width: 440px;
      margin: 0 auto 2.5rem;
      text-align: left;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 0.55rem 0;
      font-size: 0.92rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .summary-row:last-child { border-bottom: none; }
    .summary-label { color: var(--text-muted); }
    .summary-val { color: #fff; font-weight: 600; }

    /* Footer matching Footer.astro */
    .site-footer {
      border-top: 1px solid var(--border);
      padding: 3rem 0;
      margin-top: 5rem;
    }
    .footer-inner {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      align-items: center;
      text-align: center;
      color: var(--text-dim);
      font-size: 0.85rem;
      max-width: 1100px;
      margin: 0 auto;
      padding: 0 1.25rem;
    }
    @media (min-width: 640px) {
      .footer-inner {
        flex-direction: row;
        justify-content: space-between;
        text-align: left;
      }
    }
    .footer-links {
      display: flex;
      gap: 1.25rem;
      flex-wrap: wrap;
    }
    .footer-links a:hover {
      color: #fff;
    }
  </style>
</head>
<body>

  <!-- Site Header with Takeoff Tokyo Logo -->
  <header class="site-header">
    <div class="header-inner">
      <a href="/" class="logo" aria-label="Takeoff Tokyo — home">
        <img
          src="/images/takeoff-tokyo-logo.png"
          alt="Takeoff Tokyo"
          width="242"
          height="80"
        />
      </a>
      <div class="header-badge">
        September 25, 2026 · Dragon Gate, Shibuya
      </div>
    </div>
  </header>

  <main class="container">
    <!-- Hero Section -->
    <section class="hero">
      <p class="hero-badge">
        By
        <img
          class="hero-badge-logo"
          src="/images/takeoff-tokyo-logo.png"
          alt="Takeoff Tokyo"
        />
        · Asia's flagship startup conference, since 2023
      </p>

      <h1 class="hero-title">SUPER OFFICE<br />HOURS</h1>

      <p class="hero-meta">
        September 25, 2026 · Dragon Gate, Shibuya, Tokyo
      </p>

      <!-- Event Key Stats Strip -->
      <div class="stats">
        <div class="stat">
          <div class="stat-value">50</div>
          <div class="stat-label">investors</div>
        </div>
        <div class="stat">
          <div class="stat-value">100</div>
          <div class="stat-label">startups</div>
        </div>
        <div class="stat">
          <div class="stat-value">400</div>
          <div class="stat-label">meetings</div>
        </div>
      </div>
    </section>

    <!-- Welcome Partner Banner -->
    <div class="partner-banner">
      <span class="partner-tag">Official Partner & Sponsor</span>
      <h2 class="partner-title">Welcome, ${safeName}</h2>
      <p class="partner-desc">
        Thank you for supporting founders and investors taking off from Tokyo. Please finalize your sponsorship contribution below to confirm your team passes and brand visibility.
      </p>
    </div>

    ${
      isCanceledParam && !isAlreadyPaid
        ? `<div class="alert alert-warning">
             <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
             <span>Payment procedure was canceled or not completed. You can safely try again below.</span>
           </div>`
        : ""
    }

    ${
      isAlreadyPaid
        ? `<div class="ticket-card featured paid-card">
             <div class="paid-icon">✓</div>
             <h2 class="paid-title">SPONSORSHIP CONFIRMED!</h2>
             <p class="paid-desc">
               Your sponsorship payment for <strong>${safeName}</strong> has been successfully received. A separate confirmation receipt and next steps have been emailed.
             </p>
             <div class="paid-summary">
               <div class="summary-row">
                 <span class="summary-label">Sponsor</span>
                 <span class="summary-val">${safeName}</span>
               </div>
               <div class="summary-row">
                 <span class="summary-label">Package Details</span>
                 <span class="summary-val">${safeDesc}</span>
               </div>
               <div class="summary-row">
                 <span class="summary-label">Amount Paid</span>
                 <span class="summary-val" style="color:var(--accent); font-weight:700;">${formattedAmount} JPY</span>
               </div>
               <div class="summary-row">
                 <span class="summary-label">Payment Status</span>
                 <span class="summary-val" style="color:#2dd4bf;">Confirmed (Paid ✓)</span>
               </div>
             </div>
             <a href="/" class="btn btn-primary">
               &larr; Return to Super Office Hours Home
             </a>
           </div>`
        : `<!-- Ticket Box Form Styled as Featured Ticket Card -->
           <div class="ticket-card featured">
             <div class="ticket-badge">Partner Package</div>
             <h2 class="ticket-heading">${safeName} Sponsorship Ticket</h2>

             <div class="ticket-price-strip">
               <span class="price-label">Predetermined Contribution</span>
               <div class="price">${formattedAmount}<span>JPY</span></div>
             </div>

             ${perksHtml}

             <form id="sponsorForm">
               <div class="form-section-title">Billing & Contact Information</div>

               <div class="field-row">
                 <div class="field">
                   <label for="contactName">Representative Name *</label>
                   <input type="text" id="contactName" placeholder="e.g. Jane Doe" required />
                 </div>
                 <div class="field">
                   <label for="contactEmail">Confirmation & Billing Email *</label>
                   <input type="email" id="contactEmail" placeholder="billing@yourcompany.com" value="${escapeHtml(sponsor.contact_email || "")}" required />
                 </div>
               </div>

               <div id="errorAlert" class="alert alert-error" style="display:none;margin-top:1rem;"></div>

               <button type="submit" id="payBtn" class="btn btn-accent" style="margin-top:1.5rem;">
                 <span class="spinner" id="btnSpinner"></span>
                 <span id="btnText">Proceed to Stripe Checkout (${formattedAmount}) &rarr;</span>
               </button>

               <div class="security-note">
                 <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"></path></svg>
                 Secured with 256-bit SSL encryption powered by Stripe
               </div>
             </form>
           </div>

           <script>
             const form = document.getElementById('sponsorForm');
             const payBtn = document.getElementById('payBtn');
             const btnSpinner = document.getElementById('btnSpinner');
             const btnText = document.getElementById('btnText');
             const errorAlert = document.getElementById('errorAlert');

             form.addEventListener('submit', async (e) => {
               e.preventDefault();
               errorAlert.style.display = 'none';
               payBtn.disabled = true;
               btnSpinner.style.display = 'inline-block';
               btnText.textContent = 'Connecting to Stripe...';

               const name = document.getElementById('contactName').value.trim();
               const email = document.getElementById('contactEmail').value.trim();

               try {
                 const res = await fetch('/api/create-sponsor-checkout', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({
                     slug: '${safeSlug}',
                     name,
                     email,
                   }),
                 });

                 const data = await res.json();
                 if (!res.ok) {
                   throw new Error(data.error || 'Failed to initialize payment session.');
                 }

                 if (data.url) {
                   window.location.href = data.url;
                 } else {
                   throw new Error('No checkout URL received from server.');
                 }
               } catch (err) {
                 errorAlert.textContent = err.message || 'An unexpected error occurred.';
                 errorAlert.style.display = 'flex';
                 payBtn.disabled = false;
                 btnSpinner.style.display = 'none';
                 btnText.textContent = 'Proceed to Stripe Checkout (${formattedAmount}) →';
               }
             });
           </script>`
    }
  </main>

  <!-- Site Footer matching Footer.astro -->
  <footer class="site-footer">
    <div class="footer-inner">
      <p>Copyright &copy; 2026. TAKEOFF tokyo. All rights reserved.</p>
      <div class="footer-links">
        <a href="https://www.takeoff-tokyo.com/terms-conditions" target="_blank">Terms &amp; Conditions</a>
        <a href="https://www.takeoff-tokyo.com/privacy-policy" target="_blank">Privacy Policy</a>
        <a href="https://www.takeoff-tokyo.com/scta" target="_blank">Commercial Disclosure</a>
      </div>
    </div>
  </footer>

</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function renderNotFoundHtml(slug) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sponsorship Link Not Found — Super Office Hours</title>
  <link rel="icon" type="image/png" href="/favicon.png" />
  <style>
    body {
      background: #0a0a0c;
      color: #f3f4f6;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1.5rem;
      text-align: center;
    }
    .card {
      max-width: 480px;
      background: #1c1c22;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 3rem 2rem;
    }
    .logo { margin-bottom: 1.5rem; display: inline-block; }
    .logo img { height: 28px; width: auto; margin: 0 auto; }
    h1 { font-size: 1.75rem; margin-bottom: 0.75rem; color: #fff; }
    p { color: rgba(255, 255, 255, 0.6); font-size: 0.95rem; line-height: 1.6; margin-bottom: 2rem; }
    a {
      display: inline-block;
      background: #2dd4bf;
      color: #0a0a0c;
      font-weight: 700;
      padding: 0.75rem 1.75rem;
      border-radius: 9999px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <a href="/" class="logo">
      <img src="/images/takeoff-tokyo-logo.png" alt="Takeoff Tokyo" />
    </a>
    <h1>Sponsorship Link Not Found</h1>
    <p>The custom sponsor link <code>/thanks-${escapeHtml(slug)}</code> was not found or may have expired. Please verify the link with the Super Office Hours team.</p>
    <a href="/">&larr; Go to Super Office Hours Home</a>
  </div>
</body>
</html>`;
}
