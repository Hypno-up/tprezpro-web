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
  try {
    const stored = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (!stored) return false;

    const { key, data } = JSON.parse(atob(stored));

    // Check expiry client-side first
    if (data.expires && new Date(data.expires) < new Date()) {
      localStorage.removeItem(LICENSE_STORAGE_KEY);
      licenseData = null;
      return false;
    }

    licenseData = { valid: true, ...data };
    return true;
  } catch {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
    licenseData = null;
    return false;
  }
}

export function clearLicense() {
  localStorage.removeItem(LICENSE_STORAGE_KEY);
  licenseData = null;
}
