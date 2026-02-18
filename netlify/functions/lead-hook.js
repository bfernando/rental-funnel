// Netlify Function: optional lead webhook hook
// POST /.netlify/functions/lead-hook
//
// If HOOK_URL is configured in Netlify environment variables,
// this function forwards the submitted payload (JSON) to that URL.
//
// Designed to be best-effort (doesn't block user redirect).

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const hookUrl = process.env.HOOK_URL;
  if (!hookUrl) {
    // No hook configured; treat as success.
    return { statusCode: 204, body: '' };
  }

  try {
    const contentType = (event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();
    let payload;

    if (contentType.includes('application/json')) {
      payload = event.body ? JSON.parse(event.body) : {};
    } else {
      // fall back to raw body
      payload = { raw: event.body || '' };
    }

    const res = await fetch(hookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': 'netlify-function/lead-hook',
      },
      body: JSON.stringify({
        source: 'elite-rental-funnel',
        receivedAt: new Date().toISOString(),
        payload,
      }),
    });

    // Don't fail the funnel UX if hook errors; just report status.
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: res.ok, status: res.status }),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: false, error: String(e) }),
    };
  }
};
