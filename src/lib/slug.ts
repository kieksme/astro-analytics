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
