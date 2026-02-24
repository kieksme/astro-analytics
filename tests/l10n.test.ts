import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/** Hover tooltip keys that must be translated so the hover shows labels, not raw keys. */
const HOVER_L10N_KEYS = [
  'hover.analyticsTitle',
  'hover.pageTitle',
  'hover.metric',
  'hover.value',
  'hover.bounceRate',
  'hover.pageViews',
  'hover.activeUsers',
  'hover.avgSessionDuration',
  'hover.footer',
  'hover.dynamicRouteAggregated',
] as const;

/** Message keys (dialogs, status, output) that must have fallbacks so UI never shows raw keys. */
const MSG_L10N_KEYS = [
  'msg.noWorkspace',
  'msg.noFileForPath',
  'msg.setPropertyId',
  'msg.openSettings',
  'msg.loadingGa4',
  'msg.analyticsLoading',
  'msg.pagesLoaded',
  'msg.analyticsError',
  'msg.analyticsErrorStatus',
  'msg.dashboardFailed',
  'msg.extensionActivated',
] as const;

/** Decoration (e.g. inline tooltip) keys. */
const DECORATION_L10N_KEYS = ['decoration.tooltip'] as const;

/** Dashboard webview keys (e.g. table labels, dynamic route badge). */
const DASHBOARD_L10N_KEYS = ['dashboard.dynamicRoute', 'dashboard.badgeCriticalTooltip'] as const;

/** Keys that use placeholders (e.g. {0}, {1}). Value is the expected placeholder indices. */
const KEYS_WITH_PLACEHOLDERS: Record<string, number[]> = {
  'hover.footer': [0, 1],
  'decoration.tooltip': [0, 1, 2, 3],
  'msg.noFileForPath': [0],
  'msg.pagesLoaded': [0],
  'msg.analyticsError': [0],
  'codelens.title': [0, 1, 2, 3],
  'status.text': [0],
  'status.tooltip': [0, 1, 2, 3],
  'status.a11y': [0, 1, 2],
  'status.noDataTooltip': [0],
  'status.noDataA11y': [0],
  'dashboard.pageOf': [0, 1],
};

function loadBundle(locale: string): Record<string, string> {
  const base = path.resolve(__dirname, '../l10n');
  const file = locale === 'en' ? 'bundle.l10n.json' : `bundle.l10n.${locale}.json`;
  const raw = fs.readFileSync(path.join(base, file), 'utf-8');
  return JSON.parse(raw) as Record<string, string>;
}

function getL10nBundleFiles(): string[] {
  const l10nDir = path.resolve(__dirname, '../l10n');
  return fs.readdirSync(l10nDir).filter((f) => f.startsWith('bundle.l10n') && f.endsWith('.json'));
}

/** Returns placeholder indices (e.g. [0, 1]) found in the string. */
function getPlaceholderIndices(value: string): number[] {
  const indices = new Set<number>();
  const re = /\{(\d+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) indices.add(Number(m[1]));
  return [...indices].sort((a, b) => a - b);
}

describe('l10n bundles', () => {
  it('default bundle (en) contains all hover keys with non-empty values', () => {
    const bundle = loadBundle('en');
    for (const key of HOVER_L10N_KEYS) {
      expect(bundle[key], `missing or empty: ${key}`).toBeDefined();
      expect(typeof bundle[key]).toBe('string');
      expect(bundle[key].trim().length, `${key} must be non-empty`).toBeGreaterThan(0);
    }
  });

  it('default bundle (en) hover values are not the raw key', () => {
    const bundle = loadBundle('en');
    for (const key of HOVER_L10N_KEYS) {
      const value = bundle[key];
      expect(value, `${key} should be translated, not the key`).not.toBe(key);
    }
  });

  it('German bundle contains all hover keys with non-empty values', () => {
    const bundle = loadBundle('de');
    for (const key of HOVER_L10N_KEYS) {
      expect(bundle[key], `missing or empty: ${key}`).toBeDefined();
      expect(typeof bundle[key]).toBe('string');
      expect(bundle[key].trim().length, `${key} must be non-empty`).toBeGreaterThan(0);
    }
  });

  it('hover keys with placeholders contain the expected placeholders', () => {
    const bundle = loadBundle('en');
    for (const [key, indices] of Object.entries(KEYS_WITH_PLACEHOLDERS)) {
      const value = bundle[key];
      expect(value, `missing key: ${key}`).toBeDefined();
      for (const i of indices) {
        expect(value!.includes(`{${i}}`), `${key} should contain {${i}}`).toBe(true);
      }
    }
  });

  it('default bundle (en) contains all msg keys with non-empty values', () => {
    const bundle = loadBundle('en');
    for (const key of MSG_L10N_KEYS) {
      expect(bundle[key], `missing or empty: ${key}`).toBeDefined();
      expect(typeof bundle[key]).toBe('string');
      expect(bundle[key].trim().length, `${key} must be non-empty`).toBeGreaterThan(0);
    }
  });

  it('default bundle (en) contains decoration keys with non-empty values', () => {
    const bundle = loadBundle('en');
    for (const key of DECORATION_L10N_KEYS) {
      expect(bundle[key], `missing or empty: ${key}`).toBeDefined();
      expect(typeof bundle[key]).toBe('string');
      expect(bundle[key].trim().length, `${key} must be non-empty`).toBeGreaterThan(0);
    }
  });

  it('default bundle (en) contains all dashboard keys with non-empty values', () => {
    const bundle = loadBundle('en');
    for (const key of DASHBOARD_L10N_KEYS) {
      expect(bundle[key], `missing or empty: ${key}`).toBeDefined();
      expect(typeof bundle[key]).toBe('string');
      expect(bundle[key].trim().length, `${key} must be non-empty`).toBeGreaterThan(0);
    }
  });

  it('msg, decoration, and dashboard values in default bundle are not the raw key', () => {
    const bundle = loadBundle('en');
    for (const key of [...MSG_L10N_KEYS, ...DECORATION_L10N_KEYS, ...DASHBOARD_L10N_KEYS]) {
      const value = bundle[key];
      expect(value, `${key} should be translated, not the key`).not.toBe(key);
    }
  });

  it('all locale bundles that exist contain hover, msg, decoration, and dashboard keys', () => {
    const allUiKeys = [...HOVER_L10N_KEYS, ...MSG_L10N_KEYS, ...DECORATION_L10N_KEYS, ...DASHBOARD_L10N_KEYS];
    const l10nDir = path.resolve(__dirname, '../l10n');
    const files = fs.readdirSync(l10nDir).filter((f) => f.startsWith('bundle.l10n') && f.endsWith('.json'));
    for (const file of files) {
      const raw = fs.readFileSync(path.join(l10nDir, file), 'utf-8');
      const bundle = JSON.parse(raw) as Record<string, string>;
      for (const key of allUiKeys) {
        expect(bundle[key], `${file}: missing key ${key}`).toBeDefined();
        expect(bundle[key].trim().length, `${file}: ${key} must be non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it('msg/decoration keys with placeholders contain the expected placeholders', () => {
    const bundle = loadBundle('en');
    for (const [key, indices] of Object.entries(KEYS_WITH_PLACEHOLDERS)) {
      if (!key.startsWith('hover.')) {
        const value = bundle[key];
        expect(value, `missing key: ${key}`).toBeDefined();
        for (const i of indices) {
          expect(value!.includes(`{${i}}`), `${key} should contain {${i}}`).toBe(true);
        }
      }
    }
  });

  describe('all translations (every bundle)', () => {
    const defaultBundle = loadBundle('en');
    const allKeysFromDefault = Object.keys(defaultBundle);

    it('default bundle has no empty or missing values', () => {
      for (const key of allKeysFromDefault) {
        const value = defaultBundle[key];
        expect(value, `default: ${key} must be defined`).toBeDefined();
        expect(typeof value).toBe('string');
        expect(value.trim().length, `default: ${key} must be non-empty`).toBeGreaterThan(0);
      }
    });

    it('every locale bundle contains all keys from default bundle with non-empty values', () => {
      const files = getL10nBundleFiles();
      for (const file of files) {
        const raw = fs.readFileSync(path.resolve(__dirname, '../l10n', file), 'utf-8');
        const bundle = JSON.parse(raw) as Record<string, string>;
        for (const key of allKeysFromDefault) {
          expect(bundle[key], `${file}: missing key ${key}`).toBeDefined();
          expect(typeof bundle[key]).toBe('string');
          expect(
            (bundle[key] as string).trim().length,
            `${file}: ${key} must be non-empty`
          ).toBeGreaterThan(0);
        }
      }
    });

    it('every locale bundle has at least all keys from default (no missing keys)', () => {
      const files = getL10nBundleFiles().filter((f) => f !== 'bundle.l10n.json');
      for (const file of files) {
        const raw = fs.readFileSync(path.resolve(__dirname, '../l10n', file), 'utf-8');
        const bundle = JSON.parse(raw) as Record<string, string>;
        const missing = allKeysFromDefault.filter((k) => !(k in bundle));
        expect(missing, `${file}: missing keys`).toEqual([]);
      }
    });

    it('placeholder keys in every locale bundle have same placeholder indices as default', () => {
      const files = getL10nBundleFiles();
      for (const file of files) {
        const raw = fs.readFileSync(path.resolve(__dirname, '../l10n', file), 'utf-8');
        const bundle = JSON.parse(raw) as Record<string, string>;
        for (const [key, expectedIndices] of Object.entries(KEYS_WITH_PLACEHOLDERS)) {
          const value = bundle[key];
          if (value == null) continue;
          const found = getPlaceholderIndices(value);
          const expectedSet = new Set(expectedIndices);
          const missing = expectedIndices.filter((i) => !value.includes(`{${i}}`));
          expect(
            missing,
            `${file}: ${key} must contain placeholders {${expectedIndices.join('}, {')}}`
          ).toEqual([]);
          const extra = found.filter((i) => !expectedSet.has(i));
          expect(
            extra,
            `${file}: ${key} should not add extra placeholders beyond {${expectedIndices.join('}, {')}}`
          ).toEqual([]);
        }
      }
    });

    it('no locale bundle value is the raw key (all keys are translated)', () => {
      const files = getL10nBundleFiles().filter((f) => f !== 'bundle.l10n.json');
      for (const file of files) {
        const raw = fs.readFileSync(path.resolve(__dirname, '../l10n', file), 'utf-8');
        const bundle = JSON.parse(raw) as Record<string, string>;
        for (const key of allKeysFromDefault) {
          const value = bundle[key];
          expect(value, `${file}: ${key} should be translated, not the key`).not.toBe(key);
        }
      }
    });
  });
});
