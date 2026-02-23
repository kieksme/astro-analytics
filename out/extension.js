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
const path = __importStar(require("path"));
const google_auth_library_1 = require("google-auth-library");
const node_fetch_1 = __importDefault(require("node-fetch"));
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
// ---------------------------------------------------------------------------
// Slug → pagePath derivation
// Astro: file at src/content/blog/my-post.md → /blog/my-post/
// ---------------------------------------------------------------------------
function filePathToSlug(filePath, workspaceRoot, contentRoot) {
    const absContentRoot = path.join(workspaceRoot, contentRoot);
    if (!filePath.startsWith(absContentRoot))
        return null;
    let rel = filePath.slice(absContentRoot.length);
    // Remove extension
    rel = rel.replace(/\.(md|mdx)$/, '');
    // Remove index
    rel = rel.replace(/\/index$/, '/');
    // Ensure leading slash and trailing slash
    if (!rel.startsWith('/'))
        rel = '/' + rel;
    if (!rel.endsWith('/'))
        rel = rel + '/';
    return rel;
}
// ---------------------------------------------------------------------------
// Bounce rate → colour
// ---------------------------------------------------------------------------
function bounceColor(rate) {
    if (rate < 0.25)
        return '🟢';
    if (rate < 0.45)
        return '🟡';
    if (rate < 0.65)
        return '🟠';
    return '🔴';
}
function fmtPct(rate) {
    return (rate * 100).toFixed(1) + '%';
}
function fmtDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
// ---------------------------------------------------------------------------
// Extension state
// ---------------------------------------------------------------------------
let metricsCache = new Map(); // keyed by pagePath
let lastFetch = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let statusBarItem;
let outputChannel;
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
        const config = vscode.workspace.getConfiguration('thinkportAnalytics');
        const contentRoot = config.get('contentRoot', 'src/content');
        const slug = filePathToSlug(document.uri.fsPath, wsFolder.uri.fsPath, contentRoot);
        if (!slug)
            return [];
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
        const lenses = [
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
class AnalyticsHoverProvider {
    provideHover(document, position) {
        // Only show hover on first 5 lines (frontmatter area)
        if (position.line > 10)
            return null;
        const wsFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!wsFolder)
            return null;
        const config = vscode.workspace.getConfiguration('thinkportAnalytics');
        const contentRoot = config.get('contentRoot', 'src/content');
        const slug = filePathToSlug(document.uri.fsPath, wsFolder.uri.fsPath, contentRoot);
        if (!slug)
            return null;
        const metrics = metricsCache.get(slug);
        if (!metrics)
            return null;
        const icon = bounceColor(metrics.bounceRate);
        const md = new vscode.MarkdownString(undefined, true);
        md.isTrusted = true;
        md.appendMarkdown(`### 📊 Analytics — \`${slug}\`\n\n`);
        md.appendMarkdown(`| Metrik | Wert |\n|---|---|\n`);
        md.appendMarkdown(`| ${icon} Bounce Rate | **${fmtPct(metrics.bounceRate)}** |\n`);
        md.appendMarkdown(`| 👁 Seitenaufrufe | **${metrics.views.toLocaleString('de')}** |\n`);
        md.appendMarkdown(`| 👤 Aktive Nutzer | **${metrics.users.toLocaleString('de')}** |\n`);
        md.appendMarkdown(`| ⏱ Ø Session-Dauer | **${fmtDuration(metrics.avgSessionDuration)}** |\n`);
        md.appendMarkdown(`\n\n*Letzten ${config.get('lookbackDays', 30)} Tage · GA4 Property ${config.get('propertyId')}*`);
        return new vscode.Hover(md);
    }
}
// ---------------------------------------------------------------------------
// Status bar update
// ---------------------------------------------------------------------------
function updateStatusBar(document) {
    if (!document || !document.fileName.match(/\.(md|mdx)$/)) {
        statusBarItem.hide();
        return;
    }
    const wsFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!wsFolder) {
        statusBarItem.hide();
        return;
    }
    const config = vscode.workspace.getConfiguration('thinkportAnalytics');
    const contentRoot = config.get('contentRoot', 'src/content');
    const slug = filePathToSlug(document.uri.fsPath, wsFolder.uri.fsPath, contentRoot);
    if (!slug) {
        statusBarItem.hide();
        return;
    }
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
async function refreshData(codeLensProvider) {
    const config = vscode.workspace.getConfiguration('thinkportAnalytics');
    const propertyId = config.get('propertyId', '364493652');
    const credentialsPath = config.get('credentialsPath', '');
    const lookbackDays = config.get('lookbackDays', 30);
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
    }
    catch (err) {
        outputChannel.appendLine(`[ERROR] ${err.message}`);
        outputChannel.show(true);
        vscode.window.showErrorMessage(`Analytics Fehler: ${err.message}`);
        statusBarItem.text = '$(graph) Analytics: Fehler';
    }
}
// ---------------------------------------------------------------------------
// Activate
// ---------------------------------------------------------------------------
function activate(context) {
    outputChannel = vscode.window.createOutputChannel('Thinkport Analytics');
    // Status bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    // Providers
    const codeLensProvider = new AnalyticsCodeLensProvider();
    const hoverProvider = new AnalyticsHoverProvider();
    context.subscriptions.push(vscode.languages.registerCodeLensProvider([{ language: 'markdown' }, { language: 'mdx' }], codeLensProvider), vscode.languages.registerHoverProvider([{ language: 'markdown' }, { language: 'mdx' }], hoverProvider));
    // Commands
    context.subscriptions.push(vscode.commands.registerCommand('thinkport-analytics.refresh', () => {
        refreshData(codeLensProvider);
    }), vscode.commands.registerCommand('thinkport-analytics.configure', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'thinkportAnalytics');
    }));
    // Auto-update status bar on editor change
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        updateStatusBar(editor?.document);
        // Auto-refresh if cache is stale and a markdown file is opened
        if (editor?.document.fileName.match(/\.(md|mdx)$/) && Date.now() - lastFetch > CACHE_TTL_MS) {
            refreshData(codeLensProvider);
        }
    }));
    // Initial load if a markdown file is already open
    if (vscode.window.activeTextEditor?.document.fileName.match(/\.(md|mdx)$/)) {
        refreshData(codeLensProvider);
    }
    outputChannel.appendLine('Thinkport Analytics extension activated.');
}
function deactivate() {
    statusBarItem?.dispose();
}
//# sourceMappingURL=extension.js.map