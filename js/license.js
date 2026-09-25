// License management for web
const LICENSE_STORAGE_KEY = 'timer-pro-license';
const DEMO_MAX_SECONDS = 300; // 5 minutes max in demo mode

let licenseData = null;

export function isLicensed() {
  return licenseData !== null && licenseData.valid === true;
}

export function getDemoMaxSeconds() {
  return DEMO_MAX_SECONDS;
}

export function getLicenseData() {
  return licenseData;
}

export async function validateLicense(key) {
  try {
    const response = await fetch('/.netlify/functions/validate-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: key })
    });
    const result = await response.json();

    if (result.valid) {
      licenseData = { valid: true, ...result.data };
      localStorage.setItem(LICENSE_STORAGE_KEY, btoa(JSON.stringify({ key, data: result.data })));
    }
    return result;
  } catch (err) {
    return { valid: false, error: 'Network error' };
  }
}

export async function loadStoredLicense() {
  let stored;
  try {
    stored = JSON.parse(atob(localStorage.getItem(LICENSE_STORAGE_KEY) || ''));
  } catch {
    clearLicense();
    return false;
  }
  if (!stored || !stored.key) {
    clearLicense();
    return false;
  }

  // Re-check with the server: the stored blob is only a cache, anyone can edit localStorage.
  const result = await validateLicense(stored.key);
  if (result.valid) return true;

  if (result.error === 'Network error' || result.error === 'Erreur serveur') {
    // Offline or server hiccup: fall back to the cached expiry so a paid user isn't locked out mid-event.
    const expires = stored.data && (stored.data.expiresAt || stored.data.expires);
    const stillValid = stored.data && (stored.data.unlimited || (expires && new Date(expires) > new Date()));
    if (stillValid) {
      licenseData = { valid: true, ...stored.data };
      return true;
    }
  }

  clearLicense();
  return false;
}

export function clearLicense() {
  localStorage.removeItem(LICENSE_STORAGE_KEY);
  licenseData = null;
}
