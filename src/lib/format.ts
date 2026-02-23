/** Icon id for bounce rate (used as $(astro-analytics.bounce-good) etc.). */
export type BounceIconId = 'astro-analytics.bounce-good' | 'astro-analytics.bounce-warning' | 'astro-analytics.bounce-high' | 'astro-analytics.bounce-critical';

/**
 * Bounce rate (0–1) to contributed icon id. Use in UI as $(bounceIconId).
 * Note: Use bounceStatusBarCodicon() for StatusBarItem.text so the icon resolves.
 */
export function bounceColor(rate: number): BounceIconId {
  if (rate < 0.25) return 'astro-analytics.bounce-good';
  if (rate < 0.45) return 'astro-analytics.bounce-warning';
  if (rate < 0.65) return 'astro-analytics.bounce-high';
  return 'astro-analytics.bounce-critical';
}

/** Codicon name for status bar (always resolves; custom icons may not in StatusBarItem). */
export function bounceStatusBarCodicon(rate: number): string {
  if (rate < 0.25) return 'pass';
  if (rate < 0.45) return 'warning';
  if (rate < 0.65) return 'warning';
  return 'error';
}

/**
 * Format rate (0–1) as percentage string.
 */
export function fmtPct(rate: number): string {
  return (rate * 100).toFixed(1) + '%';
}

/**
 * Format seconds as "Xm Ys" or "Ys".
 */
export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
