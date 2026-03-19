// Internationalization - FR/EN translations
const translations = {
  fr: {
    // Landing page
    'app-title': 'Timer Presentation Pro',
    'app-subtitle': 'Timer professionnel pour vos presentations',
    'create-room': 'Creer une salle',
    'join-room': 'Rejoindre une salle',
    'room-code-placeholder': 'Code de salle (ex: XK7M2P)',
    'join-btn': 'Rejoindre',
    'invalid-code': 'Code de salle invalide',
    'room-not-found': 'Salle introuvable',

    // BackOffice
    'quick-durations': 'Durees rapides',
    'custom-time': 'Personnalise',
    'appearance': 'Apparence',
    'display-settings': 'Affichage',
    'locked': 'Verrouille',
    'unlocked': 'Deverrouille',
    'visible': 'Visible',
    'hidden': 'Cache',
    'transparency': 'Transparence',
    'message-label': 'Message',
    'above': 'Dessus',
    'below': 'Dessous',
    'share': 'Partager',
    'display-link': 'Lien Display',
    'copy-link': 'Copier le lien',
    'show-qr': 'Afficher QR Code',
    'room-code-label': 'Code salle',
    'copied': 'Copie !',
    'shortcuts': 'Raccourcis',
    'license-label': 'Licence',
    'enter-license': 'Entrer une cle de licence',
    'activate': 'Activer',
    'demo-mode': 'Mode demo',
    'licensed': 'Licence active',
    'license-valid': 'Licence valide',
    'license-invalid': 'Cle invalide',
    'demo-limit': 'Mode demo : timer limite a 5 minutes',

    // Display
    'fullscreen-prompt': 'Cliquer pour passer en plein ecran',
    'connecting': 'Connexion...',
    'connected': 'Connecte',
    'disconnected': 'Deconnecte',
    'room-label': 'Salle'
  },
  en: {
    // Landing page
    'app-title': 'Timer Presentation Pro',
    'app-subtitle': 'Professional timer for your presentations',
    'create-room': 'Create a room',
    'join-room': 'Join a room',
    'room-code-placeholder': 'Room code (e.g. XK7M2P)',
    'join-btn': 'Join',
    'invalid-code': 'Invalid room code',
    'room-not-found': 'Room not found',

    // BackOffice
    'quick-durations': 'Quick times',
    'custom-time': 'Custom',
    'appearance': 'Appearance',
    'display-settings': 'Display',
    'locked': 'Locked',
    'unlocked': 'Unlocked',
    'visible': 'Visible',
    'hidden': 'Hidden',
    'transparency': 'Transparency',
    'message-label': 'Message',
    'above': 'Above',
    'below': 'Below',
    'share': 'Share',
    'display-link': 'Display link',
    'copy-link': 'Copy link',
    'show-qr': 'Show QR Code',
    'room-code-label': 'Room code',
    'copied': 'Copied!',
    'shortcuts': 'Shortcuts',
    'license-label': 'License',
    'enter-license': 'Enter a license key',
    'activate': 'Activate',
    'demo-mode': 'Demo mode',
    'licensed': 'Licensed',
    'license-valid': 'License valid',
    'license-invalid': 'Invalid key',
    'demo-limit': 'Demo mode: timer limited to 5 minutes',

    // Display
    'fullscreen-prompt': 'Click to enter fullscreen',
    'connecting': 'Connecting...',
    'connected': 'Connected',
    'disconnected': 'Disconnected',
    'room-label': 'Room'
  }
};

let currentLang = localStorage.getItem('timer-language') || 'fr';

export function t(key) {
  return translations[currentLang]?.[key] || translations['fr']?.[key] || key;
}

export function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('timer-language', lang);
  updatePageTranslations();
}

export function getLanguage() {
  return currentLang;
}

export function updatePageTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = text;
    } else {
      el.textContent = text;
    }
  });
}

export { translations };
