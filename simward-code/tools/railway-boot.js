// SimWard Railway bootstrap (no-GitHub deployment path).
// Runs inside a plain node:22 image as the service start command.
// Phase 1 (no bundle yet, or FORCE_UPLOAD=1): serve an authenticated uploader on $PORT
//   PUT  /upload/<index>   body = tarball chunk, header x-upload-key
//   POST /done             finalize -> extract, npm ci, build, start the app
//   GET  anything          200 (keeps the Railway healthcheck green while waiting)
// Phase 2 (bundle on the /data volume): extract, install, build, exec `npm start`.
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const D = process.env.SRC_DIR || '/data', T = path.join(D, 'src.tgz'), PART = T + '.part', APP = '/app/simward';
const PORT = Number(process.env.PORT || 8080), KEY = process.env.UPLOAD_KEY || '';
fs.mkdirSync(D, { recursive: true });

function startApp() {
  console.log('[boot] extracting bundle', T, fs.statSync(T).size, 'bytes');
  fs.rmSync(APP, { recursive: true, force: true }); fs.mkdirSync(APP, { recursive: true });
  cp.execSync(`tar xzf "${T}" -C "${APP}"`, { stdio: 'inherit' });
  console.log('[boot] npm ci'); cp.execSync('npm ci --no-audit --no-fund', { cwd: APP, stdio: 'inherit' });
  console.log('[boot] build'); cp.execSync('npm run build', { cwd: APP, stdio: 'inherit', env: { ...process.env, SKIP_ARTIFACT: '1' } });
  console.log('[boot] starting app');
  const child = cp.spawn('npm', ['start'], { cwd: APP, stdio: 'inherit', env: process.env });
  child.on('exit', code => process.exit(code ?? 1));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

if (fs.existsSync(T) && !process.env.FORCE_UPLOAD) { startApp(); }
else {
  fs.rmSync(PART, { force: true });
  let expected = 0;
  const srv = http.createServer((req, res) => {
    const m = req.url.match(/^\/(upload|done|status)(?:\/(\d+))?/);
    if (req.method === 'GET' && !(m && m[1] === 'status')) { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('simward: awaiting source bundle\n'); }
    if (!KEY || req.headers['x-upload-key'] !== KEY) { res.writeHead(403); return res.end('forbidden'); }
    if (m && m[1] === 'status') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ expected, have: fs.existsSync(PART) ? fs.statSync(PART).size : 0 })); }
    if (m && m[1] === 'upload' && req.method === 'PUT') {
      const idx = Number(m[2]);
      if (idx !== expected) { res.writeHead(409); return res.end(`expected chunk ${expected}`); }
      const ws = fs.createWriteStream(PART, { flags: 'a' });
      req.pipe(ws); ws.on('finish', () => { expected++; res.writeHead(200); res.end(JSON.stringify({ next: expected, size: fs.statSync(PART).size })); });
      ws.on('error', e => { res.writeHead(500); res.end(String(e)); });
      return;
    }
    if (m && m[1] === 'done' && req.method === 'POST') {
      try { cp.execSync(`tar tzf "${PART}" > /dev/null`); } catch (e) { res.writeHead(400); return res.end('bundle is not a valid tar.gz'); }
      fs.renameSync(PART, T); res.writeHead(200); res.end('ok, building\n');
      srv.close(() => startApp()); return;
    }
    res.writeHead(404); res.end('not found');
  });
  srv.listen(PORT, () => console.log('[boot] uploader listening on', PORT, '— waiting for source bundle'));
}
