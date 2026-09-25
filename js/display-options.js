// Display options shared by the BackOffice (controls + preview) and the external display.
// The Electron overlay (electron-display/display.html) keeps its own copy of FONTS —
// keep both lists in sync.

export const FONTS = {
  system:            { label: 'Systeme (par defaut)', css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  'noto-sans':       { label: 'Noto Sans',       css: "'Noto Sans', sans-serif" },
  inter:             { label: 'Inter',           css: "'Inter', sans-serif" },
  montserrat:        { label: 'Montserrat',      css: "'Montserrat', sans-serif" },
  'roboto-mono':     { label: 'Roboto Mono',     css: "'Roboto Mono', monospace" },
  oswald:            { label: 'Oswald',          css: "'Oswald', sans-serif" },
  'bebas-neue':      { label: 'Bebas Neue',      css: "'Bebas Neue', sans-serif" },
  orbitron:          { label: 'Orbitron',        css: "'Orbitron', sans-serif" },
  'share-tech-mono': { label: 'Share Tech Mono (digital)', css: "'Share Tech Mono', monospace" }
};

export function fontCss(key) {
  return (FONTS[key] || FONTS.system).css;
}

// Font size slider bounds (px) and the px equivalent of the legacy S/M/L/XL presets.
export const FONT_SIZE_MIN = 32;
export const FONT_SIZE_MAX = 320;
export const SIZE_PRESETS_PX = { 'text-4xl': 48, 'text-6xl': 80, 'text-8xl': 128, 'text-9xl': 192 };

export function fontSizePx(state) {
  if (state && Number(state.fontSizePx) > 0) return Number(state.fontSizePx);
  return SIZE_PRESETS_PX[state && state.size] || SIZE_PRESETS_PX['text-6xl'];
}

// Current time as HH:MM, `nowMs` should be server-corrected.
export function formatClock(nowMs) {
  const d = new Date(nowMs);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
