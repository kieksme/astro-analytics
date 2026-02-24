/**
 * Dashboard data and HTML generation for the Astro Analytics webview.
 * Pure functions for unit testing without VS Code runtime.
 * Uses ETA for lightweight HTML templating (Option A: inline template strings).
 */

import { Eta } from 'eta';

const eta = new Eta({ useWith: false });
/** Full dashboard uses custom delimiters so embedded script/JSON can contain <% or %> safely. */
const etaFull = new Eta({ useWith: false, tags: ['[[', ']]'] });

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
  /** Page title from GA4 (document title when the page was viewed). */
  pageTitle?: string;
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
  /** Shown when filter yields no rows but data exists. */
  filterEmpty?: string;
  /** Shown when script fails to load (e.g. acquireVsCodeApi). */
  loadError?: string;
}

export interface BuildDashboardHtmlOptions {
  cspSource: string;
  nonce?: string;
  lang?: string;
  /** Page title for <title> and <h1> (e.g. localized "Astro Analytics Dashboard"). Used by full dashboard only. */
  pageTitle?: string;
  /** Localized strings for the dashboard UI. When omitted, DEFAULT_DASHBOARD_L10N (English) is used. */
  l10n?: DashboardL10n;
}

/** English fallback when options.l10n is not provided (e.g. in tests). Matches bundle.l10n.json dashboard.* keys. */
export const DEFAULT_DASHBOARD_L10N: DashboardL10n = {
  title: 'Astro Analytics Dashboard',
  propertyId: 'Property ID:',
  pagesInCache: 'Pages in cache:',
  lastFetch: 'Last fetch:',
  lookback: 'Lookback:',
  days: 'days',
  refreshData: 'Refresh data',
  page: 'Page',
  views: 'Views',
  users: 'Users',
  bounce: 'Bounce',
  avgDuration: 'Avg duration',
  emptyState: 'No cached pages. Configure GA4 and run Refresh Data.',
  notConfigured: 'GA4 is not configured. Set Property ID and credentials in Settings to load analytics data. ',
  openSettings: 'Open Settings',
  notSet: '(not set)',
  legendGood: '<25%',
  legendWarning: '25–45%',
  legendHigh: '45–65%',
  legendCritical: '≥65%',
  pageOf: 'Page {0} of {1}',
  previous: 'Previous',
  next: 'Next',
  dynamicRouteLabel: 'dynamic',
  filterAll: 'All',
  filterStatic: 'Static only',
  filterDynamicOnly: 'Dynamic only',
  filterDynamicLabel: 'Filter by route type',
  filterEmpty: 'No pages match the current filter. Try "All".',
  loadError: 'Dashboard failed to load',
};

const SORT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M4 6h8l-4-4-4 4zm0 4l4 4 4-4H4z"/></svg>';
const REFRESH_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M1,12A11,11,0,0,1,17.882,2.7l1.411-1.41A1,1,0,0,1,21,2V6a1,1,0,0,1-1,1H16a1,1,0,0,1-.707-1.707l1.128-1.128A8.994,8.994,0,0,0,3,12a1,1,0,0,1-2,0Zm21-1a1,1,0,0,0-1,1,9.01,9.01,0,0,1-9,9,8.9,8.9,0,0,1-4.42-1.166l1.127-1.127A1,1,0,0,0,8,17H4a1,1,0,0,0-1,1v4a1,1,0,0,0,.617.924A.987.987,0,0,0,4,23a1,1,0,0,0,.707-.293L6.118,21.3A10.891,10.891,0,0,0,12,23,11.013,11.013,0,0,0,23,12,1,1,0,0,0,22,11Z"/></svg>';

/** Bounce rate threshold for "critical" (red) pages: ≥ 65%. */
export const BOUNCE_CRITICAL_THRESHOLD = 0.65;

const SIDEBAR_SCRIPT_BODY = `
    try {
    const vscode = acquireVsCodeApi();
    function appendDebug(msg) { try { var el = document.getElementById('debugOutput'); if (el) el.value = (el.value ? el.value + '\\n' : '') + msg; } catch (_) {} }
    appendDebug('Script started ' + new Date().toLocaleTimeString());
    const l10n = __SCRIPT_L10N_JSON__;
    let data;
    try {
      const payloadEl = document.getElementById('dataPayload');
      const raw = payloadEl ? payloadEl.textContent : '';
      data = raw ? JSON.parse(raw) : { configured: true, propertyId: '', cacheSize: 0, lastFetch: 0, lookbackDays: 30, pageSize: 20, topPages: [] };
    } catch (e) { data = { configured: true, propertyId: '', cacheSize: 0, lastFetch: 0, lookbackDays: 30, pageSize: 20, topPages: [] }; }
    if (!data || !Array.isArray(data.topPages)) data = Object.assign({ configured: true, propertyId: '', cacheSize: 0, lastFetch: 0, lookbackDays: 30, pageSize: 20, topPages: [] }, data || {}, { topPages: Array.isArray((data || {}).topPages) ? (data || {}).topPages : [] });
    const emptyStateDefaultHtml = document.getElementById('emptyState').innerHTML;

    function updateDebugOutput(d) {
      try {
        const el = document.getElementById('debugOutput');
        if (!el) { return; }
        const list = Array.isArray(d && d.topPages) ? d.topPages : [];
        const filterVal = typeof filterDynamic !== 'undefined' ? filterDynamic : 'all';
        let filtered = list;
        if (filterVal === 'static') filtered = list.filter(function(p) { return !p.isDynamicRoute; });
        else if (filterVal === 'dynamic') filtered = list.filter(function(p) { return !!p.isDynamicRoute; });
        const pageSize = Math.max(1, (d && d.pageSize) || 20);
        const curPage = typeof currentPage !== 'undefined' ? currentPage : 1;
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        const start = (curPage - 1) * pageSize;
        const pageRows = filtered.slice(start, start + pageSize);
        const dataSource = typeof lastDataReceiveSource !== 'undefined' ? lastDataReceiveSource : 'embedded';
        const dataSourceTime = typeof lastDataReceiveTime !== 'undefined' && lastDataReceiveTime ? ' at ' + lastDataReceiveTime : ' (initial load)';
        let lines = [
          'Data received: ' + dataSource + dataSourceTime,
          'cacheSize: ' + (d && d.cacheSize != null ? d.cacheSize : 0),
          'topPages.length: ' + list.length,
          'pageSize: ' + pageSize,
          'currentPage: ' + curPage,
          'filter: ' + filterVal + ' -> filtered count: ' + filtered.length,
          'totalPages: ' + totalPages,
          'rows on this page: ' + pageRows.length,
          '',
          'First 10 (pagePath | bounce%):'
        ];
        pageRows.slice(0, 10).forEach(function(p, i) {
          const rate = (p && typeof p.bounceRate === 'number') ? (p.bounceRate * 100).toFixed(1) : '-';
          lines.push((i + 1) + '. ' + (p && p.pagePath != null ? String(p.pagePath) : '') + ' | ' + rate + '%');
        });
        el.value = lines.join('\\n');
      } catch (e) {
        const el = document.getElementById('debugOutput');
        if (el) el.value = 'updateDebugOutput error: ' + (e && e.message ? e.message : String(e));
      }
    }

    function bounceClass(rate) {
      if (rate < 0.25) return 'bounce-good';
      if (rate < 0.45) return 'bounce-warning';
      if (rate < __BOUNCE_CRITICAL__) return 'bounce-high';
      return 'bounce-critical';
    }
    function escapeHtml(s) { const div = document.createElement('div'); div.textContent = s; return div.innerHTML; }

    let sortKey = 'bounceRate';
    let sortDir = -1;
    let currentPage = 1;
    let filterDynamic = 'all';
    let lastDataReceiveSource = 'embedded';
    let lastDataReceiveTime = '';
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
      updateDebugOutput(d);
      const banner = document.getElementById('notConfiguredBanner');
      if (banner) banner.style.display = d.configured ? 'none' : 'block';
      document.getElementById('propertyId').textContent = d.configured ? d.propertyId : l10n.notSet;
      const cacheEl = document.getElementById('cacheSize');
      if (cacheEl) cacheEl.textContent = String(d.cacheSize != null ? d.cacheSize : 0);
      const tbody = document.getElementById('tbody');
      const emptyEl = document.getElementById('emptyState');
      const tableWrap = document.getElementById('tableWrap');
      const paginationWrap = document.getElementById('paginationWrap');
      if (!d.topPages || d.topPages.length === 0) {
        tableWrap.style.display = 'none';
        if (paginationWrap) paginationWrap.style.display = 'none';
        emptyEl.innerHTML = emptyStateDefaultHtml;
        emptyEl.style.display = 'block';
        tbody.innerHTML = '';
        updateSortIndicator();
        return;
      }
      const pageSize = Math.max(1, d.pageSize || 20);
      let list = Array.isArray(d.topPages) ? d.topPages : [];
      if (filterDynamic === 'static') list = list.filter(function(p) { return !p.isDynamicRoute; });
      else if (filterDynamic === 'dynamic') list = list.filter(function(p) { return !!p.isDynamicRoute; });
      if (list.length === 0) {
        tableWrap.style.display = 'none';
        if (paginationWrap) paginationWrap.style.display = 'none';
        emptyEl.innerHTML = (l10n.filterEmpty || 'No pages match the current filter. Try "All".');
        emptyEl.style.display = 'block';
        tbody.innerHTML = '';
        updateSortIndicator();
        return;
      }
      tableWrap.style.display = 'block';
      emptyEl.style.display = 'none';
      const sorted = sortData(list);
      const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
      if (currentPage < 1) currentPage = 1;
      if (currentPage > totalPages) currentPage = totalPages;
      const start = (currentPage - 1) * pageSize;
      const pageRows = sorted.slice(start, start + pageSize);
      const safeNum = (v) => (typeof v === 'number' && !Number.isNaN(v)) ? v : 0;
      tbody.innerHTML = pageRows.map(p => {
        const pathEsc = escapeHtml(p && p.pagePath != null ? String(p.pagePath) : '');
        const bounceRate = safeNum(p && p.bounceRate);
        const bounceCl = bounceClass(bounceRate);
        const pct = (bounceRate * 100).toFixed(1) + '%';
        const titlePath = (p && p.titleDisplayPath != null && p.titleDisplayPath !== '') ? p.titleDisplayPath : (p && p.resolvedFilePath != null && p.resolvedFilePath !== '') ? p.resolvedFilePath : '';
        const titleAttr = titlePath ? ' title="' + escapeHtml(titlePath) + '"' : '';
        const badgeHtml = (p && p.isDynamicRoute && l10n.dynamicRouteLabel) ? ' <span class="dynamic-route-badge">' + escapeHtml(l10n.dynamicRouteLabel) + '</span>' : '';
        const pageCell = (p && p.hasFile)
          ? '<a class="page-link" href="#" data-page-path="' + escapeHtml(p.pagePath || '') + '"' + titleAttr + '>' + pathEsc + badgeHtml + '</a>'
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
      updateDebugOutput(d);
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
      filterDynamic = 'all';
      const filterEl = document.getElementById('filterDynamic');
      if (filterEl) filterEl.value = 'all';
      render(currentData);
    }
    document.getElementById('prevBtn').onclick = () => { if (currentPage > 1) { currentPage--; render(currentData); } };
    document.getElementById('nextBtn').onclick = () => { const totalPages = Math.ceil((currentData.topPages || []).length / (currentData.pageSize || 20)); if (currentPage < totalPages) { currentPage++; render(currentData); } };
    render(currentData);
    window.addEventListener('message', e => {
      if (e.data && e.data.type === 'data') {
        lastDataReceiveSource = 'postMessage';
        lastDataReceiveTime = new Date().toLocaleTimeString();
        updateData(e.data.data);
      }
    });
    var refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function() {
        try {
          appendDebug('[' + new Date().toLocaleTimeString() + '] Refresh clicked, sending postMessage');
          vscode.postMessage({ type: 'refresh' });
        } catch (e) {
          appendDebug('Refresh click error: ' + (e && e.message ? e.message : String(e)));
        }
      });
    } else {
      appendDebug('ERROR: refreshBtn element not found');
    }
    document.getElementById('openSettingsLink')?.addEventListener('click', e => { e.preventDefault(); vscode.postMessage({ type: 'openSettings' }); });
    document.getElementById('openSettingsBannerLink')?.addEventListener('click', e => { e.preventDefault(); vscode.postMessage({ type: 'openSettings' }); });
    } catch (scriptErr) {
      const errMsg = (scriptErr && scriptErr.message) ? scriptErr.message : String(scriptErr);
      const emptyEl = document.getElementById('emptyState');
      const msg = (typeof l10n !== 'undefined' && l10n && l10n.loadError) ? l10n.loadError : 'Dashboard failed to load';
      if (emptyEl) { emptyEl.innerHTML = msg + ': ' + errMsg + '. Click Refresh to retry.'; emptyEl.style.display = 'block'; }
      const debugEl = document.getElementById('debugOutput');
      if (debugEl) debugEl.value = 'Script error (before render): ' + errMsg;
      try { if (typeof vscode !== 'undefined') vscode.postMessage({ type: 'scriptError', error: errMsg }); } catch (_) {}
    }
  `;

const SIDEBAR_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="<%= it.lang %>">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-<%= it.nonce %>'; style-src 'unsafe-inline' <%= it.cspSource %>;">
  <title><%= it.pageTitle %></title>
  <style>
    body { font-family: var(--vscode-font-family); padding: 0.75rem; color: var(--vscode-foreground); margin: 0; }
    .dashboard-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
    .dashboard-header svg { flex-shrink: 0; }
    h1 { font-size: 1.1rem; margin: 0; font-weight: 600; }
    .meta { margin-bottom: 0.5rem; font-size: 0.85em; }
    .btn-refresh { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.6rem; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; font-size: inherit; }
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
    .toolbar-row .btn-refresh { margin: 0; }
    .filter-row { display: flex; align-items: center; gap: 0.5rem; margin: 0; }
    .filter-row select { font-size: inherit; padding: 0.35rem 0.5rem; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 2px; box-sizing: border-box; height: 2rem; }
    .debug-section { margin-top: 1rem; font-size: 0.75em; }
    .debug-section summary { cursor: pointer; color: var(--vscode-descriptionForeground); }
    #debugOutput { width: 100%; min-height: 120px; font-family: var(--vscode-editor-font-family, monospace); font-size: 0.85em; background: var(--vscode-textBlockQuote-background); border: 1px solid var(--vscode-widget-border); border-radius: 2px; padding: 0.5rem; margin-top: 0.25rem; box-sizing: border-box; white-space: pre-wrap; overflow: auto; }
  </style>
</head>
<body>
  <div class="dashboard-header">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="22" height="22"><path fill="currentColor" d="M4 20v-4h4v4H4zm6 0v-8h4v8h-4zm6 0V8h4v12h-4zm6 0V4h4v16h-4z"/></svg>
    <h1><%= it.pageTitle %></h1>
  </div>
  <div id="notConfiguredBanner" class="message-box message-warning" style="display:none;"><%= it.notConfiguredBanner %> <a href="#" id="openSettingsBannerLink"><%= it.openSettings %></a></div>
  <div class="meta">
    <span><strong><%= it.propertyIdLabel %></strong> <span id="propertyId"><%= it.propertyId %></span></span>
    <span><strong><%= it.pagesInCacheLabel %></strong> <span id="cacheSize"><%= it.cacheSize %></span></span>
  </div>
  <div class="toolbar-row">
    <button type="button" class="btn-refresh" id="refreshBtn"><%- it.refreshSvg %> <%= it.refreshData %></button>
    <div class="filter-row">
      <select id="filterDynamic" aria-label="<%= it.filterDynamicLabel %>">
        <option value="all"><%= it.filterAll %></option>
        <option value="static"><%= it.filterStatic %></option>
        <option value="dynamic"><%= it.filterDynamicOnly %></option>
      </select>
    </div>
  </div>
  <div id="tableWrap">
    <table>
      <thead><tr>
        <th data-sort="pagePath"><%= it.pageLabel %> <span class="sort-icon"><%- it.sortSvg %></span></th>
        <th data-sort="bounceRate"><%= it.bounceLabel %> <span class="sort-icon"><%- it.sortSvg %></span></th>
      </tr></thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>
  <div id="paginationWrap" class="pagination" style="display:none;">
    <button type="button" class="btn-page" id="prevBtn"><%= it.previous %></button>
    <span class="page-info" id="pageInfo"></span>
    <button type="button" class="btn-page" id="nextBtn"><%= it.next %></button>
  </div>
  <div id="emptyState" class="empty-state" style="display:none;"><%= it.emptyStateMessage %> <a href="#" id="openSettingsLink"><%= it.openSettings %></a></div>
  <script type="application/json" id="dataPayload">__DATA_PAYLOAD__</script>
  <div class="legend" id="legend"><span class="bounce-good"><span class="bounce-dot"></span> <%= it.legendGood %></span><span class="bounce-warning"><span class="bounce-dot"></span> <%= it.legendWarning %></span><span class="bounce-high"><span class="bounce-dot"></span> <%= it.legendHigh %></span><span class="bounce-critical"><span class="bounce-dot"></span> <%= it.legendCritical %></span></div>
  <details class="debug-section"><summary>Debug: data summary</summary><textarea id="debugOutput" readonly></textarea></details>
  <script nonce="<%= it.nonce %>">
__SCRIPT_CONTENT__
  </script>
</body>
</html>`;

/** Full dashboard inline script body (placeholders: __SCRIPT_L10N_JSON__, __BOUNCE_CRITICAL__). */
const FULL_SCRIPT_BODY = `
    try {
    const vscode = acquireVsCodeApi();
    function appendDebug(msg) { try { var el = document.getElementById('debugOutput'); if (el) el.value = (el.value ? el.value + '\\n' : '') + msg; } catch (_) {} }
    appendDebug('Script started ' + new Date().toLocaleTimeString());
    const l10n = __SCRIPT_L10N_JSON__;
    let data;
    try {
      const payloadEl = document.getElementById('dataPayload');
      const raw = payloadEl ? payloadEl.textContent : '';
      data = raw ? JSON.parse(raw) : { configured: true, propertyId: '', cacheSize: 0, lastFetch: 0, lookbackDays: 30, pageSize: 20, topPages: [] };
    } catch (e) { data = { configured: true, propertyId: '', cacheSize: 0, lastFetch: 0, lookbackDays: 30, pageSize: 20, topPages: [] }; }
    if (!data || !Array.isArray(data.topPages)) data = Object.assign({ configured: true, propertyId: '', cacheSize: 0, lastFetch: 0, lookbackDays: 30, pageSize: 20, topPages: [] }, data || {}, { topPages: Array.isArray((data || {}).topPages) ? (data || {}).topPages : [] });
    const emptyStateDefaultHtml = document.getElementById('emptyState').innerHTML;

    function updateDebugOutput(d) {
      try {
        const el = document.getElementById('debugOutput');
        if (!el) { return; }
        const list = Array.isArray(d && d.topPages) ? d.topPages : [];
        const filterVal = typeof filterDynamic !== 'undefined' ? filterDynamic : 'all';
        let filtered = list;
        if (filterVal === 'static') filtered = list.filter(function(p) { return !p.isDynamicRoute; });
        else if (filterVal === 'dynamic') filtered = list.filter(function(p) { return !!p.isDynamicRoute; });
        const pageSize = Math.max(1, (d && d.pageSize) || 20);
        const curPage = typeof currentPage !== 'undefined' ? currentPage : 1;
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        const start = (curPage - 1) * pageSize;
        const pageRows = filtered.slice(start, start + pageSize);
        const dataSource = typeof lastDataReceiveSource !== 'undefined' ? lastDataReceiveSource : 'embedded';
        const dataSourceTime = typeof lastDataReceiveTime !== 'undefined' && lastDataReceiveTime ? ' at ' + lastDataReceiveTime : ' (initial load)';
        let lines = [
          'Data received: ' + dataSource + dataSourceTime,
          'cacheSize: ' + (d && d.cacheSize != null ? d.cacheSize : 0),
          'topPages.length: ' + list.length,
          'pageSize: ' + pageSize,
          'currentPage: ' + curPage,
          'filter: ' + filterVal + ' -> filtered count: ' + filtered.length,
          'totalPages: ' + totalPages,
          'rows on this page: ' + pageRows.length,
          '',
          'First 10 (pagePath | bounce%):'
        ];
        pageRows.slice(0, 10).forEach(function(p, i) {
          const rate = (p && typeof p.bounceRate === 'number') ? (p.bounceRate * 100).toFixed(1) : '-';
          lines.push((i + 1) + '. ' + (p && p.pagePath != null ? String(p.pagePath) : '') + ' | ' + rate + '%');
        });
        el.value = lines.join('\\n');
      } catch (e) {
        const el = document.getElementById('debugOutput');
        if (el) el.value = 'updateDebugOutput error: ' + (e && e.message ? e.message : String(e));
      }
    }

    function bounceClass(rate) {
      if (rate < 0.25) return 'bounce-good';
      if (rate < 0.45) return 'bounce-warning';
      if (rate < __BOUNCE_CRITICAL__) return 'bounce-high';
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
    let lastDataReceiveSource = 'embedded';
    let lastDataReceiveTime = '';
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
      updateDebugOutput(d);
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
        emptyEl.innerHTML = emptyStateDefaultHtml;
        emptyEl.style.display = 'block';
        tbody.innerHTML = '';
        updateSortIndicator();
        return;
      }
      const pageSize = Math.max(1, d.pageSize || 20);
      let list = Array.isArray(d.topPages) ? d.topPages : [];
      if (filterDynamic === 'static') list = list.filter(function(p) { return !p.isDynamicRoute; });
      else if (filterDynamic === 'dynamic') list = list.filter(function(p) { return !!p.isDynamicRoute; });
      if (list.length === 0) {
        tableWrap.style.display = 'none';
        if (paginationWrap) paginationWrap.style.display = 'none';
        emptyEl.innerHTML = (l10n.filterEmpty || 'No pages match the current filter. Try "All".');
        emptyEl.style.display = 'block';
        tbody.innerHTML = '';
        updateSortIndicator();
        return;
      }
      tableWrap.style.display = 'block';
      emptyEl.style.display = 'none';
      const sorted = sortData(list);
      const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
      if (currentPage < 1) currentPage = 1;
      if (currentPage > totalPages) currentPage = totalPages;
      const start = (currentPage - 1) * pageSize;
      const pageRows = sorted.slice(start, start + pageSize);
      const safeNum = (v) => (typeof v === 'number' && !Number.isNaN(v)) ? v : 0;
      tbody.innerHTML = pageRows.map(p => {
        const pathEsc = escapeHtml(p && p.pagePath != null ? String(p.pagePath) : '');
        const bounceRate = safeNum(p && p.bounceRate);
        const bounceCl = bounceClass(bounceRate);
        const pct = (bounceRate * 100).toFixed(1) + '%';
        const titlePath = (p && p.titleDisplayPath != null && p.titleDisplayPath !== '') ? p.titleDisplayPath : (p && p.resolvedFilePath != null && p.resolvedFilePath !== '') ? p.resolvedFilePath : '';
        const titleAttr = titlePath ? ' title="' + escapeHtml(titlePath) + '"' : '';
        const badgeHtml = (p && p.isDynamicRoute && l10n.dynamicRouteLabel) ? ' <span class="dynamic-route-badge">' + escapeHtml(l10n.dynamicRouteLabel) + '</span>' : '';
        const pageCell = (p && p.hasFile)
          ? '<a class="page-link" href="#" data-page-path="' + escapeHtml(p.pagePath || '') + '"' + titleAttr + '>' + pathEsc + badgeHtml + '</a>'
          : '<span class="page-text"' + titleAttr + '>' + pathEsc + badgeHtml + '</span>';
        const views = safeNum(p && p.views);
        const users = safeNum(p && p.users);
        const avgDur = safeNum(p && p.avgSessionDuration);
        return '<tr><td>' + pageCell + '</td><td>' + views.toLocaleString() + '</td><td>' + users.toLocaleString() + '</td><td class="bounce-cell ' + bounceCl + '"><span class="bounce-dot"></span>' + pct + '</td><td>' + formatDuration(avgDur) + '</td></tr>';
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
      updateDebugOutput(d);
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
      filterDynamic = 'all';
      const filterSelect = document.getElementById('filterDynamic');
      if (filterSelect) filterSelect.value = 'all';
      render(currentData);
    }
    document.getElementById('prevBtn').onclick = () => { if (currentPage > 1) { currentPage--; render(currentData); } };
    document.getElementById('nextBtn').onclick = () => { const totalPages = Math.ceil((currentData.topPages || []).length / (currentData.pageSize || 20)); if (currentPage < totalPages) { currentPage++; render(currentData); } };
    render(currentData);
    window.addEventListener('message', e => {
      if (e.data && e.data.type === 'data') {
        lastDataReceiveSource = 'postMessage';
        lastDataReceiveTime = new Date().toLocaleTimeString();
        updateData(e.data.data);
      }
    });
    var refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function() {
        try {
          appendDebug('[' + new Date().toLocaleTimeString() + '] Refresh clicked, sending postMessage');
          vscode.postMessage({ type: 'refresh' });
        } catch (e) {
          appendDebug('Refresh click error: ' + (e && e.message ? e.message : String(e)));
        }
      });
    } else {
      appendDebug('ERROR: refreshBtn element not found');
    }
    document.getElementById('openSettingsLink')?.addEventListener('click', e => { e.preventDefault(); vscode.postMessage({ type: 'openSettings' }); });
    document.getElementById('openSettingsBannerLink')?.addEventListener('click', e => { e.preventDefault(); vscode.postMessage({ type: 'openSettings' }); });
    } catch (scriptErr) {
      const errMsg = (scriptErr && scriptErr.message) ? scriptErr.message : String(scriptErr);
      const emptyEl = document.getElementById('emptyState');
      const msg = (typeof l10n !== 'undefined' && l10n && l10n.loadError) ? l10n.loadError : 'Dashboard failed to load';
      if (emptyEl) { emptyEl.innerHTML = msg + ': ' + errMsg + '. Click Refresh to retry.'; emptyEl.style.display = 'block'; }
      const debugEl = document.getElementById('debugOutput');
      if (debugEl) debugEl.value = 'Script error (before render): ' + errMsg;
      try { if (typeof vscode !== 'undefined') vscode.postMessage({ type: 'scriptError', error: errMsg }); } catch (_) {}
    }
  `;

const FULL_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="[[= it.lang ]]">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-[[= it.nonce ]]'; style-src 'unsafe-inline' [[= it.cspSource ]];">
  <title>[[= it.pageTitle ]]</title>
  <style>
    body { font-family: var(--vscode-font-family); padding: 1rem; color: var(--vscode-foreground); margin: 0; }
    .dashboard-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
    .dashboard-header svg { flex-shrink: 0; }
    h1 { font-size: 1.2rem; margin: 0; font-weight: 600; }
    .meta { margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0 1rem; }
    .meta span { font-size: 0.9em; }
    .btn-refresh { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.8rem; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; font-size: inherit; }
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
    .toolbar-row .btn-refresh { margin: 0; }
    .filter-row { display: flex; align-items: center; gap: 0.5rem; margin: 0; }
    .filter-row select { font-size: inherit; padding: 0.4rem 0.5rem; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 2px; box-sizing: border-box; height: 2.25rem; }
    .debug-section { margin-top: 1rem; font-size: 0.75em; }
    .debug-section summary { cursor: pointer; color: var(--vscode-descriptionForeground); }
    #debugOutput { width: 100%; min-height: 120px; font-family: var(--vscode-editor-font-family, monospace); font-size: 0.85em; background: var(--vscode-textBlockQuote-background); border: 1px solid var(--vscode-widget-border); border-radius: 2px; padding: 0.5rem; margin-top: 0.25rem; box-sizing: border-box; white-space: pre-wrap; overflow: auto; }
  </style>
</head>
<body>
  <div class="dashboard-header">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="24" height="24"><path fill="currentColor" d="M4 20v-4h4v4H4zm6 0v-8h4v8h-4zm6 0V8h4v12h-4zm6 0V4h4v16h-4z"/></svg>
    <h1>[[= it.pageTitle ]]</h1>
  </div>
  <div id="notConfiguredBanner" class="message-box message-warning" style="display:none;">[[= it.notConfiguredBanner ]] <a href="#" id="openSettingsBannerLink">[[= it.openSettings ]]</a></div>
  <div class="meta">
    <span><strong>[[= it.propertyIdLabel ]]</strong> <span id="propertyId">[[= it.propertyId ]]</span></span>
    <span><strong>[[= it.pagesInCacheLabel ]]</strong> <span id="cacheSize">[[= it.cacheSize ]]</span></span>
    <span><strong>[[= it.lastFetchLabel ]]</strong> <span id="lastFetch">[[= it.lastFetch ]]</span></span>
    <span><strong>[[= it.lookbackLabel ]]</strong> <span id="lookbackDays">[[= it.lookbackDays ]]</span> [[= it.days ]]</span>
  </div>
  <div class="toolbar-row">
    <button type="button" class="btn-refresh" id="refreshBtn">[[- it.refreshSvg ]] [[= it.refreshData ]]</button>
    <div class="filter-row">
      <select id="filterDynamic" aria-label="[[= it.filterDynamicLabel ]]">
        <option value="all">[[= it.filterAll ]]</option>
        <option value="static">[[= it.filterStatic ]]</option>
        <option value="dynamic">[[= it.filterDynamicOnly ]]</option>
      </select>
    </div>
  </div>
  <div id="tableWrap">
    <table>
      <thead><tr>
        <th data-sort="pagePath">[[= it.pageLabel ]] <span class="sort-icon">[[- it.sortSvg ]]</span></th>
        <th data-sort="views">[[= it.viewsLabel ]] <span class="sort-icon">[[- it.sortSvg ]]</span></th>
        <th data-sort="users">[[= it.usersLabel ]] <span class="sort-icon">[[- it.sortSvg ]]</span></th>
        <th data-sort="bounceRate">[[= it.bounceLabel ]] <span class="sort-icon">[[- it.sortSvg ]]</span></th>
        <th data-sort="avgSessionDuration">[[= it.avgDurationLabel ]] <span class="sort-icon">[[- it.sortSvg ]]</span></th>
      </tr></thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>
  <div id="paginationWrap" class="pagination" style="display:none;">
    <button type="button" class="btn-page" id="prevBtn">[[= it.previous ]]</button>
    <span class="page-info" id="pageInfo"></span>
    <button type="button" class="btn-page" id="nextBtn">[[= it.next ]]</button>
  </div>
  <div id="emptyState" class="empty-state" style="display:none;">[[= it.emptyStateMessage ]] <a href="#" id="openSettingsLink">[[= it.openSettings ]]</a></div>
  <script type="application/json" id="dataPayload">__DATA_PAYLOAD__</script>
  <div class="legend" id="legend"><span class="bounce-good"><span class="bounce-dot"></span> [[= it.legendGood ]]</span><span class="bounce-warning"><span class="bounce-dot"></span> [[= it.legendWarning ]]</span><span class="bounce-high"><span class="bounce-dot"></span> [[= it.legendHigh ]]</span><span class="bounce-critical"><span class="bounce-dot"></span> [[= it.legendCritical ]]</span></div>
  <details class="debug-section"><summary>Debug: data summary</summary><textarea id="debugOutput" readonly></textarea></details>
  <script nonce="[[= it.nonce ]]">
__SCRIPT_CONTENT__
  </script>
</body>
</html>`;

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

/** Count pages with critical bounce rate (≥ BOUNCE_CRITICAL_THRESHOLD). */
export function countCriticalPages(data: DashboardData): number {
  return (data.topPages ?? []).filter((p) => p.bounceRate >= BOUNCE_CRITICAL_THRESHOLD).length;
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
        pageTitle: m.pageTitle,
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

/** Build script l10n subset from DashboardL10n for inline script. */
function getScriptL10n(l10n: DashboardL10n): { notSet: string; filterEmpty: string; pageOf: string; dynamicRouteLabel: string; loadError: string } {
  return {
    notSet: l10n.notSet,
    filterEmpty: l10n.filterEmpty ?? 'No pages match the current filter. Try "All".',
    pageOf: l10n.pageOf,
    dynamicRouteLabel: l10n.dynamicRouteLabel ?? 'dynamic',
    loadError: l10n.loadError ?? 'Dashboard failed to load',
  };
}

/**
 * Build dashboard HTML string. Pure function: no vscode or global state.
 * UI strings come from options.l10n or DEFAULT_DASHBOARD_L10N.
 */
export function buildDashboardHtml(
  data: DashboardData,
  options: BuildDashboardHtmlOptions
): string {
  const l10n = options.l10n ?? DEFAULT_DASHBOARD_L10N;
  const nonce = options.nonce ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
  const lang = options.lang ?? 'en';
  const escapeHtmlAttr = (s: string) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const pageTitle = options.pageTitle ?? l10n.title;
  const payload = { ...data, topPages: Array.isArray(data.topPages) ? data.topPages : [] };
  const dataJson = JSON.stringify(payload);
  /** Escape for embedding in <script type="application/json"> so </script> in payload does not close the tag */
  const dataJsonSafe = dataJson.replace(/<\/script/gi, '\\u003c/script');
  const initialCacheSize = String(data.cacheSize ?? 0);
  const initialLastFetch = data.lastFetch ? new Date(data.lastFetch).toLocaleString() : '-';
  const initialLookbackDays = String(data.lookbackDays ?? 30);
  const scriptL10n = getScriptL10n(options.l10n ?? DEFAULT_DASHBOARD_L10N);
  /** Inline script l10n; escape </script> so it does not close the tag */
  const scriptL10nJson = JSON.stringify(scriptL10n).replace(/<\/script/gi, '\\u003c/script');
  const scriptContent = FULL_SCRIPT_BODY.replace('__SCRIPT_L10N_JSON__', scriptL10nJson).replace(
    '__BOUNCE_CRITICAL__',
    String(BOUNCE_CRITICAL_THRESHOLD)
  );

  const html = etaFull.renderString(FULL_HTML_TEMPLATE, {
    lang: escapeHtmlAttr(lang),
    nonce: escapeHtmlAttr(nonce),
    cspSource: escapeHtmlAttr(options.cspSource),
    pageTitle: pageTitle,
    notConfiguredBanner: l10n.notConfigured,
    openSettings: l10n.openSettings,
    propertyIdLabel: l10n.propertyId,
    propertyId: data.propertyId || l10n.notSet,
    pagesInCacheLabel: l10n.pagesInCache,
    cacheSize: initialCacheSize,
    lastFetchLabel: l10n.lastFetch,
    lastFetch: initialLastFetch,
    lookbackLabel: l10n.lookback,
    lookbackDays: initialLookbackDays,
    days: l10n.days,
    refreshSvg: REFRESH_SVG,
    refreshData: l10n.refreshData,
    filterDynamicLabel: l10n.filterDynamicLabel ?? 'Filter by route type',
    filterAll: l10n.filterAll ?? 'All',
    filterStatic: l10n.filterStatic ?? 'Static only',
    filterDynamicOnly: l10n.filterDynamicOnly ?? 'Dynamic only',
    pageLabel: l10n.page,
    viewsLabel: l10n.views,
    usersLabel: l10n.users,
    bounceLabel: l10n.bounce,
    avgDurationLabel: l10n.avgDuration,
    sortSvg: SORT_SVG,
    previous: l10n.previous,
    next: l10n.next,
    emptyStateMessage: l10n.emptyState,
    legendGood: l10n.legendGood,
    legendWarning: l10n.legendWarning,
    legendHigh: l10n.legendHigh,
    legendCritical: l10n.legendCritical,
  });
  return html.replace('__DATA_PAYLOAD__', dataJsonSafe).replace('__SCRIPT_CONTENT__', scriptContent);
}

/**
 * Build sidebar dashboard HTML (path + bounce only). Same data and message protocol as full dashboard.
 * Uses ETA template; UI strings come from options.l10n or DEFAULT_DASHBOARD_L10N.
 */
export function buildSidebarDashboardHtml(
  data: DashboardData,
  options: BuildDashboardHtmlOptions
): string {
  const l10n = options.l10n ?? DEFAULT_DASHBOARD_L10N;
  const nonce = options.nonce ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
  const lang = options.lang ?? 'en';
  const escapeHtmlAttr = (s: string) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const payload = { ...data, topPages: Array.isArray(data.topPages) ? data.topPages : [] };
  const dataJsonSafe = JSON.stringify(payload).replace(/<\/script/gi, '\\u003c/script');
  const scriptL10n = getScriptL10n(l10n);
  const scriptL10nJson = JSON.stringify(scriptL10n).replace(/<\/script/gi, '\\u003c/script');
  const scriptContent = SIDEBAR_SCRIPT_BODY.replace('__SCRIPT_L10N_JSON__', scriptL10nJson).replace(
    '__BOUNCE_CRITICAL__',
    String(BOUNCE_CRITICAL_THRESHOLD)
  );

  const html = eta.renderString(SIDEBAR_HTML_TEMPLATE, {
    lang: escapeHtmlAttr(lang),
    nonce: escapeHtmlAttr(nonce),
    cspSource: escapeHtmlAttr(options.cspSource),
    propertyId: escapeHtmlAttr(data.propertyId || l10n.notSet),
    cacheSize: escapeHtmlAttr(String(data.cacheSize ?? 0)),
    refreshSvg: REFRESH_SVG,
    sortSvg: SORT_SVG,
    pageTitle: l10n.title,
    propertyIdLabel: l10n.propertyId,
    pagesInCacheLabel: l10n.pagesInCache,
    refreshData: l10n.refreshData,
    filterAll: l10n.filterAll ?? 'All',
    filterStatic: l10n.filterStatic ?? 'Static only',
    filterDynamicOnly: l10n.filterDynamicOnly ?? 'Dynamic only',
    filterDynamicLabel: l10n.filterDynamicLabel ?? 'Filter by route type',
    pageLabel: l10n.page,
    bounceLabel: l10n.bounce,
    previous: l10n.previous,
    next: l10n.next,
    emptyStateMessage: l10n.emptyState,
    openSettings: l10n.openSettings,
    notConfiguredBanner: l10n.notConfigured,
    legendGood: l10n.legendGood,
    legendWarning: l10n.legendWarning,
    legendHigh: l10n.legendHigh,
    legendCritical: l10n.legendCritical,
  });
  return html.replace('__DATA_PAYLOAD__', dataJsonSafe).replace('__SCRIPT_CONTENT__', scriptContent);
}
