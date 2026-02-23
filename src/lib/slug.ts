import * as path from 'path';

/**
 * Derives GA4 pagePath slug from file path.
 * .md/.mdx: relative to contentRoot (e.g. src/content)
 * .astro: relative to pagesRoot (e.g. src/pages)
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
