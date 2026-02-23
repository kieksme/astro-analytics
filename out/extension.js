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
        const config = vscode.workspace.getConfiguration('astroAnalytics');
        const contentRoot = config.get('contentRoot', 'src/content');
        const pagesRoot = config.get('pagesRoot', 'src/pages');
        const slug = (0, slug_1.filePathToSlug)(document.uri.fsPath, wsFolder.uri.fsPath, contentRoot, pagesRoot);
        if (!slug)
            return [];
        const metrics = metricsCache.get(slug);
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
        const metrics = metricsCache.get(slug);
        if (!metrics)
            return null;
        const icon = (0, format_1.bounceColor)(metrics.bounceRate);
        const md = new vscode.MarkdownString(undefined, true);
        md.isTrusted = true;
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
    const metrics = metricsCache.get(slug);
    if (!metrics) {
        statusBarItem.text = '$(graph) Analytics: —';
        statusBarItem.tooltip = `No data for ${slug}`;
        statusBarItem.show();
        return;
    }
    const icon = (0, format_1.bounceColor)(metrics.bounceRate);
    statusBarItem.text = `$(graph) ${icon} ${(0, format_1.fmtPct)(metrics.bounceRate)} Bounce · ${metrics.views.toLocaleString('de')} Views`;
    statusBarItem.tooltip = `Bounce: ${(0, format_1.fmtPct)(metrics.bounceRate)} | Views: ${metrics.views} | Users: ${metrics.users} | Ø ${(0, format_1.fmtDuration)(metrics.avgSessionDuration)}`;
    statusBarItem.command = 'astro-analytics.refresh';
    statusBarItem.show();
}
// ---------------------------------------------------------------------------
// Data refresh
// ---------------------------------------------------------------------------
async function refreshData(codeLensProvider) {
    const config = vscode.workspace.getConfiguration('astroAnalytics');
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
    outputChannel = vscode.window.createOutputChannel('Astro Analytics');
    // Status bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    // Providers
    const codeLensProvider = new AnalyticsCodeLensProvider();
    const hoverProvider = new AnalyticsHoverProvider();
    context.subscriptions.push(vscode.languages.registerCodeLensProvider([{ language: 'markdown' }, { language: 'mdx' }, { language: 'astro' }], codeLensProvider), vscode.languages.registerHoverProvider([{ language: 'markdown' }, { language: 'mdx' }, { language: 'astro' }], hoverProvider));
    // Commands
    context.subscriptions.push(vscode.commands.registerCommand('astro-analytics.refresh', () => {
        refreshData(codeLensProvider);
    }), vscode.commands.registerCommand('astro-analytics.configure', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'astroAnalytics');
    }));
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
function deactivate() {
    statusBarItem?.dispose();
}
//# sourceMappingURL=extension.js.map