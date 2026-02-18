// Netlify Function: proxy listings API to avoid browser CORS issues
// GET /.netlify/functions/listings

exports.handler = async function handler() {
  try {
    const upstream = 'https://rentallistings.elitepropertymanagementsd.com/api/listings';

    const res = await fetch(upstream, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'netlify-function',
      },
    });

    if (!res.ok) {
      return {
        statusCode: res.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({ error: 'Upstream error', status: res.status }),
      };
    }

    const text = await res.text();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // Cache a little to reduce upstream calls (tune as desired)
        // 10 minutes is a good balance for freshness + performance during ad traffic spikes
        'Cache-Control': 'public, max-age=600',
      },
      body: text,
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({ error: 'Function error', message: String(e) }),
    };
  }
};
