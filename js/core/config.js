// ============================================================
// CONFIG
// Replace SCRIPT_URL with your deployed Google Apps Script Web App URL
// (Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone)
// ============================================================

export const CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwb29iIN8Vgesj_Odj_zPx-nF9D8_sWAPTZpunXysAdPiVlrZVkuct8s6NvVH-JsWEKzA/exec',

  // Fallback conference defaults — overridden by Settings sheet once loaded
  DEFAULTS: {
    conferenceName: 'Youth Conference 2026',
    conferenceDays: 3,
    themeColor: '#FF6B4E',
  },

  STORAGE_KEYS: {
    SESSION: 'cams_session',       // { role: 'admin'|'volunteer', name }
    SETTINGS_CACHE: 'cams_settings_cache',
    LAST_PARTICIPANT: 'cams_last_participant',
  },

  GENDERS: ['Male', 'Female'],
  AGE_GROUPS: ['Under 12', '13-17', '18-24', '25-35', '36+'],
};
