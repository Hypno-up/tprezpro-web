const crypto = require('crypto');

const SECRET_KEY = process.env.LICENSE_SECRET || '@Lejouroujesuisdevenumillionnaire!';

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ valid: false, error: 'Method not allowed' }) };
  }

  try {
    const { licenseKey } = JSON.parse(event.body);

    if (!licenseKey || typeof licenseKey !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ valid: false, error: 'Missing license key' }) };
    }

    const lastDash = licenseKey.lastIndexOf('-');
    if (lastDash === -1) {
      return { statusCode: 200, headers, body: JSON.stringify({ valid: false, error: 'Invalid key format' }) };
    }

    const payload = licenseKey.substring(0, lastDash);
    const signature = licenseKey.substring(lastDash + 1);

    // Verify HMAC signature
    const expectedSignature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      return { statusCode: 200, headers, body: JSON.stringify({ valid: false, error: 'Invalid signature' }) };
    }

    // Decode payload
    let data;
    try {
      data = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
    } catch {
      return { statusCode: 200, headers, body: JSON.stringify({ valid: false, error: 'Invalid payload encoding' }) };
    }

    // Check expiration
    if (data.expires && new Date(data.expires) < new Date()) {
      return { statusCode: 200, headers, body: JSON.stringify({ valid: false, error: 'License expired' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        valid: true,
        data: {
          email: data.email || data.customer || 'Unknown',
          plan: data.plan || 'pro',
          expires: data.expires || null
        }
      })
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ valid: false, error: 'Server error' }) };
  }
};
