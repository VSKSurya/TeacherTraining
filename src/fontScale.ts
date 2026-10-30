const STORAGE_KEY = 'teacher-training-font-scale';
export const MIN_FONT_SCALE = 0.8;
export const MAX_FONT_SCALE = 2;

export function readFontScale(): number {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(stored) && stored >= MIN_FONT_SCALE && stored <= MAX_FONT_SCALE ? stored : 1;
  } catch {
    return 1;
  }
}

export function applyFontScale(value: number): number {
  const scale = Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, Math.round(value * 10) / 10));
  document.body.style.zoom = String(scale);
  try { window.localStorage.setItem(STORAGE_KEY, String(scale)); } catch { /* Keep the in-memory setting when storage is unavailable. */ }
  return scale;
}
