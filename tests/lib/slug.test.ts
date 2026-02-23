import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { filePathToSlug, slugToFilePaths, normalizePagePath } from '../../src/lib/slug';

const workspace = path.join('/fake', 'workspace');
const contentRoot = 'src/content';
const pagesRoot = 'src/pages';

describe('filePathToSlug', () => {
  describe('content files (.md, .mdx)', () => {
    it('maps content .md to slug with trailing slash', () => {
      const filePath = path.join(workspace, contentRoot, 'blog', 'my-post.md');
      expect(filePathToSlug(filePath, workspace, contentRoot, pagesRoot)).toBe('/blog/my-post/');
    });

    it('maps content .mdx to slug with trailing slash', () => {
      const filePath = path.join(workspace, contentRoot, 'blog', 'my-post.mdx');
      expect(filePathToSlug(filePath, workspace, contentRoot, pagesRoot)).toBe('/blog/my-post/');
    });

    it('maps index.md to directory slug', () => {
      const filePath = path.join(workspace, contentRoot, 'karriere', 'index.md');
      expect(filePathToSlug(filePath, workspace, contentRoot, pagesRoot)).toBe('/karriere/');
    });

    it('returns null when file is outside content root', () => {
      const filePath = path.join(workspace, 'other', 'blog', 'post.md');
      expect(filePathToSlug(filePath, workspace, contentRoot, pagesRoot)).toBeNull();
    });

    it('returns null for non-content extension', () => {
      const filePath = path.join(workspace, contentRoot, 'blog', 'post.txt');
      expect(filePathToSlug(filePath, workspace, contentRoot, pagesRoot)).toBeNull();
    });
  });

  describe('Astro pages (.astro)', () => {
    it('maps .astro file to slug with trailing slash', () => {
      const filePath = path.join(workspace, pagesRoot, 'blog', 'my-post.astro');
      expect(filePathToSlug(filePath, workspace, contentRoot, pagesRoot)).toBe('/blog/my-post/');
    });

    it('maps index.astro to root or parent slug', () => {
      const filePath = path.join(workspace, pagesRoot, 'index.astro');
      expect(filePathToSlug(filePath, workspace, contentRoot, pagesRoot)).toBe('/');
    });

    it('maps nested index.astro', () => {
      const filePath = path.join(workspace, pagesRoot, 'blog', 'index.astro');
      expect(filePathToSlug(filePath, workspace, contentRoot, pagesRoot)).toBe('/blog/');
    });

    it('returns null when .astro is outside pages root', () => {
      const filePath = path.join(workspace, contentRoot, 'page.astro');
      expect(filePathToSlug(filePath, workspace, contentRoot, pagesRoot)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles content root file at top level', () => {
      const filePath = path.join(workspace, contentRoot, 'about.md');
      expect(filePathToSlug(filePath, workspace, contentRoot, pagesRoot)).toBe('/about/');
    });

    it('handles pages root file at top level', () => {
      const filePath = path.join(workspace, pagesRoot, 'about.astro');
      expect(filePathToSlug(filePath, workspace, contentRoot, pagesRoot)).toBe('/about/');
    });
  });
});

describe('slugToFilePaths', () => {
  it('returns content index + pages index for root path "/"', () => {
    const result = slugToFilePaths(workspace, contentRoot, pagesRoot, '/');
    expect(result).toContain(path.join(workspace, contentRoot, 'index.md'));
    expect(result).toContain(path.join(workspace, contentRoot, 'index.mdx'));
    expect(result).toContain(path.join(workspace, pagesRoot, 'index.astro'));
    expect(result.length).toBe(3);
  });

  it('returns content index + pages index for path with trailing slash normalized', () => {
    const result = slugToFilePaths(workspace, contentRoot, pagesRoot, '/');
    expect(result[0]).toBe(path.join(workspace, contentRoot, 'index.md'));
    expect(result[result.length - 1]).toBe(path.join(workspace, pagesRoot, 'index.astro'));
  });

  it('returns candidates for single-segment path "/blog/"', () => {
    const result = slugToFilePaths(workspace, contentRoot, pagesRoot, '/blog/');
    expect(result).toContain(path.join(workspace, contentRoot, 'blog', 'index.md'));
    expect(result).toContain(path.join(workspace, contentRoot, 'blog', 'index.mdx'));
    expect(result).toContain(path.join(workspace, contentRoot, 'blog.md'));
    expect(result).toContain(path.join(workspace, contentRoot, 'blog.mdx'));
    expect(result).toContain(path.join(workspace, pagesRoot, 'blog', 'index.astro'));
    expect(result).toContain(path.join(workspace, pagesRoot, 'blog.astro'));
  });

  it('returns candidates for multi-segment path "/blog/my-post/"', () => {
    const result = slugToFilePaths(workspace, contentRoot, pagesRoot, '/blog/my-post/');
    expect(result).toContain(path.join(workspace, contentRoot, 'blog', 'my-post', 'index.md'));
    expect(result).toContain(path.join(workspace, contentRoot, 'blog', 'my-post', 'index.mdx'));
    expect(result).toContain(path.join(workspace, pagesRoot, 'blog', 'my-post', 'index.astro'));
    expect(result).not.toContain(path.join(workspace, contentRoot, 'blog.my-post.md'));
  });

  it('strips trailing slash from input path', () => {
    const withSlash = slugToFilePaths(workspace, contentRoot, pagesRoot, '/blog/');
    const withoutSlash = slugToFilePaths(workspace, contentRoot, pagesRoot, '/blog');
    expect(withSlash).toEqual(withoutSlash);
  });

  it('trims whitespace from input path', () => {
    const result = slugToFilePaths(workspace, contentRoot, pagesRoot, '  /blog/  ');
    expect(result).toContain(path.join(workspace, contentRoot, 'blog', 'index.md'));
  });

  it('treats empty path as root', () => {
    const result = slugToFilePaths(workspace, contentRoot, pagesRoot, '');
    expect(result).toContain(path.join(workspace, contentRoot, 'index.md'));
    expect(result).toContain(path.join(workspace, pagesRoot, 'index.astro'));
  });
});

describe('normalizePagePath', () => {
  it('adds trailing slash when missing', () => {
    expect(normalizePagePath('/blog')).toBe('/blog/');
  });

  it('keeps trailing slash when present', () => {
    expect(normalizePagePath('/blog/')).toBe('/blog/');
    expect(normalizePagePath('/')).toBe('/');
  });

  it('trims whitespace', () => {
    expect(normalizePagePath('  /blog/  ')).toBe('/blog/');
    expect(normalizePagePath(' /blog ')).toBe('/blog/');
  });
});
