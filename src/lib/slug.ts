import * as path from 'path';

/** True if the path is an Astro dynamic route (file or dir name contains [ and ]). */
export function isDynamicRouteFilePath(
  filePath: string,
  workspaceRoot: string,
  pagesRoot: string
): boolean {
  const absPages = path.join(workspaceRoot, pagesRoot);
  if (!filePath.startsWith(absPages) || !filePath.endsWith('.astro')) return false;
  const rel = path.relative(absPages, filePath).split(path.sep).join('/');
  return /\[[^\]]*\]/.test(rel);
}

/**
 * Match spec for a dynamic route file: segment count and whether it's a catch-all.
 * Used to filter GA4 page paths that are served by this route.
 */
export interface DynamicRouteMatchSpec {
  segmentCount: number;
  catchAll: boolean;
}

/**
 * Returns the dynamic route match spec for a file under pagesRoot, or null if not a dynamic route.
 * Examples: [slug].astro → { segmentCount: 1, catchAll: false }; [...slug].astro → { segmentCount: 1, catchAll: true }; [slug]/[id].astro → { segmentCount: 2, catchAll: false }.
 */
export function getDynamicRouteMatchSpec(
  filePath: string,
  workspaceRoot: string,
  pagesRoot: string
): DynamicRouteMatchSpec | null {
  const absPages = path.join(workspaceRoot, pagesRoot);
  if (!filePath.startsWith(absPages) || !filePath.endsWith('.astro')) return null;
  const rel = path.relative(absPages, filePath).split(path.sep).join('/');
  if (!/\[[^\]]*\]/.test(rel)) return null;

  const parts = rel.replace(/\.astro$/, '').split('/').filter(Boolean);
  const catchAll = parts.some(p => p.startsWith('[...'));
  const segmentCount = parts.length;
  return { segmentCount: Math.max(1, segmentCount), catchAll };
}

/**
 * Returns true if a normalized GA4 pagePath (with trailing slash) matches the dynamic route spec.
 */
export function pagePathMatchesDynamicRoute(
  pagePath: string,
  segmentCount: number,
  catchAll: boolean
): boolean {
  const normalized = pagePath.trim().replace(/\/$/, '') || '';
  const segments = normalized ? normalized.split('/').filter(Boolean) : [];
  if (catchAll) return segments.length >= 1;
  return segments.length === segmentCount;
}

/**
 * Derives GA4 pagePath slug from file path.
 * .md/.mdx: relative to contentRoot (e.g. src/content)
 * .astro: relative to pagesRoot (e.g. src/pages)
 * Returns null for dynamic route files ([slug].astro etc.) since they have no single path.
 */
export function filePathToSlug(
  filePath: string,
  workspaceRoot: string,
  contentRoot: string,
  pagesRoot: string
): string | null {
  const isAstro = filePath.endsWith('.astro');
  const isContent = /\.(md|mdx)$/.test(filePath);

  let absRoot: string;
  let rel: string;

  if (isAstro) {
    absRoot = path.join(workspaceRoot, pagesRoot);
    if (!filePath.startsWith(absRoot)) return null;
    if (isDynamicRouteFilePath(filePath, workspaceRoot, pagesRoot)) return null;
    rel = filePath.slice(absRoot.length).replace(/\.astro$/, '');
  } else if (isContent) {
    absRoot = path.join(workspaceRoot, contentRoot);
    if (!filePath.startsWith(absRoot)) return null;
    rel = filePath.slice(absRoot.length).replace(/\.(md|mdx)$/, '');
  } else {
    return null;
  }

  rel = rel.replace(/\/index$/, '/');
  if (!rel.startsWith('/')) rel = '/' + rel;
  if (!rel.endsWith('/')) rel = rel + '/';

  return rel;
}

/**
 * Returns candidate absolute file paths for a GA4 pagePath (slug).
 * Order: content index.md/mdx first, then pages index.astro, then flat .md/.mdx/.astro.
 * Caller should open the first path that exists.
 */
export function slugToFilePaths(
  workspaceRoot: string,
  contentRoot: string,
  pagesRoot: string,
  pagePath: string
): string[] {
  const normalized = pagePath.trim().replace(/\/$/, '') || '';
  const segments = normalized ? normalized.split('/').filter(Boolean) : [];
  const relDir = segments.length > 0 ? segments.join(path.sep) : '';
  const contentBase = path.join(workspaceRoot, contentRoot);
  const pagesBase = path.join(workspaceRoot, pagesRoot);
  const candidates: string[] = [];

  // Content: .../blog/post/index.md, index.mdx; or .../blog/post.md for single segment
  if (relDir) {
    candidates.push(
      path.join(contentBase, relDir, 'index.md'),
      path.join(contentBase, relDir, 'index.mdx')
    );
    if (segments.length === 1) {
      candidates.push(
        path.join(contentBase, segments[0] + '.md'),
        path.join(contentBase, segments[0] + '.mdx')
      );
    }
  } else {
    candidates.push(
      path.join(contentBase, 'index.md'),
      path.join(contentBase, 'index.mdx')
    );
  }

  // Pages: .../blog/post/index.astro or .../blog/post.astro
  if (relDir) {
    candidates.push(path.join(pagesBase, relDir, 'index.astro'));
    if (segments.length === 1) {
      candidates.push(path.join(pagesBase, segments[0] + '.astro'));
    }
  } else {
    candidates.push(path.join(pagesBase, 'index.astro'));
  }

  // Dynamic route candidates (after static so static files take precedence)
  if (segments.length === 1) {
    candidates.push(path.join(pagesBase, '[slug].astro'));
    candidates.push(path.join(pagesBase, '[id].astro'));
  }
  if (segments.length === 2) {
    candidates.push(path.join(pagesBase, '[slug]', '[id].astro'));
    candidates.push(path.join(pagesBase, '[id]', '[slug].astro'));
  }
  if (segments.length >= 1) {
    candidates.push(path.join(pagesBase, '[...slug].astro'));
  }

  return candidates;
}

/**
 * Normalize GA4 pagePath to slug format (trailing slash) for cache lookup.
 */
export function normalizePagePath(pagePath: string): string {
  const p = pagePath.trim();
  if (!p.endsWith('/')) return p + '/';
  return p;
}
