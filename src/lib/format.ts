/**
 * Bounce rate (0–1) to color emoji.
 */
export function bounceColor(rate: number): string {
  if (rate < 0.25) return '🟢';
  if (rate < 0.45) return '🟡';
  if (rate < 0.65) return '🟠';
  return '🔴';
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
