// License admin API — the admin code lives in the ADMIN_CODE env var (Netlify),
// never in the page source. The browser no longer touches `/licenses` directly.
const crypto = require('crypto');
const { firebaseRequest } = require('../lib/firebase-rest');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
const PLANS = {
  24: { plan: 'day', label: '1 jour' },
  48: { plan: '2day', label: '2 jours' },
  72: { plan: 'multi', label: '3 jours' }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}

function isAuthorized(provided) {
  const expected = process.env.ADMIN_CODE;
  if (!expected || typeof provided !== 'string') return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function generateCode() {
  let code = 'TPRO-';
  for (let i = 0; i < 4; i++) code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  code += '-';
  for (let i = 0; i < 4; i++) code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  return code;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!process.env.ADMIN_CODE || !process.env.FIREBASE_DB_SECRET) {
    return json(500, { error: 'Serveur non configure (ADMIN_CODE / FIREBASE_DB_SECRET manquants)' });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'JSON invalide' }); }

  if (!isAuthorized(event.headers['x-admin-code'])) {
    // Slow down brute force a little
    await new Promise(r => setTimeout(r, 800));
    return json(401, { error: 'Code incorrect' });
  }

  try {
    if (payload.action === 'login') return json(200, { ok: true });

    if (payload.action === 'list') {
      const data = await firebaseRequest('/licenses');
      return json(200, { licenses: data || {} });
    }

    if (payload.action === 'generate') {
      const client = String(payload.client || '').trim().slice(0, 100);
      const email = String(payload.email || '').trim().slice(0, 200) || null;
      const durationHours = parseInt(payload.durationHours, 10);
      const count = Math.min(50, Math.max(1, parseInt(payload.count, 10) || 1));
      if (!client) return json(400, { error: 'Nom du client requis' });
      if (!PLANS[durationHours]) return json(400, { error: 'Duree invalide' });

      const codes = [];
      for (let i = 0; i < count; i++) {
        let code = generateCode();
        // Avoid collisions with existing keys
        while (await firebaseRequest(`/licenses/${code}`)) code = generateCode();
        await firebaseRequest(`/licenses/${code}`, 'PUT', {
          plan: PLANS[durationHours].plan,
          durationHours,
          createdAt: new Date().toISOString(),
          activatedAt: null,
          machineId: null,
          expired: false,
          client,
          email
        });
        codes.push(code);
      }
      return json(200, { codes });
    }

    return json(400, { error: 'Action inconnue' });
  } catch (err) {
    console.error('license-admin:', err);
    return json(500, { error: 'Erreur serveur' });
  }
};
