import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

type HeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
};

function globMatch(pattern: string, pathname: string): boolean {
  if (pattern === '**') return true;
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3);
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }
  return pathname === pattern;
}

function cacheControlFor(pathname: string, rules: HeaderRule[]): string | undefined {
  let value: string | undefined;
  for (const rule of rules) {
    if (!globMatch(rule.source, pathname)) continue;
    for (const header of rule.headers) {
      if (header.key === 'Cache-Control') value = header.value;
    }
  }
  return value;
}

describe('app-shell service worker', () => {
  const viteConfig = read('vite.config.js');
  const firebase = JSON.parse(read('firebase.json')) as {
    hosting: { headers: HeaderRule[]; rewrites: Array<{ source: string; destination: string }> };
  };

  test('registers outside the React bundle and takes over on the next open', () => {
    expect(viteConfig).toContain("injectRegister: 'inline'");
    expect(viteConfig).toContain('skipWaiting: true');
    expect(viteConfig).toContain('clientsClaim: true');
    expect(viteConfig).toContain('enabled: false');
    const src = fs.readdirSync(path.join(root, 'src'), { recursive: true, encoding: 'utf8' }) as string[];
    const imported = src
      .filter((name) => /\.(js|jsx|ts|tsx)$/.test(name) && !name.endsWith('.test.ts'))
      .map((name) => read(path.join('src', name)))
      .some((code) => /from ['"]virtual:pwa-register/.test(code));
    expect(imported).toBe(false);
  });

  test('does not precache HTML or money-data responses', () => {
    expect(viteConfig).toContain("globPatterns: ['**/*.{js,css,ico,webmanifest}']");
    expect(viteConfig).toContain('navigateFallback: null');
    expect(viteConfig).toContain("handler: 'NetworkFirst'");
    expect(viteConfig).toContain("handler: 'NetworkOnly'");
    expect(viteConfig).toContain('firestore.googleapis.com');
    expect(viteConfig).toContain('cloudfunctions.net');
    expect(viteConfig).toContain('firebasestorage.googleapis.com');
    expect(viteConfig).toContain("pathName.startsWith('/clear-sw')");
  });

  test('Hosting will not pin sw.js or index.html for an hour', () => {
    const rules = firebase.hosting.headers;
    expect(cacheControlFor('/sw.js', rules)).toBe('no-cache');
    expect(cacheControlFor('/index.html', rules)).toBe('no-cache');
    expect(cacheControlFor('/manifest.webmanifest', rules)).toBe('no-cache');
    expect(cacheControlFor('/clear-sw.html', rules)).toBe('no-cache');
    expect(cacheControlFor('/assets/index-abc123.js', rules)).toBe(
      'public, max-age=31536000, immutable'
    );
  });

  test('clear-sw is a real file, not the SPA shell', () => {
    const html = read('public/clear-sw.html');
    expect(html).toContain('serviceWorker.getRegistrations');
    expect(html).toContain('caches.delete');
    expect(html).toContain('location.replace');
    const rewrite = firebase.hosting.rewrites.find((row) => row.source === '/clear-sw');
    expect(rewrite?.destination).toBe('/clear-sw.html');
  });

  test('localhost preview of the shell uses staging, not production', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['build:staging']).toContain('--mode staging');
    expect(pkg.scripts['preview:staging']).toContain('--mode staging');
    expect(pkg.scripts['preview:staging']).toContain('--port 3000');
    expect(pkg.scripts['preview:staging']).not.toContain('production');
  });
});
