import * as fs from 'fs';
import * as vscode from 'vscode';
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';
import { filePathToSlug, slugToFilePaths, normalizePagePath } from './lib/slug';
import { bounceColor, fmtPct, fmtDuration } from './lib/format';

/** Localization: use vscode.l10n when available (VS Code 1.74+), else return message key. */
function l10nT(message: string, ...args: (string | number | boolean)[]): string {
  const l10n = (vscode as { l10n?: { t: (m: string, ...a: (string | number | boolean)[]) => string } }).l10n;
  return l10n ? l10n.t(message, ...args) : (args.length ? message.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? '')) : message);
}

/** Current UI language (e.g. 'de', 'en'). */
function uiLanguage(): string {
  return (vscode as { env?: { language?: string } }).env?.language ?? 'en';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PageMetrics {
  pagePath: string;
  views: number;
  users: number;
  bounceRate: number;          // 0–1
  avgSessionDuration: number;  // seconds
}

// ---------------------------------------------------------------------------
// GA4 Data API helper
// ---------------------------------------------------------------------------
async function fetchAnalyticsData(
  propertyId: string,
  credentialsPath: string,
  lookbackDays: number
): Promise<PageMetrics[]> {
  // Resolve credentials
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (credentialsPath) {
    env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  }

  const auth = new GoogleAuth({
    keyFilename: credentialsPath || undefined,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) {
    throw new Error('Could not obtain access token. Check your credentials.');
  }

  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const body = {
    dateRanges: [{ startDate: `${lookbackDays}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'activeUsers' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
    ],
    limit: 1000,
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GA4 API error ${response.status}: ${text}`);
  }

  const json = (await response.json()) as any;
  const rows: PageMetrics[] = (json.rows ?? []).map((row: any) => ({
    pagePath: row.dimensionValues[0].value as string,
    views: parseInt(row.metricValues[0].value, 10),
    users: parseInt(row.metricValues[1].value, 10),
    bounceRate: parseFloat(row.metricValues[2].value),
    avgSessionDuration: parseFloat(row.metricValues[3].value),
  }));

  return rows;
}

/** Bounce rate (0–1) to ThemeColor for Explorer badge. Returns undefined for good (default style). */
function bounceThemeColor(rate: number): vscode.ThemeColor | undefined {
  if (rate < 0.25) return new vscode.ThemeColor('testing.iconPassed');
  if (rate < 0.45) return new vscode.ThemeColor('editorWarning.foreground');
  if (rate < 0.65) return new vscode.ThemeColor('editorWarning.foreground');
  return new vscode.ThemeColor('editorError.foreground');
}

// ---------------------------------------------------------------------------
// Extension state
// ---------------------------------------------------------------------------
let metricsCache = new Map<string, PageMetrics>(); // keyed by normalized pagePath (with trailing slash)
let lastFetch = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;
let dashboardPanel: vscode.WebviewPanel | undefined;
let fileDecorationProvider: AnalyticsFileDecorationProvider;

// ---------------------------------------------------------------------------
// CodeLens provider
// ---------------------------------------------------------------------------
class AnalyticsCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  refresh() { this._onDidChangeCodeLenses.fire(); }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const wsFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!wsFolder) return [];

    const config = vscode.workspace.getConfiguration('astroAnalytics');
    const contentRoot = config.get<string>('contentRoot', 'src/content');
    const pagesRoot = config.get<string>('pagesRoot', 'src/pages');

    const slug = filePathToSlug(document.uri.fsPath, wsFolder.uri.fsPath, contentRoot, pagesRoot);
    if (!slug) return [];

    const metrics = metricsCache.get(slug) ?? metricsCache.get(normalizePagePath(slug));
    const range = new vscode.Range(0, 0, 0, 0);

    if (!metrics) {
      return [
        new vscode.CodeLens(range, {
          title: `$(graph) ${l10nT('codelens.noData')}`,
          command: 'astro-analytics.refresh',
        }),
      ];
    }

    const bounceIcon = bounceColor(metrics.bounceRate);
    const locale = uiLanguage();
    const lenses: vscode.CodeLens[] = [
      new vscode.CodeLens(range, {
        title: `$(${bounceIcon}) ${l10nT('codelens.title', fmtPct(metrics.bounceRate), metrics.views.toLocaleString(locale), metrics.users.toLocaleString(locale), fmtDuration(metrics.avgSessionDuration))}`,
        command: 'astro-analytics.refresh',
        tooltip: l10nT('codelens.tooltip'),
      }),
    ];

    return lenses;
  }
}

// ---------------------------------------------------------------------------
// Hover provider
// ---------------------------------------------------------------------------
class AnalyticsHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | null {
    // Only show hover on first 5 lines (frontmatter area)
    if (position.line > 10) return null;

    const wsFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!wsFolder) return null;

    const config = vscode.workspace.getConfiguration('astroAnalytics');
    const contentRoot = config.get<string>('contentRoot', 'src/content');
    const pagesRoot = config.get<string>('pagesRoot', 'src/pages');

    const slug = filePathToSlug(document.uri.fsPath, wsFolder.uri.fsPath, contentRoot, pagesRoot);
    if (!slug) return null;

    const metrics = metricsCache.get(slug) ?? metricsCache.get(normalizePagePath(slug));
    if (!metrics) return null;

    const bounceIcon = bounceColor(metrics.bounceRate);
    const locale = uiLanguage();
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = false;
    md.appendMarkdown(`### $(graph) ${l10nT('hover.analyticsTitle')}\`${slug}\`\n\n`);
    md.appendMarkdown(`| ${l10nT('hover.metric')} | ${l10nT('hover.value')} |\n|---|---|\n`);
    md.appendMarkdown(`| $(${bounceIcon}) ${l10nT('hover.bounceRate')} | **${fmtPct(metrics.bounceRate)}** |\n`);
    md.appendMarkdown(`| $(eye) ${l10nT('hover.pageViews')} | **${metrics.views.toLocaleString(locale)}** |\n`);
    md.appendMarkdown(`| $(person) ${l10nT('hover.activeUsers')} | **${metrics.users.toLocaleString(locale)}** |\n`);
    md.appendMarkdown(`| $(watch) ${l10nT('hover.avgSessionDuration')} | **${fmtDuration(metrics.avgSessionDuration)}** |\n`);
    const footer = `*${l10nT('hover.footer', String(config.get<number>('lookbackDays', 30)), config.get<string>('propertyId') ?? '')}*`;
    md.appendMarkdown(`\n\n${footer}`);

    return new vscode.Hover(md);
  }
}

// ---------------------------------------------------------------------------
// File decoration provider (Explorer: bounce rate badge at filename level)
// ---------------------------------------------------------------------------
class AnalyticsFileDecorationProvider implements vscode.FileDecorationProvider {
  private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  refresh(): void {
    this._onDidChangeFileDecorations.fire(undefined);
  }

  provideFileDecoration(
    uri: vscode.Uri,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FileDecoration> {
    if (!uri.fsPath.match(/\.(md|mdx|astro)$/)) return undefined;

    const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!wsFolder) return undefined;

    const config = vscode.workspace.getConfiguration('astroAnalytics');
    const contentRoot = config.get<string>('contentRoot', 'src/content');
    const pagesRoot = config.get<string>('pagesRoot', 'src/pages');

    const slug = filePathToSlug(uri.fsPath, wsFolder.uri.fsPath, contentRoot, pagesRoot);
    if (!slug) return undefined;

    const metrics = metricsCache.get(slug) ?? metricsCache.get(normalizePagePath(slug));
    if (!metrics) return undefined;

    const locale = uiLanguage();
    const badge = (metrics.bounceRate * 100).toFixed(0) + '%';
    const tooltip = l10nT('decoration.tooltip', fmtPct(metrics.bounceRate), metrics.views.toLocaleString(locale), metrics.users.toLocaleString(locale), fmtDuration(metrics.avgSessionDuration));
    const color = bounceThemeColor(metrics.bounceRate);
    return new vscode.FileDecoration(badge, tooltip, color);
  }
}

// ---------------------------------------------------------------------------
// Status bar update
// ---------------------------------------------------------------------------
function updateStatusBar(document: vscode.TextDocument | undefined) {
  if (!document || !document.fileName.match(/\.(md|mdx|astro)$/)) {
    statusBarItem.hide();
    return;
  }

  const wsFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!wsFolder) { statusBarItem.hide(); return; }

  const config = vscode.workspace.getConfiguration('astroAnalytics');
  const contentRoot = config.get<string>('contentRoot', 'src/content');
  const pagesRoot = config.get<string>('pagesRoot', 'src/pages');

  const slug = filePathToSlug(document.uri.fsPath, wsFolder.uri.fsPath, contentRoot, pagesRoot);
  if (!slug) { statusBarItem.hide(); return; }

  const metrics = metricsCache.get(slug) ?? metricsCache.get(normalizePagePath(slug));
  const locale = uiLanguage();
  if (!metrics) {
    statusBarItem.text = `$(graph) ${l10nT('status.analyticsNone')}`;
    statusBarItem.tooltip = l10nT('status.noDataTooltip', slug);
    statusBarItem.accessibilityInformation = { label: l10nT('status.noDataA11y', slug), role: 'status' };
    statusBarItem.show();
    return;
  }

  const bounceIcon = bounceColor(metrics.bounceRate);
  statusBarItem.text = `$(graph) $(${bounceIcon}) ${fmtPct(metrics.bounceRate)} ${l10nT('status.text', metrics.views.toLocaleString(locale))}`;
  statusBarItem.tooltip = l10nT('status.tooltip', fmtPct(metrics.bounceRate), String(metrics.views), String(metrics.users), fmtDuration(metrics.avgSessionDuration));
  statusBarItem.accessibilityInformation = {
    label: l10nT('status.a11y', fmtPct(metrics.bounceRate), String(metrics.views), String(metrics.users)),
    role: 'status',
  };
  statusBarItem.command = 'astro-analytics.refresh';
  statusBarItem.show();
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Resolve pagePath to the first existing workspace file, or null if none. */
function resolvePagePathToFile(pagePath: string): string | null {
  const wsFolder = vscode.workspace.workspaceFolders?.[0];
  if (!wsFolder) return null;
  const config = vscode.workspace.getConfiguration('astroAnalytics');
  const contentRoot = config.get<string>('contentRoot', 'src/content');
  const pagesRoot = config.get<string>('pagesRoot', 'src/pages');
  const candidates = slugToFilePaths(wsFolder.uri.fsPath, contentRoot, pagesRoot, pagePath);
  const found = candidates.find(p => fs.existsSync(p));
  return found ?? null;
}

/** Resolve pagePath to a workspace file and open it. */
function openPageInEditor(pagePath: string): void {
  const wsFolder = vscode.workspace.workspaceFolders?.[0];
  if (!wsFolder) {
    vscode.window.showWarningMessage(l10nT('msg.noWorkspace'));
    return;
  }
  const found = resolvePagePathToFile(pagePath);
  if (!found) {
    vscode.window.showWarningMessage(l10nT('msg.noFileForPath', pagePath));
    return;
  }
  vscode.window.showTextDocument(vscode.Uri.file(found));
}

/** Serializable summary for the dashboard webview. */
function getDashboardData(): {
  configured: boolean;
  propertyId: string;
  cacheSize: number;
  lastFetch: number;
  lookbackDays: number;
  topPages: Array<{ pagePath: string; views: number; users: number; bounceRate: number; avgSessionDuration: number; hasFile: boolean }>;
} {
  const config = vscode.workspace.getConfiguration('astroAnalytics');
  const propertyId = config.get<string>('propertyId', '');
  const lookbackDays = config.get<number>('lookbackDays', 30);
  const entries = Array.from(metricsCache.entries());
  const topPages = entries
    .sort((a, b) => b[1].views - a[1].views)
    .slice(0, 20)
    .map(([path, m]) => ({
      pagePath: path,
      views: m.views,
      users: m.users,
      bounceRate: m.bounceRate,
      avgSessionDuration: m.avgSessionDuration,
      hasFile: resolvePagePathToFile(path) !== null,
    }));
  return {
    configured: !!propertyId,
    propertyId,
    cacheSize: metricsCache.size,
    lastFetch,
    lookbackDays,
    topPages,
  };
}

function getDashboardHtml(webview: vscode.Webview, data: ReturnType<typeof getDashboardData>): string {
  const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const dataJson = JSON.stringify(data);
  const l10n = {
    title: l10nT('dashboard.title'),
    propertyId: l10nT('dashboard.propertyId'),
    pagesInCache: l10nT('dashboard.pagesInCache'),
    lastFetch: l10nT('dashboard.lastFetch'),
    lookback: l10nT('dashboard.lookback'),
    days: l10nT('dashboard.days'),
    refreshData: l10nT('dashboard.refreshData'),
    page: l10nT('dashboard.page'),
    views: l10nT('dashboard.views'),
    users: l10nT('dashboard.users'),
    bounce: l10nT('dashboard.bounce'),
    avgDuration: l10nT('dashboard.avgDuration'),
    emptyState: l10nT('dashboard.emptyState'),
    notSet: l10nT('dashboard.notSet'),
    legendGood: l10nT('dashboard.legendGood'),
    legendWarning: l10nT('dashboard.legendWarning'),
    legendHigh: l10nT('dashboard.legendHigh'),
    legendCritical: l10nT('dashboard.legendCritical'),
  };
  const l10nJson = JSON.stringify(l10n).replace(/</g, '\\u003c');
  const sortSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M4 6h8l-4-4-4 4zm0 4l4 4 4-4H4z"/></svg>';
  return `<!DOCTYPE html>
<html lang="${uiLanguage()}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' ${webview.cspSource};">
  <title>${l10n.title}</title>
  <style>
    body { font-family: var(--vscode-font-family); padding: 1rem; color: var(--vscode-foreground); margin: 0; }
    .dashboard-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
    .dashboard-header svg { flex-shrink: 0; }
    h1 { font-size: 1.2rem; margin: 0; font-weight: 600; }
    .meta { margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0 1rem; }
    .meta span { font-size: 0.9em; }
    .btn-refresh { display: inline-flex; align-items: center; gap: 0.4rem; margin-top: 0.5rem; padding: 0.4rem 0.8rem; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; font-size: inherit; }
    .btn-refresh:hover { background: var(--vscode-button-hoverBackground); }
    .btn-refresh svg { width: 14px; height: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--vscode-widget-border); }
    th { font-weight: 600; cursor: pointer; user-select: none; white-space: nowrap; }
    th:hover { background: var(--vscode-list-hoverBackground); }
    th .sort-icon { display: inline-block; vertical-align: middle; margin-left: 2px; opacity: 0.6; }
    tbody tr:hover { background: var(--vscode-list-hoverBackground); }
    .page-link { color: var(--vscode-textLink-foreground); text-decoration: none; cursor: pointer; }
    .page-link:hover { text-decoration: underline; }
    .page-text { color: var(--vscode-foreground); cursor: default; }
    .bounce-cell { display: flex; align-items: center; gap: 0.35rem; }
    .bounce-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .bounce-good .bounce-dot { background: var(--vscode-testing-iconPassed, #22c55e); }
    .bounce-warning .bounce-dot { background: var(--vscode-editorWarning-foreground, #eab308); }
    .bounce-high .bounce-dot { background: #f97316; }
    .bounce-critical .bounce-dot { background: var(--vscode-errorForeground, #ef4444); }
    .empty-state { padding: 1.5rem; text-align: center; color: var(--vscode-descriptionForeground); }
    .legend { margin-top: 0.75rem; font-size: 0.8em; color: var(--vscode-descriptionForeground); display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; }
    .legend span { display: inline-flex; align-items: center; gap: 0.25rem; }
  </style>
</head>
<body>
  <div class="dashboard-header">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="24" height="24"><path fill="currentColor" d="M4 20v-4h4v4H4zm6 0v-8h4v8h-4zm6 0V8h4v12h-4zm6 0V4h4v16h-4z"/></svg>
    <h1>${l10n.title}</h1>
  </div>
  <div class="meta">
    <span><strong>${l10n.propertyId}</strong> <span id="propertyId">-</span></span>
    <span><strong>${l10n.pagesInCache}</strong> <span id="cacheSize">0</span></span>
    <span><strong>${l10n.lastFetch}</strong> <span id="lastFetch">-</span></span>
    <span><strong>${l10n.lookback}</strong> <span id="lookbackDays">-</span> ${l10n.days}</span>
  </div>
  <button type="button" class="btn-refresh" id="refreshBtn"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="currentColor" d="M8 2a6 6 0 1 1-4.5 2.02L6 5h3V2l2.5 2.5L9 7V4H7.17A4 4 0 1 0 8 14a4 4 0 0 0 3.5-2.08l1.2.92A6 6 0 1 1 8 2z"/></svg> ${l10n.refreshData}</button>
  <div id="tableWrap">
    <table>
      <thead><tr>
        <th data-sort="pagePath">${l10n.page} <span class="sort-icon">${sortSvg}</span></th>
        <th data-sort="views">${l10n.views} <span class="sort-icon">${sortSvg}</span></th>
        <th data-sort="users">${l10n.users} <span class="sort-icon">${sortSvg}</span></th>
        <th data-sort="bounceRate">${l10n.bounce} <span class="sort-icon">${sortSvg}</span></th>
        <th data-sort="avgSessionDuration">${l10n.avgDuration} <span class="sort-icon">${sortSvg}</span></th>
      </tr></thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>
  <div id="emptyState" class="empty-state" style="display:none;">${l10n.emptyState}</div>
  <div class="legend" id="legend"><span class="bounce-good"><span class="bounce-dot"></span> ${l10n.legendGood}</span><span class="bounce-warning"><span class="bounce-dot"></span> ${l10n.legendWarning}</span><span class="bounce-high"><span class="bounce-dot"></span> ${l10n.legendHigh}</span><span class="bounce-critical"><span class="bounce-dot"></span> ${l10n.legendCritical}</span></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const l10n = ${l10nJson};
    const data = ${dataJson.replace(/</g, '\\u003c')};

    function bounceClass(rate) {
      if (rate < 0.25) return 'bounce-good';
      if (rate < 0.45) return 'bounce-warning';
      if (rate < 0.65) return 'bounce-high';
      return 'bounce-critical';
    }
    function formatDuration(sec) {
      const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
      return (m > 0 ? m + 'm ' : '') + s + 's';
    }
    function escapeHtml(s) { const div = document.createElement('div'); div.textContent = s; return div.innerHTML; }

    let sortKey = 'views';
    let sortDir = -1;
    function sortData(pages) {
      const key = sortKey;
      const dir = sortDir;
      return [...pages].sort((a, b) => {
        let va = a[key], vb = b[key];
        if (key === 'pagePath') { va = (va || '').toLowerCase(); vb = (vb || '').toLowerCase(); return (va < vb ? -1 : va > vb ? 1 : 0) * dir; }
        return (va - vb) * dir;
      });
    }

    function render(d) {
      document.getElementById('propertyId').textContent = d.configured ? d.propertyId : l10n.notSet;
      document.getElementById('cacheSize').textContent = String(d.cacheSize);
      document.getElementById('lastFetch').textContent = d.lastFetch ? new Date(d.lastFetch).toLocaleString() : '-';
      document.getElementById('lookbackDays').textContent = String(d.lookbackDays);
      const tbody = document.getElementById('tbody');
      const emptyEl = document.getElementById('emptyState');
      const tableWrap = document.getElementById('tableWrap');
      if (!d.topPages || d.topPages.length === 0) {
        tableWrap.style.display = 'none';
        emptyEl.style.display = 'block';
        tbody.innerHTML = '';
        return;
      }
      tableWrap.style.display = 'block';
      emptyEl.style.display = 'none';
      const sorted = sortData(d.topPages);
      tbody.innerHTML = sorted.map(p => {
        const pathEsc = escapeHtml(p.pagePath);
        const bounceCl = bounceClass(p.bounceRate);
        const pct = (p.bounceRate * 100).toFixed(1) + '%';
        const pageCell = p.hasFile
          ? '<a class="page-link" href="#" data-page-path="' + escapeHtml(p.pagePath) + '">' + pathEsc + '</a>'
          : '<span class="page-text">' + pathEsc + '</span>';
        return '<tr><td>' + pageCell + '</td><td>' + p.views.toLocaleString() + '</td><td>' + p.users.toLocaleString() + '</td><td class="bounce-cell ' + bounceCl + '"><span class="bounce-dot"></span>' + pct + '</td><td>' + formatDuration(p.avgSessionDuration) + '</td></tr>';
      }).join('');
      tbody.querySelectorAll('.page-link').forEach(el => {
        el.addEventListener('click', e => { e.preventDefault(); vscode.postMessage({ type: 'openPage', pagePath: el.getAttribute('data-page-path') }); });
      });
    }

    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (sortKey === key) sortDir = -sortDir; else { sortKey = key; sortDir = (key === 'pagePath' ? 1 : -1); }
        render(currentData);
      });
    });

    const currentData = { topPages: data.topPages, configured: data.configured, propertyId: data.propertyId, cacheSize: data.cacheSize, lastFetch: data.lastFetch, lookbackDays: data.lookbackDays };
    function updateData(d) {
      currentData.topPages = d.topPages;
      currentData.configured = d.configured;
      currentData.propertyId = d.propertyId;
      currentData.cacheSize = d.cacheSize;
      currentData.lastFetch = d.lastFetch;
      currentData.lookbackDays = d.lookbackDays;
      render(currentData);
    }
    render(currentData);
    window.addEventListener('message', e => { if (e.data && e.data.type === 'data') updateData(e.data.data); });
    document.getElementById('refreshBtn').onclick = () => vscode.postMessage({ type: 'refresh' });
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Test API connection (for debugging)
// ---------------------------------------------------------------------------
async function testConnection() {
  const config = vscode.workspace.getConfiguration('astroAnalytics');
  const propertyId = config.get<string>('propertyId', '');
  const credentialsPath = config.get<string>('credentialsPath', '');
  const lookbackDays = config.get<number>('lookbackDays', 30);

  outputChannel.clear();
  outputChannel.show(true);
  outputChannel.appendLine('--- Astro Analytics: Test API Connection ---');
  outputChannel.appendLine(`Property ID: ${propertyId || '(not set)'}`);
  outputChannel.appendLine(`Credentials: ${credentialsPath || '(default ADC)'}`);
  outputChannel.appendLine(`Lookback: ${lookbackDays} days`);
  outputChannel.appendLine('');

  if (!propertyId) {
    outputChannel.appendLine('[ERROR] Set astroAnalytics.propertyId in settings first.');
    return;
  }

  const resolvedCreds = credentialsPath.replace(/^~/, process.env.HOME ?? '');

  try {
    outputChannel.appendLine('Calling GA4 Data API…');
    const data = await fetchAnalyticsData(propertyId, resolvedCreds, lookbackDays);
    outputChannel.appendLine(`[OK] Fetched ${data.length} page paths from GA4.`);
    outputChannel.appendLine('');
    outputChannel.appendLine('First 15 pagePaths from GA4 (these must match your file slugs):');
    data.slice(0, 15).forEach((m, i) => {
      outputChannel.appendLine(`  ${i + 1}. "${m.pagePath}" → normalized: "${normalizePagePath(m.pagePath)}" (${m.views} views)`);
    });
    if (data.length > 15) {
      outputChannel.appendLine(`  … and ${data.length - 15} more.`);
    }

    const doc = vscode.window.activeTextEditor?.document;
    if (doc?.fileName.match(/\.(md|mdx|astro)$/)) {
      const wsFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
      if (wsFolder) {
        const contentRoot = config.get<string>('contentRoot', 'src/content');
        const pagesRoot = config.get<string>('pagesRoot', 'src/pages');
        const slug = filePathToSlug(doc.uri.fsPath, wsFolder.uri.fsPath, contentRoot, pagesRoot);
        outputChannel.appendLine('');
        outputChannel.appendLine(`Current file slug for matching: "${slug ?? '(none)'}"`);
        if (slug) {
          const normalized = normalizePagePath(slug);
          const found = data.some(m => normalizePagePath(m.pagePath) === normalized || normalizePagePath(m.pagePath) === slug);
          outputChannel.appendLine(found ? '  → Match found in GA4 data.' : '  → No match in GA4 data (check contentRoot/pagesRoot and path structure).');
        }
      }
    } else {
      outputChannel.appendLine('');
      outputChannel.appendLine('Tip: Open a .md/.mdx/.astro file and run this again to see its slug vs GA4 paths.');
    }
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    outputChannel.appendLine(`[ERROR] ${msg}`);
  }

  outputChannel.appendLine('');
  outputChannel.appendLine('--- End of test ---');
}

// ---------------------------------------------------------------------------
// Dashboard (sidebar view + optional webview panel in editor area)
// ---------------------------------------------------------------------------
class DashboardViewProvider implements vscode.WebviewViewProvider {
  private _view: vscode.WebviewView | undefined;

  constructor(private _codeLensProvider: AnalyticsCodeLensProvider) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = getDashboardHtml(webviewView.webview, getDashboardData());
    webviewView.webview.onDidReceiveMessage((msg: { type: string; pagePath?: string }) => {
      if (msg.type === 'refresh') {
        refreshData(this._codeLensProvider, () => {
          if (this._view) {
            this._view.webview.postMessage({ type: 'data', data: getDashboardData() });
          }
        });
      } else if (msg.type === 'openPage' && msg.pagePath) {
        openPageInEditor(msg.pagePath);
      }
    });
  }
}

function showDashboard(context: vscode.ExtensionContext, codeLensProvider: AnalyticsCodeLensProvider) {
  try {
    const viewType = 'astroAnalytics.dashboard';
    const title = l10nT('dashboard.title');
    if (dashboardPanel) {
      dashboardPanel.reveal();
      dashboardPanel.webview.html = getDashboardHtml(dashboardPanel.webview, getDashboardData());
      return;
    }
    dashboardPanel = vscode.window.createWebviewPanel(
      viewType,
      title,
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );
    dashboardPanel.webview.html = getDashboardHtml(dashboardPanel.webview, getDashboardData());
    dashboardPanel.webview.onDidReceiveMessage((msg: { type: string; pagePath?: string }) => {
      if (msg.type === 'refresh') {
        refreshData(codeLensProvider, () => {
          if (dashboardPanel) {
            dashboardPanel.webview.postMessage({ type: 'data', data: getDashboardData() });
          }
        });
      } else if (msg.type === 'openPage' && msg.pagePath) {
        openPageInEditor(msg.pagePath);
      }
    });
    dashboardPanel.onDidDispose(() => {
      dashboardPanel = undefined;
    });
    context.subscriptions.push(dashboardPanel);
  } catch (err: unknown) {
    outputChannel.appendLine(`[ERROR] showDashboard: ${getErrorMessage(err)}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Data refresh
// ---------------------------------------------------------------------------
async function refreshData(
  codeLensProvider: AnalyticsCodeLensProvider,
  onDone?: () => void
) {
  const config = vscode.workspace.getConfiguration('astroAnalytics');
  const propertyId = config.get<string>('propertyId', '');
  const credentialsPath = config.get<string>('credentialsPath', '');
  const lookbackDays = config.get<number>('lookbackDays', 30);

  if (!propertyId) {
    vscode.window.showErrorMessage(
      l10nT('msg.setPropertyId'),
      l10nT('msg.openSettings')
    ).then(choice => {
      if (choice === l10nT('msg.openSettings')) {
        vscode.commands.executeCommand('workbench.action.openSettings', 'astroAnalytics.propertyId');
      }
    });
    return;
  }

  // Expand ~ in credentials path
  const resolvedCreds = credentialsPath.replace(/^~/, process.env.HOME ?? '');

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: l10nT('dashboard.title'),
      cancellable: true,
    },
    async (progress, token) => {
      progress.report({ message: l10nT('msg.loadingGa4') });
      statusBarItem.text = `$(sync~spin) ${l10nT('msg.analyticsLoading')}`;
      statusBarItem.show();

      try {
        const data = await fetchAnalyticsData(propertyId, resolvedCreds, lookbackDays);
        if (token.isCancellationRequested) return;

        metricsCache = new Map(data.map(m => [normalizePagePath(m.pagePath), m]));
        lastFetch = Date.now();
        outputChannel.appendLine(`[${new Date().toISOString()}] Loaded ${data.length} pages from GA4.`);
        const sample = data.slice(0, 5).map(m => m.pagePath).join(', ');
        outputChannel.appendLine(`  Sample pagePaths: ${sample}${data.length > 5 ? '…' : ''}`);

        codeLensProvider.refresh();
        fileDecorationProvider.refresh();
        updateStatusBar(vscode.window.activeTextEditor?.document);

        vscode.window.setStatusBarMessage(`$(check) ${l10nT('msg.pagesLoaded', String(data.length))}`, 3000);
        onDone?.();
      } catch (err: unknown) {
        const msg = getErrorMessage(err);
        outputChannel.appendLine(`[ERROR] ${msg}`);
        outputChannel.show(true);
        vscode.window.showErrorMessage(l10nT('msg.analyticsError', msg));
        statusBarItem.text = `$(graph) ${l10nT('msg.analyticsErrorStatus')}`;
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Activate
// ---------------------------------------------------------------------------
export function activate(context: vscode.ExtensionContext): void {
  try {
    outputChannel = vscode.window.createOutputChannel('Astro Analytics');
    context.subscriptions.push(outputChannel);

    // Declare providers so command handlers can close over them (assigned below)
    let codeLensProvider: AnalyticsCodeLensProvider;
    let hoverProvider: AnalyticsHoverProvider;
    // Commands (registered first so they exist even if later activation steps throw)
    context.subscriptions.push(
      vscode.commands.registerCommand('astro-analytics.refresh', () => {
        refreshData(codeLensProvider);
      }),
      vscode.commands.registerCommand('astro-analytics.testConnection', () => {
        testConnection();
      }),
      vscode.commands.registerCommand('astro-analytics.configure', () => {
        vscode.commands.executeCommand(
          'workbench.action.openSettings',
          'astroAnalytics'
        );
      }),
      vscode.commands.registerCommand('astro-analytics.showDashboard', () => {
        try {
          showDashboard(context, codeLensProvider);
        } catch (err: unknown) {
          const msg = getErrorMessage(err);
          outputChannel.appendLine(`[ERROR] showDashboard: ${msg}`);
          outputChannel.show(true);
          vscode.window.showErrorMessage(l10nT('msg.dashboardFailed'));
        }
      })
    );

    // Status bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);

    // Providers
    codeLensProvider = new AnalyticsCodeLensProvider();
    hoverProvider = new AnalyticsHoverProvider();
    fileDecorationProvider = new AnalyticsFileDecorationProvider();
    const dashboardViewProvider = new DashboardViewProvider(codeLensProvider);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider('astroAnalytics.dashboard', dashboardViewProvider, {
        webviewOptions: { retainContextWhenHidden: true },
      }),
      vscode.window.registerFileDecorationProvider(fileDecorationProvider),
      vscode.languages.registerCodeLensProvider(
        [{ language: 'markdown' }, { language: 'mdx' }, { language: 'astro' }],
        codeLensProvider
      ),
      vscode.languages.registerHoverProvider(
        [{ language: 'markdown' }, { language: 'mdx' }, { language: 'astro' }],
        hoverProvider
      )
    );

    // Auto-update status bar on editor change
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        updateStatusBar(editor?.document);
        // Auto-refresh if cache is stale and a markdown file is opened
        if (editor?.document.fileName.match(/\.(md|mdx|astro)$/) && Date.now() - lastFetch > CACHE_TTL_MS) {
          refreshData(codeLensProvider);
        }
      })
    );

    // Initial load if a markdown file is already open
    if (vscode.window.activeTextEditor?.document.fileName.match(/\.(md|mdx|astro)$/)) {
      refreshData(codeLensProvider);
    }

    outputChannel.appendLine(l10nT('msg.extensionActivated'));
  } catch (err) {
    const msg = getErrorMessage(err);
    console.error('[Astro Analytics] Activation failed:', msg);
    throw err;
  }
}

export function deactivate() {
  // Resources are disposed via context.subscriptions
}
