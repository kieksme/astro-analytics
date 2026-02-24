import { describe, it, expect } from 'vitest';
import { bounceColor, bounceStatusBarCodicon, fmtPct, fmtDuration } from '../../src/lib/format';

/** Built-in codicons that VS Code resolves in CodeLens title and MarkdownString (hover). */
const RESOLVABLE_CODICONS = new Set(['pass', 'warning', 'error']);

/** Extension icon ids from bounceColor (for dashboard/webview; not resolved in CodeLens/Hover). */
const EXTENSION_BOUNCE_ICONS = new Set([
  'astroanalytics-bouncegood',
  'astroanalytics-bouncewarning',
  'astroanalytics-bouncehigh',
  'astroanalytics-bouncecritical',
]);

describe('bounceColor', () => {
  it('returns bouncegood for rate < 0.25', () => {
    expect(bounceColor(0)).toBe('astroanalytics-bouncegood');
    expect(bounceColor(0.24)).toBe('astroanalytics-bouncegood');
  });

  it('returns bouncewarning for 0.25 <= rate < 0.45', () => {
    expect(bounceColor(0.25)).toBe('astroanalytics-bouncewarning');
    expect(bounceColor(0.35)).toBe('astroanalytics-bouncewarning');
    expect(bounceColor(0.44)).toBe('astroanalytics-bouncewarning');
  });

  it('returns bouncehigh for 0.45 <= rate < 0.65', () => {
    expect(bounceColor(0.45)).toBe('astroanalytics-bouncehigh');
    expect(bounceColor(0.55)).toBe('astroanalytics-bouncehigh');
    expect(bounceColor(0.64)).toBe('astroanalytics-bouncehigh');
  });

  it('returns bouncecritical for rate >= 0.65', () => {
    expect(bounceColor(0.65)).toBe('astroanalytics-bouncecritical');
    expect(bounceColor(1)).toBe('astroanalytics-bouncecritical');
  });

  it('returns only extension icon ids (for dashboard/webview)', () => {
    for (const rate of [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 1]) {
      const icon = bounceColor(rate);
      expect(EXTENSION_BOUNCE_ICONS.has(icon), `${rate} should yield extension icon, got ${icon}`).toBe(true);
      expect(icon).toMatch(/^astroanalytics-bounce(good|warning|high|critical)$/);
    }
  });
});

/** All four bounce tiers with boundary rate and expected codicon (CodeLens/Hover). */
const BOUNCE_TIERS: { rate: number; bounceColorId: string; codicon: string }[] = [
  { rate: 0, bounceColorId: 'astroanalytics-bouncegood', codicon: 'pass' },
  { rate: 0.24, bounceColorId: 'astroanalytics-bouncegood', codicon: 'pass' },
  { rate: 0.25, bounceColorId: 'astroanalytics-bouncewarning', codicon: 'warning' },
  { rate: 0.44, bounceColorId: 'astroanalytics-bouncewarning', codicon: 'warning' },
  { rate: 0.45, bounceColorId: 'astroanalytics-bouncehigh', codicon: 'warning' },
  { rate: 0.64, bounceColorId: 'astroanalytics-bouncehigh', codicon: 'warning' },
  { rate: 0.65, bounceColorId: 'astroanalytics-bouncecritical', codicon: 'error' },
  { rate: 1, bounceColorId: 'astroanalytics-bouncecritical', codicon: 'error' },
];

describe('bounceStatusBarCodicon', () => {
  it('returns pass for rate < 0.25 (good bounce)', () => {
    expect(bounceStatusBarCodicon(0)).toBe('pass');
    expect(bounceStatusBarCodicon(0.24)).toBe('pass');
  });

  it('returns warning for 0.25 <= rate < 0.65 (warning and high tiers)', () => {
    expect(bounceStatusBarCodicon(0.25)).toBe('warning');
    expect(bounceStatusBarCodicon(0.35)).toBe('warning');
    expect(bounceStatusBarCodicon(0.44)).toBe('warning');
    expect(bounceStatusBarCodicon(0.45)).toBe('warning');
    expect(bounceStatusBarCodicon(0.55)).toBe('warning');
    expect(bounceStatusBarCodicon(0.64)).toBe('warning');
  });

  it('returns error for rate >= 0.65 (critical)', () => {
    expect(bounceStatusBarCodicon(0.65)).toBe('error');
    expect(bounceStatusBarCodicon(0.8)).toBe('error');
    expect(bounceStatusBarCodicon(1)).toBe('error');
  });

  it('returns only built-in codicon names so $(icon) resolves in CodeLens and Hover', () => {
    for (const rate of [0, 0.2, 0.3, 0.5, 0.6, 0.7, 1]) {
      const icon = bounceStatusBarCodicon(rate);
      expect(RESOLVABLE_CODICONS.has(icon), `${rate} should yield resolvable codicon, got ${icon}`).toBe(true);
      expect(icon).not.toContain('.');
      expect(icon).not.toContain('astroanalytics');
    }
  });

  it('maps all four bounce tiers to the correct codicon (good→pass, warning/high→warning, critical→error)', () => {
    for (const { rate, bounceColorId, codicon } of BOUNCE_TIERS) {
      expect(bounceColor(rate)).toBe(bounceColorId);
      expect(bounceStatusBarCodicon(rate)).toBe(codicon);
    }
  });
});

describe('fmtPct', () => {
  it('formats rate as percentage with one decimal', () => {
    expect(fmtPct(0)).toBe('0.0%');
    expect(fmtPct(0.5)).toBe('50.0%');
    expect(fmtPct(0.123)).toBe('12.3%');
    expect(fmtPct(1)).toBe('100.0%');
  });

  it('rounds to one decimal', () => {
    expect(fmtPct(0.999)).toBe('99.9%');
    expect(fmtPct(0.001)).toBe('0.1%');
  });
});

describe('fmtDuration', () => {
  it('formats seconds only when < 60', () => {
    expect(fmtDuration(0)).toBe('0s');
    expect(fmtDuration(30)).toBe('30s');
    expect(fmtDuration(59)).toBe('59s');
  });

  it('formats minutes and seconds when >= 60', () => {
    expect(fmtDuration(60)).toBe('1m 0s');
    expect(fmtDuration(90)).toBe('1m 30s');
    expect(fmtDuration(125)).toBe('2m 5s');
  });

  it('floors fractional seconds', () => {
    expect(fmtDuration(59.9)).toBe('59s');
    expect(fmtDuration(90.7)).toBe('1m 30s');
  });

  it('handles large durations', () => {
    expect(fmtDuration(3661)).toBe('61m 1s');
  });
});
