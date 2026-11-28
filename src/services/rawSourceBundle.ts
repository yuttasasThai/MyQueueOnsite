// Separate glob container so Vite includes src/services/sourcePackager.ts in the bundle
// (Vite intentionally excludes the calling module itself from import.meta.glob).
export const rawCodeModules = import.meta.glob(
  [
    '/src/**/*.ts',
    '/src/**/*.tsx',
    '/src/**/*.css',
    '/api/**/*.ts',
    '/public/alarm-sw.js',
    '/public/icon.svg',
    '/index.html',
    '/package.json',
    '/tsconfig.json',
    '/vite.config.ts',
    '/server.ts',
    '/vercel.json',
    '/metadata.json',
    '/firebase-applet-config.json',
    '/firebase-blueprint.json',
    '/firestore.rules',
    '/.env.example',
    '/.gitignore',
    '/.npmrc',
  ],
  { query: '?raw', import: 'default', eager: true }
) as Record<string, string>;

export const mediaAssetUrls = import.meta.glob(['/src/assets/**/*'], {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;
