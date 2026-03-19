const https = require('https');

// Firebase REST API
const FIREBASE_DB_URL = 'https://tprezpro-web-default-rtdb.europe-west1.firebasedatabase.app';

function firebaseRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${FIREBASE_DB_URL}${path}.json`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(body); }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

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
    const { licenseKey, machineId } = JSON.parse(event.body);

    if (!licenseKey || typeof licenseKey !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ valid: false, error: 'Cle manquante' }) };
    }

    // Lookup license in Firebase
    const license = await firebaseRequest(`/licenses/${licenseKey.toUpperCase()}`);

    if (!license || license === 'null') {
      return { statusCode: 200, headers, body: JSON.stringify({ valid: false, error: 'Cle invalide' }) };
    }

    // Check if already used (different machine)
    if (license.machineId && machineId && license.machineId !== machineId) {
      return { statusCode: 200, headers, body: JSON.stringify({ valid: false, error: 'Cle deja utilisee sur un autre appareil' }) };
    }

    // Check expiry
    if (license.activatedAt) {
      const activated = new Date(license.activatedAt);
      const now = new Date();
      const hoursElapsed = (now - activated) / (1000 * 60 * 60);
      const durationHours = license.durationHours || 24;

      if (hoursElapsed > durationHours) {
        // Mark as expired
        await firebaseRequest(`/licenses/${licenseKey.toUpperCase()}`, 'PATCH', { expired: true });
        return { statusCode: 200, headers, body: JSON.stringify({ valid: false, error: 'Cle expiree' }) };
      }

      // Still valid
      const expiresAt = new Date(activated.getTime() + durationHours * 60 * 60 * 1000);
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          valid: true,
          data: {
            plan: license.plan || 'day',
            expiresAt: expiresAt.toISOString(),
            durationHours,
            hoursLeft: Math.max(0, durationHours - hoursElapsed).toFixed(1)
          }
        })
      };
    }

    // First activation — bind to machine and start timer
    const now = new Date();
    const durationHours = license.durationHours || 24;
    const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    await firebaseRequest(`/licenses/${licenseKey.toUpperCase()}`, 'PATCH', {
      activatedAt: now.toISOString(),
      machineId: machineId || 'web-' + Date.now(),
      expired: false
    });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        valid: true,
        data: {
          plan: license.plan || 'day',
          expiresAt: expiresAt.toISOString(),
          durationHours,
          hoursLeft: durationHours
        }
      })
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ valid: false, error: 'Erreur serveur: ' + err.message }) };
  }
};
