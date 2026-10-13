// Voice system: persona-matched speech for the patient, family member and nurse.
// Provider order: server TTS (/api/tts → OpenAI gpt-4o-mini-tts or ElevenLabs, when configured) → browser SpeechSynthesis.
// All speech goes through one sequential queue so nurse and patient never talk over each other, and every
// utterance reports its start/duration so the 3D avatar can lip-sync.
import { MODE } from '../api/index.js';
import { audioOn, unlockAudio } from './audio.js';

// ---------- accent / language hints ----------
// accent codes: 'en-US', 'en-GB', 'en-IE', 'en-IN', 'en-AU', 'en-ZA', 'es-US' (Spanish-accented English),
// 'en-US-ja' (Japanese-accented), 'en-US-so' (Somali-accented), 'en-US-zh', 'en-US-ar', 'en-US-ht', 'en-US-pt'
const ACCENT_LANG = { 'en-US': ['en-US', 'en'], 'en-GB': ['en-GB', 'en'], 'en-IE': ['en-IE', 'en-GB', 'en'], 'en-IN': ['en-IN', 'en'], 'en-AU': ['en-AU', 'en'], 'en-ZA': ['en-ZA', 'en-GB', 'en'],
  'es-US': ['es-US', 'es-MX', 'es', 'en-US', 'en'], 'en-US-ja': ['en-US', 'en'], 'en-US-so': ['en-US', 'en'], 'en-US-zh': ['en-US', 'en'], 'en-US-ar': ['en-US', 'en'], 'en-US-ht': ['fr-CA', 'fr', 'en-US', 'en'], 'en-US-pt': ['pt-BR', 'en-US', 'en'] };
const FEMALE = /female|woman|samantha|victoria|karen|moira|tessa|fiona|zira|susan|serena|allison|ava|joanna|salli|kimberly|kendra|amy|emma|nicole|raveena|aditi|lupe|paulina|penelope|google (us|uk) english female|google español|hazel|sonia|libby|aria|jenny|michelle|ana|natasha|emily|catherine|clara|siri female/i;
const MALE = /\bmale\b|\bman\b|daniel|alex|fred|david|mark|george|james|aaron|arthur|google uk english male|guy|tom|brian|matthew|joey|justin|russell|miguel|ryan|christopher|eric|roger|steffan|william|liam|andrew|thomas|oliver|rishi|prabhat|siri male/i;

let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices() || []; } catch { voices = []; } }
if (typeof window !== 'undefined' && 'speechSynthesis' in window) { loadVoices(); try { speechSynthesis.onvoiceschanged = loadVoices; } catch { /* ignore */ } }
export const speechAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function pickBrowserVoice(profile = {}) {
  if (!voices.length) loadVoices();
  const wantF = profile.gender === 'F';
  const langs = ACCENT_LANG[profile.accent] || ACCENT_LANG['en-US'];
  let best = null, bestScore = -1;
  for (const v of voices) {
    let s = 0;
    const li = langs.findIndex(l => v.lang?.toLowerCase().startsWith(l.toLowerCase()));
    if (li < 0) continue; s += (langs.length - li) * 10;
    const f = FEMALE.test(v.name), m = MALE.test(v.name);
    if (wantF ? f : m) s += 8; else if (wantF ? m : f) s -= 6;
    if (/google|microsoft|natural|neural|premium|enhanced/i.test(v.name)) s += 3;
    if (v.localService) s += 1;
    if (s > bestScore) { bestScore = s; best = v; }
  }
  return best || voices.find(v => /^en/i.test(v.lang)) || voices[0] || null;
}

// prosody from the persona: children higher/faster, elders lower/slower, distress slows & breaks phrasing
export function prosody(profile = {}, { distress = 0 } = {}) {
  const age = Number(profile.age) || 45;
  let pitch = profile.gender === 'F' ? 1.08 : 0.9;
  if (age < 13) pitch = 1.45; else if (age < 18) pitch += 0.15; else if (age > 70) pitch -= 0.08;
  let rate = age < 13 ? 1.05 : age > 75 ? 0.86 : 0.97;
  rate -= distress * 0.1;
  return { pitch: Math.max(0.5, Math.min(2, pitch + (profile.pitch || 0))), rate: Math.max(0.6, Math.min(1.4, rate + (profile.rate || 0))) };
}

export const estimateDuration = (text, rate = 1) => Math.max(0.7, String(text).split(/\s+/).filter(Boolean).length / (2.7 * rate));

// ---------- server TTS ----------
let serverStatus = null;
export async function ttsStatus() {
  if (MODE === 'local') return { provider: null };
  if (serverStatus) return serverStatus;
  try { serverStatus = await (await fetch('/api/tts/status', { credentials: 'include' })).json(); } catch { serverStatus = { provider: null }; }
  return serverStatus;
}
const audioCache = new Map();
async function serverAudio(text, profile, distress) {
  const key = JSON.stringify([text, profile, distress]);
  if (audioCache.has(key)) return audioCache.get(key);
  const r = await fetch('/api/tts', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, profile, distress }) });
  if (!r.ok) throw new Error('tts');
  const blob = await r.blob();
  if (!/audio/.test(blob.type) || blob.size < 200) throw new Error('tts');
  const url = URL.createObjectURL(blob);
  if (audioCache.size > 60) { const first = audioCache.keys().next().value; URL.revokeObjectURL(audioCache.get(first)); audioCache.delete(first); }
  audioCache.set(key, url);
  return url;
}

// ---------- the speech queue ----------
const queue = [];
let current = null;
const listeners = new Set();
export function onSpeech(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = (ev) => { for (const fn of listeners) { try { fn(ev); } catch { /* listener error */ } } };

function cleanText(text) { return String(text || '').replace(/\([^)]*\)/g, ' ').replace(/[*_#]/g, '').replace(/…/g, '... ').replace(/\s+/g, ' ').trim(); }

export function speakAs(who, text, profile = {}, { distress = 0, onStart, onEnd, priority = false } = {}) {
  const clean = cleanText(text);
  if (!clean) { onEnd?.(); return; }
  const item = { who, text: clean, profile, distress, onStart, onEnd, id: Math.random().toString(36).slice(2) };
  if (priority) queue.unshift(item); else queue.push(item);
  pump();
  return item.id;
}
export function cancelSpeech(who) {
  for (let i = queue.length - 1; i >= 0; i--) if (!who || queue[i].who === who) queue.splice(i, 1);
  if (current && (!who || current.who === who)) stopCurrent();
}
export function isSpeaking(who) { return current ? (!who || current.who === who) : false; }
let audioEl = null;
function stopCurrent() {
  if (!current) return;
  try { speechSynthesis.cancel(); } catch { /* n/a */ }
  if (audioEl) { try { audioEl.pause(); } catch { /* n/a */ } audioEl = null; }
  finish(current);
}
function finish(item) {
  if (current !== item) return;
  current = null;
  emit({ type: 'end', who: item.who, id: item.id });
  item.onEnd?.();
  setTimeout(pump, 120);
}
async function pump() {
  if (current || !queue.length) return;
  const item = queue.shift();
  current = item;
  if (!audioOn()) { const d = estimateDuration(item.text); emit({ type: 'start', who: item.who, id: item.id, text: item.text, duration: d, silent: true }); item.onStart?.(d, true); setTimeout(() => finish(item), Math.min(2500, d * 400)); return; }
  unlockAudio();
  const pr = prosody(item.profile, { distress: item.distress });
  const status = await ttsStatus();
  if (status.provider) {
    try {
      const url = await serverAudio(item.text, item.profile, item.distress);
      if (current !== item) return;
      const a = new Audio(url); audioEl = a;
      const started = () => { const d = isFinite(a.duration) && a.duration > 0 ? a.duration : estimateDuration(item.text, pr.rate); emit({ type: 'start', who: item.who, id: item.id, text: item.text, duration: d }); item.onStart?.(d, false); };
      a.onplaying = started; a.onended = () => finish(item); a.onerror = () => finish(item);
      await a.play();
      return;
    } catch { /* fall back to browser voice */ }
  }
  if (!speechAvailable()) { const d = estimateDuration(item.text, pr.rate); emit({ type: 'start', who: item.who, id: item.id, text: item.text, duration: d, silent: true }); item.onStart?.(d, true); setTimeout(() => finish(item), d * 1000); return; }
  try {
    const u = new SpeechSynthesisUtterance(item.text);
    const v = pickBrowserVoice(item.profile); if (v) u.voice = v;
    u.pitch = pr.pitch; u.rate = pr.rate; u.volume = 1;
    const d = estimateDuration(item.text, pr.rate);
    let startedAt = 0;
    u.onstart = () => { startedAt = performance.now(); emit({ type: 'start', who: item.who, id: item.id, text: item.text, duration: d }); item.onStart?.(d, false); };
    u.onend = () => finish(item); u.onerror = () => finish(item);
    // Chrome occasionally never fires onend for long utterances; guard with a timeout
    setTimeout(() => { if (current === item && (!startedAt || performance.now() - startedAt > d * 1000 + 4000)) finish(item); }, d * 1000 + 8000);
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch { finish(item); }
}

// Split streaming text into complete sentences so audio can start before the whole reply is written.
export function sentenceStreamer(onSentence) {
  let spoken = 0;
  return {
    push(full) {
      const rest = full.slice(spoken);
      const re = /[^.!?…]+[.!?…]+["’”)]*\s+/g;
      let m, consumed = 0;
      while ((m = re.exec(rest))) { onSentence(m[0].trim()); consumed = m.index + m[0].length; }
      spoken += consumed;
    },
    flush(full) { const rest = full.slice(spoken).trim(); spoken = full.length; if (rest) onSentence(rest); },
  };
}

// ---------- nurse persona (per student, stored in this browser) ----------
const NURSE_KEY = 'simward-nurse-v1';
export function loadNurse(user) {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(NURSE_KEY) || 'null'); } catch { saved = null; }
  const first = (user?.name || 'Nurse').split(' ')[0];
  return { name: first, gender: 'F', accent: 'en-US', avatarId: 'Medical_Female_01', ...(saved || {}) };
}
export function saveNurse(n) { try { localStorage.setItem(NURSE_KEY, JSON.stringify(n)); } catch { /* storage blocked */ } }
export const ACCENT_OPTIONS = [
  ['en-US', 'American English'], ['en-GB', 'British English'], ['en-IE', 'Irish English'], ['en-AU', 'Australian English'], ['en-IN', 'Indian English'], ['en-ZA', 'South African English'],
  ['es-US', 'Spanish-accented English'], ['en-US-ja', 'Japanese-accented English'], ['en-US-zh', 'Chinese-accented English'], ['en-US-so', 'Somali-accented English'], ['en-US-ar', 'Arabic-accented English'], ['en-US-ht', 'Haitian Creole-accented English'], ['en-US-pt', 'Portuguese-accented English'],
];
