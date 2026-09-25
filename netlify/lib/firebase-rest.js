// Firebase Realtime Database REST access for Netlify functions.
// Authenticates with FIREBASE_DB_SECRET (Firebase console > Project settings >
// Service accounts > Database secrets) so `/licenses` can be closed to the public.
const https = require('https');

const FIREBASE_DB_URL = 'https://tprezpro-web-default-rtdb.europe-west1.firebasedatabase.app';

function firebaseRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${FIREBASE_DB_URL}${path}.json`);
    const secret = process.env.FIREBASE_DB_SECRET;
    if (secret) url.searchParams.set('auth', secret);
    const body = data !== null ? JSON.stringify(data) : null;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        if (res.statusCode >= 400) {
          const msg = parsed && parsed.error ? parsed.error : `HTTP ${res.statusCode}`;
          return reject(new Error(`Firebase: ${msg}`));
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = { firebaseRequest, FIREBASE_DB_URL };
