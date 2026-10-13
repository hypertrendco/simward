import { h } from 'preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { api } from '../api/index.js';
import { useApp } from '../store.jsx';
import { Btn, Modal, Field, Badge, Icon, toast, confirmAsk, Tabs, Spinner } from '../ui/components.jsx';
import { Scene3D } from '../ui/Scene3D.jsx';
import { SimEngine } from '../sim/engine.js';
import { scoreAttempt, fmt } from '../sim/scoring.js';
import { drawMonitor } from '../sim/monitorDraw.js';
import { ACTIONS, ACTION_CATEGORIES, ACTION_MAP, nurseLine } from '../data/actions.js';
import { aiText } from '../ai/client.js';
import { patientPrompt, familyPrompt, directorPrompt, reactionPrompt, spontaneousPrompt, ACTION_HINTS } from '../ai/prompts.js';
import { patientFallback, familyFallback, reactionFallback, spontaneousFallback } from '../ai/fallback.js';
import { Report } from './Report.jsx';
import { unlockAudio, setAudio, audioOn, monitorTick, playLungs, playHeart, lungTypeFor, heartTypeFor, LUNG_TYPES, HEART_TYPES, playCue, setAmbience } from '../sim/audio.js';
import { speakAs, cancelSpeech, onSpeech, sentenceStreamer, loadNurse, saveNurse, ACCENT_OPTIONS, ttsStatus } from '../sim/voice.js';
import { NURSE_AVATARS, avatarThumb } from '../three/avatar.js';
import { ROOM_PRESETS, EQUIP_MAP } from '../data/equipment.js';

const REGION_ACTIONS = {
  head: ['loc', 'neuro-check', 'pain-assess', 'identify', 'introduce', 'explain', 'reassure', 'o2-nc', 'o2-nrb', 'suction', 'swallow-screen', 'temp-check', 'hygiene'],
  chest: ['resp-assess', 'cardio-assess', 'monitor', 'ecg-12', 'peak-flow', 'incentive-spiro', 'pursed-lip', 'newborn-check'],
  abdomen: ['gi-assess', 'gu-assess', 'foley-uo', 'fundus-check', 'fundal-massage'],
  arm: ['vitals', 'pulse-ox-spot', 'glucose', 'iv-access', 'blood-cultures', 'lactate', 'fluid-bolus', 'identify', 'allergy-check'],
  legs: ['skin-assess', 'calf-check', 'reposition', 'turn-q2h', 'scd-apply', 'daily-weight', 'fall-precautions', 'ice-pack', 'hip-precautions'],
};
const EQUIP_ACTIONS = {
  monitor: ['monitor', 'vitals', 'pulse-ox-spot'], ivpole: ['iv-access', 'fluid-bolus'], bed: ['hob-up', 'tripod', 'bed-safety', 'aspiration-precautions', 'turn-q2h'], stretcher: ['hob-up', 'bed-safety'],
  sink: ['hand-hygiene'], sanitizer: ['hand-hygiene'], wow: ['review-orders', 'review-labs', 'doc-assessment', 'doc-intervention'], medcart: ['review-orders', 'doc-mar'],
  crashcart: ['rapid-response', 'code-blue'], headwall: ['o2-nc', 'o2-nrb', 'suction'], o2tank: ['o2-nc', 'o2-nrb'], curtain: ['privacy'], vent: ['resp-assess'],
  phone: ['report-rn', 'sbar-provider', 'rapid-response', 'family-update'], walker: ['ambulate'], commode: ['elimination'], gaitbelt: ['ambulate'], scdpump: ['scd-apply'], isocart: ['ppe'],
  bassinet: ['newborn-check', 'breastfeeding-support'], recliner: ['family-include'], chair: ['family-include'], nightstand: ['offer-fluids', 'cultural-prefs'], toys: ['peds-distraction'], whiteboard: ['introduce', 'reinforce-teaching'], door: ['call-light', 'delegate-uap'],
};
const SILENT_FOR_PATIENT = new Set(['hand-hygiene', 'ppe', 'review-labs', 'review-orders', 'report-rn', 'sbar-provider', 'rapid-response', 'code-blue', 'handoff', 'delegate-uap', 'verify-scope', 'family-update', 'weight-based-dose', 'monitor', 'daily-weight', 'blood-cultures', 'lactate']);
const REGION_LABEL = { head: 'Head & face', chest: 'Chest', abdomen: 'Abdomen', arm: 'Arm', legs: 'Legs & skin' };
const EVENT_META = { patient: ['chat', 'Patient'], family: ['users', 'Family'], phone: ['phone', 'Phone'], pump: ['alert', 'Alarm'], callLight: ['bell', 'Call light'], environment: ['eye', 'In the room'] };

function HudMonitor({ snapRef, connected }) {
  const c = useRef(null);
  useEffect(() => {
    let raf, t0 = performance.now();
    const loop = () => { const ctx = c.current?.getContext('2d'); if (ctx) drawMonitor(ctx, c.current.width, c.current.height, snapRef.current?.vitals, (performance.now() - t0) / 1000, { connected }); raf = requestAnimationFrame(loop); };
    loop(); return () => cancelAnimationFrame(raf);
  }, [connected]);
  return <canvas ref={c} width="520" height="300" class="hud-monitor" aria-label="Patient monitor" />;
}

export function Player({ scenarioId, preview }) {
  const { nav, data, user, route } = useApp();
  const [sc, setSc] = useState(null);
  const [phase, setPhase] = useState('prebrief');
  const [attempt, setAttempt] = useState(null);
  const [snap, setSnap] = useState(null);
  const [events, setEvents] = useState([]);
  const [finding, setFinding] = useState(null);
  const [panel, setPanel] = useState('chart');
  const [chartTab, setChartTab] = useState('summary');
  const [openCat, setOpenCat] = useState('safety');
  const [pick, setPick] = useState(null);
  const [hover, setHover] = useState(null);
  const [medModal, setMedModal] = useState(null);
  const [sbar, setSbar] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatTo, setChatTo] = useState('patient');
  const [msg, setMsg] = useState('');
  const [typing, setTyping] = useState(null);
  const [speaking, setSpeaking] = useState(null);
  const [cues, setCues] = useState([]);
  const [flowsheet, setFlowsheet] = useState([]);
  const [previewResult, setPreviewResult] = useState(null);
  const [note, setNote] = useState({ type: 'doc-assessment', text: '' });
  const [sound, setSound] = useState(audioOn());
  const [nurse, setNurse] = useState(() => loadNurse(user));
  const [nurseModal, setNurseModal] = useState(false);
  const [tts, setTts] = useState(null);
  const eng = useRef(null), sceneRef = useRef(null), snapRef = useRef(null), directorBusy = useRef(false), chatRef = useRef(chat), logRef = useRef(null);
  const idle = useRef({ lastActivity: 0, lastSpont: -999, busy: false });
  chatRef.current = chat;
  const settings = data.settings || {};

  useEffect(() => { api.getScenario(scenarioId).then(setSc).catch(e => toast(e.message, 'bad')); ttsStatus().then(setTts); }, [scenarioId]);
  useEffect(() => onSpeech((ev) => { setSpeaking(ev.type === 'start' ? ev.who : null); }), []);
  useEffect(() => () => { cancelSpeech(); setAmbience(false); }, []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [chat, typing]);

  const p = sc?.patient;
  const patientVoice = useMemo(() => (p ? { gender: p.sex === 'X' ? 'F' : p.sex, age: p.age, accent: 'en-US', ...(p.voice || {}) } : {}), [p]);
  const familyVoice = useMemo(() => (sc?.family ? { gender: sc.family.sex, age: sc.family.age, accent: 'en-US', ...(sc.family.voice || {}) } : null), [sc]);
  const nurseVoice = useMemo(() => ({ gender: nurse.gender, age: 32, accent: nurse.accent, style: 'calm, warm, professional nurse' }), [nurse]);

  const env3d = useMemo(() => {
    if (!sc) return null;
    const e = JSON.parse(JSON.stringify(sc.environment));
    const bed = e.items.find(i => i.type === 'bed' || i.type === 'stretcher');
    if (bed && sc.start?.foley) bed.props.foley = true;
    return e;
  }, [sc]);

  const distressOf = () => { const v = snapRef.current?.vitals || {}; return v.rr > 30 ? 2 : v.rr > 24 ? 1 : 0; };
  const sayPatient = (text, { priority = false } = {}) => speakAs('patient', text, patientVoice, { distress: distressOf(), priority, onStart: (d) => sceneRef.current?.patient?.speak?.(text, d) });
  const sayFamily = (text) => { if (!familyVoice) return; speakAs('family', text, familyVoice, { onStart: (d) => sceneRef.current?.family?.speak?.(text, d) }); };
  const sayNurse = (text) => speakAs('nurse', text, nurseVoice, {});

  const start = async () => {
    if (!preview) { try { setAttempt(await api.startAttempt(scenarioId)); } catch (e) { return toast(e.message, 'bad'); } }
    unlockAudio(); setAmbience(true);
    const e = new SimEngine(sc, {
      onUpdate: (s) => { snapRef.current = s; },
      onEvent: (ev) => {
        setEvents(l => [...l, ev]);
        if (ev.type === 'transition') { if (preview) toast(`State → ${sc.states.find(x => x.id === ev.to)?.name}`, 'info'); const A = sc.states.find(x => x.id === ev.from)?.vitals || {}, B = sc.states.find(x => x.id === ev.to)?.vitals || {}; const better = ((B.pain ?? 0) <= (A.pain ?? 0)) && ((B.rr ?? 0) <= (A.rr ?? 0)) && ((B.spo2 ?? 100) >= (A.spo2 ?? 100)); setTimeout(() => spontaneous(better ? 'better' : 'change'), 2500); }
        if (ev.type === 'event') handleEvent(ev);
      },
    });
    eng.current = e; e.start(); snapRef.current = e.snapshot(); setSnap(e.snapshot());
    setPhase('running');
  };

  const handleEvent = (ev) => {
    const cue = { ...ev, at: Date.now() };
    setCues(c => [cue, ...c].slice(0, 4));
    if (ev.kind === 'patient') { setChat(c => [...c, { role: 'patient', text: ev.label, spontaneous: true }]); sayPatient(ev.label, { priority: true }); }
    else if (ev.kind === 'family' && sc.family) { const text = ev.label.replace(/^[^:]+:\s*/, '').replace(/^[“"]|[”"]$/g, ''); setChat(c => [...c, { role: 'family', text, spontaneous: true }]); sayFamily(text); sceneRef.current?.family?.setMood?.(-0.3, true); }
    else playCue(ev.kind);
    setTimeout(() => setCues(c => c.filter(x => x.eventId !== ev.eventId)), 50000);
  };

  // engine loop (timer-driven so scenario time runs in real time regardless of rendering speed)
  useEffect(() => {
    if (phase !== 'running') return;
    let last = performance.now(), acc = 0;
    const iv = setInterval(() => {
      const now = performance.now(), dt = (now - last) / 1000; last = now;
      eng.current.tick(Math.min(dt, 2));
      const s = snapRef.current;
      sceneRef.current?.setVitals(s.vitals, s.cues, s.revealed.monitor);
      monitorTick(s.vitals, s.revealed.monitor);
      acc += dt; if (acc > 0.24) { acc = 0; setSnap({ ...s }); }
      // a quiet nurse gets prompted by the patient (≈ every 75 s of inactivity, at most every 2.5 min)
      const now2 = eng.current.clock;
      if (now2 - idle.current.lastActivity > 75 && now2 - idle.current.lastSpont > 150 && !idle.current.busy) { idle.current.lastSpont = now2; spontaneous('idle'); }
    }, 100);
    return () => clearInterval(iv);
  }, [phase]);
  useEffect(() => { if (snap) { sceneRef.current?.setHob(snap.hob); sceneRef.current?.setO2(snap.o2); } }, [snap?.hob, snap?.o2]);

  if (!sc) return <div class="sim-loading"><Spinner label="Preparing the patient room…" /></div>;
  const exit = async () => {
    if (phase === 'running' && !(await confirmAsk('Leave the simulation? Your progress in this attempt will be lost.', { okLabel: 'Leave', danger: true }))) return;
    cancelSpeech(); setAmbience(false);
    nav(preview ? (route.params.from === 'builder' ? 'builder' : 'library') : 'home', preview && route.params.from === 'builder' ? { id: scenarioId } : {});
  };

  const auscultate = (kind) => {
    const st = eng.current?.state; const v = snapRef.current?.vitals || {};
    if (kind === 'lung') { const t = lungTypeFor(st); playLungs(t, v.rr); return LUNG_TYPES[t]; }
    const t = heartTypeFor(st); playHeart(t, v.hr); return HEART_TYPES[t];
  };

  const perform = (id, params) => {
    if (!eng.current || phase !== 'running') return;
    if (id === 'sbar-provider' && !params) { setSbar({ s: '', b: '', a: '', r: '' }); return; }
    if (id === 'report-rn' && !params) { setSbar({ s: '', b: '', a: '', r: '', rn: true }); return; }
    // the nurse verbalizes the action to the patient before doing it
    const line = nurseLine(id, sc, nurse.name);
    if (line && !/^doc-/.test(id)) { eng.current.say(line, id); setChat(c => [...c, { role: 'nurse', text: line, action: id }]); sayNurse(line); }
    const r = eng.current.perform(id, params);
    idle.current.lastActivity = eng.current.clock;
    if (line && !SILENT_FOR_PATIENT.has(id) && !/^doc-/.test(id)) reactToAction(id, r.finding, line);
    setPick(null);
    const audio = ['resp-assess', 'peak-flow'].includes(id) ? 'lung' : id === 'cardio-assess' ? 'heart' : null;
    setFinding({ title: r.message, text: r.finding, t: eng.current.clock, audio });
    if (audio && sound) setTimeout(() => auscultate(audio), 1500);
    if (ACTION_MAP[id]?.reveals === 'vitals') { const v = eng.current.displayVitals(); setFlowsheet(f => [...f, { t: eng.current.clock, ...v }]); }
    if (id === 'review-labs') { setPanel('chart'); setChartTab('labs'); }
    if (id === 'review-orders') { setPanel('chart'); setChartTab('orders'); }
    const kind = id.startsWith('med:') ? 'med' : ACTION_MAP[id]?.kind;
    if (['intervene', 'med', 'communicate', 'assess'].includes(kind)) runDirector(id);
  };

  // expected actions the nurse hasn't done yet, with the patient-perceivable angle for each (drives the hidden guidance block)
  const pendingExpected = () => {
    const done = eng.current?.performed || new Set();
    return (sc.expected || []).filter(x => !x.actions.some(a => done.has(a))).map(x => ({ actions: x.actions, hint: ACTION_HINTS[x.actions[0]] || (x.actions[0].startsWith('med:') ? 'asking when the next dose of medicine is coming' : '(none)') }));
  };
  const ctx = () => ({
    nurse: { ...nurse, introduced: eng.current?.performed?.has('introduce') || chatRef.current.some(c => c.role === 'student' && /\b(i'?m|my name is|this is)\s+\w+/i.test(c.text)) },
    pending: pendingExpected(),
    recentPatientLines: chatRef.current.filter(c => c.role === 'patient').slice(-4).map(c => c.text),
    events: eng.current?.events.filter(x => x.type === 'action' || x.type === 'say').slice(-6).map(e => `[${fmt(e.t)}] ${e.type === 'say' ? `Nurse said: "${e.label}"` : `Nurse did: ${e.label}`}`).join('\n'),
  });

  const pushPatient = (text, spontaneous = true) => { if (!text || !eng.current || eng.current.ended) return; text = text.trim().replace(/^"|"$/g, ''); eng.current.chat('patient', text); setChat(c => [...c, { role: 'patient', text, spontaneous }]); sayPatient(text); };

  // The patient answers/reacts to every action the nurse verbalizes (AI with a rule-based fallback)
  const reactToAction = async (id, finding, line) => {
    const snapNow = eng.current.snapshot();
    let text = settings.aiPatient === false ? null : await aiText('patient', reactionPrompt(sc, snapNow, id, finding, line, ctx()), { tier: 'quick' });
    if (!text) text = reactionFallback(sc, snapNow, id);
    pushPatient(text, false);
  };

  // Unprompted patient speech on a state change or when the nurse has been quiet
  const spontaneous = async (reason) => {
    if (!eng.current || eng.current.ended || idle.current.busy) return;
    idle.current.busy = true;
    try {
      const snapNow = eng.current.snapshot();
      let text = settings.aiPatient === false ? null : await aiText('patient', spontaneousPrompt(sc, snapNow, reason, ctx()), { tier: 'quick' });
      if (!text) text = spontaneousFallback(sc, snapNow, reason, pendingExpected());
      pushPatient(text, true);
      idle.current.lastSpont = eng.current.clock;
    } finally { idle.current.busy = false; }
  };

  const runDirector = async (lastId) => {
    if (settings.aiDirector === false || sc.aiDirector === false || directorBusy.current) return;
    const kind = lastId?.startsWith('med:') ? 'med' : ACTION_MAP[lastId]?.kind;
    if (kind === 'assess' && Math.random() < 0.6) return; // don't call the director for every assessment
    directorBusy.current = true;
    try {
      const e = eng.current;
      const recent = e.events.filter(x => x.type === 'action').slice(-12);
      const d = await aiText('director', directorPrompt(sc, e.snapshot(), recent, ctx()), { json: true, tier: 'quick' });
      if (d && !e.ended) {
        e.applyDirector(d);
        if (d.patientSays && d.transitionTo) pushPatient(d.patientSays, true); // the direct reaction to the action is spoken by reactToAction
        if (d.familySays && sc.family) { e.chat('family', d.familySays); setChat(c => [...c, { role: 'family', text: d.familySays, spontaneous: true }]); sayFamily(d.familySays); }
      }
    } finally { directorBusy.current = false; }
  };

  const send = async (e) => {
    e?.preventDefault();
    const text = msg.trim(); if (!text || !eng.current) return;
    const to = chatTo === 'family' && sc.family ? 'family' : 'patient';
    setMsg('');
    const hist = chatRef.current;
    setChat(c => [...c, { role: 'student', text, to }]); eng.current.chat('student', text, to);
    idle.current.lastActivity = eng.current.clock;
    sayNurse(text);
    setTyping(to);
    const snapNow = eng.current.snapshot();
    const streamer = sentenceStreamer((sentence) => (to === 'family' ? sayFamily(sentence) : sayPatient(sentence)));
    let streamed = false;
    const prompt = to === 'family' ? familyPrompt(sc, snapNow, hist, text, ctx()) : patientPrompt(sc, snapNow, hist, text, ctx());
    let reply = await aiText(to === 'family' ? 'family' : 'patient', prompt, { tier: 'quick', onText: ({ text: t }) => { streamed = true; streamer.push(t); } });
    if (!reply) { reply = to === 'family' ? familyFallback(sc, snapNow, text) : patientFallback(sc, snapNow, text); streamed = false; }
    reply = reply.trim().replace(/^"|"$/g, '');
    if (streamed) streamer.flush(reply); else (to === 'family' ? sayFamily(reply) : sayPatient(reply));
    eng.current.chat(to, reply, to); setChat(c => [...c, { role: to, text: reply }]); setTyping(null);
    if (to === 'family') sceneRef.current?.family?.setMood?.(/thank|relief|better|okay/i.test(reply) ? 0.5 : -0.2, /scared|worried|wrong/i.test(reply));
  };

  const finish = async () => {
    if (!(await confirmAsk('End the scenario and go to debrief? You can’t return to this attempt.', { okLabel: 'End & debrief' }))) return;
    cancelSpeech(); setAmbience(false);
    eng.current.end('Student ended scenario');
    setPhase('finishing');
    const evs = eng.current.events;
    if (preview) { setPreviewResult({ id: 'preview', scenarioId, scenarioTitle: sc.title, studentName: user.name, events: evs, result: scoreAttempt(sc, evs, { passingScore: settings.passingScore || 75 }), reflections: {} }); setPhase('done'); return; }
    try { const a = await api.finishAttempt(attempt.id, { events: evs }); nav('report', { attemptId: a.id, fresh: true }); } catch (err) { toast(err.message, 'bad'); setPhase('running'); }
  };

  if (phase === 'done' && previewResult) return <div class="page report-page"><div class="row between"><Badge tone="info">Instructor test run — not saved</Badge><Btn icon="arrowLeft" onClick={() => nav(route.params.from === 'builder' ? 'builder' : 'library', route.params.from === 'builder' ? { id: scenarioId } : {})}>Back</Btn></div><Report attempt={previewResult} scenario={sc} /></div>;

  const roomLabel = ROOM_PRESETS[sc.environment?.preset]?.label || 'Patient room';
  if (phase === 'prebrief') return <div class="prebrief">
    <div class="pb-card">
      <div class="pb-head"><button class="icon-btn light" aria-label="Exit" onClick={exit}><Icon name="arrowLeft" /></button><span class="eyebrow">{sc.course || sc.specialty} · {sc.specialty} · {sc.difficulty} · about {sc.durationMin} min{preview ? ' · instructor test run' : ''}</span></div>
      <h1>{sc.title}</h1>
      <p class="pb-sum">{sc.summary}</p>
      {sc.scope && <div class="pb-scope"><Icon name="shield" size={16} /><div><strong>Your role: {sc.program === 'LPN' ? 'LPN/LVN' : sc.program || 'Nurse'}</strong><p>{sc.scope}</p></div></div>}
      <div class="pb-grid">
        <section><h3>Report from the off-going nurse</h3>
          <dl class="sbar">{[['S', 'situation'], ['B', 'background'], ['A', 'assessment'], ['R', 'recommendation']].map(([l, k]) => <><dt>{l}</dt><dd>{sc.handoff[k]}</dd></>)}</dl>
          <h3>The room</h3>
          <p class="small">{roomLabel}. {sc.start?.monitor ? 'The patient is on the monitor. ' : 'The monitor is not attached. '}{sc.start?.o2 ? `Oxygen is running via ${sc.start.o2 === 'nc' ? 'nasal cannula' : 'non-rebreather mask'}. ` : ''}{sc.family ? `${sc.family.name}, the patient’s ${sc.family.relation}, is at the bedside — you can talk with ${sc.family.sex === 'F' ? 'her' : 'him'} too.` : 'No family is present right now.'}</p>
        </section>
        <section><h3>Your patient</h3>
          <div class="pb-patient"><img src={avatarThumb(p.appearance?.avatarId)} alt="" width="64" height="92" /><div>
            <p><strong>{p.name}</strong>, {p.age}-year-old {p.sex === 'F' ? (p.age < 13 ? 'girl' : 'female') : p.sex === 'M' ? (p.age < 13 ? 'boy' : 'male') : 'patient'} · {p.weightKg} kg</p>
            <p class="small">{p.diagnosis}</p>
            <p class="small"><span class="allergy">Allergies: {(p.allergies || []).join('; ')}</span></p>
            <p class="small">Code status: {p.codeStatus} · Isolation: {p.isolation}</p></div></div>
          <h3>Objectives</h3><ul>{sc.objectives.filter(Boolean).map(o => <li>{o}</li>)}</ul>
        </section>
      </div>
      <div class="pb-how small"><Icon name="volume" size={16} /> You’ll hear the patient{sc.family ? ' and family' : ''} speak, and your own voice as {nurse.name} when you act. {tts?.provider ? 'Studio voices are on.' : 'Voices use your device’s speech engine.'} <button class="linkish" onClick={() => setNurseModal(true)}>Change my nurse voice & name</button></div>
      <div class="pb-how small"><Icon name="eye" size={16} /> Click the patient to assess a body region, click equipment to use it, or use the action menu. Each action is spoken to the patient. Watch for cues — alarms, phone calls and family questions — and respond to them.</div>
      <div class="row end"><Btn kind="primary" icon="play" onClick={start}>Enter patient room</Btn></div>
    </div>
    {nurseModal && <NurseModal nurse={nurse} onClose={() => setNurseModal(false)} onSave={(n) => { setNurse(n); saveNurse(n); setNurseModal(false); }} />}
  </div>;

  const s = snap || {};
  const conn = !!s.revealed?.monitor;
  const actsByCat = (cat) => ACTIONS.filter(a => a.kind === cat);
  const logItems = events.filter(e => ['action', 'transition', 'chat', 'ai', 'note', 'event', 'say'].includes(e.type) && (preview || !['transition', 'ai'].includes(e.type)));
  const pickActions = pick?.kind === 'patient' ? REGION_ACTIONS[pick.region] : pick?.kind === 'equipment' ? (EQUIP_ACTIONS[pick.type] || []) : pick?.kind === 'family' ? ['family-include', 'family-update', 'cultural-prefs', 'reinforce-teaching'] : [];
  return <div class="sim">
    <header class="sim-top">
      <button class="icon-btn light" aria-label="Exit simulation" onClick={exit}><Icon name="arrowLeft" /></button>
      <div class="banner">
        <strong>{p.name}</strong><span>{p.age}{p.sex} · MRN {p.mrn} · DOB {p.dob}</span>
        <span class="chip-allergy"><Icon name="alert" size={14} /> {(p.allergies || []).join('; ')}</span>
        <span class="chip-code">{p.codeStatus}</span>{p.isolation && p.isolation !== 'Standard' && <span class="chip-iso">{p.isolation}</span>}
      </div>
      <button class="nurse-chip" onClick={() => setNurseModal(true)} title="Your nurse persona & voice"><img src={avatarThumb(nurse.avatarId)} alt="" /><span>{nurse.name}, LPN</span></button>
      <button class={`sound-btn${sound ? ' on' : ''}`} aria-pressed={sound} onClick={() => { const n = !sound; setAudio(n); setSound(n); if (n) { unlockAudio(); setAmbience(true); } }} title="Voices, auscultation and monitor tones"><Icon name={sound ? 'volume' : 'mute'} size={16} />{sound ? 'Sound on' : 'Sound off'}</button>
      <div class="sim-clock"><Icon name="clock" size={16} /><span class="num">{fmt(s.clock)}</span></div>
      {preview && <span class="op-state" title="Visible to instructors only">State: {s.stateName}</span>}
      <Btn kind="danger" icon="flag" onClick={finish} disabled={phase !== 'running'}>End scenario</Btn>
    </header>
    <div class="sim-body">
      <aside class="sim-actions" aria-label="Nursing actions">
        {ACTION_CATEGORIES.map(c => <div class={`acc${openCat === c.id ? ' open' : ''}`}>
          <button class="acc-head" aria-expanded={openCat === c.id} onClick={() => setOpenCat(openCat === c.id ? null : c.id)}><Icon name={c.icon} size={16} />{c.label}<span class="acc-n">{actsByCat(c.id).length}</span></button>
          {openCat === c.id && <div class="acc-body">{actsByCat(c.id).map(a => <button class={`act${eng.current?.performed.has(a.id) ? ' done' : ''}`} onClick={() => perform(a.id)}>{a.label}</button>)}</div>}
        </div>)}
        <div class={`acc${openCat === 'meds' ? ' open' : ''}`}>
          <button class="acc-head" aria-expanded={openCat === 'meds'} onClick={() => setOpenCat(openCat === 'meds' ? null : 'meds')}><Icon name="pill" size={16} />Medications<span class="acc-n">{sc.meds.length}</span></button>
          {openCat === 'meds' && <div class="acc-body">{sc.meds.map(m => <button class={`act${eng.current?.performed.has(`med:${m.id}`) ? ' done' : ''}`} onClick={() => setMedModal(m)}>{m.name} {m.dose} {m.route}{m.highAlert && <span class="ha">HIGH ALERT</span>}</button>)}</div>}
        </div>
      </aside>
      <div class="sim-stage">
        <Scene3D environment={env3d} patient={p} family={sc.family} apiRef={sceneRef} camera="bedside" onPick={(pk) => { if (pk.kind === 'family') { setPanel('patient'); setChatTo('family'); } setPick(pk); }} onHover={setHover} onReady={(api3d) => { if (sc.start?.o2) api3d.setO2(sc.start.o2); }} />
        <div class="cam-bar">{[['room', 'Room'], ['bedside', 'Bedside'], ['face', 'Patient'], ['monitor', 'Monitor'], ...(sc.family ? [['family', sc.family.relation[0].toUpperCase() + sc.family.relation.slice(1)]] : [])].map(([k, l]) => <button onClick={() => sceneRef.current?.setCamera(k)}>{l}</button>)}</div>
        <div class="state-strip"><span class="dot" />{s.cues}</div>
        {hover && !pick && <div class="hover-label" style={{ left: `${hover.x + 14}px`, top: `${hover.y + 14}px` }}>{hover.label}</div>}
        {speaking && <div class={`speaking sp-${speaking}`}><Icon name="volume" size={14} /> {speaking === 'nurse' ? `${nurse.name} (you)` : speaking === 'family' ? sc.family?.name : p.name.split(' ')[0]} is speaking…</div>}
        <div class="cue-stack">{cues.map(c => { const [ic, lbl] = EVENT_META[c.kind] || ['eye', 'Cue']; return <div class={`cue cue-${c.kind}`} role="status"><div class="row between"><span class="eyebrow"><Icon name={ic} size={13} /> {lbl} · {fmt(c.t)}</span><button class="icon-btn light" aria-label="Dismiss" onClick={() => setCues(x => x.filter(y => y.eventId !== c.eventId))}><Icon name="x" size={14} /></button></div><p>{c.label}</p>{c.respond?.length > 0 && <span class="small cue-hint">Respond with an action{c.kind === 'family' || c.kind === 'patient' ? ' or reply in the chat' : ''}.</span>}</div>; })}</div>
        {pick && <div class="pick-menu" style={{ left: `${Math.min(pick.x, window.innerWidth - 280)}px`, top: `${Math.min(pick.y, window.innerHeight - 340)}px` }}>
          <div class="row between"><strong>{pick.kind === 'patient' ? REGION_LABEL[pick.region] : pick.kind === 'family' ? sc.family?.name : (EQUIP_MAP[pick.type]?.name || pick.type)}</strong><button class="icon-btn light" aria-label="Close" onClick={() => setPick(null)}><Icon name="x" size={16} /></button></div>
          {pick.kind === 'family' && <button class="act" onClick={() => { setPanel('patient'); setChatTo('family'); setPick(null); }}><Icon name="chat" size={14} /> Talk with {sc.family.name.split(' ')[0]}</button>}
          {pick.kind === 'patient' && <button class="act" onClick={() => { setPanel('patient'); setChatTo('patient'); setPick(null); }}><Icon name="chat" size={14} /> Talk with {p.name.split(' ')[0]}</button>}
          {pickActions.map(id => <button class="act" onClick={() => perform(id)}>{ACTION_MAP[id]?.label}</button>)}
          {pick.kind === 'equipment' && !pickActions.length && <p class="small">Nothing to do with this item.</p>}
        </div>}
        {finding && <div class="finding" role="status"><div class="row between"><span class="eyebrow">{fmt(finding.t)} · result</span><button class="icon-btn light" aria-label="Dismiss" onClick={() => setFinding(null)}><Icon name="x" size={14} /></button></div><strong>{finding.title}</strong>{finding.text && <p>{finding.text}</p>}{finding.audio && <div class="ausc"><button onClick={() => { unlockAudio(); auscultate('lung'); if (!sound) toast('Turn sound on to hear auscultation', 'info'); }}><Icon name="steth" size={14} /> Play lung sounds</button><button onClick={() => { unlockAudio(); auscultate('heart'); if (!sound) toast('Turn sound on to hear auscultation', 'info'); }}><Icon name="heart" size={14} /> Play heart sounds</button><span class="small">Use headphones · 7 s</span></div>}</div>}
        <div class={`hud${conn ? '' : ' off'}`}><HudMonitor snapRef={snapRef} connected={conn} />{!conn && <span class="hud-note small">Monitor not attached</span>}</div>
      </div>
      <aside class="sim-panel">
        <Tabs tabs={[{ id: 'chart', label: 'EHR', icon: 'file' }, { id: 'patient', label: 'Talk', icon: 'chat', badge: chat.length || undefined }, { id: 'log', label: 'Log', icon: 'log' }]} value={panel} onChange={setPanel} />
        {panel === 'chart' && <div class="ehr">
          <div class="seg wrap">{[['summary', 'Summary'], ['orders', 'Orders'], ['mar', 'MAR'], ['labs', 'Labs'], ['vitals', 'Flowsheet'], ['notes', 'Notes']].map(([k, l]) => <button class={chartTab === k ? 'on' : ''} onClick={() => setChartTab(k)}>{l}</button>)}</div>
          {chartTab === 'summary' && <div class="ehr-sec"><p><strong>Diagnosis:</strong> {p.diagnosis}</p><p><strong>Chief complaint:</strong> {p.chiefComplaint}</p><p><strong>History:</strong> {p.history}</p><p><strong>Social:</strong> {p.social}</p><p><strong>Home medications:</strong></p><ul>{(p.homeMeds || []).map(m => <li>{m}</li>)}</ul>{sc.family && <p><strong>At the bedside:</strong> {sc.family.name} ({sc.family.relation})</p>}<h4>Hand-off</h4><dl class="sbar">{[['S', 'situation'], ['B', 'background'], ['A', 'assessment'], ['R', 'recommendation']].map(([l, k]) => <><dt>{l}</dt><dd>{sc.handoff[k]}</dd></>)}</dl></div>}
          {chartTab === 'orders' && <ul class="ehr-list">{sc.orders.map(o => <li><span class={`kind k-${o.type}`}>{o.type}</span>{o.text}</li>)}</ul>}
          {chartTab === 'mar' && <div class="ehr-list">{sc.meds.map(m => <div class="mar-row"><div><strong>{m.name}</strong> {m.dose} {m.route}{m.highAlert && <span class="ha">HIGH ALERT</span>}<span class="small muted">{m.freq} · {m.indication}</span>{m.caution && <span class="small caution">{m.caution}</span>}</div><Btn small onClick={() => setMedModal(m)}>Give…</Btn></div>)}</div>}
          {chartTab === 'labs' && (s.revealed?.labs || preview ? <table class="lab-table"><thead><tr><th>Test</th><th>Result</th><th>Ref</th></tr></thead><tbody>{sc.labs.map(l => <tr class={l.flag ? 'flag' : ''}><td>{l.name}</td><td><strong>{l.value}</strong> {l.unit} {l.flag && <span class="flagchip">{l.flag}</span>}</td><td class="small muted">{l.ref}</td></tr>)}</tbody></table> : <div class="ehr-sec"><p class="muted">Results are available. Select “Review labs & diagnostics” to open them — the review is part of your data collection.</p><Btn small onClick={() => perform('review-labs')}>Review labs now</Btn></div>)}
          {chartTab === 'vitals' && (flowsheet.length ? <table class="lab-table"><thead><tr><th>Time</th><th>BP</th><th>HR</th><th>RR</th><th>SpO₂</th><th>T</th></tr></thead><tbody>{flowsheet.map(v => <tr><td>{fmt(v.t)}</td><td>{Math.round(v.sbp)}/{Math.round(v.dbp)}</td><td>{Math.round(v.hr)}</td><td>{Math.round(v.rr)}</td><td>{Math.round(v.spo2)}</td><td>{v.temp.toFixed(1)}</td></tr>)}</tbody></table> : <p class="muted ehr-sec">No vital signs documented yet.</p>)}
          {chartTab === 'notes' && <form class="ehr-sec" onSubmit={e => { e.preventDefault(); if (!note.text.trim()) return; perform(note.type); eng.current.log({ type: 'note', label: `Nursing note (${ACTION_MAP[note.type].label})`, detail: note.text }); setNote({ ...note, text: '' }); toast('Note saved to chart', 'good'); }}>
            <Field label="Note type" id="n-type"><select id="n-type" value={note.type} onChange={e => setNote({ ...note, type: e.target.value })}><option value="doc-assessment">Data collection / assessment</option><option value="doc-intervention">Intervention & response</option><option value="doc-mar">Medication administration</option></select></Field>
            <Field label="Note" id="n-text"><textarea id="n-text" rows="5" value={note.text} onInput={e => setNote({ ...note, text: e.target.value })} placeholder="e.g., 1430 Pt reports… Data collected… Intervention… Response… RN notified." /></Field>
            <Btn kind="primary" type="submit" small>Save note</Btn>
            <ul class="notes">{events.filter(e => e.type === 'note').map(n => <li><span class="small muted">{fmt(n.t)}</span> {n.detail}</li>)}</ul>
          </form>}
        </div>}
        {panel === 'patient' && <div class="chat">
          {sc.family && <div class="seg chat-to"><button class={chatTo === 'patient' ? 'on' : ''} onClick={() => setChatTo('patient')}>{p.name.split(' ')[0]} (patient)</button><button class={chatTo === 'family' ? 'on' : ''} onClick={() => setChatTo('family')}>{sc.family.name.split(' ')[0]} ({sc.family.relation})</button></div>}
          <div class="chat-log" aria-live="polite" ref={logRef}>
            {!chat.length && <p class="muted small">Ask {p.name.split(' ')[0]} about symptoms, history, allergies or how {p.sex === 'F' ? 'she' : 'he'} feels. {sc.family ? `You can also talk with ${sc.family.name.split(' ')[0]}. ` : ''}Everything you type is spoken aloud in your nurse voice; every action you take is explained to the patient.</p>}
            {chat.map(c => <div class={`bubble ${c.role}${c.spontaneous ? ' spont' : ''}`}>{c.role === 'nurse' && <span class="who">You · {c.action ? 'while acting' : ''}</span>}{c.role === 'family' && <span class="who">{sc.family?.name.split(' ')[0]}</span>}{c.role === 'student' && c.to === 'family' && <span class="who">To {sc.family?.name.split(' ')[0]}</span>}{c.text}</div>)}
            {typing && <div class={`bubble ${typing} typing`}><span /><span /><span /></div>}
          </div>
          <form class="chat-in" onSubmit={send}><input aria-label="Message" value={msg} onInput={e => setMsg(e.target.value)} placeholder={`Say something to ${chatTo === 'family' && sc.family ? sc.family.name.split(' ')[0] : p.name.split(' ')[0]}…`} /><button class="icon-btn accent" aria-label="Send" type="submit"><Icon name="send" /></button></form>
        </div>}
        {panel === 'log' && <ol class="sim-log">{logItems.slice().reverse().map(e => <li class={`lg-${e.type}${e.harmful ? ' harm' : ''}`}><span class="num">{fmt(e.t)}</span><div><strong>{e.type === 'chat' ? (e.role === 'student' ? `You → ${e.to === 'family' ? sc.family?.name.split(' ')[0] : p.name.split(' ')[0]}` : e.role === 'family' ? sc.family?.name.split(' ')[0] : p.name.split(' ')[0]) : e.type === 'say' ? 'You said' : e.type === 'event' ? `${EVENT_META[e.kind]?.[1] || 'Cue'}` : e.label}</strong>{['chat', 'say', 'event'].includes(e.type) ? <p>{e.label}</p> : e.detail && <p>{e.detail}</p>}</div></li>)}</ol>}
      </aside>
    </div>
    {medModal && <MedModal med={medModal} patient={p} onClose={() => setMedModal(null)} onGive={(rights) => { perform(`med:${medModal.id}`, { rightsChecked: rights }); setMedModal(null); }} onHold={(reason) => { eng.current.log({ type: 'note', label: `Held ${medModal.name}`, detail: reason }); setMedModal(null); toast(`${medModal.name} held — remember to notify the RN`, 'info'); }} />}
    {sbar && <Modal title={sbar.rn ? 'Report to the RN — SBAR' : 'Call the provider — SBAR'} onClose={() => setSbar(null)} wide footer={<><Btn onClick={() => setSbar(null)}>Cancel</Btn><Btn kind="primary" icon="send" onClick={() => { const id = sbar.rn ? 'report-rn' : 'sbar-provider'; perform(id, { sbar }); eng.current.log({ type: 'note', label: sbar.rn ? 'SBAR to RN' : 'SBAR to provider', detail: `S: ${sbar.s}\nB: ${sbar.b}\nA: ${sbar.a}\nR: ${sbar.r}` }); setFinding({ title: sbar.rn ? 'RN response' : 'Provider response', text: sbar.rn ? 'Thanks — good catch. Keep doing what you’re doing, I’m coming to assess now. If anything changes before I get there, call me straight back.' : 'Thanks for the call. I agree — proceed with the protocol orders in the chart and page me with any change. I’ll be up to see the patient shortly.', t: eng.current.clock }); setSbar(null); }}>{sbar.rn ? 'Give report' : 'Place call'}</Btn></>}>
      <p class="small muted">{sbar.rn ? 'Structure your report to the RN. Reporting changes in condition is a core LPN responsibility; your SBAR is included in your debrief.' : 'Structure your call. Your SBAR is included in your debrief.'}</p>
      {[['s', 'Situation — what is happening now?'], ['b', 'Background — pertinent history'], ['a', 'Assessment — what you observed / think the problem is'], ['r', 'Recommendation — what you need']].map(([k, l]) => <Field label={l} id={`sb-${k}`}><textarea id={`sb-${k}`} rows="2" value={sbar[k]} onInput={e => setSbar({ ...sbar, [k]: e.target.value })} /></Field>)}
    </Modal>}
    {nurseModal && <NurseModal nurse={nurse} onClose={() => setNurseModal(false)} onSave={(n) => { setNurse(n); saveNurse(n); setNurseModal(false); }} />}
    {phase === 'finishing' && <div class="modal-back"><div class="modal"><div class="modal-body"><Spinner label="Scoring your performance…" /></div></div></div>}
  </div>;
}

export function NurseModal({ nurse, onClose, onSave }) {
  const [n, setN] = useState({ ...nurse });
  const preview = () => { unlockAudio(); cancelSpeech('nurse'); speakAs('nurse', `Hi, I’m ${n.name}, I’ll be your nurse today. I’m going to check your blood pressure now.`, { gender: n.gender, age: 32, accent: n.accent, style: 'calm, warm, professional nurse' }); };
  return <Modal title="Your nurse persona" onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn icon="volume" onClick={preview}>Hear my voice</Btn><Btn kind="primary" onClick={() => onSave(n)}>Save</Btn></>}>
    <p class="small muted">The patient hears everything you type and every action you take in this voice. Choose the name and voice that match you.</p>
    <div class="form-grid">
      <Field label="Name the patient hears" id="nu-name"><input id="nu-name" value={n.name} onInput={e => setN({ ...n, name: e.target.value })} /></Field>
      <Field label="Voice" id="nu-g"><select id="nu-g" value={n.gender} onChange={e => setN({ ...n, gender: e.target.value })}><option value="F">Female</option><option value="M">Male</option></select></Field>
      <Field label="Accent / language background" id="nu-a"><select id="nu-a" value={n.accent} onChange={e => setN({ ...n, accent: e.target.value })}>{ACCENT_OPTIONS.map(([k, l]) => <option value={k}>{l}</option>)}</select></Field>
    </div>
    <span class="field-label">Avatar</span>
    <div class="avatar-grid small-grid">{NURSE_AVATARS.map(a => <button class={`avatar-opt${n.avatarId === a.id ? ' on' : ''}`} onClick={() => setN({ ...n, avatarId: a.id, gender: a.sex })}><img src={avatarThumb(a.id)} alt={a.label} loading="lazy" /><span>{a.label}</span></button>)}</div>
  </Modal>;
}

function MedModal({ med, patient, onClose, onGive, onHold }) {
  const [r, setR] = useState({ patient: false, allergy: false, dose: false, route: false, time: false });
  const [hold, setHold] = useState('');
  const items = [['patient', 'Right patient — scanned wristband, verified name & DOB'], ['allergy', `Allergies checked against drug (${(patient.allergies || []).join('; ')})`], ['dose', `Right dose — ${med.dose}${patient.age < 13 ? ' (weight-based: verified with RN)' : ''}`], ['route', `Right route — ${med.route}`], ['time', `Right time — ${med.freq}`]];
  return <Modal title={`${med.name} ${med.dose} ${med.route}`} onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="default" icon="x" onClick={() => onHold(hold || 'Held for clarification')}>Hold & clarify with RN</Btn><Btn kind="primary" icon="pill" onClick={() => onGive(r)}>Administer</Btn></>}>
    <div class="med-info"><span class="kind k-med">{med.category}</span><p>{med.indication} · {med.freq}</p>{med.highAlert && <p class="ha-box"><Icon name="alert" size={16} /> High-alert medication — independent double check recommended.</p>}{med.caution && <p class="caution">{med.caution}</p>}</div>
    <h4>Medication rights</h4>
    <div class="check-list">{items.map(([k, l]) => <label class="check"><input type="checkbox" checked={r[k]} onChange={e => setR({ ...r, [k]: e.target.checked })} />{l}</label>)}</div>
    <Field label="If holding: reason (optional)" id="hold-r"><input id="hold-r" value={hold} onInput={e => setHold(e.target.value)} /></Field>
  </Modal>;
}
