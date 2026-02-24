/**
 * Dashboard data and HTML generation for the Astro Analytics webview.
 * Pure functions for unit testing without VS Code runtime.
 */

export interface DashboardConfig {
  propertyId: string;
  lookbackDays: number;
  /** Maximum number of top pages to include in dashboard data (default 500). */
  maxPages: number;
  /** Number of entries per page in the dashboard UI (default 20). */
  pageSize: number;
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
  /** Resolved workspace file path for this page (for hover tooltip). */
  resolvedFilePath?: string | null;
  /** Path to show in title tooltip (e.g. relative path from project root). Falls back to resolvedFilePath when not set. */
  titleDisplayPath?: string | null;
  /** True when the resolved file is an Astro dynamic route (e.g. [slug].astro). */
  isDynamicRoute?: boolean;
}

export interface DashboardData {
  configured: boolean;
  propertyId: string;
  cacheSize: number;
  lastFetch: number;
  lookbackDays: number;
  /** Number of entries per page (for pagination). */
  pageSize: number;
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
  pageOf: string;
  previous: string;
  next: string;
  /** Label for dynamic route badge (e.g. "dynamic"). */
  dynamicRouteLabel?: string;
  /** Filter option: show all pages. */
  filterAll?: string;
  /** Filter option: show only static pages. */
  filterStatic?: string;
  /** Filter option: show only dynamic pages. */
  filterDynamicOnly?: string;
  /** Aria-label for the filter select. */
  filterDynamicLabel?: string;
}

export interface BuildDashboardHtmlOptions {
  cspSource: string;
  nonce?: string;
  lang?: string;
}

const SORT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M4 6h8l-4-4-4 4zm0 4l4 4 4-4H4z"/></svg>';
const REFRESH_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M1,12A11,11,0,0,1,17.882,2.7l1.411-1.41A1,1,0,0,1,21,2V6a1,1,0,0,1-1,1H16a1,1,0,0,1-.707-1.707l1.128-1.128A8.994,8.994,0,0,0,3,12a1,1,0,0,1-2,0Zm21-1a1,1,0,0,0-1,1,9.01,9.01,0,0,1-9,9,8.9,8.9,0,0,1-4.42-1.166l1.127-1.127A1,1,0,0,0,8,17H4a1,1,0,0,0-1,1v4a1,1,0,0,0,.617.924A.987.987,0,0,0,4,23a1,1,0,0,0,.707-.293L6.118,21.3A10.891,10.891,0,0,0,12,23,11.013,11.013,0,0,0,23,12,1,1,0,0,0,22,11Z"/></svg>';

/**
 * Build sidebar view title string (for activity bar badge/title).
 * When isRefreshing, appends the sync spinner codicon; otherwise appends (cacheSize) when > 0.
 */
export function getSidebarViewTitleString(
  baseTitle: string,
  cacheSize: number,
  isRefreshing: boolean
): string {
  if (isRefreshing) return `${baseTitle} $(sync~spin)`;
  return cacheSize > 0 ? `${baseTitle} (${cacheSize})` : baseTitle;
}

/**
 * Build serializable dashboard data from config, cache, and a file-resolver.
 * Used by the extension with vscode.workspace and resolvePagePathToFile.
 */
export function getDashboardDataFromState(
  config: DashboardConfig,
  metricsCache: Map<string, PageMetrics>,
  lastFetch: number,
  resolveFile: (pagePath: string) => string | null,
  isDynamicRoute?: (pagePath: string) => boolean,
  getTitlePath?: (pagePath: string, resolvedFilePath: string | null) => string | null
): DashboardData {
  const propertyId = config.propertyId ?? '';
  const lookbackDays = config.lookbackDays ?? 30;
  const maxPages = Math.max(1, config.maxPages ?? 500);
  const pageSize = Math.max(1, config.pageSize ?? 20);
  const entries = Array.from(metricsCache.entries());
  const topPages: DashboardTopPage[] = entries
    .sort((a, b) => b[1].bounceRate - a[1].bounceRate)
    .slice(0, maxPages)
    .map(([path, m]) => {
      const resolvedFilePath = resolveFile(path);
      const titleDisplayPath = getTitlePath ? getTitlePath(path, resolvedFilePath ?? null) : (resolvedFilePath ?? null);
      return {
        pagePath: path,
        views: m.views,
        users: m.users,
        bounceRate: m.bounceRate,
        avgSessionDuration: m.avgSessionDuration,
        hasFile: resolvedFilePath !== null,
        resolvedFilePath: resolvedFilePath ?? null,
        titleDisplayPath: titleDisplayPath ?? null,
        isDynamicRoute: isDynamicRoute ? isDynamicRoute(path) : false,
      };
    });
  return {
    configured: !!propertyId,
    propertyId,
    cacheSize: metricsCache.size,
    lastFetch,
    lookbackDays,
    pageSize,
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
    .dynamic-route-badge { font-size: 0.75em; opacity: 0.85; margin-left: 0.35rem; color: var(--vscode-descriptionForeground); }
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
    .pagination { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; font-size: 0.9em; flex-wrap: wrap; }
    .pagination .page-info { margin: 0 0.25rem; }
    .btn-page { padding: 0.25rem 0.5rem; cursor: pointer; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 2px; font-size: inherit; }
    .btn-page:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground); }
    .btn-page:disabled { opacity: 0.5; cursor: default; }
    .toolbar-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin: 0.5rem 0; }
    .filter-row { display: flex; align-items: center; gap: 0.5rem; margin: 0; }
    .filter-row select { font-size: inherit; padding: 0.25rem 0.5rem; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 2px; }
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
  <div class="toolbar-row">
    <button type="button" class="btn-refresh" id="refreshBtn">${REFRESH_SVG} ${l10n.refreshData}</button>
    <div class="filter-row">
      <select id="filterDynamic" aria-label="${l10n.filterDynamicLabel || 'Filter by route type'}">
        <option value="all">${l10n.filterAll ?? 'All'}</option>
        <option value="static">${l10n.filterStatic ?? 'Static only'}</option>
        <option value="dynamic">${l10n.filterDynamicOnly ?? 'Dynamic only'}</option>
      </select>
    </div>
  </div>
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
  <div id="paginationWrap" class="pagination" style="display:none;">
    <button type="button" class="btn-page" id="prevBtn">${l10n.previous}</button>
    <span class="page-info" id="pageInfo"></span>
    <button type="button" class="btn-page" id="nextBtn">${l10n.next}</button>
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
    let currentPage = 1;
    let filterDynamic = 'all';
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
      const paginationWrap = document.getElementById('paginationWrap');
      if (!d.topPages || d.topPages.length === 0) {
        tableWrap.style.display = 'none';
        if (paginationWrap) paginationWrap.style.display = 'none';
        emptyEl.style.display = 'block';
        tbody.innerHTML = '';
        updateSortIndicator();
        return;
      }
      tableWrap.style.display = 'block';
      emptyEl.style.display = 'none';
      const pageSize = Math.max(1, d.pageSize || 20);
      let list = d.topPages || [];
      if (filterDynamic === 'static') list = list.filter(function(p) { return !p.isDynamicRoute; });
      else if (filterDynamic === 'dynamic') list = list.filter(function(p) { return !!p.isDynamicRoute; });
      const sorted = sortData(list);
      const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
      if (currentPage > totalPages) currentPage = totalPages;
      const start = (currentPage - 1) * pageSize;
      const pageRows = sorted.slice(start, start + pageSize);
      tbody.innerHTML = pageRows.map(p => {
        const pathEsc = escapeHtml(p.pagePath);
        const bounceCl = bounceClass(p.bounceRate);
        const pct = (p.bounceRate * 100).toFixed(1) + '%';
        const titlePath = (p.titleDisplayPath != null && p.titleDisplayPath !== '') ? p.titleDisplayPath : (p.resolvedFilePath != null && p.resolvedFilePath !== '') ? p.resolvedFilePath : '';
        const titleAttr = titlePath ? ' title="' + escapeHtml(titlePath) + '"' : '';
        const badgeHtml = (p.isDynamicRoute && l10n.dynamicRouteLabel) ? ' <span class="dynamic-route-badge">' + escapeHtml(l10n.dynamicRouteLabel) + '</span>' : '';
        const pageCell = p.hasFile
          ? '<a class="page-link" href="#" data-page-path="' + escapeHtml(p.pagePath) + '"' + titleAttr + '>' + pathEsc + badgeHtml + '</a>'
          : '<span class="page-text"' + titleAttr + '>' + pathEsc + badgeHtml + '</span>';
        return '<tr><td>' + pageCell + '</td><td>' + p.views.toLocaleString() + '</td><td>' + p.users.toLocaleString() + '</td><td class="bounce-cell ' + bounceCl + '"><span class="bounce-dot"></span>' + pct + '</td><td>' + formatDuration(p.avgSessionDuration) + '</td></tr>';
      }).join('');
      tbody.querySelectorAll('.page-link').forEach(el => {
        el.addEventListener('click', e => { e.preventDefault(); vscode.postMessage({ type: 'openPage', pagePath: el.getAttribute('data-page-path') }); });
      });
      if (paginationWrap) {
        paginationWrap.style.display = totalPages > 1 ? 'flex' : 'none';
        document.getElementById('pageInfo').textContent = l10n.pageOf.replace('{0}', String(currentPage)).replace('{1}', String(totalPages));
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
      }
      updateSortIndicator();
    }

    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (sortKey === key) sortDir = -sortDir; else { sortKey = key; sortDir = (key === 'pagePath' ? 1 : -1); }
        render(currentData);
      });
    });
    const filterEl = document.getElementById('filterDynamic');
    if (filterEl) filterEl.addEventListener('change', function() { filterDynamic = this.value; currentPage = 1; render(currentData); });

    const currentData = { topPages: data.topPages, configured: data.configured, propertyId: data.propertyId, cacheSize: data.cacheSize, lastFetch: data.lastFetch, lookbackDays: data.lookbackDays, pageSize: data.pageSize || 20 };
    function updateData(d) {
      currentData.topPages = d.topPages;
      currentData.configured = d.configured;
      currentData.propertyId = d.propertyId;
      currentData.cacheSize = d.cacheSize;
      currentData.lastFetch = d.lastFetch;
      currentData.lookbackDays = d.lookbackDays;
      currentData.pageSize = d.pageSize || 20;
      currentPage = 1;
      render(currentData);
    }
    document.getElementById('prevBtn').onclick = () => { if (currentPage > 1) { currentPage--; render(currentData); } };
    document.getElementById('nextBtn').onclick = () => { const totalPages = Math.ceil((currentData.topPages || []).length / (currentData.pageSize || 20)); if (currentPage < totalPages) { currentPage++; render(currentData); } };
    render(currentData);
    window.addEventListener('message', e => { if (e.data && e.data.type === 'data') updateData(e.data.data); });
    document.getElementById('refreshBtn').onclick = () => vscode.postMessage({ type: 'refresh' });
    document.getElementById('openSettingsLink')?.addEventListener('click', e => { e.preventDefault(); vscode.postMessage({ type: 'openSettings' }); });
    document.getElementById('openSettingsBannerLink')?.addEventListener('click', e => { e.preventDefault(); vscode.postMessage({ type: 'openSettings' }); });
  </script>
</body>
</html>`;
}

/**
 * Build sidebar dashboard HTML (path + bounce only). Same data and message protocol as full dashboard.
 */
export function buildSidebarDashboardHtml(
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
    body { font-family: var(--vscode-font-family); padding: 0.75rem; color: var(--vscode-foreground); margin: 0; }
    .dashboard-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
    .dashboard-header svg { flex-shrink: 0; }
    h1 { font-size: 1.1rem; margin: 0; font-weight: 600; }
    .meta { margin-bottom: 0.5rem; font-size: 0.85em; }
    .btn-refresh { display: inline-flex; align-items: center; gap: 0.4rem; margin-bottom: 0.5rem; padding: 0.35rem 0.6rem; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; font-size: inherit; }
    .btn-refresh:hover { background: var(--vscode-button-hoverBackground); }
    .btn-refresh svg { width: 14px; height: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
    th, td { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--vscode-widget-border); }
    th { font-weight: 600; cursor: pointer; user-select: none; white-space: nowrap; }
    th:hover { background: var(--vscode-list-hoverBackground); }
    th.th-sort-active { background: var(--vscode-list-activeSelectionBackground, rgba(0, 122, 204, 0.2)); color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground)); border-bottom: 2px solid var(--vscode-focusBorder, #007acc); }
    th .sort-icon { display: inline-block; vertical-align: middle; margin-left: 2px; opacity: 0.6; }
    th.th-sort-active .sort-icon { opacity: 1; }
    tbody tr:hover { background: var(--vscode-list-hoverBackground); }
    .page-link { color: var(--vscode-textLink-foreground); text-decoration: none; cursor: pointer; }
    .page-link:hover { text-decoration: underline; }
    .page-text { color: var(--vscode-foreground); cursor: default; }
    .dynamic-route-badge { font-size: 0.75em; opacity: 0.85; margin-left: 0.35rem; color: var(--vscode-descriptionForeground); }
    .bounce-cell { display: flex; align-items: center; gap: 0.35rem; }
    .bounce-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .bounce-good .bounce-dot { background: var(--vscode-testing-iconPassed, #22c55e); }
    .bounce-warning .bounce-dot { background: var(--vscode-editorWarning-foreground, #eab308); }
    .bounce-high .bounce-dot { background: #f97316; }
    .bounce-critical .bounce-dot { background: var(--vscode-errorForeground, #ef4444); }
    .empty-state { padding: 1rem; text-align: center; color: var(--vscode-foreground); background: var(--vscode-inputValidation-warningBackground, rgba(204, 160, 0, 0.15)); border: 1px solid var(--vscode-editorWarning-foreground, #eab308); border-radius: 4px; margin: 0.5rem 0; font-size: 0.9em; }
    .empty-state a { color: var(--vscode-textLink-foreground); text-decoration: none; font-weight: 600; }
    .empty-state a:hover { text-decoration: underline; }
    .message-box { padding: 0.6rem 0.75rem; margin: 0.5rem 0; border-radius: 4px; font-size: 0.85em; }
    .message-box.message-warning { background: var(--vscode-inputValidation-warningBackground, rgba(204, 160, 0, 0.15)); border: 1px solid var(--vscode-editorWarning-foreground, #eab308); color: var(--vscode-foreground); }
    .message-box a { color: var(--vscode-textLink-foreground); text-decoration: none; font-weight: 600; }
    .message-box a:hover { text-decoration: underline; }
    .legend { margin-top: 0.5rem; font-size: 0.75em; color: var(--vscode-descriptionForeground); display: flex; flex-wrap: wrap; gap: 0.35rem 0.75rem; align-items: center; }
    .legend span { display: inline-flex; align-items: center; gap: 0.2rem; }
    .pagination { display: flex; align-items: center; gap: 0.35rem; margin-top: 0.4rem; font-size: 0.8em; flex-wrap: wrap; }
    .pagination .page-info { margin: 0 0.2rem; }
    .btn-page { padding: 0.2rem 0.4rem; cursor: pointer; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 2px; font-size: inherit; }
    .btn-page:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground); }
    .btn-page:disabled { opacity: 0.5; cursor: default; }
    .toolbar-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin: 0.5rem 0; }
    .filter-row { display: flex; align-items: center; gap: 0.5rem; margin: 0; }
    .filter-row select { font-size: inherit; padding: 0.25rem 0.5rem; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 2px; }
  </style>
</head>
<body>
  <div class="dashboard-header">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="22" height="22"><path fill="currentColor" d="M4 20v-4h4v4H4zm6 0v-8h4v8h-4zm6 0V8h4v12h-4zm6 0V4h4v16h-4z"/></svg>
    <h1>${l10n.title}</h1>
  </div>
  <div id="notConfiguredBanner" class="message-box message-warning" style="display:none;">${l10n.notConfigured} <a href="#" id="openSettingsBannerLink">${l10n.openSettings}</a></div>
  <div class="meta"><strong>${l10n.propertyId}</strong> <span id="propertyId">-</span></div>
  <div class="toolbar-row">
    <button type="button" class="btn-refresh" id="refreshBtn">${REFRESH_SVG} ${l10n.refreshData}</button>
    <div class="filter-row">
      <select id="filterDynamic" aria-label="${l10n.filterDynamicLabel || 'Filter by route type'}">
        <option value="all">${l10n.filterAll ?? 'All'}</option>
        <option value="static">${l10n.filterStatic ?? 'Static only'}</option>
        <option value="dynamic">${l10n.filterDynamicOnly ?? 'Dynamic only'}</option>
      </select>
    </div>
  </div>
  <div id="tableWrap">
    <table>
      <thead><tr>
        <th data-sort="pagePath">${l10n.page} <span class="sort-icon">${SORT_SVG}</span></th>
        <th data-sort="bounceRate">${l10n.bounce} <span class="sort-icon">${SORT_SVG}</span></th>
      </tr></thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>
  <div id="paginationWrap" class="pagination" style="display:none;">
    <button type="button" class="btn-page" id="prevBtn">${l10n.previous}</button>
    <span class="page-info" id="pageInfo"></span>
    <button type="button" class="btn-page" id="nextBtn">${l10n.next}</button>
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
    function escapeHtml(s) { const div = document.createElement('div'); div.textContent = s; return div.innerHTML; }

    let sortKey = 'bounceRate';
    let sortDir = -1;
    let currentPage = 1;
    let filterDynamic = 'all';
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
      const tbody = document.getElementById('tbody');
      const emptyEl = document.getElementById('emptyState');
      const tableWrap = document.getElementById('tableWrap');
      const paginationWrap = document.getElementById('paginationWrap');
      if (!d.topPages || d.topPages.length === 0) {
        tableWrap.style.display = 'none';
        if (paginationWrap) paginationWrap.style.display = 'none';
        emptyEl.style.display = 'block';
        tbody.innerHTML = '';
        updateSortIndicator();
        return;
      }
      tableWrap.style.display = 'block';
      emptyEl.style.display = 'none';
      const pageSize = Math.max(1, d.pageSize || 20);
      let list = d.topPages || [];
      if (filterDynamic === 'static') list = list.filter(function(p) { return !p.isDynamicRoute; });
      else if (filterDynamic === 'dynamic') list = list.filter(function(p) { return !!p.isDynamicRoute; });
      const sorted = sortData(list);
      const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
      if (currentPage > totalPages) currentPage = totalPages;
      const start = (currentPage - 1) * pageSize;
      const pageRows = sorted.slice(start, start + pageSize);
      tbody.innerHTML = pageRows.map(p => {
        const pathEsc = escapeHtml(p.pagePath);
        const bounceCl = bounceClass(p.bounceRate);
        const pct = (p.bounceRate * 100).toFixed(1) + '%';
        const titlePath = (p.titleDisplayPath != null && p.titleDisplayPath !== '') ? p.titleDisplayPath : (p.resolvedFilePath != null && p.resolvedFilePath !== '') ? p.resolvedFilePath : '';
        const titleAttr = titlePath ? ' title="' + escapeHtml(titlePath) + '"' : '';
        const badgeHtml = (p.isDynamicRoute && l10n.dynamicRouteLabel) ? ' <span class="dynamic-route-badge">' + escapeHtml(l10n.dynamicRouteLabel) + '</span>' : '';
        const pageCell = p.hasFile
          ? '<a class="page-link" href="#" data-page-path="' + escapeHtml(p.pagePath) + '"' + titleAttr + '>' + pathEsc + badgeHtml + '</a>'
          : '<span class="page-text"' + titleAttr + '>' + pathEsc + badgeHtml + '</span>';
        return '<tr><td>' + pageCell + '</td><td class="bounce-cell ' + bounceCl + '"><span class="bounce-dot"></span>' + pct + '</td></tr>';
      }).join('');
      tbody.querySelectorAll('.page-link').forEach(el => {
        el.addEventListener('click', e => { e.preventDefault(); vscode.postMessage({ type: 'openPage', pagePath: el.getAttribute('data-page-path') }); });
      });
      if (paginationWrap) {
        paginationWrap.style.display = totalPages > 1 ? 'flex' : 'none';
        document.getElementById('pageInfo').textContent = l10n.pageOf.replace('{0}', String(currentPage)).replace('{1}', String(totalPages));
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
      }
      updateSortIndicator();
    }

    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (sortKey === key) sortDir = -sortDir; else { sortKey = key; sortDir = (key === 'pagePath' ? 1 : -1); }
        render(currentData);
      });
    });
    const filterEl = document.getElementById('filterDynamic');
    if (filterEl) filterEl.addEventListener('change', function() { filterDynamic = this.value; currentPage = 1; render(currentData); });

    const currentData = { topPages: data.topPages, configured: data.configured, propertyId: data.propertyId, cacheSize: data.cacheSize, lastFetch: data.lastFetch, lookbackDays: data.lookbackDays, pageSize: data.pageSize || 20 };
    function updateData(d) {
      currentData.topPages = d.topPages;
      currentData.configured = d.configured;
      currentData.propertyId = d.propertyId;
      currentData.cacheSize = d.cacheSize;
      currentData.lastFetch = d.lastFetch;
      currentData.lookbackDays = d.lookbackDays;
      currentData.pageSize = d.pageSize || 20;
      currentPage = 1;
      render(currentData);
    }
    document.getElementById('prevBtn').onclick = () => { if (currentPage > 1) { currentPage--; render(currentData); } };
    document.getElementById('nextBtn').onclick = () => { const totalPages = Math.ceil((currentData.topPages || []).length / (currentData.pageSize || 20)); if (currentPage < totalPages) { currentPage++; render(currentData); } };
    render(currentData);
    window.addEventListener('message', e => { if (e.data && e.data.type === 'data') updateData(e.data.data); });
    document.getElementById('refreshBtn').onclick = () => vscode.postMessage({ type: 'refresh' });
    document.getElementById('openSettingsLink')?.addEventListener('click', e => { e.preventDefault(); vscode.postMessage({ type: 'openSettings' }); });
    document.getElementById('openSettingsBannerLink')?.addEventListener('click', e => { e.preventDefault(); vscode.postMessage({ type: 'openSettings' }); });
  </script>
</body>
</html>`;
}
