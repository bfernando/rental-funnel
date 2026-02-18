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

document.addEventListener('DOMContentLoaded', async () => {
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

    syncListingHiddenFields();
    const listingUrl = listingUrlInput.value;
    if (!listingUrl) {
      setError('Please select an address.');
      return;
    }

    try {
      setSubmitState(true);
      await submitToNetlify(form);
      window.location.assign(listingUrl);
    } catch (err) {
      console.error(err);
      setError('Sorry — something went wrong submitting the form. Please try again.');
      setSubmitState(false);
    }
  });
});
