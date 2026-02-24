/**
 * Outputs dashboard HTML and decoded payload for inspection.
 * Run: pnpm test -- tests/integration/dashboard-output.test.ts
 * Output: out/dashboard-full.html, out/dashboard-sidebar.html, out/dashboard-payload.json
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildDashboardHtml,
  buildSidebarDashboardHtml,
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
    '/api/v1/email/person-avatar/philipp-dangelo/',
    '/icons/logo/thinkport-venitus-dark.png/',
    '/blog/post-with-dashes.html',
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

const outDir = path.join(process.cwd(), 'dashboard-output');

describe('Dashboard output (inspect generated HTML)', () => {
  it('writes full and sidebar dashboard HTML plus decoded payload to out/', () => {
    const data: DashboardData = {
      configured: true,
      propertyId: '364493652',
      cacheSize: 101,
      lastFetch: Date.now(),
      lookbackDays: 30,
      pageSize: 20,
      topPages: createRealisticTopPages(101),
    };

    const fullHtml = buildDashboardHtml(data, options);
    const sidebarHtml = buildSidebarDashboardHtml(data, options);

    const decoded = getPayloadFromHtml(fullHtml);
    if (!decoded || !decoded.topPages) (decoded as Record<string, unknown>).error = 'no payload found';

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(path.join(outDir, 'dashboard-full.html'), fullHtml, 'utf8');
    fs.writeFileSync(path.join(outDir, 'dashboard-sidebar.html'), sidebarHtml, 'utf8');
    fs.writeFileSync(
      path.join(outDir, 'dashboard-payload.json'),
      JSON.stringify(decoded, null, 2),
      'utf8'
    );

    // eslint-disable-next-line no-console
    console.log('\n--- Dashboard output ---');
    // eslint-disable-next-line no-console
    console.log('Full HTML length:', fullHtml.length);
    // eslint-disable-next-line no-console
    console.log('Sidebar HTML length:', sidebarHtml.length);
    // eslint-disable-next-line no-console
    console.log('Payload topPages count:', decoded.topPages?.length ?? 0);
    // eslint-disable-next-line no-console
    console.log('Payload cacheSize:', decoded.cacheSize);
    // eslint-disable-next-line no-console
    console.log('Sample page:', decoded.topPages?.[0] ? JSON.stringify(decoded.topPages[0], null, 2) : 'none');
    // eslint-disable-next-line no-console
    console.log('\nWritten to: dashboard-output/dashboard-full.html, dashboard-output/dashboard-sidebar.html, dashboard-output/dashboard-payload.json');

    expect(fullHtml.length).toBeGreaterThan(0);
    expect(decoded.topPages).toHaveLength(101);
  });
});
