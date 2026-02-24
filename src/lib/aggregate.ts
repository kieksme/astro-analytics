/**
 * Aggregates GA4 metrics for Astro dynamic route files ([slug].astro etc.).
 */

import {
  getDynamicRouteMatchSpec,
  pagePathMatchesDynamicRoute,
  normalizePagePath,
} from './slug';

export interface PageMetrics {
  pagePath: string;
  /** Page title from GA4 (optional; not set for aggregated dynamic routes). */
  pageTitle?: string;
  views: number;
  users: number;
  bounceRate: number;
  avgSessionDuration: number;
}

/**
 * Returns aggregated metrics for all GA4 page paths that match the given dynamic route file,
 * or null if the file is not a dynamic route or no matching cache entries exist.
 * Bounce rate and avgSessionDuration are views-weighted.
 */
export function getAggregatedMetricsForDynamicRoute(
  filePath: string,
  workspaceRoot: string,
  pagesRoot: string,
  metricsCache: Map<string, PageMetrics>
): PageMetrics | null {
  const spec = getDynamicRouteMatchSpec(filePath, workspaceRoot, pagesRoot);
  if (!spec) return null;

  const matching: PageMetrics[] = [];
  for (const [pathKey, m] of metricsCache.entries()) {
    const normalized = normalizePagePath(pathKey);
    if (pagePathMatchesDynamicRoute(normalized, spec.segmentCount, spec.catchAll)) {
      matching.push(m);
    }
  }
  if (matching.length === 0) return null;

  const totalViews = matching.reduce((s, m) => s + m.views, 0);
  const totalUsers = matching.reduce((s, m) => s + m.users, 0);
  if (totalViews === 0) {
    return {
      pagePath: '',
      views: totalViews,
      users: totalUsers,
      bounceRate: 0,
      avgSessionDuration: 0,
    };
  }
  const weightedBounce = matching.reduce((s, m) => s + m.bounceRate * m.views, 0) / totalViews;
  const weightedDuration = matching.reduce((s, m) => s + m.avgSessionDuration * m.views, 0) / totalViews;
  return {
    pagePath: '',
    views: totalViews,
    users: totalUsers,
    bounceRate: weightedBounce,
    avgSessionDuration: weightedDuration,
  };
}
