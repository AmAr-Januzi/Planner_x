'use strict';

/* Planner X — Color themes and light/dark mode. */

// One gradient theme unlocks per level. a = primary (buttons, actions), b = accent (decoration),
// c = optional third gradient stop, bg = exact light-mode background (otherwise tinted from a).
const THEMES = [
  { name: 'Aurora', icon: '🌌', a: '#6C4CF1', b: '#A78BFA', bg: '#F7F5FF' },
  { name: 'Lagoon', icon: '🌊', a: '#0891b2', b: '#3b82f6' },
  { name: 'Forest', icon: '🌲', a: '#059669', b: '#65a30d' },
  { name: 'Sunset', icon: '🌅', a: '#f97316', b: '#db2777' },
  { name: 'Ember',  icon: '🔥', a: '#dc2626', b: '#ea580c' },
  { name: 'Royal',  icon: '👑', a: '#7c3aed', b: '#db2777' },
  { name: 'Arctic', icon: '❄️', a: '#0284c7', b: '#0891b2' },
  { name: 'Gold',   icon: '🏆', a: '#b45309', b: '#ca8a04' },
  { name: 'Neon',   icon: '⚡', a: '#c026d3', b: '#0891b2' },
  { name: 'Galaxy', icon: '✨', a: '#4f46e5', b: '#db2777', c: '#0891b2' },
];
const themeGrad = t => `linear-gradient(135deg, ${t.a}, ${t.b}${t.c ? `, ${t.c}` : ''})`;
const levelTheme = n => (n - 1) % THEMES.length;
const currentTheme = () => THEMES[state.theme ?? levelTheme(state.level)];

const MODES = {
  auto:  { icon: '🖥️', label: 'Auto',  hint: 'follows your device' },
  light: { icon: '☀️', label: 'Light', hint: 'bright and clean' },
  dark:  { icon: '🌙', label: 'Dark',  hint: 'easy on the eyes' },
};

function applyTheme() {
  const t = currentTheme(), root = document.documentElement, s = root.style;
  s.setProperty('--accent', t.a);
  s.setProperty('--accent-2', t.b);
  s.setProperty('--grad', themeGrad(t));
  // buttons stay close to the primary color so white text keeps its contrast
  s.setProperty('--btn-grad', `linear-gradient(135deg, ${t.a}, color-mix(in srgb, ${t.a} 75%, ${t.b}))`);
  if (t.bg) s.setProperty('--theme-bg', t.bg); else s.removeProperty('--theme-bg');
  const mode = state.mode || 'auto';
  if (mode === 'auto') delete root.dataset.mode; else root.dataset.mode = mode;
}
