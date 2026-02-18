// Use a same-origin Netlify Function to avoid browser CORS issues
const LISTINGS_API = '/.netlify/functions/listings';
const LISTING_BASE_URL = 'https://rentallistings.elitepropertymanagementsd.com/listings';

function formatAddress(unit) {
  const a = unit?.Address;
  if (!a) return unit?.UnitNumber ? `Unit ${unit.UnitNumber}` : 'Unknown address';
  const line1 = a.AddressLine1 || '';
  const city = a.City || '';
  const state = a.State || '';
  const zip = a.PostalCode || '';
  return [line1, [city, state].filter(Boolean).join(', '), zip].filter(Boolean).join(' ');
}

function safeText(s) {
  return (s ?? '').toString().replace(/\s+/g, ' ').trim();
}

async function loadListings() {
  const select = document.getElementById('listing');
  const help = document.getElementById('listingHelp');

  try {
    const res = await fetch(LISTINGS_API, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Listings API error: ${res.status}`);

    const listings = await res.json();
    const options = (Array.isArray(listings) ? listings : [])
      .map((x) => {
        const listingId = x?.Unit?.Id;
        if (!listingId) return null;
        const label = safeText(formatAddress(x.Unit));
        return {
          listingId: String(listingId),
          label,
          url: `${LISTING_BASE_URL}/${listingId}`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label));

    select.innerHTML = '';
    select.append(new Option('Select an address…', '', true, true));

    for (const opt of options) {
      const o = new Option(opt.label, opt.listingId, false, false);
      o.dataset.url = opt.url;
      select.append(o);
    }

    help.textContent = `Loaded ${options.length} listings.`;
  } catch (err) {
    console.error(err);
    select.innerHTML = '';
    select.append(new Option('Unable to load listings — refresh to try again', '', true, true));
    help.textContent = 'We could not load the live listing dropdown.';
  }
}

function getSelectedListingUrl() {
  const select = document.getElementById('listing');
  const selected = select.options[select.selectedIndex];
  return selected?.dataset?.url || '';
}

function formDataToObject(formData) {
  const obj = {};
  for (const [k, v] of formData.entries()) obj[k] = v.toString();
  return obj;
}

async function submitToNetlify(form) {
  // Netlify form submission (without leaving the page)
  const formData = new FormData(form);
  const body = new URLSearchParams();
  for (const [k, v] of formData.entries()) body.append(k, v.toString());

  const res = await fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  // Netlify returns 200/302/etc; we just want "not an outright failure".
  if (!res.ok) throw new Error(`Form submit failed: ${res.status}`);

  return formData;
}

function fireLeadHook(formData) {
  // Best-effort hook: does NOT block redirect.
  // Netlify env var HOOK_URL (server-side) controls whether this forwards anywhere.
  try {
    const payload = JSON.stringify(formDataToObject(formData));
    const url = '/.netlify/functions/lead-hook';

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
      return;
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch (_) {}
}

function setSubmitState(isSubmitting) {
  const btn = document.getElementById('submitBtn');
  btn.disabled = isSubmitting;
  btn.textContent = isSubmitting ? 'Submitting…' : 'Continue to Listing';
}

function setError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg || '';
}

function setAttributionFields() {
  const qs = new URLSearchParams(window.location.search);

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = (value ?? '').toString().slice(0, 500);
  };

  set('referrer', document.referrer || '');
  set('landingPage', window.location.href);
  set('utmSource', qs.get('utm_source'));
  set('utmMedium', qs.get('utm_medium'));
  set('utmCampaign', qs.get('utm_campaign'));
  set('utmTerm', qs.get('utm_term'));
  set('utmContent', qs.get('utm_content'));

  // Common click ids
  set('fbclid', qs.get('fbclid'));
  set('gclid', qs.get('gclid'));
  set('msclkid', qs.get('msclkid'));
  set('ttclid', qs.get('ttclid'));

  // Optional explicit ids you might append in ads
  set('adId', qs.get('ad_id') || qs.get('adid') || qs.get('ad'));
  set('adsetId', qs.get('adset_id') || qs.get('adsetid') || qs.get('adset'));
  set('campaignId', qs.get('campaign_id') || qs.get('campaignid') || qs.get('campaign'));

  set('submittedAt', new Date().toISOString());
}

document.addEventListener('DOMContentLoaded', async () => {
  setAttributionFields();
  await loadListings();

  const select = document.getElementById('listing');
  const listingIdInput = document.getElementById('listingId');
  const listingUrlInput = document.getElementById('listingUrl');

  const syncListingHiddenFields = () => {
    const id = select.value || '';
    const url = getSelectedListingUrl();
    listingIdInput.value = id;
    listingUrlInput.value = url;
  };

  select.addEventListener('change', syncListingHiddenFields);
  syncListingHiddenFields();

  const form = document.getElementById('leadForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError('');

    // update timestamp at submit time
    const submittedAt = document.getElementById('submittedAt');
    if (submittedAt) submittedAt.value = new Date().toISOString();

    syncListingHiddenFields();
    const listingUrl = listingUrlInput.value;
    if (!listingUrl) {
      setError('Please select an address.');
      return;
    }

    try {
      setSubmitState(true);
      const formData = await submitToNetlify(form);
      fireLeadHook(formData);
      window.location.assign(listingUrl);
    } catch (err) {
      console.error(err);
      setError('Sorry — something went wrong submitting the form. Please try again.');
      setSubmitState(false);
    }
  });
});
