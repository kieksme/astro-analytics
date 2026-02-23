import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';

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

// ---------------------------------------------------------------------------
// Slug → pagePath derivation
// Astro: file at src/content/blog/my-post.md → /blog/my-post/
// ---------------------------------------------------------------------------
function filePathToSlug(
  filePath: string,
  workspaceRoot: string,
  contentRoot: string
): string | null {
  const absContentRoot = path.join(workspaceRoot, contentRoot);
  if (!filePath.startsWith(absContentRoot)) return null;

  let rel = filePath.slice(absContentRoot.length);
  // Remove extension
  rel = rel.replace(/\.(md|mdx)$/, '');
  // Remove index
  rel = rel.replace(/\/index$/, '/');
  // Ensure leading slash and trailing slash
  if (!rel.startsWith('/')) rel = '/' + rel;
  if (!rel.endsWith('/')) rel = rel + '/';

  return rel;
}

// ---------------------------------------------------------------------------
// Bounce rate → colour
// ---------------------------------------------------------------------------
function bounceColor(rate: number): string {
  if (rate < 0.25) return '🟢';
  if (rate < 0.45) return '🟡';
  if (rate < 0.65) return '🟠';
  return '🔴';
}

function fmtPct(rate: number): string {
  return (rate * 100).toFixed(1) + '%';
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ---------------------------------------------------------------------------
// Extension state
// ---------------------------------------------------------------------------
let metricsCache = new Map<string, PageMetrics>(); // keyed by pagePath
let lastFetch = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

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

    const config = vscode.workspace.getConfiguration('thinkportAnalytics');
    const contentRoot = config.get<string>('contentRoot', 'src/content');

    const slug = filePathToSlug(document.uri.fsPath, wsFolder.uri.fsPath, contentRoot);
    if (!slug) return [];

    const metrics = metricsCache.get(slug);
    const range = new vscode.Range(0, 0, 0, 0);

    if (!metrics) {
      return [
        new vscode.CodeLens(range, {
          title: '📊 Analytics: no data ($(sync) refresh)',
          command: 'thinkport-analytics.refresh',
        }),
      ];
    }

    const icon = bounceColor(metrics.bounceRate);
    const lenses: vscode.CodeLens[] = [
      new vscode.CodeLens(range, {
        title: `${icon} Bounce ${fmtPct(metrics.bounceRate)}   👁 ${metrics.views.toLocaleString('de')} Views   👤 ${metrics.users.toLocaleString('de')} Nutzer   ⏱ ${fmtDuration(metrics.avgSessionDuration)}`,
        command: 'thinkport-analytics.refresh',
        tooltip: 'Click to refresh analytics data',
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

    const config = vscode.workspace.getConfiguration('thinkportAnalytics');
    const contentRoot = config.get<string>('contentRoot', 'src/content');

    const slug = filePathToSlug(document.uri.fsPath, wsFolder.uri.fsPath, contentRoot);
    if (!slug) return null;

    const metrics = metricsCache.get(slug);
    if (!metrics) return null;

    const icon = bounceColor(metrics.bounceRate);
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = true;
    md.appendMarkdown(`### 📊 Analytics — \`${slug}\`\n\n`);
    md.appendMarkdown(`| Metrik | Wert |\n|---|---|\n`);
    md.appendMarkdown(`| ${icon} Bounce Rate | **${fmtPct(metrics.bounceRate)}** |\n`);
    md.appendMarkdown(`| 👁 Seitenaufrufe | **${metrics.views.toLocaleString('de')}** |\n`);
    md.appendMarkdown(`| 👤 Aktive Nutzer | **${metrics.users.toLocaleString('de')}** |\n`);
    md.appendMarkdown(`| ⏱ Ø Session-Dauer | **${fmtDuration(metrics.avgSessionDuration)}** |\n`);
    md.appendMarkdown(`\n\n*Letzten ${config.get<number>('lookbackDays', 30)} Tage · GA4 Property ${config.get<string>('propertyId')}*`);

    return new vscode.Hover(md);
  }
}

// ---------------------------------------------------------------------------
// Status bar update
// ---------------------------------------------------------------------------
function updateStatusBar(document: vscode.TextDocument | undefined) {
  if (!document || !document.fileName.match(/\.(md|mdx)$/)) {
    statusBarItem.hide();
    return;
  }

  const wsFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!wsFolder) { statusBarItem.hide(); return; }

  const config = vscode.workspace.getConfiguration('thinkportAnalytics');
  const contentRoot = config.get<string>('contentRoot', 'src/content');

  const slug = filePathToSlug(document.uri.fsPath, wsFolder.uri.fsPath, contentRoot);
  if (!slug) { statusBarItem.hide(); return; }

  const metrics = metricsCache.get(slug);
  if (!metrics) {
    statusBarItem.text = '$(graph) Analytics: —';
    statusBarItem.tooltip = `No data for ${slug}`;
    statusBarItem.show();
    return;
  }

  const icon = bounceColor(metrics.bounceRate);
  statusBarItem.text = `$(graph) ${icon} ${fmtPct(metrics.bounceRate)} Bounce · ${metrics.views.toLocaleString('de')} Views`;
  statusBarItem.tooltip = `Bounce: ${fmtPct(metrics.bounceRate)} | Views: ${metrics.views} | Users: ${metrics.users} | Ø ${fmtDuration(metrics.avgSessionDuration)}`;
  statusBarItem.command = 'thinkport-analytics.refresh';
  statusBarItem.show();
}

// ---------------------------------------------------------------------------
// Data refresh
// ---------------------------------------------------------------------------
async function refreshData(codeLensProvider: AnalyticsCodeLensProvider) {
  const config = vscode.workspace.getConfiguration('thinkportAnalytics');
  const propertyId = config.get<string>('propertyId', '364493652');
  const credentialsPath = config.get<string>('credentialsPath', '');
  const lookbackDays = config.get<number>('lookbackDays', 30);

  // Expand ~ in credentials path
  const resolvedCreds = credentialsPath.replace(/^~/, process.env.HOME ?? '');

  statusBarItem.text = '$(sync~spin) Analytics: Loading…';
  statusBarItem.show();

  try {
    const data = await fetchAnalyticsData(propertyId, resolvedCreds, lookbackDays);
    metricsCache = new Map(data.map(m => [m.pagePath, m]));
    lastFetch = Date.now();
    outputChannel.appendLine(`[${new Date().toISOString()}] Loaded ${data.length} pages from GA4.`);

    codeLensProvider.refresh();
    updateStatusBar(vscode.window.activeTextEditor?.document);

    vscode.window.setStatusBarMessage(`$(check) Analytics: ${data.length} Seiten geladen`, 3000);
  } catch (err: any) {
    outputChannel.appendLine(`[ERROR] ${err.message}`);
    outputChannel.show(true);
    vscode.window.showErrorMessage(`Analytics Fehler: ${err.message}`);
    statusBarItem.text = '$(graph) Analytics: Fehler';
  }
}

// ---------------------------------------------------------------------------
// Activate
// ---------------------------------------------------------------------------
export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Thinkport Analytics');

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(statusBarItem);

  // Providers
  const codeLensProvider = new AnalyticsCodeLensProvider();
  const hoverProvider = new AnalyticsHoverProvider();

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      [{ language: 'markdown' }, { language: 'mdx' }],
      codeLensProvider
    ),
    vscode.languages.registerHoverProvider(
      [{ language: 'markdown' }, { language: 'mdx' }],
      hoverProvider
    )
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('thinkport-analytics.refresh', () => {
      refreshData(codeLensProvider);
    }),
    vscode.commands.registerCommand('thinkport-analytics.configure', () => {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'thinkportAnalytics'
      );
    })
  );

  // Auto-update status bar on editor change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      updateStatusBar(editor?.document);
      // Auto-refresh if cache is stale and a markdown file is opened
      if (editor?.document.fileName.match(/\.(md|mdx)$/) && Date.now() - lastFetch > CACHE_TTL_MS) {
        refreshData(codeLensProvider);
      }
    })
  );

  // Initial load if a markdown file is already open
  if (vscode.window.activeTextEditor?.document.fileName.match(/\.(md|mdx)$/)) {
    refreshData(codeLensProvider);
  }

  outputChannel.appendLine('Thinkport Analytics extension activated.');
}

export function deactivate() {
  statusBarItem?.dispose();
}
