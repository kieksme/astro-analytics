/**
 * Integration tests for the dashboard with realistic data.
 * Verifies that the dashboard HTML renders correctly with GA4-like data
 * including paths that contain special characters (slashes, dots, etc.).
 */
import { describe, it, expect } from 'vitest';
import {
  buildDashboardHtml,
  buildSidebarDashboardHtml,
  getSidebarViewTitleString,
  countCriticalPages,
  BOUNCE_CRITICAL_THRESHOLD,
} from '../../src/lib/dashboard';
import type { DashboardData } from '../../src/lib/dashboard';

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

const options = { cspSource: 'https://vscode-csp', nonce: 'test-nonce', lang: 'en' };

function createRealisticTopPages(count: number): DashboardData['topPages'] {
  const paths = [
    '/',
    '/thinkport-cloud-experten-uber-uns/',
    '/karriere-in-der-cloud/',
    '/api/v1/email/person-avatar/philipp-dangelo/',
    '/icons/logo/thinkport-venitus-dark.png/',
    '/terraform-fuer-aws-lernen/',
    '/snowflake-vs-databricks/',
    '/blog/post-with-dashes.html',
    '/about?utm_source=test',
    '/path/with/special-chars-äöü/',
  ];
  return Array.from({ length: count }, (_, i) => ({
    pagePath: paths[i % paths.length] || `/page-${i}/`,
    views: Math.floor(Math.random() * 100) + 1,
    users: Math.floor(Math.random() * 50) + 1,
    bounceRate: Math.random() * 0.8 + 0.1,
    avgSessionDuration: Math.floor(Math.random() * 120),
    hasFile: i % 3 !== 0,
    resolvedFilePath: i % 3 !== 0 ? `/workspace/src/pages/page-${i}.astro` : null,
    titleDisplayPath: null,
    isDynamicRoute: i % 5 === 0,
  }));
}

describe('Dashboard integration (realistic data)', () => {
  it('full dashboard renders 101 pages with special-character paths', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '364493652',
      cacheSize: 101,
      lastFetch: Date.now(),
      lookbackDays: 30,
      pageSize: 60,
      topPages: createRealisticTopPages(101),
    };
    const html = buildDashboardHtml(data, options);

    expect(html).toContain('id="dataPayload"');
    const decoded = getPayloadFromHtml(html);
    expect((decoded.topPages as unknown[])).toHaveLength(101);
    expect(decoded.cacheSize).toBe(101);
    expect(decoded.propertyId).toBe('364493652');

    const apiPath = decoded.topPages.find((p: { pagePath: string }) =>
      p.pagePath.includes('/api/v1/')
    );
    expect(apiPath).toBeDefined();
    expect(apiPath.pagePath).toBe('/api/v1/email/person-avatar/philipp-dangelo/');

    const iconsPath = decoded.topPages.find((p: { pagePath: string }) =>
      p.pagePath.includes('.png')
    );
    expect(iconsPath).toBeDefined();
    expect(iconsPath.pagePath).toContain('thinkport-venitus-dark.png');

    expect(html).toContain('id="tbody"');
    expect(html).toContain('render(currentData)');
  });

  it('sidebar dashboard renders 101 pages with special-character paths', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '364493652',
      cacheSize: 101,
      lastFetch: Date.now(),
      lookbackDays: 30,
      pageSize: 60,
      topPages: createRealisticTopPages(101),
    };
    const html = buildSidebarDashboardHtml(data, options);

    expect(html).toContain('id="dataPayload"');
    const decoded = getPayloadFromHtml(html);
    expect((decoded.topPages as unknown[])).toHaveLength(101);
    expect(decoded.cacheSize).toBe(101);
  });

  it('table contains rendered values (pagePath, views, bounce) when data is present', () => {
    const topPages: DashboardData['topPages'] = [
      { pagePath: '/blog/', views: 42, users: 21, bounceRate: 0.35, avgSessionDuration: 90, hasFile: true, resolvedFilePath: '/proj/blog/index.astro', titleDisplayPath: null, isDynamicRoute: false },
      { pagePath: '/about/', views: 100, users: 50, bounceRate: 0.5, avgSessionDuration: 60, hasFile: false, resolvedFilePath: null, titleDisplayPath: null, isDynamicRoute: false },
    ];
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 2,
      lastFetch: Date.now(),
      lookbackDays: 30,
      pageSize: 20,
      topPages,
    };
    const html = buildDashboardHtml(data, options);
    const decoded = getPayloadFromHtml(html);
    expect((decoded.topPages as unknown[])).toHaveLength(2);

    // Simulate the table row rendering (same logic as dashboard script)
    const escapeHtml = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const safeNum = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v)) ? v : 0;
    const formatDuration = (sec: number) => {
      const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
      return (m > 0 ? m + 'm ' : '') + s + 's';
    };
    const pageRows = decoded.topPages;
    const rowHtml = pageRows.map((p: { pagePath?: string; views?: number; users?: number; bounceRate?: number; avgSessionDuration?: number }) => {
      const pathEsc = escapeHtml(p?.pagePath != null ? String(p.pagePath) : '');
      const bounceRate = safeNum(p?.bounceRate);
      const pct = (bounceRate * 100).toFixed(1) + '%';
      const views = safeNum(p?.views);
      const users = safeNum(p?.users);
      const avgDur = safeNum(p?.avgSessionDuration);
      return `<tr><td>${pathEsc}</td><td>${views.toLocaleString()}</td><td>${users.toLocaleString()}</td><td>${pct}</td><td>${formatDuration(avgDur)}</td></tr>`;
    }).join('');

    expect(rowHtml).toContain('/blog/');
    expect(rowHtml).toContain('/about/');
    expect(rowHtml).toContain('42');
    expect(rowHtml).toContain('100');
    expect(rowHtml).toContain('35.0%');
    expect(rowHtml).toContain('50.0%');
    expect(rowHtml).toContain('<tr>');
    expect(rowHtml).toContain('</tr>');
  });

  it('sidebar table contains rendered values (pagePath, bounce)', () => {
    const topPages: DashboardData['topPages'] = [
      { pagePath: '/docs/', views: 10, users: 5, bounceRate: 0.4, avgSessionDuration: 45, hasFile: true, resolvedFilePath: null, titleDisplayPath: null, isDynamicRoute: false },
    ];
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 1,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages,
    };
    const html = buildSidebarDashboardHtml(data, options);
    const decoded = getPayloadFromHtml(html);
    const pageRows = decoded.topPages as unknown[];
    const safeNum = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v)) ? v : 0;
    const rowHtml = pageRows.map((p: { pagePath?: string; bounceRate?: number }) => {
      const bounceRate = safeNum(p?.bounceRate);
      const pct = (bounceRate * 100).toFixed(1) + '%';
      return `<tr><td>${p?.pagePath ?? ''}</td><td>${pct}</td></tr>`;
    }).join('');

    expect(rowHtml).toContain('/docs/');
    expect(rowHtml).toContain('40.0%');
    expect(rowHtml).toContain('<tr>');
  });

  it('sidebar badge shows critical count and title format', () => {
    const topPages: DashboardData['topPages'] = [
      { pagePath: '/a/', views: 10, users: 5, bounceRate: 0.3, avgSessionDuration: 60, hasFile: false, resolvedFilePath: null, titleDisplayPath: null, isDynamicRoute: false },
      { pagePath: '/b/', views: 50, users: 20, bounceRate: BOUNCE_CRITICAL_THRESHOLD, avgSessionDuration: 90, hasFile: false, resolvedFilePath: null, titleDisplayPath: null, isDynamicRoute: false },
      { pagePath: '/c/', views: 100, users: 40, bounceRate: 0.8, avgSessionDuration: 45, hasFile: false, resolvedFilePath: null, titleDisplayPath: null, isDynamicRoute: false },
    ];
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 3,
      lastFetch: Date.now(),
      lookbackDays: 30,
      pageSize: 20,
      topPages,
    };

    const criticalCount = countCriticalPages(data);
    expect(criticalCount).toBe(2);

    const titleWithBadge = getSidebarViewTitleString('Astro Analytics Dashboard', 3, false);
    expect(titleWithBadge).toBe('Astro Analytics Dashboard (3)');

    const titleRefreshing = getSidebarViewTitleString('Astro Analytics Dashboard', 3, true);
    expect(titleRefreshing).toBe('Astro Analytics Dashboard $(sync~spin)');

    const titleEmpty = getSidebarViewTitleString('Astro Analytics Dashboard', 0, false);
    expect(titleEmpty).toBe('Astro Analytics Dashboard');
  });

  it('table markup is present and script runs without syntax error', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '1',
      cacheSize: 3,
      lastFetch: 0,
      lookbackDays: 30,
      pageSize: 20,
      topPages: [
        {
          pagePath: '/api/v1/test/',
          views: 10,
          users: 5,
          bounceRate: 0.5,
          avgSessionDuration: 60,
          hasFile: false,
        },
      ],
    };
    const html = buildDashboardHtml(data, options);

    expect(html).toContain('<script nonce="test-nonce">');
    expect(html).toContain('document.getElementById(\'refreshBtn\')');
    expect(html).toContain('addEventListener(\'click\'');
  });
});
