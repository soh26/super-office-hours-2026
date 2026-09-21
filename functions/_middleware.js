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
    // In local development or before DB migration, check if test sponsor is requested
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
  const safeDesc = escapeHtml(sponsor.description || "Official Sponsor & Partner of Super Office Hours");
  const formattedAmount = formatYen(sponsor.amount);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeName} — Super Office Hours Sponsorship</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0a0c;
      --card-bg: #141418;
      --card-border: rgba(255, 255, 255, 0.08);
      --card-hover: rgba(255, 255, 255, 0.14);
      --accent: #2dd4bf;
      --accent-glow: rgba(45, 212, 191, 0.25);
      --purple: #a855f7;
      --purple-glow: rgba(168, 85, 247, 0.25);
      --text: #f3f4f6;
      --text-muted: rgba(255, 255, 255, 0.6);
      --text-dim: rgba(255, 255, 255, 0.4);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      line-height: 1.5;
      background-image: 
        radial-gradient(ellipse 80% 50% at 50% -20%, rgba(168, 85, 247, 0.15), transparent 70%),
        radial-gradient(ellipse 60% 40% at 50% 100%, rgba(45, 212, 191, 0.1), transparent 70%);
      background-attachment: fixed;
    }
    .header {
      padding: 1.5rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--card-border);
      backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(10, 10, 12, 0.8);
    }
    .logo {
      font-weight: 700;
      font-size: 1.15rem;
      text-decoration: none;
      color: #fff;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    .logo span { color: var(--accent); }
    .event-badge {
      font-size: 0.75rem;
      background: rgba(45, 212, 191, 0.12);
      border: 1px solid rgba(45, 212, 191, 0.3);
      color: var(--accent);
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-weight: 600;
      letter-spacing: 0.03em;
    }
    .container {
      max-width: 720px;
      margin: 3rem auto;
      padding: 0 1.5rem;
      width: 100%;
      flex: 1;
    }
    .sponsor-hero {
      text-align: center;
      margin-bottom: 2.5rem;
    }
    .sponsor-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(168, 85, 247, 0.15);
      border: 1px solid rgba(168, 85, 247, 0.35);
      color: #c084fc;
      padding: 0.35rem 1rem;
      border-radius: 9999px;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 1.25rem;
    }
    .sponsor-badge .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #c084fc;
      box-shadow: 0 0 10px #c084fc;
    }
    h1 {
      font-size: clamp(2rem, 5vw, 2.75rem);
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.15;
      margin-bottom: 0.85rem;
      color: #ffffff;
    }
    .hero-sub {
      color: var(--text-muted);
      font-size: 1.05rem;
      max-width: 540px;
      margin: 0 auto;
    }
    .alert {
      padding: 1rem 1.25rem;
      border-radius: 12px;
      margin-bottom: 2rem;
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
    .alert-success {
      background: rgba(45, 212, 191, 0.12);
      border: 1px solid rgba(45, 212, 191, 0.3);
      color: #2dd4bf;
    }
    /* Ticket Box Card */
    .ticket-box {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
      position: relative;
    }
    .ticket-box::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--accent), var(--purple));
    }
    .ticket-header {
      padding: 2rem 2.25rem 1.5rem;
      border-bottom: 1px solid var(--card-border);
    }
    .ticket-type {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
      font-weight: 700;
      margin-bottom: 0.4rem;
    }
    .ticket-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 0.5rem;
    }
    .ticket-desc {
      color: var(--text-muted);
      font-size: 0.92rem;
      line-height: 1.5;
    }
    .ticket-price-row {
      margin-top: 1.5rem;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      background: rgba(255, 255, 255, 0.03);
      padding: 1.15rem 1.5rem;
      border-radius: 12px;
      border: 1px solid var(--card-border);
    }
    .price-label {
      color: var(--text-muted);
      font-size: 0.9rem;
      font-weight: 500;
    }
    .price-val {
      font-size: 2rem;
      font-weight: 800;
      color: #fff;
      letter-spacing: -0.02em;
    }
    .price-currency {
      font-size: 0.85rem;
      color: var(--accent);
      font-weight: 600;
      margin-left: 0.3rem;
    }
    .ticket-body {
      padding: 2rem 2.25rem;
    }
    .form-group {
      margin-bottom: 1.25rem;
    }
    label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 0.5rem;
    }
    .input-field {
      width: 100%;
      padding: 0.85rem 1.15rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      color: #fff;
      font-family: inherit;
      font-size: 0.95rem;
      transition: all 0.2s ease;
    }
    .input-field:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow);
      background: rgba(255, 255, 255, 0.07);
    }
    .btn-pay {
      width: 100%;
      padding: 1.1rem;
      border-radius: 12px;
      background: var(--accent);
      color: #0a0a0c;
      font-weight: 700;
      font-size: 1.05rem;
      font-family: inherit;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s ease;
      box-shadow: 0 8px 24px -6px var(--accent-glow);
      margin-top: 1.75rem;
    }
    .btn-pay:hover:not(:disabled) {
      background: #38e6d0;
      transform: translateY(-2px);
      box-shadow: 0 12px 28px -4px var(--accent-glow);
    }
    .btn-pay:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-pay .spinner {
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
      margin-top: 1.25rem;
      font-size: 0.8rem;
      color: var(--text-dim);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
    }
    .footer {
      text-align: center;
      padding: 2.5rem 1.5rem;
      color: var(--text-dim);
      font-size: 0.85rem;
      border-top: 1px solid var(--card-border);
      margin-top: 4rem;
    }
    .paid-card {
      text-align: center;
      padding: 3.5rem 2rem;
    }
    .paid-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(45, 212, 191, 0.15);
      border: 2px solid var(--accent);
      color: var(--accent);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 0 30px var(--accent-glow);
    }
    .paid-title {
      font-size: 1.85rem;
      font-weight: 800;
      color: #fff;
      margin-bottom: 0.75rem;
    }
    .paid-desc {
      color: var(--text-muted);
      font-size: 1rem;
      max-width: 480px;
      margin: 0 auto 2rem;
      line-height: 1.6;
    }
    .paid-summary {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.5rem;
      max-width: 420px;
      margin: 0 auto 2.5rem;
      text-align: left;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      font-size: 0.9rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .summary-row:last-child { border-bottom: none; }
    .summary-label { color: var(--text-muted); }
    .summary-val { color: #fff; font-weight: 600; }
  </style>
</head>
<body>

  <header class="header">
    <a href="/" class="logo">
      TAKEOFF <span>tokyo</span>
    </a>
    <div class="event-badge">Super Office Hours · Sep 25, 2026</div>
  </header>

  <div class="container">
    <div class="sponsor-hero">
      <div class="sponsor-badge">
        <span class="dot"></span>
        Official Partner Link
      </div>
      <h1>Welcome, ${safeName}</h1>
      <p class="hero-sub">
        Thank you for partnering with Super Office Hours. Complete your sponsorship below to finalize your package and team access.
      </p>
    </div>

    ${
      isCanceledParam && !isAlreadyPaid
        ? `<div class="alert alert-warning">
             <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
             <span>Payment was canceled or not completed. You can safely try again below.</span>
           </div>`
        : ""
    }

    ${
      isAlreadyPaid
        ? `<div class="ticket-box paid-card">
             <div class="paid-icon">✓</div>
             <h2 class="paid-title">Sponsorship Confirmed!</h2>
             <p class="paid-desc">
               Your sponsorship payment for <strong>${safeName}</strong> has been successfully received. A confirmation email with details and next steps has been sent.
             </p>
             <div class="paid-summary">
               <div class="summary-row">
                 <span class="summary-label">Sponsor</span>
                 <span class="summary-val">${safeName}</span>
               </div>
               <div class="summary-row">
                 <span class="summary-label">Package</span>
                 <span class="summary-val">${safeDesc}</span>
               </div>
               <div class="summary-row">
                 <span class="summary-label">Amount Paid</span>
                 <span class="summary-val" style="color:var(--accent); font-weight:700;">${formattedAmount}</span>
               </div>
               <div class="summary-row">
                 <span class="summary-label">Status</span>
                 <span class="summary-val" style="color:#2dd4bf;">Confirmed (Paid)</span>
               </div>
             </div>
             <a href="/" style="display:inline-block;color:var(--accent);text-decoration:none;font-weight:600;font-size:0.95rem;">
               &larr; Return to Super Office Hours Home
             </a>
           </div>`
        : `<!-- Ticket Box Form -->
           <div class="ticket-box">
             <div class="ticket-header">
               <div class="ticket-type">Sponsorship Package</div>
               <div class="ticket-title">${safeName} Sponsorship Ticket</div>
               <div class="ticket-desc">${safeDesc}</div>
               <div class="ticket-price-row">
                 <span class="price-label">Predetermined Amount</span>
                 <div>
                   <span class="price-val">${formattedAmount}</span>
                   <span class="price-currency">JPY</span>
                 </div>
               </div>
             </div>

             <div class="ticket-body">
               <form id="sponsorForm">
                 <div class="form-group">
                   <label for="contactName">Contact Name</label>
                   <input type="text" id="contactName" class="input-field" placeholder="e.g. Jane Doe" required />
                 </div>
                 <div class="form-group">
                   <label for="contactEmail">Confirmation & Billing Email</label>
                   <input type="email" id="contactEmail" class="input-field" placeholder="billing@yourcompany.com" value="${escapeHtml(sponsor.contact_email || "")}" required />
                 </div>
                 <div class="form-group">
                   <label for="notes">Special Requests / Invoice Memo (Optional)</label>
                   <input type="text" id="notes" class="input-field" placeholder="Optional notes or invoice recipient name" />
                 </div>

                 <div id="errorAlert" class="alert alert-warning" style="display:none;margin-top:1rem;"></div>

                 <button type="submit" id="payBtn" class="btn-pay">
                   <span class="spinner" id="btnSpinner"></span>
                   <span id="btnText">Proceed to Stripe Checkout (${formattedAmount}) &rarr;</span>
                 </button>

                 <div class="security-note">
                   <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"></path></svg>
                   Secure 256-bit encrypted checkout powered by Stripe
                 </div>
               </form>
             </div>
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
               btnText.textContent = 'Redirecting to Stripe...';

               const name = document.getElementById('contactName').value.trim();
               const email = document.getElementById('contactEmail').value.trim();
               const notes = document.getElementById('notes').value.trim();

               try {
                 const res = await fetch('/api/create-sponsor-checkout', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({
                     slug: '${safeSlug}',
                     name,
                     email,
                     description: notes || '${safeDesc}',
                   }),
                 });

                 const data = await res.json();
                 if (!res.ok) {
                   throw new Error(data.error || 'Failed to initialize payment session.');
                 }

                 if (data.url) {
                   window.location.href = data.url;
                 } else {
                   throw new Error('No checkout URL received.');
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
  </div>

  <footer class="footer">
    <p>&copy; 2026 TAKEOFF tokyo. Super Office Hours &middot; Dragon Gate, Shibuya, Tokyo.</p>
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
  <style>
    body {
      background: #0a0a0c;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1.5rem;
      text-align: center;
    }
    .card {
      max-width: 480px;
      background: #141418;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 3rem 2rem;
    }
    h1 { font-size: 1.75rem; margin-bottom: 0.75rem; }
    p { color: rgba(255, 255, 255, 0.6); font-size: 0.95rem; line-height: 1.6; margin-bottom: 2rem; }
    a {
      display: inline-block;
      background: #2dd4bf;
      color: #0a0a0c;
      font-weight: 700;
      padding: 0.75rem 1.5rem;
      border-radius: 9999px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sponsorship Link Not Found</h1>
    <p>The custom sponsor link <code>/thanks-${escapeHtml(slug)}</code> was not found or may have expired. Please verify the URL with the Super Office Hours organizers.</p>
    <a href="/">Go to Super Office Hours Home &rarr;</a>
  </div>
</body>
</html>`;
}
