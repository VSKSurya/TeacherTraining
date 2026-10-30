const STORAGE_KEY = 'teacher-training-font-scale-v3';
const CURRENT_LEGACY_STORAGE_KEY = 'teacher-training-font-scale-v2';
const LEGACY_STORAGE_KEY = 'teacher-training-font-scale';
export const DEFAULT_FONT_SCALE = 1;
export const MIN_FONT_SCALE = 0.8;
export const MAX_FONT_SCALE = 2;

export function readFontScale(): number {
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current !== null) {
      const stored = Number(current);
      return Number.isFinite(stored) && stored >= MIN_FONT_SCALE && stored <= MAX_FONT_SCALE ? stored : DEFAULT_FONT_SCALE;
    }
    const previousDefault = window.localStorage.getItem(CURRENT_LEGACY_STORAGE_KEY);
    if (previousDefault !== null) {
      const stored = Number(previousDefault);
      if (!Number.isFinite(stored) || stored < MIN_FONT_SCALE || stored > MAX_FONT_SCALE) return DEFAULT_FONT_SCALE;
      return stored === 1.1 ? DEFAULT_FONT_SCALE : stored;
    }
    const legacy = Number(window.localStorage.getItem(LEGACY_STORAGE_KEY));
    return Number.isFinite(legacy) && legacy >= MIN_FONT_SCALE && legacy <= MAX_FONT_SCALE ? legacy : DEFAULT_FONT_SCALE;
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
