import * as fs from 'fs';
import * as vscode from 'vscode';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { filePathToSlug, slugToFilePaths, normalizePagePath } from './lib/slug';
import { getAggregatedMetricsForDynamicRoute } from './lib/aggregate';
import { bounceStatusBarCodicon, fmtPct, fmtDuration } from './lib/format';
import { getDashboardDataFromState, buildDashboardHtml, buildSidebarDashboardHtml } from './lib/dashboard';
import { shouldRefreshOnStartup, shouldRefreshOnConfigChange } from './lib/refresh-behavior';

/** Default (en) strings when l10n returns the key or l10n is unavailable. */
const l10nDefaults: Record<string, string> = {
  'codelens.noData': 'Analytics: no data ($(sync) refresh)',
  'codelens.tooltip': 'Click to refresh analytics data',
  'codelens.title': 'Bounce {0}   $(eye) {1} Views   $(person) {2} Users   $(watch) {3}',
  'hover.analyticsTitle': 'Analytics — ',
  'hover.metric': 'Metric',
  'hover.value': 'Value',
  'hover.bounceRate': 'Bounce Rate',
  'hover.pageViews': 'Page views',
  'hover.activeUsers': 'Active users',
  'hover.avgSessionDuration': 'Avg. session duration',
  'hover.footer': 'Last {0} days · GA4 Property {1}',
  'hover.dynamicRouteAggregated': '(dynamic route, aggregated)',
  'decoration.tooltip': 'Bounce {0} | {1} Views | {2} Users | Ø {3}',
  'status.text': 'Bounce · {0} Views',
  'status.tooltip': 'Bounce: {0} | Views: {1} | Users: {2} | Ø {3}',
  'status.a11y': 'Analytics: Bounce {0}, {1} views, {2} users. Click to refresh.',
  'status.noDataTooltip': 'No data for {0}',
  'status.analyticsNone': 'Analytics: —',
  'status.noDataA11y': 'Analytics: no data for {0}',
  'msg.noWorkspace': 'Astro Analytics: No workspace folder open.',
  'msg.noFileForPath': 'Astro Analytics: No file found for path {0}',
  'msg.setPropertyId': 'Astro Analytics: Set astroAnalytics.propertyId in settings.',
  'msg.openSettings': 'Open Settings',
  'msg.loadingGa4': 'Loading GA4 data…',
  'msg.analyticsLoading': 'Analytics: Loading…',
  'msg.pagesLoaded': 'Analytics: {0} pages loaded',
  'msg.analyticsError': 'Analytics Error: {0}',
  'msg.analyticsErrorStatus': 'Analytics: Error',
  'msg.dashboardFailed': 'Astro Analytics: Open Dashboard failed. Check the Output channel (Astro Analytics) for details.',
  'msg.extensionActivated': 'Astro Analytics extension activated.',
  'dashboard.title': 'Astro Analytics Dashboard',
  'dashboard.propertyId': 'Property ID:',
  'dashboard.pagesInCache': 'Pages in cache:',
  'dashboard.lastFetch': 'Last fetch:',
  'dashboard.lookback': 'Lookback:',
  'dashboard.days': 'days',
  'dashboard.refreshData': 'Refresh data',
  'dashboard.page': 'Page',
  'dashboard.views': 'Views',
  'dashboard.users': 'Users',
  'dashboard.bounce': 'Bounce',
  'dashboard.avgDuration': 'Avg duration',
  'dashboard.emptyState': 'No cached pages. Configure GA4 and run Refresh Data.',
  'dashboard.notConfigured': 'GA4 is not configured. Set Property ID and credentials in Settings to load analytics data.',
  'dashboard.notSet': '(not set)',
  'dashboard.legendGood': '<25%',
  'dashboard.legendWarning': '25–45%',
  'dashboard.legendHigh': '45–65%',
  'dashboard.legendCritical': '≥65%',
  'dashboard.pageOf': 'Page {0} of {1}',
  'dashboard.previous': 'Previous',
  'dashboard.next': 'Next',
};

/** Localization: use vscode.l10n when available (VS Code 1.74+), else use defaults or key with {0} replaced. */
function l10nT(message: string, ...args: (string | number | boolean)[]): string {
  const l10n = (vscode as { l10n?: { t: (m: string, ...a: (string | number | boolean)[]) => string } }).l10n;
  let out: string;
  if (l10n) {
    out = l10n.t(message, ...args);
    if (out === message && l10nDefaults[message]) out = l10nDefaults[message];
  } else {
    out = l10nDefaults[message] ?? message;
  }
  if (args.length && out.includes('{')) {
    out = out.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ''));
  }
  return out;
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
  const prevCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  }
  try {
    const analyticsDataClient = new BetaAnalyticsDataClient();
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
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
    });

    const rows: PageMetrics[] = (response.rows ?? []).map((row) => ({
      pagePath: row.dimensionValues?.[0]?.value ?? '',
      views: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
      users: parseInt(row.metricValues?.[1]?.value ?? '0', 10),
      bounceRate: parseFloat(row.metricValues?.[2]?.value ?? '0'),
      avgSessionDuration: parseFloat(row.metricValues?.[3]?.value ?? '0'),
    }));

    return rows;
  } finally {
    if (credentialsPath) {
      if (prevCreds !== undefined) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = prevCreds;
      } else {
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      }
    }
  }
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
    let metrics = slug != null ? (metricsCache.get(slug) ?? metricsCache.get(normalizePagePath(slug))) : null;
    if (!metrics) {
      metrics = getAggregatedMetricsForDynamicRoute(document.uri.fsPath, wsFolder.uri.fsPath, pagesRoot, metricsCache);
    }
    const range = new vscode.Range(0, 0, 0, 0);

    if (!metrics) {
      return [
        new vscode.CodeLens(range, {
          title: `$(graph) ${l10nT('codelens.noData')}`,
          command: 'astro-analytics.refresh',
        }),
      ];
    }

    const bounceIcon = bounceStatusBarCodicon(metrics.bounceRate);
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
    let metrics = slug != null ? (metricsCache.get(slug) ?? metricsCache.get(normalizePagePath(slug))) : null;
    if (!metrics) {
      metrics = getAggregatedMetricsForDynamicRoute(document.uri.fsPath, wsFolder.uri.fsPath, pagesRoot, metricsCache);
    }
    if (!metrics) return null;

    const bounceIcon = bounceStatusBarCodicon(metrics.bounceRate);
    const locale = uiLanguage();
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = false;
    const titleSlug = slug ?? l10nT('hover.dynamicRouteAggregated');
    md.appendMarkdown(`### $(graph) ${l10nT('hover.analyticsTitle')}\`${titleSlug}\`\n\n`);
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
    let metrics = slug != null ? (metricsCache.get(slug) ?? metricsCache.get(normalizePagePath(slug))) : null;
    if (!metrics) {
      metrics = getAggregatedMetricsForDynamicRoute(uri.fsPath, wsFolder.uri.fsPath, pagesRoot, metricsCache);
    }
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
  let metrics = slug != null ? (metricsCache.get(slug) ?? metricsCache.get(normalizePagePath(slug))) : null;
  if (!metrics) {
    metrics = getAggregatedMetricsForDynamicRoute(document.uri.fsPath, wsFolder.uri.fsPath, pagesRoot, metricsCache);
  }
  const locale = uiLanguage();
  if (!metrics) {
    statusBarItem.text = `$(graph) ${l10nT('status.analyticsNone')}`;
    statusBarItem.tooltip = slug != null ? l10nT('status.noDataTooltip', slug) : l10nT('status.noDataA11y', document.uri.fsPath);
    statusBarItem.accessibilityInformation = { label: l10nT('status.noDataA11y', slug ?? document.uri.fsPath), role: 'status' };
    statusBarItem.show();
    return;
  }

  const statusBarCodicon = bounceStatusBarCodicon(metrics.bounceRate);
  statusBarItem.text = `$(graph) $(${statusBarCodicon}) ${fmtPct(metrics.bounceRate)} ${l10nT('status.text', metrics.views.toLocaleString(locale))}`;
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
function getDashboardData() {
  const config = vscode.workspace.getConfiguration('astroAnalytics');
  return getDashboardDataFromState(
    {
      propertyId: config.get<string>('propertyId', ''),
      lookbackDays: config.get<number>('lookbackDays', 30),
      maxPages: config.get<number>('dashboardMaxPages', 500),
      pageSize: config.get<number>('dashboardPageSize', 20),
    },
    metricsCache,
    lastFetch,
    (path) => resolvePagePathToFile(path)
  );
}

function getDashboardHtml(webview: vscode.Webview, data: ReturnType<typeof getDashboardData>): string {
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
    notConfigured: l10nT('dashboard.notConfigured'),
    openSettings: l10nT('msg.openSettings'),
    notSet: l10nT('dashboard.notSet'),
    legendGood: l10nT('dashboard.legendGood'),
    legendWarning: l10nT('dashboard.legendWarning'),
    legendHigh: l10nT('dashboard.legendHigh'),
    legendCritical: l10nT('dashboard.legendCritical'),
    pageOf: l10nT('dashboard.pageOf'),
    previous: l10nT('dashboard.previous'),
    next: l10nT('dashboard.next'),
  };
  return buildDashboardHtml(data, l10n, {
    cspSource: webview.cspSource,
    lang: uiLanguage(),
  });
}

function getSidebarDashboardHtml(webview: vscode.Webview, data: ReturnType<typeof getDashboardData>): string {
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
    notConfigured: l10nT('dashboard.notConfigured'),
    openSettings: l10nT('msg.openSettings'),
    notSet: l10nT('dashboard.notSet'),
    legendGood: l10nT('dashboard.legendGood'),
    legendWarning: l10nT('dashboard.legendWarning'),
    legendHigh: l10nT('dashboard.legendHigh'),
    legendCritical: l10nT('dashboard.legendCritical'),
    pageOf: l10nT('dashboard.pageOf'),
    previous: l10nT('dashboard.previous'),
    next: l10nT('dashboard.next'),
  };
  return buildSidebarDashboardHtml(data, l10n, {
    cspSource: webview.cspSource,
    lang: uiLanguage(),
  });
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
  outputChannel.appendLine('--- 📊 Astro Analytics: Test API Connection ---');
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
    webviewView.webview.html = getSidebarDashboardHtml(webviewView.webview, getDashboardData());
    webviewView.webview.onDidReceiveMessage((msg: { type: string; pagePath?: string }) => {
      if (msg.type === 'refresh') {
        refreshData(this._codeLensProvider, () => {
          if (this._view) {
            this._view.webview.postMessage({ type: 'data', data: getDashboardData() });
          }
        });
      } else if (msg.type === 'openPage' && msg.pagePath) {
        openPageInEditor(msg.pagePath);
      } else if (msg.type === 'openSettings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'astroAnalytics');
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
      } else if (msg.type === 'openSettings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'astroAnalytics');
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
        vscode.window.showErrorMessage(l10nT('msg.analyticsError', msg), l10nT('msg.openSettings')).then(choice => {
          if (choice === l10nT('msg.openSettings')) {
            vscode.commands.executeCommand('workbench.action.openSettings', 'astroAnalytics');
          }
        });
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
          vscode.window.showErrorMessage(l10nT('msg.dashboardFailed'), l10nT('msg.openSettings')).then(choice => {
            if (choice === l10nT('msg.openSettings')) {
              vscode.commands.executeCommand('workbench.action.openSettings', 'astroAnalytics');
            }
          });
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

    // Refresh when astroAnalytics settings change (propertyId, credentialsPath, lookbackDays, etc.)
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (shouldRefreshOnConfigChange('astroAnalytics', e)) {
          refreshData(codeLensProvider);
        }
      })
    );

    // Auto-refresh on startup when GA4 is configured so analytics data is loaded when VS Code starts
    const config = vscode.workspace.getConfiguration('astroAnalytics');
    if (shouldRefreshOnStartup(config.get<string>('propertyId', ''))) {
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
