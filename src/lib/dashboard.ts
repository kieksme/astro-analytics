/**
 * Dashboard data and HTML generation for the Astro Analytics webview.
 * Pure functions for unit testing without VS Code runtime.
 */

export interface DashboardConfig {
  propertyId: string;
  lookbackDays: number;
  /** Maximum number of top pages to show (default 20). */
  maxPages: number;
}

export interface PageMetrics {
  pagePath: string;
  views: number;
  users: number;
  bounceRate: number;
  avgSessionDuration: number;
}

export interface DashboardTopPage extends PageMetrics {
  hasFile: boolean;
}

export interface DashboardData {
  configured: boolean;
  propertyId: string;
  cacheSize: number;
  lastFetch: number;
  lookbackDays: number;
  topPages: DashboardTopPage[];
}

export interface DashboardL10n {
  title: string;
  propertyId: string;
  pagesInCache: string;
  lastFetch: string;
  lookback: string;
  days: string;
  refreshData: string;
  page: string;
  views: string;
  users: string;
  bounce: string;
  avgDuration: string;
  emptyState: string;
  notConfigured: string;
  openSettings: string;
  notSet: string;
  legendGood: string;
  legendWarning: string;
  legendHigh: string;
  legendCritical: string;
}

export interface BuildDashboardHtmlOptions {
  cspSource: string;
  nonce?: string;
  lang?: string;
}

const SORT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M4 6h8l-4-4-4 4zm0 4l4 4 4-4H4z"/></svg>';

/**
 * Build serializable dashboard data from config, cache, and a file-resolver.
 * Used by the extension with vscode.workspace and resolvePagePathToFile.
 */
export function getDashboardDataFromState(
  config: DashboardConfig,
  metricsCache: Map<string, PageMetrics>,
  lastFetch: number,
  resolveFile: (pagePath: string) => string | null
): DashboardData {
  const propertyId = config.propertyId ?? '';
  const lookbackDays = config.lookbackDays ?? 30;
  const maxPages = Math.max(1, config.maxPages ?? 20);
  const entries = Array.from(metricsCache.entries());
  const topPages: DashboardTopPage[] = entries
    .sort((a, b) => b[1].bounceRate - a[1].bounceRate)
    .slice(0, maxPages)
    .map(([path, m]) => ({
      pagePath: path,
      views: m.views,
      users: m.users,
      bounceRate: m.bounceRate,
      avgSessionDuration: m.avgSessionDuration,
      hasFile: resolveFile(path) !== null,
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

/**
 * Build dashboard HTML string. Pure function: no vscode or global state.
 */
export function buildDashboardHtml(
  data: DashboardData,
  l10n: DashboardL10n,
  options: BuildDashboardHtmlOptions
): string {
  const nonce = options.nonce ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
  const lang = options.lang ?? 'en';
  const dataJson = JSON.stringify(data);
  const l10nJson = JSON.stringify(l10n).replace(/</g, '\\u003c');
  const safeDataJson = dataJson.replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' ${options.cspSource};">
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
    th.th-sort-active { background: var(--vscode-list-activeSelectionBackground, rgba(0, 122, 204, 0.2)); color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground)); border-bottom: 2px solid var(--vscode-focusBorder, #007acc); }
    th .sort-icon { display: inline-block; vertical-align: middle; margin-left: 2px; opacity: 0.6; }
    th.th-sort-active .sort-icon { opacity: 1; }
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
    .empty-state { padding: 1.5rem; text-align: center; color: var(--vscode-foreground); background: var(--vscode-inputValidation-warningBackground, rgba(204, 160, 0, 0.15)); border: 1px solid var(--vscode-editorWarning-foreground, #eab308); border-radius: 4px; margin: 0.5rem 0; }
    .empty-state a { color: var(--vscode-textLink-foreground); text-decoration: none; font-weight: 600; }
    .empty-state a:hover { text-decoration: underline; }
    .message-box { padding: 0.75rem 1rem; margin: 0.5rem 0; border-radius: 4px; font-size: 0.9em; }
    .message-box.message-warning { background: var(--vscode-inputValidation-warningBackground, rgba(204, 160, 0, 0.15)); border: 1px solid var(--vscode-editorWarning-foreground, #eab308); color: var(--vscode-foreground); }
    .message-box a { color: var(--vscode-textLink-foreground); text-decoration: none; font-weight: 600; }
    .message-box a:hover { text-decoration: underline; }
    .legend { margin-top: 0.75rem; font-size: 0.8em; color: var(--vscode-descriptionForeground); display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; }
    .legend span { display: inline-flex; align-items: center; gap: 0.25rem; }
  </style>
</head>
<body>
  <div class="dashboard-header">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="24" height="24"><path fill="currentColor" d="M4 20v-4h4v4H4zm6 0v-8h4v8h-4zm6 0V8h4v12h-4zm6 0V4h4v16h-4z"/></svg>
    <h1>${l10n.title}</h1>
  </div>
  <div id="notConfiguredBanner" class="message-box message-warning" style="display:none;">${l10n.notConfigured} <a href="#" id="openSettingsBannerLink">${l10n.openSettings}</a></div>
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
        <th data-sort="pagePath">${l10n.page} <span class="sort-icon">${SORT_SVG}</span></th>
        <th data-sort="views">${l10n.views} <span class="sort-icon">${SORT_SVG}</span></th>
        <th data-sort="users">${l10n.users} <span class="sort-icon">${SORT_SVG}</span></th>
        <th data-sort="bounceRate">${l10n.bounce} <span class="sort-icon">${SORT_SVG}</span></th>
        <th data-sort="avgSessionDuration">${l10n.avgDuration} <span class="sort-icon">${SORT_SVG}</span></th>
      </tr></thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>
  <div id="emptyState" class="empty-state" style="display:none;">${l10n.emptyState} <a href="#" id="openSettingsLink">${l10n.openSettings}</a></div>
  <div class="legend" id="legend"><span class="bounce-good"><span class="bounce-dot"></span> ${l10n.legendGood}</span><span class="bounce-warning"><span class="bounce-dot"></span> ${l10n.legendWarning}</span><span class="bounce-high"><span class="bounce-dot"></span> ${l10n.legendHigh}</span><span class="bounce-critical"><span class="bounce-dot"></span> ${l10n.legendCritical}</span></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const l10n = ${l10nJson};
    const data = ${safeDataJson};

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

    let sortKey = 'bounceRate';
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

    function updateSortIndicator() {
      document.querySelectorAll('th[data-sort]').forEach(th => {
        th.classList.toggle('th-sort-active', th.getAttribute('data-sort') === sortKey);
      });
    }

    function render(d) {
      const banner = document.getElementById('notConfiguredBanner');
      if (banner) banner.style.display = d.configured ? 'none' : 'block';
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
        updateSortIndicator();
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
      updateSortIndicator();
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
    document.getElementById('openSettingsLink')?.addEventListener('click', e => { e.preventDefault(); vscode.postMessage({ type: 'openSettings' }); });
    document.getElementById('openSettingsBannerLink')?.addEventListener('click', e => { e.preventDefault(); vscode.postMessage({ type: 'openSettings' }); });
  </script>
</body>
</html>`;
}
