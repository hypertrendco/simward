// Patient-monitor renderer shared by the 3D bedside monitor (CanvasTexture) and the 2D HUD monitor.
// Draws ECG (lead II), SpO2 pleth and respiration waveforms plus numerics in the classic monitor layout.

function ecgShape(p, rhythm) {
  // p in [0,1) of one beat. Returns mV-ish amplitude.
  const g = (x, m, s, a) => a * Math.exp(-((x - m) ** 2) / (2 * s * s));
  const af = /fibrillation/i.test(rhythm || '');
  let v = 0;
  if (!af) v += g(p, 0.12, 0.025, 0.15); // P
  v += g(p, 0.235, 0.008, -0.12); // Q
  v += g(p, 0.25, 0.011, 1.1); // R
  v += g(p, 0.268, 0.01, -0.28); // S
  v += g(p, 0.46, 0.05, 0.3); // T
  return v;
}
function plethShape(p) {
  const g = (x, m, s, a) => a * Math.exp(-((x - m) ** 2) / (2 * s * s));
  return g(p, 0.22, 0.08, 1) + g(p, 0.5, 0.06, 0.28);
}

// Deterministic jitter for AFib RR irregularity
function beatPhase(t, hr, rhythm) {
  const period = 60 / Math.max(hr, 1);
  if (!/fibrillation/i.test(rhythm || '')) return (t % period) / period;
  // irregular: modulate period with pseudo-random per-beat factor
  let acc = 0, i = 0;
  const target = t % 60;
  while (acc <= target && i < 400) {
    const f = 0.7 + 0.6 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1);
    const len = period * f;
    if (acc + len > target) return (target - acc) / len;
    acc += len; i++;
  }
  return 0;
}

export function drawMonitor(ctx, w, h, vitals, t, opts = {}) {
  const connected = opts.connected !== false;
  const v = vitals || {};
  ctx.fillStyle = '#05090b';
  ctx.fillRect(0, 0, w, h);
  const waveW = w * 0.66;
  const rows = [
    { label: 'II', color: '#39e27d', fn: (tt) => ecgShape(beatPhase(tt, v.hr, v.rhythm), v.rhythm), speed: 1.6, amp: 0.34 },
    { label: 'Pleth', color: '#35c9ff', fn: (tt) => plethShape(beatPhase(tt - 0.15, v.hr, v.rhythm)), speed: 1.6, amp: 0.3 },
    { label: 'Resp', color: '#f3e163', fn: (tt) => Math.sin(((tt * (v.rr || 14)) / 60) * Math.PI * 2) * 0.5 + 0.5, speed: 0.6, amp: 0.3 },
  ];
  const rowH = h / 3;
  ctx.lineWidth = Math.max(1.2, h / 160);
  ctx.font = `${Math.round(h / 22)}px "JetBrains Mono", ui-monospace, monospace`;
  rows.forEach((r, i) => {
    const y0 = i * rowH;
    ctx.fillStyle = r.color;
    ctx.globalAlpha = 0.8;
    ctx.fillText(r.label, 8, y0 + h / 18);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = r.color;
    ctx.beginPath();
    const secs = waveW / (w * 0.12) / r.speed * 1.2;
    for (let x = 0; x <= waveW; x += 2) {
      const tt = t - secs + (x / waveW) * secs;
      let a = connected ? r.fn(tt) : 0;
      if (!connected && i === 0) a = 0;
      const y = y0 + rowH * 0.78 - a * rowH * (r.amp / 0.34) * 0.62;
      x === 0 ? ctx.moveTo(x + 4, y) : ctx.lineTo(x + 4, y);
    }
    ctx.stroke();
    // sweep eraser bar
    ctx.fillStyle = '#05090b';
  });
  // numerics panel
  const nx = waveW + 12;
  ctx.strokeStyle = '#1b2a2f';
  ctx.beginPath(); ctx.moveTo(waveW + 6, 0); ctx.lineTo(waveW + 6, h); ctx.stroke();
  const big = Math.round(h / 6.2), small = Math.round(h / 20);
  const num = (label, val, color, y, unit, bigSize = big) => {
    ctx.fillStyle = color; ctx.globalAlpha = 0.85;
    ctx.font = `${small}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillText(label, nx, y + small);
    if (unit) { ctx.textAlign = 'right'; ctx.fillText(unit, w - 8, y + small); ctx.textAlign = 'left'; }
    ctx.globalAlpha = 1;
    ctx.font = `600 ${bigSize}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillText(val, nx, y + small + bigSize * 0.95);
  };
  const dash = (x) => (connected && x != null && !Number.isNaN(x) ? x : '--');
  const hrAlarm = connected && (v.hr > 120 || v.hr < 50);
  const spAlarm = connected && v.spo2 < 90;
  const bpAlarm = connected && v.sbp < 90;
  const blink = Math.floor(t * 2) % 2 === 0;
  num('HR', dash(Math.round(v.hr)), hrAlarm && blink ? '#ff4d4d' : '#39e27d', 2, 'bpm');
  num('SpO₂', dash(Math.round(v.spo2)), spAlarm && blink ? '#ff4d4d' : '#35c9ff', h * 0.28, '%');
  num('NIBP', connected ? `${Math.round(v.sbp)}/${Math.round(v.dbp)}` : '--/--', bpAlarm && blink ? '#ff4d4d' : '#f2f2f2', h * 0.54, 'mmHg', Math.round(big * 0.62));
  num('RR', dash(Math.round(v.rr)), '#f3e163', h * 0.74, '/min', Math.round(big * 0.62));
  ctx.font = `${small}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.fillStyle = '#ffb347';
  ctx.fillText(`T ${connected && v.temp ? v.temp.toFixed(1) : '--.-'}°C`, nx + (w - nx) * 0.48, h * 0.74 + small);
  if (!connected) {
    ctx.fillStyle = '#ffcf4d';
    ctx.font = `600 ${Math.round(h / 16)}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillText('LEADS OFF', 12, h / 2);
  }
  if (connected && (hrAlarm || spAlarm || bpAlarm) && blink) {
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(w - 18, 6, 10, 10);
  }
}
