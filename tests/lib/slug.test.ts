import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { filePathToSlug } from '../../src/lib/slug';

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
});
