import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { getAggregatedMetricsForDynamicRoute } from '../../src/lib/aggregate';

const workspace = path.join('/fake', 'workspace');
const pagesRoot = 'src/pages';

describe('getAggregatedMetricsForDynamicRoute', () => {
  it('returns null for non-dynamic route file', () => {
    const filePath = path.join(workspace, pagesRoot, 'about.astro');
    const cache = new Map([['/about/', { pagePath: '/about/', views: 10, users: 5, bounceRate: 0.2, avgSessionDuration: 60 }]]);
    expect(getAggregatedMetricsForDynamicRoute(filePath, workspace, pagesRoot, cache)).toBeNull();
  });

  it('returns aggregated metrics for [slug].astro matching single-segment paths', () => {
    const filePath = path.join(workspace, pagesRoot, '[slug].astro');
    const cache = new Map([
      ['/blog/', { pagePath: '/blog/', views: 100, users: 50, bounceRate: 0.3, avgSessionDuration: 90 }],
      ['/about/', { pagePath: '/about/', views: 50, users: 20, bounceRate: 0.5, avgSessionDuration: 60 }],
    ]);
    const result = getAggregatedMetricsForDynamicRoute(filePath, workspace, pagesRoot, cache);
    expect(result).not.toBeNull();
    expect(result!.views).toBe(150);
    expect(result!.users).toBe(70);
    // Weighted bounce: (0.3*100 + 0.5*50) / 150 = 55/150 ≈ 0.3667
    expect(result!.bounceRate).toBeCloseTo(0.3667, 3);
    // Weighted duration: (90*100 + 60*50) / 150 = 12000/150 = 80
    expect(result!.avgSessionDuration).toBe(80);
  });

  it('returns null when no cache entries match the dynamic route', () => {
    const filePath = path.join(workspace, pagesRoot, '[slug].astro');
    const cache = new Map([['/blog/post/', { pagePath: '/blog/post/', views: 10, users: 5, bounceRate: 0.2, avgSessionDuration: 60 }]]);
    expect(getAggregatedMetricsForDynamicRoute(filePath, workspace, pagesRoot, cache)).toBeNull();
  });
});
