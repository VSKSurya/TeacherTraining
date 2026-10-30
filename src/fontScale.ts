const STORAGE_KEY = 'teacher-training-font-scale-v2';
const LEGACY_STORAGE_KEY = 'teacher-training-font-scale';
export const DEFAULT_FONT_SCALE = 1.1;
export const MIN_FONT_SCALE = 0.8;
export const MAX_FONT_SCALE = 2;

export function readFontScale(): number {
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    const stored = Number(current ?? window.localStorage.getItem(LEGACY_STORAGE_KEY));
    if (!Number.isFinite(stored) || stored < MIN_FONT_SCALE || stored > MAX_FONT_SCALE || stored === 0) return DEFAULT_FONT_SCALE;
    return current === null && stored === 1 ? DEFAULT_FONT_SCALE : stored;
  } catch {
    return DEFAULT_FONT_SCALE;
  }
}

export function applyFontScale(value: number): number {
  const scale = Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, Math.round(value * 10) / 10));
  document.body.style.zoom = String(scale);
  try { window.localStorage.setItem(STORAGE_KEY, String(scale)); } catch { /* Keep the in-memory setting when storage is unavailable. */ }
  return scale;
}
