/**
 * Light/dark theme control. "Warm Dawn" (light) is the signature default;
 * "Dusk" (dark) is opt-in and remembered. The choice is applied as a
 * `data-theme` attribute on <html>, which the CSS variables in index.css key
 * off. A `themechange` window event lets native code (status bar) re-sync.
 */
export type Theme = 'light' | 'dark';

const KEY = 'gathering-theme';

export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

export function currentTheme(): Theme {
  return (document.documentElement.getAttribute('data-theme') as Theme) || 'light';
}

function apply(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  } catch {}
}

/** Call once at startup, before first paint. */
export function initTheme() {
  apply(getStoredTheme() ?? 'light');
}

export function setTheme(theme: Theme) {
  try { localStorage.setItem(KEY, theme); } catch {}
  apply(theme);
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
