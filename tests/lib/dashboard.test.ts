import { describe, it, expect } from 'vitest';
import {
  getDashboardDataFromState,
  buildDashboardHtml,
  type DashboardConfig,
  type DashboardData,
  type DashboardL10n,
  type PageMetrics,
} from '../../src/lib/dashboard';

const defaultL10n: DashboardL10n = {
  title: 'Astro Analytics Dashboard',
  propertyId: 'Property ID:',
  pagesInCache: 'Pages in cache:',
  lastFetch: 'Last fetch:',
  lookback: 'Lookback:',
  days: 'days',
  refreshData: 'Refresh data',
  page: 'Page',
  views: 'Views',
  users: 'Users',
  bounce: 'Bounce',
  avgDuration: 'Avg duration',
  emptyState: 'No cached pages. Configure GA4 and run Refresh Data.',
  notConfigured: 'GA4 not configured.',
  openSettings: 'Open Settings',
  notSet: '(not set)',
  legendGood: '<25%',
  legendWarning: '25–45%',
  legendHigh: '45–65%',
  legendCritical: '≥65%',
};

describe('getDashboardDataFromState', () => {
  it('returns empty topPages and zero cacheSize when cache is empty', () => {
    const config: DashboardConfig = { propertyId: '123', lookbackDays: 30 };
    const data = getDashboardDataFromState(config, new Map(), 0, () => null);
    expect(data.topPages).toEqual([]);
    expect(data.cacheSize).toBe(0);
    expect(data.configured).toBe(true);
    expect(data.propertyId).toBe('123');
    expect(data.lookbackDays).toBe(30);
    expect(data.lastFetch).toBe(0);
  });

  it('returns configured false when propertyId is empty', () => {
    const config: DashboardConfig = { propertyId: '', lookbackDays: 30 };
    const data = getDashboardDataFromState(config, new Map(), 0, () => null);
    expect(data.configured).toBe(false);
  });

  it('sorts topPages by views descending and limits to 20', () => {
    const cache = new Map<string, PageMetrics>([
      ['/a/', { pagePath: '/a/', views: 10, users: 5, bounceRate: 0.3, avgSessionDuration: 60 }],
      ['/b/', { pagePath: '/b/', views: 100, users: 50, bounceRate: 0.5, avgSessionDuration: 90 }],
      ['/c/', { pagePath: '/c/', views: 50, users: 20, bounceRate: 0.2, avgSessionDuration: 120 }],
    ]);
    const config: DashboardConfig = { propertyId: '1', lookbackDays: 30 };
    const data = getDashboardDataFromState(config, cache, 1, () => null);
    expect(data.topPages.map(p => p.pagePath)).toEqual(['/b/', '/c/', '/a/']);
    expect(data.topPages[0].views).toBe(100);
    expect(data.cacheSize).toBe(3);
  });

  it('sets hasFile from resolveFile callback', () => {
    const cache = new Map<string, PageMetrics>([
      ['/blog/', { pagePath: '/blog/', views: 1, users: 1, bounceRate: 0, avgSessionDuration: 0 }],
    ]);
    const config: DashboardConfig = { propertyId: '1', lookbackDays: 30 };
    const dataWithFile = getDashboardDataFromState(config, cache, 0, (path) =>
      path === '/blog/' ? '/fake/blog/index.md' : null
    );
    expect(dataWithFile.topPages[0].hasFile).toBe(true);

    const dataWithoutFile = getDashboardDataFromState(config, cache, 0, () => null);
    expect(dataWithoutFile.topPages[0].hasFile).toBe(false);
  });

  it('returns at most 20 top pages', () => {
    const cache = new Map<string, PageMetrics>();
    for (let i = 0; i < 25; i++) {
      cache.set(`/p${i}/`, {
        pagePath: `/p${i}/`,
        views: 100 - i,
        users: 1,
        bounceRate: 0.5,
        avgSessionDuration: 60,
      });
    }
    const config: DashboardConfig = { propertyId: '1', lookbackDays: 30 };
    const data = getDashboardDataFromState(config, cache, 0, () => null);
    expect(data.topPages).toHaveLength(20);
    expect(data.topPages[0].pagePath).toBe('/p0/');
    expect(data.topPages[19].pagePath).toBe('/p19/');
  });
});

describe('buildDashboardHtml', () => {
  const options = { cspSource: 'https://vscode-csp', nonce: 'test-nonce', lang: 'en' };

  it('includes required element ids in the HTML', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '123',
      cacheSize: 0,
      lastFetch: 0,
      lookbackDays: 30,
      topPages: [],
    };
    const html = buildDashboardHtml(data, defaultL10n, options);
    expect(html).toContain('id="propertyId"');
    expect(html).toContain('id="cacheSize"');
    expect(html).toContain('id="lastFetch"');
    expect(html).toContain('id="lookbackDays"');
    expect(html).toContain('id="tbody"');
    expect(html).toContain('id="emptyState"');
    expect(html).toContain('id="refreshBtn"');
    expect(html).toContain('id="notConfiguredBanner"');
  });

  it('includes data-sort attributes on table headers', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '',
      cacheSize: 0,
      lastFetch: 0,
      lookbackDays: 30,
      topPages: [],
    };
    const html = buildDashboardHtml(data, defaultL10n, options);
    expect(html).toContain('data-sort="pagePath"');
    expect(html).toContain('data-sort="views"');
    expect(html).toContain('data-sort="users"');
    expect(html).toContain('data-sort="bounceRate"');
    expect(html).toContain('data-sort="avgSessionDuration"');
  });

  it('embeds l10n strings in the HTML', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '',
      cacheSize: 0,
      lastFetch: 0,
      lookbackDays: 30,
      topPages: [],
    };
    const html = buildDashboardHtml(data, defaultL10n, options);
    expect(html).toContain(defaultL10n.title);
    expect(html).toContain(defaultL10n.refreshData);
    expect(html).toContain(defaultL10n.emptyState);
  });

  it('embeds data in script with topPages and escapes < in JSON', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 1,
      lastFetch: 1000,
      lookbackDays: 30,
      topPages: [
        {
          pagePath: '/blog/',
          views: 10,
          users: 5,
          bounceRate: 0.3,
          avgSessionDuration: 60,
          hasFile: true,
        },
      ],
    };
    const html = buildDashboardHtml(data, defaultL10n, options);
    expect(html).toContain('const data = ');
    expect(html).toContain('"pagePath":"/blog/"');
    expect(html).toContain('"views":10');
    expect(html).toContain('"cacheSize":1');
    expect(html).not.toMatch(/const data = [^;]*<[^/]/);
  });

  it('uses provided nonce and lang', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '',
      cacheSize: 0,
      lastFetch: 0,
      lookbackDays: 30,
      topPages: [],
    };
    const html = buildDashboardHtml(data, defaultL10n, options);
    expect(html).toContain('script nonce="test-nonce"');
    expect(html).toContain('lang="en"');
  });

  it('includes CSP with cspSource', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '',
      cacheSize: 0,
      lastFetch: 0,
      lookbackDays: 30,
      topPages: [],
    };
    const html = buildDashboardHtml(data, defaultL10n, options);
    expect(html).toContain('https://vscode-csp');
  });
});
