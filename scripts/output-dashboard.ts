/**
 * Outputs dashboard HTML and decoded payload for inspection.
 * Run: npx tsx scripts/output-dashboard.ts
 *   or: pnpm exec tsx scripts/output-dashboard.ts
 * Output: dashboard-output/dashboard-full.html, dashboard-output/dashboard-sidebar.html, dashboard-output/dashboard-payload.json
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  buildDashboardHtml,
  buildSidebarDashboardHtml,
} from '../src/lib/dashboard';
import type { DashboardData } from '../src/lib/dashboard';

function decodeBase64(b64: string): string {
  return Buffer.from(b64, 'base64').toString('utf8');
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

const payloadMatch = fullHtml.match(/data-payload="([^"]+)"/);
const decoded = payloadMatch
  ? JSON.parse(decodeBase64(payloadMatch[1]))
  : { error: 'no payload found' };

const outDir = path.join(process.cwd(), 'dashboard-output');
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

console.log('\n--- Dashboard output ---');
console.log('Full HTML length:', fullHtml.length);
console.log('Sidebar HTML length:', sidebarHtml.length);
console.log('Payload topPages count:', decoded.topPages?.length ?? 0);
console.log('Payload cacheSize:', decoded.cacheSize);
console.log('Sample page:', decoded.topPages?.[0] ? JSON.stringify(decoded.topPages[0], null, 2) : 'none');
console.log('\nWritten to: dashboard-output/dashboard-full.html, dashboard-output/dashboard-sidebar.html, dashboard-output/dashboard-payload.json');
