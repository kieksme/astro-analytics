import { describe, it, expect } from 'vitest';
import {
  getDashboardDataFromState,
  buildDashboardHtml,
  buildSidebarDashboardHtml,
  getSidebarViewTitleString,
  countCriticalPages,
  BOUNCE_CRITICAL_THRESHOLD,
  type DashboardConfig,
  type DashboardData,
  type PageMetrics,
} from '../../src/lib/dashboard';

/** Extract dashboard payload from HTML (script type="application/json" id="dataPayload"). */
function getPayloadFromHtml(html: string): Record<string, unknown> {
  const scriptMatch = html.match(/<script type="application\/json" id="dataPayload">([\s\S]*?)<\/script>/);
  if (!scriptMatch) return {};
  try {
    return JSON.parse(scriptMatch[1]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

describe('getSidebarViewTitleString', () => {
  const baseTitle = 'Dashboard';

  it('returns base title when cacheSize is 0 and not refreshing', () => {
    expect(getSidebarViewTitleString(baseTitle, 0, false)).toBe('Dashboard');
  });

  it('returns base title with count when cacheSize > 0 and not refreshing', () => {
    expect(getSidebarViewTitleString(baseTitle, 47, false)).toBe('Dashboard (47)');
    expect(getSidebarViewTitleString(baseTitle, 1, false)).toBe('Dashboard (1)');
  });

  it('returns base title with spinner codicon when refreshing', () => {
    expect(getSidebarViewTitleString(baseTitle, 0, true)).toBe('Dashboard $(sync~spin)');
    expect(getSidebarViewTitleString(baseTitle, 47, true)).toBe('Dashboard $(sync~spin)');
  });
});

describe('countCriticalPages', () => {
  it('returns 0 for empty topPages', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 0,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [],
    };
    expect(countCriticalPages(data)).toBe(0);
  });

  it('counts pages with bounceRate >= BOUNCE_CRITICAL_THRESHOLD', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 4,
      lastFetch: 1,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [
        { pagePath: '/a/', views: 1, users: 1, bounceRate: 0.5, avgSessionDuration: 0, hasFile: false },
        { pagePath: '/b/', views: 1, users: 1, bounceRate: BOUNCE_CRITICAL_THRESHOLD, avgSessionDuration: 0, hasFile: false },
        { pagePath: '/c/', views: 1, users: 1, bounceRate: 0.8, avgSessionDuration: 0, hasFile: false },
        { pagePath: '/d/', views: 1, users: 1, bounceRate: 0.64, avgSessionDuration: 0, hasFile: false },
      ],
    };
    expect(countCriticalPages(data)).toBe(2);
  });
});

describe('getDashboardDataFromState', () => {
  it('returns empty topPages and zero cacheSize when cache is empty', () => {
    const config: DashboardConfig = { propertyId: '123', lookbackDays: 30, maxPages: 20, pageSize: 20 };
    const data = getDashboardDataFromState(config, new Map(), 0, () => null);
    expect(data.topPages).toEqual([]);
    expect(data.cacheSize).toBe(0);
    expect(data.configured).toBe(true);
    expect(data.propertyId).toBe('123');
    expect(data.lookbackDays).toBe(30);
    expect(data.lastFetch).toBe(0);
    expect(data.pageSize).toBe(20);
  });

  it('returns configured false when propertyId is empty', () => {
    const config: DashboardConfig = { propertyId: '', lookbackDays: 30, maxPages: 20, pageSize: 20 };
    const data = getDashboardDataFromState(config, new Map(), 0, () => null);
    expect(data.configured).toBe(false);
  });

  it('sorts topPages by bounce rate descending (worst first) and limits to maxPages', () => {
    const cache = new Map<string, PageMetrics>([
      ['/a/', { pagePath: '/a/', views: 10, users: 5, bounceRate: 0.3, avgSessionDuration: 60 }],
      ['/b/', { pagePath: '/b/', views: 100, users: 50, bounceRate: 0.5, avgSessionDuration: 90 }],
      ['/c/', { pagePath: '/c/', views: 50, users: 20, bounceRate: 0.2, avgSessionDuration: 120 }],
    ]);
    const config: DashboardConfig = { propertyId: '1', lookbackDays: 30, maxPages: 20, pageSize: 20 };
    const data = getDashboardDataFromState(config, cache, 1, () => null);
    expect(data.topPages.map(p => p.pagePath)).toEqual(['/b/', '/a/', '/c/']);
    expect(data.topPages[0].bounceRate).toBe(0.5);
    expect(data.cacheSize).toBe(3);
  });

  it('sets hasFile and resolvedFilePath from resolveFile callback', () => {
    const cache = new Map<string, PageMetrics>([
      ['/blog/', { pagePath: '/blog/', views: 1, users: 1, bounceRate: 0, avgSessionDuration: 0 }],
    ]);
    const config: DashboardConfig = { propertyId: '1', lookbackDays: 30, maxPages: 20, pageSize: 20 };
    const dataWithFile = getDashboardDataFromState(config, cache, 0, (path) =>
      path === '/blog/' ? '/fake/blog/index.md' : null
    );
    expect(dataWithFile.topPages[0].hasFile).toBe(true);
    expect(dataWithFile.topPages[0].resolvedFilePath).toBe('/fake/blog/index.md');

    const dataWithoutFile = getDashboardDataFromState(config, cache, 0, () => null);
    expect(dataWithoutFile.topPages[0].hasFile).toBe(false);
    expect(dataWithoutFile.topPages[0].resolvedFilePath).toBeNull();
  });

  it('sets titleDisplayPath from getTitlePath when provided, else falls back to resolvedFilePath', () => {
    const cache = new Map<string, PageMetrics>([
      ['/blog/', { pagePath: '/blog/', views: 1, users: 1, bounceRate: 0, avgSessionDuration: 0 }],
    ]);
    const config: DashboardConfig = { propertyId: '1', lookbackDays: 30, maxPages: 20, pageSize: 20 };
    const resolveFile = (path: string) => (path === '/blog/' ? '/abs/workspace/src/pages/blog/index.astro' : null);
    const getTitlePath = (_path: string, abs: string | null) => (abs ? 'src/pages/blog/index.astro' : null);
    const data = getDashboardDataFromState(config, cache, 0, resolveFile, undefined, getTitlePath);
    expect(data.topPages[0].resolvedFilePath).toBe('/abs/workspace/src/pages/blog/index.astro');
    expect(data.topPages[0].titleDisplayPath).toBe('src/pages/blog/index.astro');
    const dataNoGetTitlePath = getDashboardDataFromState(config, cache, 0, resolveFile);
    expect(dataNoGetTitlePath.topPages[0].titleDisplayPath).toBe('/abs/workspace/src/pages/blog/index.astro');
  });

  it('sets isDynamicRoute from optional callback', () => {
    const cache = new Map<string, PageMetrics>([
      ['/blog/', { pagePath: '/blog/', views: 1, users: 1, bounceRate: 0, avgSessionDuration: 0 }],
      ['/about/', { pagePath: '/about/', views: 1, users: 1, bounceRate: 0, avgSessionDuration: 0 }],
    ]);
    const config: DashboardConfig = { propertyId: '1', lookbackDays: 30, maxPages: 20, pageSize: 20 };
    const resolveFile = (path: string) => (path === '/blog/' ? '/src/pages/[slug].astro' : path === '/about/' ? '/src/pages/about.astro' : null);
    const dataWithDynamic = getDashboardDataFromState(config, cache, 0, resolveFile, (path) => path === '/blog/');
    expect(dataWithDynamic.topPages.find((p) => p.pagePath === '/blog/')?.isDynamicRoute).toBe(true);
    expect(dataWithDynamic.topPages.find((p) => p.pagePath === '/about/')?.isDynamicRoute).toBe(false);

    const dataWithoutCallback = getDashboardDataFromState(config, cache, 0, resolveFile);
    expect(dataWithoutCallback.topPages[0].isDynamicRoute).toBe(false);
  });

  it('returns at most maxPages top pages', () => {
    const cache = new Map<string, PageMetrics>();
    for (let i = 0; i < 25; i++) {
      cache.set(`/p${i}/`, {
        pagePath: `/p${i}/`,
        views: 100 - i,
        users: 1,
        bounceRate: 0.4 + i * 0.02,
        avgSessionDuration: 60,
      });
    }
    const config: DashboardConfig = { propertyId: '1', lookbackDays: 30, maxPages: 20, pageSize: 20 };
    const data = getDashboardDataFromState(config, cache, 0, () => null);
    expect(data.topPages).toHaveLength(20);
    expect(data.topPages[0].bounceRate).toBeGreaterThan(data.topPages[19].bounceRate);
  });

  it('respects config.maxPages', () => {
    const cache = new Map<string, PageMetrics>([
      ['/a/', { pagePath: '/a/', views: 1, users: 1, bounceRate: 0.1, avgSessionDuration: 0 }],
      ['/b/', { pagePath: '/b/', views: 1, users: 1, bounceRate: 0.2, avgSessionDuration: 0 }],
      ['/c/', { pagePath: '/c/', views: 1, users: 1, bounceRate: 0.3, avgSessionDuration: 0 }],
      ['/d/', { pagePath: '/d/', views: 1, users: 1, bounceRate: 0.4, avgSessionDuration: 0 }],
      ['/e/', { pagePath: '/e/', views: 1, users: 1, bounceRate: 0.5, avgSessionDuration: 0 }],
    ]);
    const config: DashboardConfig = { propertyId: '1', lookbackDays: 30, maxPages: 3, pageSize: 20 };
    const data = getDashboardDataFromState(config, cache, 0, () => null);
    expect(data.topPages).toHaveLength(3);
    expect(data.topPages.map(p => p.pagePath)).toEqual(['/e/', '/d/', '/c/']);
  });

  it('clamps maxPages to at least 1', () => {
    const cache = new Map<string, PageMetrics>([
      ['/a/', { pagePath: '/a/', views: 1, users: 1, bounceRate: 0.5, avgSessionDuration: 0 }],
    ]);
    const config: DashboardConfig = { propertyId: '1', lookbackDays: 30, maxPages: 0, pageSize: 20 };
    const data = getDashboardDataFromState(config, cache, 0, () => null);
    expect(data.topPages).toHaveLength(1);
  });

  it('returns topPages with numeric views and users so table can display values after refresh', () => {
    const cache = new Map<string, PageMetrics>([
      ['/a/', { pagePath: '/a/', views: 100, users: 40, bounceRate: 0.35, avgSessionDuration: 75 }],
      ['/b/', { pagePath: '/b/', views: 50, users: 20, bounceRate: 0.6, avgSessionDuration: 90 }],
    ]);
    const config: DashboardConfig = { propertyId: '1', lookbackDays: 30, maxPages: 20, pageSize: 20 };
    const data = getDashboardDataFromState(config, cache, 0, () => null);
    expect(data.topPages).toHaveLength(2);
    expect(data.cacheSize).toBe(2);
    const a = data.topPages.find((p) => p.pagePath === '/a/');
    const b = data.topPages.find((p) => p.pagePath === '/b/');
    expect(a?.views).toBe(100);
    expect(a?.users).toBe(40);
    expect(a?.bounceRate).toBe(0.35);
    expect(a?.avgSessionDuration).toBe(75);
    expect(b?.views).toBe(50);
    expect(b?.users).toBe(20);
    expect(typeof a?.views).toBe('number');
    expect(typeof a?.users).toBe('number');
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
      pageSize: 20,
      topPages: [],
    };
    const html = buildDashboardHtml(data, options);
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
      pageSize: 20,
      topPages: [],
    };
    const html = buildDashboardHtml(data, options);
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
      pageSize: 20,
      topPages: [],
    };
    const html = buildDashboardHtml(data, options);
    expect(html).toContain('Dashboard');
    expect(html).toContain('Refresh data');
    expect(html).toContain('No pages in cache. Refresh to load.');
  });

  it('embeds data in script with topPages and escapes < in JSON', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 1,
      lastFetch: 1000,
      lookbackDays: 30,
      pageSize: 20,
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
    const html = buildDashboardHtml(data, options);
    expect(html).toContain('id="dataPayload"');
    const decoded = getPayloadFromHtml(html);
    expect((decoded.topPages as unknown[])).toHaveLength(1);
    expect(decoded.topPages[0].pagePath).toBe('/blog/');
    expect(decoded.topPages[0].views).toBe(10);
    expect(decoded.cacheSize).toBe(1);
    expect(decoded.topPages).toBeDefined();
  });

  it('table shows values: embedded topPages have views and users so initial render displays cells', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 2,
      lastFetch: 1000,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [
        { pagePath: '/a/', views: 100, users: 50, bounceRate: 0.25, avgSessionDuration: 90, hasFile: false },
        { pagePath: '/b/', views: 200, users: 80, bounceRate: 0.5, avgSessionDuration: 120, hasFile: false },
      ],
    };
    const html = buildDashboardHtml(data, options);
    const decoded = getPayloadFromHtml(html);
    expect(decoded.topPages).toBeDefined();
    expect((decoded.topPages as unknown[]).length).toBe(2);
    expect(decoded.topPages[0].views).toBe(100);
    expect(decoded.topPages[1].views).toBe(200);
    expect(html).toContain('views.toLocaleString()');
    expect(html).toContain('users.toLocaleString()');
    expect(html).toContain('formatDuration(avgDur)');
  });

  it('table is shown when topPages has entries (not empty state)', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 1,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [
        { pagePath: '/blog/', views: 1, users: 1, bounceRate: 0, avgSessionDuration: 0, hasFile: false },
      ],
    };
    const html = buildDashboardHtml(data, options);
    expect(html).toContain("if (!d.topPages || d.topPages.length === 0)");
    expect(html).toContain("tableWrap.style.display = 'block'");
    expect(html).toContain("emptyEl.style.display = 'none'");
    expect(html).toContain('pageRows.map(p =>');
  });

  it('updateData assigns topPages from message so table updates after refresh', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '',
      cacheSize: 0,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [],
    };
    const html = buildDashboardHtml(data, options);
    expect(html).toContain('currentData.topPages = d.topPages');
    expect(html).toContain("type === 'data'");
    expect(html).toContain('updateData(e.data.data)');
  });

  it('uses provided nonce and lang', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '',
      cacheSize: 0,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [],
    };
    const html = buildDashboardHtml(data, options);
    expect(html).toContain('script nonce="test-nonce"');
    expect(html).toContain('lang="en"');
  });

  it('uses initial sort by bounce rate (worst first)', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '',
      cacheSize: 0,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [],
    };
    const html = buildDashboardHtml(data, options);
    expect(html).toContain("sortKey = 'bounceRate'");
    expect(html).toContain('sortDir = -1');
  });

  it('includes CSP with cspSource', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '',
      cacheSize: 0,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [],
    };
    const html = buildDashboardHtml(data, options);
    expect(html).toContain('https://vscode-csp');
  });

  it('includes CSS for active sort column highlight', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '',
      cacheSize: 0,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [],
    };
    const html = buildDashboardHtml(data, options);
    expect(html).toContain('th.th-sort-active');
    expect(html).toContain('th-sort-active');
    expect(html).toContain('list-activeSelectionBackground');
    expect(html).toContain('focusBorder');
  });

  it('includes updateSortIndicator and calls it from render', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '',
      cacheSize: 0,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [],
    };
    const html = buildDashboardHtml(data, options);
    expect(html).toContain('function updateSortIndicator()');
    expect(html).toContain("th.getAttribute('data-sort') === sortKey");
    expect(html).toContain("classList.toggle('th-sort-active'");
    expect(html).toContain('updateSortIndicator();');
  });

  it('embeds resolvedFilePath and renders title attribute for page path tooltip', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 1,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [
        {
          pagePath: '/blog/',
          views: 10,
          users: 5,
          bounceRate: 0.3,
          avgSessionDuration: 60,
          hasFile: true,
          resolvedFilePath: '/workspace/src/pages/blog/index.astro',
        },
      ],
    };
    const html = buildDashboardHtml(data, options);
    const decoded = getPayloadFromHtml(html);
    expect((decoded.topPages as { resolvedFilePath?: string }[])[0].resolvedFilePath).toBe('/workspace/src/pages/blog/index.astro');
    expect(html).toContain('titleAttr');
    expect(html).toContain('p.resolvedFilePath');
  });

  it('renders dynamic route badge when isDynamicRoute is true and dynamicRouteLabel is set', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 1,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [
        {
          pagePath: '/blog/',
          views: 10,
          users: 5,
          bounceRate: 0.3,
          avgSessionDuration: 60,
          hasFile: true,
          isDynamicRoute: true,
        },
      ],
    };
    const html = buildDashboardHtml(data, options);
    expect(html).toContain('dynamic-route-badge');
    expect(html).toContain('dynamic');
  });
});

describe('buildSidebarDashboardHtml', () => {
  const options = { cspSource: 'https://vscode-csp', nonce: 'sidebar-nonce', lang: 'en' };

  it('renders only path and bounce columns (no views, users, avgDuration)', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '',
      cacheSize: 0,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [],
    };
    const html = buildSidebarDashboardHtml(data, options);
    expect(html).toContain('data-sort="pagePath"');
    expect(html).toContain('data-sort="bounceRate"');
    expect(html).not.toContain('data-sort="views"');
    expect(html).not.toContain('data-sort="users"');
    expect(html).not.toContain('data-sort="avgSessionDuration"');
  });

  it('contains required element ids', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '123',
      cacheSize: 0,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [],
    };
    const html = buildSidebarDashboardHtml(data, options);
    expect(html).toContain('id="tbody"');
    expect(html).toContain('id="refreshBtn"');
    expect(html).toContain('id="emptyState"');
    expect(html).toContain('id="notConfiguredBanner"');
    expect(html).toContain('id="propertyId"');
  });

  it('embeds serialized data and uses CSP/nonce/lang options', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 2,
      lastFetch: 1000,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [
        {
          pagePath: '/blog/',
          views: 10,
          users: 5,
          bounceRate: 0.35,
          avgSessionDuration: 60,
          hasFile: true,
        },
      ],
    };
    const html = buildSidebarDashboardHtml(data, options);
    expect(html).toContain('id="dataPayload"');
    const decoded = getPayloadFromHtml(html);
    expect((decoded.topPages as { pagePath: string }[])[0].pagePath).toBe('/blog/');
    expect(decoded.topPages[0].bounceRate).toBe(0.35);
    expect(decoded.topPages).toBeDefined();
    expect(html).toContain('script nonce="sidebar-nonce"');
    expect(html).toContain('lang="en"');
    expect(html).toContain('https://vscode-csp');
  });

  it('row template has only path and bounce (no views/users/duration in row)', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '',
      cacheSize: 1,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [
        {
          pagePath: '/test/',
          views: 99,
          users: 50,
          bounceRate: 0.5,
          avgSessionDuration: 120,
          hasFile: false,
        },
      ],
    };
    const html = buildSidebarDashboardHtml(data, options);
    expect(html).toContain('pageCell');
    expect(html).toContain('bounce-cell');
    expect(html).not.toMatch(/\.toLocaleString\(\)/);
    expect(html).not.toContain('formatDuration');
  });

  it('embeds resolvedFilePath and uses title attribute for page path tooltip', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 1,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [
        {
          pagePath: '/docs/',
          views: 5,
          users: 2,
          bounceRate: 0.2,
          avgSessionDuration: 90,
          hasFile: true,
          resolvedFilePath: '/proj/src/pages/docs/[slug].astro',
        },
      ],
    };
    const html = buildSidebarDashboardHtml(data, options);
    const decoded = getPayloadFromHtml(html);
    expect((decoded.topPages as { resolvedFilePath?: string }[])[0].resolvedFilePath).toBe('/proj/src/pages/docs/[slug].astro');
    expect(html).toContain('titleAttr');
  });

  it('sidebar table shows values: embedded topPages and row template use bounce and path', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 1,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [
        { pagePath: '/sidebar/', views: 42, users: 21, bounceRate: 0.4, avgSessionDuration: 60, hasFile: false },
      ],
    };
    const html = buildSidebarDashboardHtml(data, options);
    const decoded = getPayloadFromHtml(html);
    expect((decoded.topPages as { pagePath: string }[])[0].pagePath).toBe('/sidebar/');
    expect(decoded.topPages[0].bounceRate).toBe(0.4);
    expect(html).toContain('bounceClass(bounceRate)');
    expect(html).toContain('(bounceRate * 100).toFixed(1)');
    expect(html).toContain('pageRows.map(p =>');
  });

  it('sidebar table is shown when topPages has entries', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 1,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [
        { pagePath: '/x/', views: 1, users: 1, bounceRate: 0, avgSessionDuration: 0, hasFile: false },
      ],
    };
    const html = buildSidebarDashboardHtml(data, options);
    expect(html).toContain("tableWrap.style.display = 'block'");
    expect(html).toContain("emptyEl.style.display = 'none'");
  });

  it('sidebar updateData assigns topPages so table updates after refresh', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '',
      cacheSize: 0,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [],
    };
    const html = buildSidebarDashboardHtml(data, options);
    expect(html).toContain('currentData.topPages = d.topPages');
    expect(html).toContain('updateData(e.data.data)');
  });

  it('renders dynamic route badge when isDynamicRoute is true', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 1,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [
        {
          pagePath: '/post/',
          views: 1,
          users: 1,
          bounceRate: 0,
          avgSessionDuration: 0,
          hasFile: true,
          isDynamicRoute: true,
        },
      ],
    };
    const html = buildSidebarDashboardHtml(data, options);
    expect(html).toContain('dynamic-route-badge');
    expect(html).toContain('dynamic');
  });
});
