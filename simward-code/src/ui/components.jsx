import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

// ---------- icons (inline SVG, stroke-based) ----------
const P = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.87M15.5 3.13a3.5 3.5 0 0 1 0 6.75',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  log: 'M4 6h16M4 12h16M4 18h10',
  play: 'M7 4v16l13-8z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z',
  steth: 'M6 3v5a5 5 0 0 0 10 0V3M11 13v3a5 5 0 0 0 10 0v-2M21 12a2 2 0 1 0 0-.01',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  hand: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5M14 10.5V5.5a1.5 1.5 0 0 1 3 0V13M17 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L3.7 15a1.6 1.6 0 0 1 2.5-2L8 15',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  pill: 'M10.5 20.5a4.95 4.95 0 0 1-7-7l10-10a4.95 4.95 0 0 1 7 7zM8.5 8.5l7 7',
  flask: 'M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3',
  file: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6',
  camera: 'M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  rotate: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
  flag: 'M4 22V4M4 4h12l-2 4 2 4H4',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  menu: 'M3 6h18M3 12h18M3 18h18',
  cube: 'M21 16V8l-9-5-9 5v8l9 5 9-5zM3.3 7L12 12l8.7-5M12 22V12',
  flow: 'M6 3v6M6 15v6M18 9v6M6 9a3 3 0 1 0 0 6M18 9a3 3 0 1 0 0-.01M9 12h6',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  volume: 'M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.9 2z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  baby: 'M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3c-2 2-2 4 0 5',
  mute: 'M11 5L6 9H2v6h4l5 4zM23 9l-6 6M17 9l6 6',
};
export function Icon({ name, size = 18, className = '' }) {
  return <svg class={`ic ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={P[name] || P.target} /></svg>;
}

export function Btn({ kind = 'default', icon, children, small, ...rest }) {
  return <button type="button" class={`btn btn-${kind}${small ? ' btn-sm' : ''}`} {...rest}>{icon && <Icon name={icon} size={small ? 15 : 17} />}{children && <span>{children}</span>}</button>;
}

export function Modal({ title, onClose, children, wide, footer }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose?.(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  return <div class="modal-back" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
    <div class={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div class="modal-head"><h3>{title}</h3><button class="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" /></button></div>
      <div class="modal-body">{children}</div>
      {footer && <div class="modal-foot">{footer}</div>}
    </div>
  </div>;
}

export function Field({ label, hint, children, id }) {
  return <label class="field" for={id}><span class="field-label">{label}</span>{children}{hint && <span class="field-hint">{hint}</span>}</label>;
}

export function Tabs({ tabs, value, onChange }) {
  return <div class="tabs" role="tablist">{tabs.map(t => <button role="tab" aria-selected={value === t.id} class={`tab${value === t.id ? ' on' : ''}`} onClick={() => onChange(t.id)}>{t.icon && <Icon name={t.icon} size={16} />}{t.label}{t.badge != null && <span class="tab-badge">{t.badge}</span>}</button>)}</div>;
}

export const Badge = ({ tone = 'neutral', children }) => <span class={`badge b-${tone}`}>{children}</span>;

export function Empty({ icon = 'layers', title, children }) {
  return <div class="empty"><Icon name={icon} size={28} /><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}

// ---------- toasts ----------
let pushToast = () => {};
export const toast = (msg, tone = 'info') => pushToast({ msg, tone, id: Math.random() });
export function Toaster() {
  const [list, setList] = useState([]);
  pushToast = (t) => { setList(l => [...l, t]); setTimeout(() => setList(l => l.filter(x => x.id !== t.id)), 4200); };
  return <div class="toaster" aria-live="polite">{list.map(t => <div class={`toast t-${t.tone}`}>{t.msg}</div>)}</div>;
}

// ---------- confirm (in-page; window.confirm is unavailable in the artifact viewer) ----------
let pushConfirm = () => {};
export const confirmAsk = (message, { okLabel = 'Confirm', danger = false } = {}) => new Promise(res => pushConfirm({ message, okLabel, danger, res }));
export function ConfirmHost() {
  const [c, setC] = useState(null);
  pushConfirm = setC;
  if (!c) return null;
  const done = (v) => { c.res(v); setC(null); };
  return <Modal title="Please confirm" onClose={() => done(false)} footer={<><Btn onClick={() => done(false)}>Cancel</Btn><Btn kind={c.danger ? 'danger' : 'primary'} onClick={() => done(true)}>{c.okLabel}</Btn></>}><p>{c.message}</p></Modal>;
}

// ---------- tiny markdown (headings, bold, italics, lists, paragraphs) ----------
export function Markdown({ text }) {
  if (!text) return null;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|\W)\*(?!\s)(.+?)\*(?=\W|$)/g, '$1<em>$2</em>').replace(/`(.+?)`/g, '<code>$1</code>');
  const out = []; let list = null;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const li = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (li) { list = list || []; list.push(`<li>${inline(li[1])}</li>`); continue; }
    if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; }
    const hd = line.match(/^(#{1,4})\s+(.*)/);
    if (hd) out.push(`<h4>${inline(hd[2])}</h4>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push(`<ul>${list.join('')}</ul>`);
  return <div class="md" dangerouslySetInnerHTML={{ __html: out.join('') }} />;
}

// ---------- charts ----------
export function Bar({ pct, tone }) {
  const t = tone || (pct == null ? 'none' : pct >= 85 ? 'good' : pct >= 70 ? 'ok' : pct >= 50 ? 'warn' : 'bad');
  return <div class={`bar bar-${t}`} role="img" aria-label={pct == null ? 'Not assessed' : `${pct}%`}><div style={{ width: `${pct ?? 0}%` }} /></div>;
}

export function Spark({ values = [], w = 90, h = 26 }) {
  if (values.length < 2) return <span class="muted small">{values[0] != null ? `${values[0]}%` : '—'}</span>;
  const xs = values.map((_, i) => (i / (values.length - 1)) * (w - 6) + 3);
  const ys = values.map(v => h - 3 - (v / 100) * (h - 6));
  const d = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join('');
  return <svg class="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}><path d={`${d}L${xs.at(-1)},${h}L${xs[0]},${h}Z`} class="spark-fill" /><path d={d} class="spark-line" /><circle cx={xs.at(-1)} cy={ys.at(-1)} r="2.6" class="spark-dot" /></svg>;
}

export function Radar({ data, size = 260 }) {
  // data: [{label, value (0-100)}]
  const n = data.length; if (n < 3) return null;
  const c = size / 2, r = size / 2 - 64;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [c + Math.cos(a) * r * v / 100, c + Math.sin(a) * r * v / 100]; };
  const poly = data.map((d, i) => pt(i, d.value ?? 0).join(',')).join(' ');
  return <svg class="radar" viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: `${size}px` }} role="img" aria-label="Competency radar chart">
    {[25, 50, 75, 100].map(g => <polygon class="radar-grid" points={data.map((_, i) => pt(i, g).join(',')).join(' ')} />)}
    {data.map((_, i) => { const [x, y] = pt(i, 100); return <line class="radar-grid" x1={c} y1={c} x2={x} y2={y} />; })}
    <polygon class="radar-area" points={poly} />
    {data.map((d, i) => { const [x, y] = pt(i, d.value ?? 0); return <circle class="radar-dot" cx={x} cy={y} r="3" />; })}
    {data.map((d, i) => { const [x, y] = pt(i, 122); return <text class="radar-label" x={x} y={y} text-anchor={Math.abs(x - c) < 8 ? 'middle' : x > c ? 'start' : 'end'} dominant-baseline="middle">{d.label}</text>; })}
  </svg>;
}

export function useAsync(fn, deps = []) {
  const [s, set] = useState({ loading: true, data: null, error: null });
  const alive = useRef(true);
  const run = () => { set(x => ({ ...x, loading: true })); return fn().then(d => alive.current && set({ loading: false, data: d, error: null })).catch(e => alive.current && set({ loading: false, data: null, error: e })); };
  useEffect(() => { alive.current = true; run(); return () => { alive.current = false; }; }, deps);
  return { ...s, reload: run };
}

export const Spinner = ({ label = 'Loading…' }) => <div class="spinner" role="status"><span class="spin" />{label}</div>;
export const initials = (n = '') => n.replace(/^(Prof\.|Dr\.)\s*/, '').split(/[\s,]+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
export const Avatar = ({ name, size = 30 }) => <span class="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(name)}</span>;
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
export const fmtDateTime = (d) => d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
export const BrandMark = () => <svg class="brandmark" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" class="bm-bg" /><path d="M5 17h5l2.2-5 3.6 10 2.6-7H27" class="bm-line" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>;
export { Fragment };
