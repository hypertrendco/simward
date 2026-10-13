// Clinical audio: synthesized auscultation (lung & heart sounds), bedside monitor tones, and patient voice.
// Everything is generated in the browser with the Web Audio and Web Speech APIs — no audio files needed.

let ctx = null, master = null;
let enabled = true;
export function audioOn() { return enabled; }
export function setAudio(on) { enabled = on; if (!on) { stopAll(); try { speechSynthesis.cancel(); } catch { /* unsupported */ } } }
export function unlockAudio() {
  try {
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
  return !!ctx;
}
const live = new Set();
function stopAll() { for (const n of live) { try { n.stop(); } catch { /* already stopped */ } } live.clear(); }

let noiseBuf = null;
function noise() {
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6; } }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
}
function env(g, t0, pts) { g.gain.setValueAtTime(0.0001, t0); for (const [dt, v] of pts) g.gain.linearRampToValueAtTime(Math.max(0.0001, v), t0 + dt); }

// ---------- inference from scenario text ----------
export function lungTypeFor(state) {
  if (state?.sounds?.lung) return state.sounds.lung;
  const t = (state?.findings?.resp || '').toLowerCase();
  if (/silent|absent|markedly diminished/.test(t)) return 'diminished';
  if (/stridor/.test(t)) return 'stridor';
  if (/wheez/.test(t)) return 'wheeze';
  if (/crackl|rales/.test(t)) return 'crackles';
  if (/rhonch|gurgl/.test(t)) return 'rhonchi';
  if (/diminish/.test(t)) return 'diminished';
  return 'normal';
}
export function heartTypeFor(state) {
  if (state?.sounds?.heart) return state.sounds.heart;
  const t = `${state?.findings?.cardio || ''} ${state?.vitals?.rhythm || ''}`.toLowerCase();
  if (/s3|gallop/.test(t)) return 's3';
  if (/murmur/.test(t)) return 'murmur';
  if (/irregular|fibrill/.test(t)) return 'irregular';
  return 'normal';
}
export const LUNG_TYPES = { normal: 'Clear vesicular', crackles: 'Fine crackles', wheeze: 'Expiratory wheeze', rhonchi: 'Rhonchi', diminished: 'Diminished / silent', stridor: 'Inspiratory stridor' };
export const HEART_TYPES = { normal: 'S1 S2 regular', s3: 'S3 gallop', murmur: 'Systolic murmur', irregular: 'Irregularly irregular' };

// ---------- lung sounds ----------
export function playLungs(type = 'normal', rr = 16, seconds = 7) {
  if (!enabled || !unlockAudio()) return 0;
  const t0 = ctx.currentTime + 0.05, cycle = 60 / Math.max(6, rr), ins = cycle * 0.38;
  const src = noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = type === 'stridor' ? 900 : 380; bp.Q.value = 0.7;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
  const g = ctx.createGain(); src.connect(bp).connect(lp).connect(g).connect(master);
  const amp = type === 'diminished' ? 0.05 : 0.32;
  g.gain.setValueAtTime(0.0001, t0);
  for (let c = 0; t0 + c * cycle < t0 + seconds; c++) {
    const s = t0 + c * cycle;
    g.gain.linearRampToValueAtTime(amp, s + ins * 0.6);
    g.gain.linearRampToValueAtTime(amp * 0.25, s + ins);
    g.gain.linearRampToValueAtTime(amp * 0.18, s + ins + (cycle - ins) * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, s + cycle * 0.97);
    if (type === 'wheeze' || type === 'stridor' || type === 'rhonchi') {
      const o = ctx.createOscillator(); const og = ctx.createGain(); const vib = ctx.createOscillator(); const vg = ctx.createGain();
      o.type = type === 'rhonchi' ? 'sawtooth' : 'sine';
      o.frequency.value = type === 'wheeze' ? 420 + (c % 3) * 60 : type === 'stridor' ? 820 : 140;
      vib.frequency.value = 6; vg.gain.value = type === 'rhonchi' ? 8 : 14; vib.connect(vg).connect(o.frequency);
      const on = type === 'stridor' ? s : s + ins, len = type === 'stridor' ? ins : (cycle - ins) * 0.8;
      env(og, on, [[len * 0.15, type === 'rhonchi' ? 0.06 : 0.09], [len * 0.85, type === 'rhonchi' ? 0.05 : 0.07], [len, 0.0001]]);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
      o.connect(f).connect(og).connect(master); o.start(on); vib.start(on); o.stop(on + len + 0.05); vib.stop(on + len + 0.05); live.add(o); live.add(vib);
    }
    if (type === 'crackles') {
      for (let k = 0; k < 9; k++) {
        const at = s + ins * (0.3 + Math.random() * 0.65);
        const o = ctx.createBufferSource(); o.buffer = noiseBuf; const cg = ctx.createGain(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
        env(cg, at, [[0.002, 0.5], [0.012, 0.0001]]);
        o.connect(hp).connect(cg).connect(master); o.start(at, Math.random()); o.stop(at + 0.02); live.add(o);
      }
    }
  }
  src.start(t0); src.stop(t0 + seconds); live.add(src);
  return seconds;
}

// ---------- heart sounds ----------
function thump(at, freq, level, dur = 0.09) {
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(freq * 1.4, at); o.frequency.exponentialRampToValueAtTime(freq, at + dur);
  const g = ctx.createGain(); env(g, at, [[0.008, level], [dur, 0.0001]]);
  o.connect(g).connect(master); o.start(at); o.stop(at + dur + 0.02); live.add(o);
}
export function playHeart(type = 'normal', hr = 80, seconds = 7) {
  if (!enabled || !unlockAudio()) return 0;
  noise(); let t = ctx.currentTime + 0.05; const end = t + seconds; let i = 0;
  while (t < end) {
    const period = 60 / Math.max(30, hr) * (type === 'irregular' ? 0.65 + Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.7 : 1);
    const sys = Math.min(0.32, period * 0.36);
    thump(t, 55, 0.9); thump(t + sys, 70, 0.65, 0.07);
    if (type === 's3') thump(t + sys + 0.14, 38, 0.45, 0.1);
    if (type === 'murmur') { const n = ctx.createBufferSource(); n.buffer = noiseBuf; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 260; bp.Q.value = 1.2; const g = ctx.createGain(); env(g, t + 0.06, [[0.05, 0.22], [sys - 0.08, 0.16], [sys - 0.04, 0.0001]]); n.connect(bp).connect(g).connect(master); n.start(t + 0.06, Math.random()); n.stop(t + sys); live.add(n); }
    t += period; i++;
  }
  return seconds;
}

// ---------- monitor tones ----------
let lastBeat = 0, lastAlarm = 0;
export function monitorTick(v, connected) {
  if (!enabled || !connected || !ctx || !v) return;
  const now = ctx.currentTime;
  const period = 60 / Math.max(30, v.hr || 70);
  if (now - lastBeat >= period) {
    lastBeat = now;
    // pulse-oximetry tone: pitch falls as saturation falls (classic variable-pitch beep)
    const f = 440 + Math.max(0, Math.min(100, v.spo2) - 70) * 14;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain(); env(g, now, [[0.005, 0.07], [0.09, 0.0001]]);
    o.connect(g).connect(master); o.start(now); o.stop(now + 0.1); live.add(o);
  }
  const alarm = v.spo2 < 90 || v.sbp < 90 || v.hr > 130 || v.hr < 45 || v.rr > 30;
  if (alarm && now - lastAlarm > 6) {
    lastAlarm = now;
    [0, 0.22, 0.44].forEach((d, k) => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = k === 1 ? 740 : 660; const g = ctx.createGain(); env(g, now + d, [[0.01, 0.09], [0.16, 0.0001]]); o.connect(g).connect(master); o.start(now + d); o.stop(now + d + 0.18); live.add(o); });
  }
}

// ---------- environmental cues ----------
export function playCue(kind) {
  if (!enabled || !unlockAudio()) return;
  const now = ctx.currentTime;
  const tone = (f, at, dur, type = 'sine', vol = 0.12) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const g = ctx.createGain(); env(g, at, [[0.01, vol], [dur, 0.0001]]); o.connect(g).connect(master); o.start(at); o.stop(at + dur + 0.05); live.add(o); };
  if (kind === 'phone') { for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) tone(i % 2 ? 1250 : 1000, now + r * 1.1 + i * 0.05, 0.05, 'square', 0.05); }
  else if (kind === 'callLight') { tone(880, now, 0.25, 'sine', 0.1); tone(1175, now + 0.3, 0.35, 'sine', 0.1); tone(880, now + 1.4, 0.25, 'sine', 0.08); tone(1175, now + 1.7, 0.35, 'sine', 0.08); }
  else if (kind === 'pump') { for (let i = 0; i < 6; i++) tone(2100, now + i * 0.28, 0.12, 'square', 0.06); }
  else if (kind === 'environment') { tone(520, now, 0.12, 'triangle', 0.06); tone(660, now + 0.14, 0.16, 'triangle', 0.06); }
  else if (kind === 'knock') { for (let i = 0; i < 3; i++) { const n = ctx.createBufferSource(); n.buffer = noiseBuf || (noise(), noiseBuf); const g = ctx.createGain(); env(g, now + i * 0.22, [[0.005, 0.35], [0.07, 0.0001]]); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; n.connect(lp).connect(g).connect(master); n.start(now + i * 0.22); n.stop(now + i * 0.22 + 0.1); live.add(n); } }
}
// Hospital ambience: distant HVAC hum + occasional hallway sounds (looping, very quiet)
let ambience = null;
export function setAmbience(on) {
  if (!on) { if (ambience) { try { ambience.src.stop(); } catch { /* n/a */ } ambience = null; } return; }
  if (ambience || !enabled || !unlockAudio()) return;
  const src = noise(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; const g = ctx.createGain(); g.gain.value = 0.045;
  src.connect(lp).connect(g).connect(master); src.start(); ambience = { src, g };
}

// ---------- patient voice (Web Speech API) ----------
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices(); } catch { voices = []; } }
if (typeof window !== 'undefined' && 'speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
const FEMALE = /female|samantha|victoria|karen|moira|tessa|fiona|zira|susan|serena|allison|ava|joanna|salli|kimberly|google us english|google uk english female/i;
const MALE = /male|daniel|alex|fred|david|mark|george|james|aaron|arthur|google uk english male|guy|tom/i;
export function speechAvailable() { return typeof window !== 'undefined' && 'speechSynthesis' in window; }
export function speak(text, { sex = 'F', age = 50, distress = 0, onStart, onEnd } = {}) {
  const clean = String(text || '').replace(/\([^)]*\)/g, '').replace(/[*_#]/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean).length;
  const rate = Math.max(0.7, 1 - distress * 0.12 - (age > 70 ? 0.08 : 0));
  const est = Math.max(0.8, words / (2.6 * rate));
  if (!enabled || !speechAvailable() || !clean) { onEnd?.(); return { duration: est, spoken: false }; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean.replace(/…/g, '... '));
    const en = voices.filter(v => /^en/i.test(v.lang));
    const pick = en.find(v => (sex === 'M' ? MALE.test(v.name) && !/female/i.test(v.name) : FEMALE.test(v.name))) || en[0];
    if (pick) u.voice = pick;
    u.rate = rate; u.pitch = sex === 'M' ? (age > 65 ? 0.8 : 0.9) : (age > 65 ? 1.0 : 1.12); u.volume = 1;
    u.onstart = () => onStart?.(est); u.onend = () => onEnd?.(); u.onerror = () => onEnd?.();
    speechSynthesis.speak(u);
    return { duration: est, spoken: true };
  } catch { onEnd?.(); return { duration: est, spoken: false }; }
}
