/** Icon id for bounce rate (used as $(astroanalytics-bouncegood) etc.). Must be two segments: component-iconname. */
export type BounceIconId = 'astroanalytics-bouncegood' | 'astroanalytics-bouncewarning' | 'astroanalytics-bouncehigh' | 'astroanalytics-bouncecritical';

/**
 * Bounce rate (0–1) to contributed icon id. Use in UI as $(bounceIconId).
 * Note: Use bounceStatusBarCodicon() for StatusBarItem.text so the icon resolves.
 */
export function bounceColor(rate: number): BounceIconId {
  if (rate < 0.25) return 'astroanalytics-bouncegood';
  if (rate < 0.45) return 'astroanalytics-bouncewarning';
  if (rate < 0.65) return 'astroanalytics-bouncehigh';
  return 'astroanalytics-bouncecritical';
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
