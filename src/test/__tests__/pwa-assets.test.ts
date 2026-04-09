import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('PWA Assets (SUB-17)', () => {
  const manifestPath = resolve(__dirname, '../../../public/manifest.json');
  const swPath = resolve(__dirname, '../../../public/service-worker.js');
  const indexPath = resolve(__dirname, '../../../index.html');

  describe('manifest.json', () => {
    it('exists', () => {
      expect(existsSync(manifestPath)).toBe(true);
    });

    it('is valid JSON', () => {
      const raw = readFileSync(manifestPath, 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    it('has required fields', () => {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      expect(manifest.name).toBeDefined();
      expect(manifest.short_name).toBeDefined();
      expect(manifest.start_url).toBe('/');
      expect(manifest.display).toBe('standalone');
      expect(manifest.theme_color).toBeDefined();
      expect(manifest.background_color).toBeDefined();
    });

    it('has icons array with at least 8 entries', () => {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(8);
    });

    it('has maskable icon for Android adaptive icons', () => {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      const maskable = manifest.icons.find((i: any) => i.purpose === 'maskable');
      expect(maskable).toBeDefined();
    });
  });

  describe('service-worker.js', () => {
    it('exists', () => {
      expect(existsSync(swPath)).toBe(true);
    });

    it('has install event listener', () => {
      const sw = readFileSync(swPath, 'utf-8');
      expect(sw).toContain("'install'");
    });

    it('has activate event listener', () => {
      const sw = readFileSync(swPath, 'utf-8');
      expect(sw).toContain("'activate'");
    });

    it('has fetch event listener', () => {
      const sw = readFileSync(swPath, 'utf-8');
      expect(sw).toContain("'fetch'");
    });

    it('implements cache-first strategy', () => {
      const sw = readFileSync(swPath, 'utf-8');
      expect(sw).toContain('cacheFirst');
    });

    it('implements network-first strategy', () => {
      const sw = readFileSync(swPath, 'utf-8');
      expect(sw).toContain('networkFirst');
    });

    it('implements stale-while-revalidate strategy', () => {
      const sw = readFileSync(swPath, 'utf-8');
      expect(sw).toContain('staleWhileRevalidate');
    });
  });

  describe('index.html', () => {
    it('links manifest.json', () => {
      const html = readFileSync(indexPath, 'utf-8');
      expect(html).toContain('rel="manifest"');
      expect(html).toContain('/manifest.json');
    });

    it('has theme-color meta tag', () => {
      const html = readFileSync(indexPath, 'utf-8');
      expect(html).toContain('name="theme-color"');
    });

    it('has apple-mobile-web-app-capable meta tag', () => {
      const html = readFileSync(indexPath, 'utf-8');
      expect(html).toContain('apple-mobile-web-app-capable');
    });

    it('has apple-touch-icon link', () => {
      const html = readFileSync(indexPath, 'utf-8');
      expect(html).toContain('apple-touch-icon');
    });
  });
});
