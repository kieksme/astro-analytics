"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const google_auth_library_1 = require("google-auth-library");
const node_fetch_1 = __importDefault(require("node-fetch"));
const slug_1 = require("./lib/slug");
const format_1 = require("./lib/format");
// ---------------------------------------------------------------------------
// GA4 Data API helper
// ---------------------------------------------------------------------------
async function fetchAnalyticsData(propertyId, credentialsPath, lookbackDays) {
    // Resolve credentials
    const env = { ...process.env };
    if (credentialsPath) {
        env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
    }
    const auth = new google_auth_library_1.GoogleAuth({
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
    const response = await (0, node_fetch_1.default)(url, {
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
    const json = (await response.json());
    const rows = (json.rows ?? []).map((row) => ({
        pagePath: row.dimensionValues[0].value,
        views: parseInt(row.metricValues[0].value, 10),
        users: parseInt(row.metricValues[1].value, 10),
        bounceRate: parseFloat(row.metricValues[2].value),
        avgSessionDuration: parseFloat(row.metricValues[3].value),
    }));
    return rows;
}
/** Normalize GA4 pagePath to match slug format (trailing slash) for cache lookup. */
function normalizePagePath(pagePath) {
    const p = pagePath.trim();
    if (!p.endsWith('/'))
        return p + '/';
    return p;
}
// ---------------------------------------------------------------------------
// Extension state
// ---------------------------------------------------------------------------
let metricsCache = new Map(); // keyed by normalized pagePath (with trailing slash)
let lastFetch = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let statusBarItem;
let outputChannel;
let dashboardPanel;
// ---------------------------------------------------------------------------
// CodeLens provider
// ---------------------------------------------------------------------------
class AnalyticsCodeLensProvider {
    constructor() {
        this._onDidChangeCodeLenses = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
    }
    refresh() { this._onDidChangeCodeLenses.fire(); }
    provideCodeLenses(document) {
        const wsFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!wsFolder)
            return [];
        const config = vscode.workspace.getConfiguration('astroAnalytics');
        const contentRoot = config.get('contentRoot', 'src/content');
        const pagesRoot = config.get('pagesRoot', 'src/pages');
        const slug = (0, slug_1.filePathToSlug)(document.uri.fsPath, wsFolder.uri.fsPath, contentRoot, pagesRoot);
        if (!slug)
            return [];
        const metrics = metricsCache.get(slug) ?? metricsCache.get(normalizePagePath(slug));
        const range = new vscode.Range(0, 0, 0, 0);
        if (!metrics) {
            return [
                new vscode.CodeLens(range, {
                    title: '📊 Analytics: no data ($(sync) refresh)',
                    command: 'astro-analytics.refresh',
                }),
            ];
        }
        const icon = (0, format_1.bounceColor)(metrics.bounceRate);
        const lenses = [
            new vscode.CodeLens(range, {
                title: `${icon} Bounce ${(0, format_1.fmtPct)(metrics.bounceRate)}   👁 ${metrics.views.toLocaleString('de')} Views   👤 ${metrics.users.toLocaleString('de')} Nutzer   ⏱ ${(0, format_1.fmtDuration)(metrics.avgSessionDuration)}`,
                command: 'astro-analytics.refresh',
                tooltip: 'Click to refresh analytics data',
            }),
        ];
        return lenses;
    }
}
// ---------------------------------------------------------------------------
// Hover provider
// ---------------------------------------------------------------------------
class AnalyticsHoverProvider {
    provideHover(document, position) {
        // Only show hover on first 5 lines (frontmatter area)
        if (position.line > 10)
            return null;
        const wsFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!wsFolder)
            return null;
        const config = vscode.workspace.getConfiguration('astroAnalytics');
        const contentRoot = config.get('contentRoot', 'src/content');
        const pagesRoot = config.get('pagesRoot', 'src/pages');
        const slug = (0, slug_1.filePathToSlug)(document.uri.fsPath, wsFolder.uri.fsPath, contentRoot, pagesRoot);
        if (!slug)
            return null;
        const metrics = metricsCache.get(slug) ?? metricsCache.get(normalizePagePath(slug));
        if (!metrics)
            return null;
        const icon = (0, format_1.bounceColor)(metrics.bounceRate);
        const md = new vscode.MarkdownString(undefined, true);
        md.isTrusted = false;
        md.appendMarkdown(`### 📊 Analytics — \`${slug}\`\n\n`);
        md.appendMarkdown(`| Metrik | Wert |\n|---|---|\n`);
        md.appendMarkdown(`| ${icon} Bounce Rate | **${(0, format_1.fmtPct)(metrics.bounceRate)}** |\n`);
        md.appendMarkdown(`| 👁 Seitenaufrufe | **${metrics.views.toLocaleString('de')}** |\n`);
        md.appendMarkdown(`| 👤 Aktive Nutzer | **${metrics.users.toLocaleString('de')}** |\n`);
        md.appendMarkdown(`| ⏱ Ø Session-Dauer | **${(0, format_1.fmtDuration)(metrics.avgSessionDuration)}** |\n`);
        const measurementId = config.get('measurementId', '');
        const footer = measurementId
            ? `*Letzten ${config.get('lookbackDays', 30)} Tage · Property ${config.get('propertyId')} · ${measurementId}*`
            : `*Letzten ${config.get('lookbackDays', 30)} Tage · GA4 Property ${config.get('propertyId')}*`;
        md.appendMarkdown(`\n\n${footer}`);
        return new vscode.Hover(md);
    }
}
// ---------------------------------------------------------------------------
// Status bar update
// ---------------------------------------------------------------------------
function updateStatusBar(document) {
    if (!document || !document.fileName.match(/\.(md|mdx|astro)$/)) {
        statusBarItem.hide();
        return;
    }
    const wsFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!wsFolder) {
        statusBarItem.hide();
        return;
    }
    const config = vscode.workspace.getConfiguration('astroAnalytics');
    const contentRoot = config.get('contentRoot', 'src/content');
    const pagesRoot = config.get('pagesRoot', 'src/pages');
    const slug = (0, slug_1.filePathToSlug)(document.uri.fsPath, wsFolder.uri.fsPath, contentRoot, pagesRoot);
    if (!slug) {
        statusBarItem.hide();
        return;
    }
    const metrics = metricsCache.get(slug) ?? metricsCache.get(normalizePagePath(slug));
    if (!metrics) {
        statusBarItem.text = '$(graph) Analytics: —';
        statusBarItem.tooltip = `No data for ${slug}`;
        statusBarItem.accessibilityInformation = { label: `Analytics: no data for ${slug}`, role: 'status' };
        statusBarItem.show();
        return;
    }
    const icon = (0, format_1.bounceColor)(metrics.bounceRate);
    statusBarItem.text = `$(graph) ${icon} ${(0, format_1.fmtPct)(metrics.bounceRate)} Bounce · ${metrics.views.toLocaleString('de')} Views`;
    statusBarItem.tooltip = `Bounce: ${(0, format_1.fmtPct)(metrics.bounceRate)} | Views: ${metrics.views} | Users: ${metrics.users} | Ø ${(0, format_1.fmtDuration)(metrics.avgSessionDuration)}`;
    statusBarItem.accessibilityInformation = {
        label: `Analytics: Bounce ${(0, format_1.fmtPct)(metrics.bounceRate)}, ${metrics.views} views, ${metrics.users} users. Click to refresh.`,
        role: 'status',
    };
    statusBarItem.command = 'astro-analytics.refresh';
    statusBarItem.show();
}
function getErrorMessage(err) {
    return err instanceof Error ? err.message : String(err);
}
/** Serializable summary for the dashboard webview. */
function getDashboardData() {
    const config = vscode.workspace.getConfiguration('astroAnalytics');
    const propertyId = config.get('propertyId', '');
    const lookbackDays = config.get('lookbackDays', 30);
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
function getDashboardHtml(webview, data) {
    const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const dataJson = JSON.stringify(data);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' ${webview.cspSource};">
  <title>Astro Analytics Dashboard</title>
  <style>
    body { font-family: var(--vscode-font-family); padding: 1rem; color: var(--vscode-foreground); }
    h1 { font-size: 1.2rem; margin-top: 0; }
    .meta { margin-bottom: 1rem; }
    .meta span { margin-right: 1rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--vscode-widget-border); }
    th { font-weight: 600; }
    button { margin-top: 0.5rem; padding: 0.4rem 0.8rem; cursor: pointer; }
  </style>
</head>
<body>
  <h1>📊 Astro Analytics Dashboard</h1>
  <div class="meta">
    <span><strong>Property ID:</strong> <span id="propertyId">-</span></span>
    <span><strong>Pages in cache:</strong> <span id="cacheSize">0</span></span>
    <span><strong>Last fetch:</strong> <span id="lastFetch">-</span></span>
    <span><strong>Lookback:</strong> <span id="lookbackDays">-</span> days</span>
  </div>
  <button id="refreshBtn">🔄 Refresh data</button>
  <table>
    <thead><tr><th>Page</th><th>Views</th><th>Users</th><th>Bounce</th><th>Avg duration</th></tr></thead>
    <tbody id="tbody"></tbody>
  </table>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const data = ${dataJson.replace(/</g, '\\u003c')};

    function render(d) {
      document.getElementById('propertyId').textContent = d.configured ? d.propertyId : '(not set)';
      document.getElementById('cacheSize').textContent = String(d.cacheSize);
      document.getElementById('lastFetch').textContent = d.lastFetch
        ? new Date(d.lastFetch).toLocaleString()
        : '-';
      document.getElementById('lookbackDays').textContent = String(d.lookbackDays);
      const tbody = document.getElementById('tbody');
      tbody.innerHTML = d.topPages.map(p => '<tr><td>' + escapeHtml(p.pagePath) + '</td><td>' + p.views.toLocaleString() + '</td><td>' + p.users.toLocaleString() + '</td><td>' + (p.bounceRate * 100).toFixed(1) + '%</td><td>' + (p.avgSessionDuration >= 60 ? Math.floor(p.avgSessionDuration/60) + 'm ' : '') + Math.floor(p.avgSessionDuration % 60) + 's</td></tr>').join('');
    }
    function escapeHtml(s) { const div = document.createElement('div'); div.textContent = s; return div.innerHTML; }
    render(data);

    window.addEventListener('message', e => { if (e.data && e.data.type === 'data') render(e.data.data); });
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
    const propertyId = config.get('propertyId', '');
    const credentialsPath = config.get('credentialsPath', '');
    const lookbackDays = config.get('lookbackDays', 30);
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
                const contentRoot = config.get('contentRoot', 'src/content');
                const pagesRoot = config.get('pagesRoot', 'src/pages');
                const slug = (0, slug_1.filePathToSlug)(doc.uri.fsPath, wsFolder.uri.fsPath, contentRoot, pagesRoot);
                outputChannel.appendLine('');
                outputChannel.appendLine(`Current file slug for matching: "${slug ?? '(none)'}"`);
                if (slug) {
                    const normalized = normalizePagePath(slug);
                    const found = data.some(m => normalizePagePath(m.pagePath) === normalized || normalizePagePath(m.pagePath) === slug);
                    outputChannel.appendLine(found ? '  → Match found in GA4 data.' : '  → No match in GA4 data (check contentRoot/pagesRoot and path structure).');
                }
            }
        }
        else {
            outputChannel.appendLine('');
            outputChannel.appendLine('Tip: Open a .md/.mdx/.astro file and run this again to see its slug vs GA4 paths.');
        }
    }
    catch (err) {
        const msg = getErrorMessage(err);
        outputChannel.appendLine(`[ERROR] ${msg}`);
    }
    outputChannel.appendLine('');
    outputChannel.appendLine('--- End of test ---');
}
// ---------------------------------------------------------------------------
// Dashboard webview
// ---------------------------------------------------------------------------
function showDashboard(context, codeLensProvider) {
    try {
        const viewType = 'astroAnalytics.dashboard';
        const title = 'Astro Analytics Dashboard';
        if (dashboardPanel) {
            dashboardPanel.reveal();
            dashboardPanel.webview.html = getDashboardHtml(dashboardPanel.webview, getDashboardData());
            return;
        }
        dashboardPanel = vscode.window.createWebviewPanel(viewType, title, vscode.ViewColumn.Beside, { enableScripts: true });
        dashboardPanel.webview.html = getDashboardHtml(dashboardPanel.webview, getDashboardData());
        dashboardPanel.webview.onDidReceiveMessage((msg) => {
            if (msg.type === 'refresh') {
                refreshData(codeLensProvider, () => {
                    if (dashboardPanel) {
                        dashboardPanel.webview.postMessage({ type: 'data', data: getDashboardData() });
                    }
                });
            }
        });
        dashboardPanel.onDidDispose(() => {
            dashboardPanel = undefined;
        });
        context.subscriptions.push(dashboardPanel);
    }
    catch (err) {
        outputChannel.appendLine(`[ERROR] showDashboard: ${getErrorMessage(err)}`);
        throw err;
    }
}
// ---------------------------------------------------------------------------
// Data refresh
// ---------------------------------------------------------------------------
async function refreshData(codeLensProvider, onDone) {
    const config = vscode.workspace.getConfiguration('astroAnalytics');
    const propertyId = config.get('propertyId', '');
    const credentialsPath = config.get('credentialsPath', '');
    const lookbackDays = config.get('lookbackDays', 30);
    if (!propertyId) {
        vscode.window.showErrorMessage('Astro Analytics: Set astroAnalytics.propertyId in settings.', 'Open Settings').then(choice => {
            if (choice === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'astroAnalytics.propertyId');
            }
        });
        return;
    }
    // Expand ~ in credentials path
    const resolvedCreds = credentialsPath.replace(/^~/, process.env.HOME ?? '');
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Astro Analytics',
        cancellable: true,
    }, async (progress, token) => {
        progress.report({ message: 'Loading GA4 data…' });
        statusBarItem.text = '$(sync~spin) Analytics: Loading…';
        statusBarItem.show();
        try {
            const data = await fetchAnalyticsData(propertyId, resolvedCreds, lookbackDays);
            if (token.isCancellationRequested)
                return;
            metricsCache = new Map(data.map(m => [normalizePagePath(m.pagePath), m]));
            lastFetch = Date.now();
            outputChannel.appendLine(`[${new Date().toISOString()}] Loaded ${data.length} pages from GA4.`);
            const sample = data.slice(0, 5).map(m => m.pagePath).join(', ');
            outputChannel.appendLine(`  Sample pagePaths: ${sample}${data.length > 5 ? '…' : ''}`);
            codeLensProvider.refresh();
            updateStatusBar(vscode.window.activeTextEditor?.document);
            vscode.window.setStatusBarMessage(`$(check) Analytics: ${data.length} Seiten geladen`, 3000);
            onDone?.();
        }
        catch (err) {
            const msg = getErrorMessage(err);
            outputChannel.appendLine(`[ERROR] ${msg}`);
            outputChannel.show(true);
            vscode.window.showErrorMessage(`Analytics Fehler: ${msg}`);
            statusBarItem.text = '$(graph) Analytics: Fehler';
        }
    });
}
// ---------------------------------------------------------------------------
// Activate
// ---------------------------------------------------------------------------
function activate(context) {
    try {
        outputChannel = vscode.window.createOutputChannel('Astro Analytics');
        context.subscriptions.push(outputChannel);
        // Declare providers so command handlers can close over them (assigned below)
        let codeLensProvider;
        let hoverProvider;
        // Commands (registered first so they exist even if later activation steps throw)
        context.subscriptions.push(vscode.commands.registerCommand('astro-analytics.refresh', () => {
            refreshData(codeLensProvider);
        }), vscode.commands.registerCommand('astro-analytics.testConnection', () => {
            testConnection();
        }), vscode.commands.registerCommand('astro-analytics.configure', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'astroAnalytics');
        }), vscode.commands.registerCommand('astro-analytics.showDashboard', () => {
            try {
                showDashboard(context, codeLensProvider);
            }
            catch (err) {
                const msg = getErrorMessage(err);
                outputChannel.appendLine(`[ERROR] showDashboard: ${msg}`);
                outputChannel.show(true);
                vscode.window.showErrorMessage('Astro Analytics: Open Dashboard failed. Check the Output channel (Astro Analytics) for details.');
            }
        }));
        // Status bar
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        context.subscriptions.push(statusBarItem);
        // Providers
        codeLensProvider = new AnalyticsCodeLensProvider();
        hoverProvider = new AnalyticsHoverProvider();
        context.subscriptions.push(vscode.languages.registerCodeLensProvider([{ language: 'markdown' }, { language: 'mdx' }, { language: 'astro' }], codeLensProvider), vscode.languages.registerHoverProvider([{ language: 'markdown' }, { language: 'mdx' }, { language: 'astro' }], hoverProvider));
        // Auto-update status bar on editor change
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
            updateStatusBar(editor?.document);
            // Auto-refresh if cache is stale and a markdown file is opened
            if (editor?.document.fileName.match(/\.(md|mdx|astro)$/) && Date.now() - lastFetch > CACHE_TTL_MS) {
                refreshData(codeLensProvider);
            }
        }));
        // Initial load if a markdown file is already open
        if (vscode.window.activeTextEditor?.document.fileName.match(/\.(md|mdx|astro)$/)) {
            refreshData(codeLensProvider);
        }
        outputChannel.appendLine('Astro Analytics extension activated.');
    }
    catch (err) {
        const msg = getErrorMessage(err);
        console.error('[Astro Analytics] Activation failed:', msg);
        throw err;
    }
}
function deactivate() {
    // Resources are disposed via context.subscriptions
}
//# sourceMappingURL=extension.js.map