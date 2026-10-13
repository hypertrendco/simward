import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api, MODE } from '../api/index.js';
import { Btn, Field, Icon, BrandMark } from '../ui/components.jsx';
import { drawMonitor } from '../sim/monitorDraw.js';

function HeroMonitor() {
  useEffect(() => {
    const c = document.getElementById('hero-mon'); if (!c) return;
    const ctx = c.getContext('2d'); let raf, t0 = performance.now();
    const v = { hr: 112, sbp: 98, dbp: 58, rr: 24, spo2: 93, temp: 38.9, rhythm: 'Sinus tachycardia' };
    const loop = () => { const t = (performance.now() - t0) / 1000; drawMonitor(ctx, c.width, c.height, { ...v, hr: v.hr + Math.sin(t * 0.3) * 2 }, t); raf = requestAnimationFrame(loop); };
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) drawMonitor(ctx, c.width, c.height, v, 3); else loop();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas id="hero-mon" width="640" height="400" class="hero-mon" aria-label="Animated patient monitor showing sinus tachycardia" />;
}

export function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState([]);
  useEffect(() => { api.demoAccounts().then(setDemo).catch(() => {}); }, []);
  const submit = async (e, em = email, pw = password) => {
    e?.preventDefault(); setBusy(true); setErr('');
    try { onLogin(await api.login(em, pw)); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const quick = (d) => { setEmail(d.email); if (MODE === 'local') submit(null, d.email, 'demo'); };
  return <div class="login">
    <section class="login-hero">
      <div class="login-brand"><BrandMark /><strong>SimWard</strong></div>
      <h1>Clinical judgment, rehearsed at the bedside.</h1>
      <p>Build 3D patient rooms, script patient deterioration, and let an AI-driven patient respond to every assessment, intervention and question your students make.</p>
      <HeroMonitor />
      <ul class="login-points">
        <li><Icon name="cube" /> Drag-and-drop 3D clinical environments</li>
        <li><Icon name="sparkle" /> AI patient dialogue and scenario direction</li>
        <li><Icon name="target" /> QSEN &amp; NCSBN CJMM competency tracking</li>
      </ul>
    </section>
    <section class="login-panel">
      <form class="login-card" onSubmit={submit}>
        <h2>Sign in</h2>
        <Field label="Email" id="email"><input id="email" type="email" autocomplete="username" value={email} onInput={e => setEmail(e.target.value)} required /></Field>
        {MODE !== 'local' && <Field label="Password" id="password"><input id="password" type="password" autocomplete="current-password" value={password} onInput={e => setPassword(e.target.value)} required /></Field>}
        {err && <div class="form-error" role="alert">{err}</div>}
        <Btn kind="primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Btn>
        {demo.length > 0 && <div class="demo-logins">
          <span class="eyebrow">{MODE === 'local' ? 'Demo accounts — one click' : 'Demo accounts'}</span>
          {demo.map(d => <button type="button" class="demo-acct" onClick={() => quick(d)}><span class={`role-pill r-${d.role}`}>{d.role}</span><span>{d.name}</span><code>{d.email}</code></button>)}
          {MODE !== 'local' && <p class="small muted">Demo password is set by your administrator (DEMO_PASSWORD).</p>}
        </div>}
      </form>
    </section>
  </div>;
}
