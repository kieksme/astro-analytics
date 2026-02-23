import { describe, it, expect } from 'vitest';
import { bounceColor, fmtPct, fmtDuration } from '../../src/lib/format';

describe('bounceColor', () => {
  it('returns bounce-good for rate < 0.25', () => {
    expect(bounceColor(0)).toBe('astro-analytics.bounce-good');
    expect(bounceColor(0.24)).toBe('astro-analytics.bounce-good');
  });

  it('returns bounce-warning for 0.25 <= rate < 0.45', () => {
    expect(bounceColor(0.25)).toBe('astro-analytics.bounce-warning');
    expect(bounceColor(0.35)).toBe('astro-analytics.bounce-warning');
    expect(bounceColor(0.44)).toBe('astro-analytics.bounce-warning');
  });

  it('returns bounce-high for 0.45 <= rate < 0.65', () => {
    expect(bounceColor(0.45)).toBe('astro-analytics.bounce-high');
    expect(bounceColor(0.55)).toBe('astro-analytics.bounce-high');
    expect(bounceColor(0.64)).toBe('astro-analytics.bounce-high');
  });

  it('returns bounce-critical for rate >= 0.65', () => {
    expect(bounceColor(0.65)).toBe('astro-analytics.bounce-critical');
    expect(bounceColor(1)).toBe('astro-analytics.bounce-critical');
  });
});

describe('fmtPct', () => {
  it('formats rate as percentage with one decimal', () => {
    expect(fmtPct(0)).toBe('0.0%');
    expect(fmtPct(0.5)).toBe('50.0%');
    expect(fmtPct(0.123)).toBe('12.3%');
    expect(fmtPct(1)).toBe('100.0%');
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
});
