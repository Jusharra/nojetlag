// LA Jet Charter — shared front-end behavior. Runs on every page;
// each block checks for its target elements before doing anything.

document.addEventListener('DOMContentLoaded', () => {
  initNavToggle();
  initSiteContent();
  initQuoteForm();
});

function initNavToggle() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => links.classList.toggle('open'));
}

function money(n) {
  if (n === undefined || n === null) return '—';
  return '$' + Number(n).toLocaleString('en-US');
}

async function fetchSiteContent() {
  if (window.__siteContentPromise) return window.__siteContentPromise;
  window.__siteContentPromise = fetch('/api/site-content')
    .then((r) => {
      if (!r.ok) throw new Error('site-content request failed');
      return r.json();
    })
    .catch((err) => {
      console.error(err);
      return { packages: [], emptyLegs: [], disclosure: null };
    });
  return window.__siteContentPromise;
}

function initSiteContent() {
  const packagesEl = document.getElementById('packages-grid');
  const legsEl = document.getElementById('empty-legs-list');
  const disclosureEls = document.querySelectorAll('[data-disclosure-text]');
  const regNumberEls = document.querySelectorAll('[data-reg-number]');
  const packagePriceEl = document.querySelector('[data-package-price]');

  if (!packagesEl && !legsEl && !disclosureEls.length && !regNumberEls.length && !packagePriceEl) return;

  fetchSiteContent().then(({ packages, emptyLegs, disclosure }) => {
    if (packagesEl) renderPackages(packagesEl, packages);
    if (legsEl) renderEmptyLegs(legsEl, emptyLegs);
    if (disclosure) {
      disclosureEls.forEach((el) => { el.textContent = disclosure.disclosureText || ''; });
      regNumberEls.forEach((el) => { el.textContent = disclosure.regNumber || 'CST # pending'; });
    }
    if (packagePriceEl) {
      const slug = packagePriceEl.getAttribute('data-package-price');
      const pkg = packages.find((p) => p.name.toLowerCase() === slug.toLowerCase());
      if (pkg) {
        packagePriceEl.textContent = 'Starting at ' + money(pkg.startingPrice);
        const includedEl = document.querySelector('[data-package-included]');
        if (includedEl && pkg.includedItems) includedEl.textContent = pkg.includedItems;
        const disclosureSnippetEl = document.querySelector('[data-package-disclosure]');
        if (disclosureSnippetEl && pkg.disclosureSnippet) disclosureSnippetEl.textContent = pkg.disclosureSnippet;
      }
    }
  });
}

function renderPackages(container, packages) {
  if (!packages.length) {
    container.innerHTML = '<p>Packages are being updated — check back shortly.</p>';
    return;
  }
  container.innerHTML = packages
    .map(
      (p) => `
    <div class="card">
      <span class="badge">Signature Route</span>
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.route || '')}</p>
      <div class="price">Starting at ${money(p.startingPrice)}<br><small>per trip, all-in</small></div>
      <p>${escapeHtml(p.includedItems || '')}</p>
      <a class="btn btn-outline" href="/packages/${p.name.toLowerCase()}.html">View details</a>
    </div>`
    )
    .join('');
}

function renderEmptyLegs(container, legs) {
  const emptyEl = document.getElementById('empty-legs-empty');
  const loadingEl = document.getElementById('empty-legs-loading');
  if (loadingEl) loadingEl.style.display = 'none';

  if (!legs.length) {
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  container.innerHTML = legs
    .map(
      (leg) => `
    <div class="leg-row">
      <div class="route">${escapeHtml(leg.route || '')}</div>
      <div>${formatDate(leg.date)}<br><span style="color:var(--text-tertiary);font-size:0.85rem">${escapeHtml(leg.aircraft || '')}</span></div>
      <div><span class="price-old">${money(leg.retailPrice)}</span><br><span class="price-new">${money(leg.emptyLegPrice)}</span></div>
      <div class="discount">${escapeHtml(leg.discountPct || '')} off</div>
    </div>`
    )
    .join('');
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d + 'T00:00:00');
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---------------- Quote request multi-step form ---------------- */

function initQuoteForm() {
  const form = document.getElementById('quote-form');
  if (!form) return;

  const steps = Array.from(form.querySelectorAll('.form-step'));
  const progress = form.querySelectorAll('.form-progress span');
  let current = 0;

  function showStep(i) {
    steps.forEach((s, idx) => s.classList.toggle('active', idx === i));
    progress.forEach((p, idx) => p.classList.toggle('done', idx <= i));
  }

  form.querySelectorAll('[data-next]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const stepEl = steps[current];
      const inputs = stepEl.querySelectorAll('input[required], select[required]');
      for (const input of inputs) {
        if (!input.reportValidity()) return;
      }
      current = Math.min(current + 1, steps.length - 1);
      showStep(current);
    });
  });

  form.querySelectorAll('[data-prev]').forEach((btn) => {
    btn.addEventListener('click', () => {
      current = Math.max(current - 1, 0);
      showStep(current);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('[type="submit"]');
    const msgEl = document.getElementById('quote-form-msg');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    const data = Object.fromEntries(new FormData(form).entries());
    const params = new URLSearchParams(window.location.search);

    try {
      const res = await fetch('/api/quote-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: data.type || params.get('type') || 'Custom Charter',
          route: data.route,
          dates: data.dates,
          passengers: data.passengers,
          aircraftPreference: data.aircraftPreference,
          notes: data.notes,
          name: data.name,
          email: data.email,
          phone: data.phone,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Something went wrong');

      form.style.display = 'none';
      msgEl.className = 'form-msg success';
      msgEl.style.display = 'block';
      msgEl.textContent = "Request received — we'll follow up with pricing shortly. Thank you.";
    } catch (err) {
      msgEl.className = 'form-msg error';
      msgEl.style.display = 'block';
      msgEl.textContent = err.message || 'Something went wrong. Please try again or call us directly.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit request';
    }
  });

  // Preselect trip type from ?type= query param (used by package pages' CTAs)
  const params = new URLSearchParams(window.location.search);
  const typeField = form.querySelector('[name="type"]');
  if (typeField && params.get('type')) typeField.value = params.get('type');
  const routeField = form.querySelector('[name="route"]');
  if (routeField && params.get('route')) routeField.value = params.get('route');
}
