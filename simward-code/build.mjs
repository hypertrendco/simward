import * as esbuild from 'esbuild';
import fs from 'node:fs';

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Figtree:wght@400..700&family=JetBrains+Mono:wght@400;600&display=swap">';
const common = { entryPoints: ['src/main.jsx'], bundle: true, minify: true, format: 'iife', target: ['es2020'], jsx: 'automatic', jsxImportSource: 'preact', legalComments: 'none', logLevel: 'info' };
const css = fs.readFileSync('src/styles.css', 'utf8');

// 1) Railway web app
fs.mkdirSync('public', { recursive: true });
await esbuild.build({ ...common, outfile: 'public/app.js' });
fs.writeFileSync('public/styles.css', css);
fs.writeFileSync('public/index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>SimWard</title><meta name="description" content="AI-driven 3D virtual clinical simulation for nursing education">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230b7a70'/%3E%3Cpath d='M5 17h5l2.2-5 3.6 10 2.6-7H27' fill='none' stroke='white' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
${FONTS}<link rel="stylesheet" href="/styles.css"></head><body><div id="app"></div><script src="/app.js" defer></script></body></html>`);

// 2) claude.ai artifact (self-contained, in-browser demo backend, AI via the viewer's Claude)
if (process.env.SKIP_ARTIFACT !== '1') {
  const r = await esbuild.build({ ...common, write: false });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/simward.html', `<title>SimWard</title>\n${FONTS}\n<style>${css}</style>\n<div id="app"></div>\n<script>window.__SIMWARD_MODE__='local';window.__SIMWARD_AVATAR_B64__=true;</script>\n<script>${js}</script>\n`);
  console.log('artifact bytes', fs.statSync('dist/simward.html').size);
  fs.mkdirSync('dist/avatars', { recursive: true });
  for (const f of fs.readdirSync('public/avatars')) {
    if (f.endsWith('.glb')) fs.writeFileSync(`dist/avatars/${f}.txt`, fs.readFileSync(`public/avatars/${f}`).toString('base64'));
    else fs.copyFileSync(`public/avatars/${f}`, `dist/avatars/${f}`);
  }
}
