import { h } from 'preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { api } from '../api/index.js';
import { useApp } from '../store.jsx';
import { Btn, Modal, Field, Badge, Empty, Icon, toast, confirmAsk, Tabs, Spinner } from '../ui/components.jsx';
import { Scene3D } from '../ui/Scene3D.jsx';
import { EQUIPMENT, EQUIP_MAP, ROOM_PRESETS, presetEnvironment } from '../data/equipment.js';
import { ACTIONS, ACTION_CATEGORIES, ACTION_MAP, actionLabel } from '../data/actions.js';
import { newScenario } from './Instructor.jsx';
import { aiText } from '../ai/client.js';
import { scenarioDraftPrompt } from '../ai/prompts.js';
import { AVATARS, avatarThumb } from '../three/avatar.js';
import { speakAs, cancelSpeech, ACCENT_OPTIONS } from '../sim/voice.js';
import { unlockAudio, speak, playLungs, playHeart, lungTypeFor, heartTypeFor, LUNG_TYPES, HEART_TYPES } from '../sim/audio.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const uid = (p) => `${p}${Math.random().toString(36).slice(2, 7)}`;
const SKIN = ['#f3d5c0', '#efc9ae', '#d7a98a', '#c68e6b', '#b98563', '#8d5a3b', '#6b4029', '#4a2b1c'];
const HAIR = ['#e8e4dc', '#bdb7ad', '#d9b36c', '#a0522d', '#6b4423', '#3a2a20', '#2a1d16', '#111111'];
const GOWN = ['#8fb3c9', '#b7a6cf', '#9bb89e', '#e3b7b0', '#e8d9a8', '#a9c3d9'];
const VITAL_FIELDS = [
  ['hr', 'Heart rate', 'bpm', 20, 200, 1], ['sbp', 'Systolic BP', 'mmHg', 40, 230, 1], ['dbp', 'Diastolic BP', 'mmHg', 20, 140, 1], ['rr', 'Resp. rate', '/min', 4, 50, 1],
  ['spo2', 'SpO₂', '%', 60, 100, 1], ['temp', 'Temp', '°C', 33, 42, 0.1], ['pain', 'Pain', '/10', 0, 10, 1], ['glucose', 'Glucose', 'mg/dL', 15, 600, 1],
];
const FINDINGS = [['neuro', 'Neuro / LOC'], ['resp', 'Respiratory'], ['cardio', 'Cardiovascular'], ['skin', 'Skin / wound'], ['pain', 'Pain'], ['gi', 'GI / abdomen'], ['gu', 'GU / output']];

export function Builder({ id }) {
  const { nav, load, data } = useApp();
  const [sc, setSc] = useState(null);
  const [tab, setTab] = useState('overview');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  useEffect(() => { (id ? api.getScenario(id) : Promise.resolve(newScenario())).then(s => setSc(clone(s))).catch(e => toast(e.message, 'bad')); }, [id]);
  if (!sc) return <div class="page"><Spinner label="Loading scenario…" /></div>;
  const up = (patch) => { setSc(s => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })); setDirty(true); };
  const issues = validate(sc);
  const save = async (status) => {
    setSaving(true);
    try {
      const body = { ...sc, status: status || sc.status };
      const r = await api.saveScenario(body);
      setSc(clone(r)); setDirty(false); load('scenarios');
      toast(status === 'published' ? 'Scenario published' : 'Scenario saved', 'good');
      if (!id && r.id) nav('builder', { id: r.id });
      return r;
    } catch (e) { toast(e.message, 'bad'); } finally { setSaving(false); }
  };
  const leave = async () => { if (!dirty || await confirmAsk('Leave without saving your changes?', { okLabel: 'Leave' })) nav('library'); };
  const preview = async () => { const r = dirty || !sc.id ? await save() : sc; if (r?.id) nav('player', { scenarioId: r.id, preview: true, from: 'builder' }); };
  const TABS = [
    { id: 'overview', label: 'Overview', icon: 'file' },
    { id: 'patient', label: 'Patient', icon: 'user' },
    { id: 'environment', label: '3D environment', icon: 'cube' },
    { id: 'flow', label: 'States & progression', icon: 'flow' },
    { id: 'scoring', label: 'Actions & scoring', icon: 'target' },
    { id: 'ehr', label: 'Hand-off & EHR', icon: 'pill' },
    { id: 'events', label: 'Cues & events', icon: 'bell' },
    { id: 'debrief', label: 'Debrief', icon: 'chat' },
  ];
  return <div class="builder">
    <header class="b-head">
      <button class="icon-btn" aria-label="Back to library" onClick={leave}><Icon name="arrowLeft" /></button>
      <div class="b-title"><input aria-label="Scenario title" value={sc.title} onInput={e => up({ title: e.target.value })} /><span class="small muted">{sc.status === 'published' ? 'Published' : 'Draft'}{dirty ? ' · unsaved changes' : ''}</span></div>
      <div class="b-actions">
        <Btn icon="sparkle" onClick={() => setAiOpen(true)}>AI draft</Btn>
        <Btn icon="play" onClick={preview}>Test run</Btn>
        <Btn icon="check" onClick={() => save()} disabled={saving}>Save</Btn>
        <Btn kind="primary" icon="flag" onClick={() => save('published')} disabled={saving || issues.some(i => i.level === 'error')} title={issues.filter(i => i.level === 'error').map(i => i.msg).join('\n')}>{sc.status === 'published' ? 'Update published' : 'Publish'}</Btn>
      </div>
    </header>
    <Tabs tabs={TABS.map(t => ({ ...t, badge: t.id === 'overview' && issues.length ? issues.length : undefined }))} value={tab} onChange={setTab} />
    <div class="b-body">
      {tab === 'overview' && <OverviewTab sc={sc} up={up} issues={issues} comps={data.competencies || []} />}
      {tab === 'patient' && <PatientTab sc={sc} up={up} />}
      {tab === 'environment' && <EnvironmentTab sc={sc} up={up} />}
      {tab === 'flow' && <FlowTab sc={sc} up={up} />}
      {tab === 'scoring' && <ScoringTab sc={sc} up={up} />}
      {tab === 'ehr' && <EhrTab sc={sc} up={up} />}
      {tab === 'events' && <EventsTab sc={sc} up={up} />}
      {tab === 'debrief' && <DebriefTab sc={sc} up={up} />}
    </div>
    {aiOpen && <AiDraftModal onClose={() => setAiOpen(false)} onDraft={(d) => { up(s => mergeDraft(s, d)); setTab('overview'); }} />}
  </div>;
}

function validate(sc) {
  const out = [];
  if (!sc.title?.trim()) out.push({ level: 'error', msg: 'Add a scenario title.' });
  if (!sc.states?.length) out.push({ level: 'error', msg: 'Add at least one patient state.' });
  if (!sc.states?.some(s => s.id === sc.initialStateId)) out.push({ level: 'error', msg: 'Choose an initial state.' });
  if (!sc.environment?.items?.some(i => i.type === 'bed' || i.type === 'stretcher')) out.push({ level: 'error', msg: 'Place a bed or stretcher in the 3D environment — the patient lies in it.' });
  if (!sc.expected?.length) out.push({ level: 'warn', msg: 'No expected actions — students can’t be scored.' });
  for (const t of sc.transitions || []) if (!sc.states.some(s => s.id === t.from) || !sc.states.some(s => s.id === t.to)) out.push({ level: 'error', msg: `Transition “${t.label || t.id}” points to a missing state.` });
  if (!sc.expected?.some(e => e.critical)) out.push({ level: 'warn', msg: 'Mark at least one expected action as critical.' });
  if (!sc.environment?.items?.some(i => i.type === 'monitor')) out.push({ level: 'warn', msg: 'No bedside monitor placed — students will only see vitals when they take them manually.' });
  if (!sc.handoff?.situation) out.push({ level: 'warn', msg: 'Write the SBAR hand-off students see in the pre-brief.' });
  return out;
}

function mergeDraft(s, d) {
  const meds = (d.meds || []).map(m => ({ ...m, id: String(m.id || uid('m')).replace(/[^a-z0-9-]/gi, '').toLowerCase() }));
  const states = (d.states || []).map((st, i) => ({ ...st, x: 60 + (i % 3) * 270, y: i === 2 ? 250 : 60, findings: st.findings || {} }));
  return {
    title: d.title || s.title, specialty: d.specialty || s.specialty, difficulty: d.difficulty || s.difficulty, summary: d.summary || '', objectives: d.objectives || s.objectives,
    patient: { ...s.patient, ...d.patient, appearance: s.patient.appearance, allergies: d.patient?.allergies || s.patient.allergies },
    handoff: d.handoff || s.handoff, meds, labs: d.labs || [], states: states.length ? states : s.states, initialStateId: states[0]?.id || s.initialStateId,
    transitions: (d.transitions || []).map(t => ({ ...t, id: uid('t') })),
    expected: (d.expected || []).map((e, i) => ({ ...e, key: `e${i + 1}`, actions: (e.actions || []).filter(a => ACTION_MAP[a] || a.startsWith('med:')) })).filter(e => e.actions.length),
    harmful: (d.harmful || []).filter(x => ACTION_MAP[x.actionId] || x.actionId?.startsWith('med:')),
    debrief: d.debrief || s.debrief,
    course: d.course || s.course, program: 'LPN', family: d.family ? { avatarId: d.family.sex === 'M' ? 'Male_Adult_13' : 'Female_Adult_09', seat: 'chair', ...d.family } : null,
    events: (d.events || []).map((e, i) => ({ ...e, id: e.id || `ev${i + 1}`, respond: (e.respond || []).filter(a => ACTION_MAP[a] || a.startsWith('med:')) })),
  };
}

function AiDraftModal({ onClose, onDraft }) {
  const [brief, setBrief] = useState('Post-operative day 1 hip replacement patient who develops a pulmonary embolism');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    setBusy(true); setErr('');
    const d = await aiText('scenario', scenarioDraftPrompt(brief, ACTIONS.map(a => a.id)), { json: true, tier: 'default' });
    setBusy(false);
    if (!d || !d.states) { setErr('AI could not draft a scenario right now. Check that AI is enabled and try again.'); return; }
    onDraft(d); toast('Draft generated — review every section before publishing', 'good'); onClose();
  };
  return <Modal title="Draft a scenario with AI" onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="sparkle" onClick={go} disabled={busy || !brief.trim()}>{busy ? 'Drafting… (up to a minute)' : 'Generate draft'}</Btn></>}>
    <p class="small muted">Describe the clinical situation, learner level and focus. AI drafts the patient, SBAR, EHR, three states with transitions, scoring and debrief questions. The 3D room and patient appearance are kept.</p>
    <Field label="Scenario brief" id="ai-brief"><textarea id="ai-brief" rows="4" value={brief} onInput={e => setBrief(e.target.value)} /></Field>
    {err && <div class="form-error">{err}</div>}
  </Modal>;
}

// ---------------- Overview ----------------
function OverviewTab({ sc, up, issues, comps }) {
  const setObj = (i, v) => up({ objectives: sc.objectives.map((o, j) => (j === i ? v : o)) });
  const toggleComp = (id) => up({ competencyIds: sc.competencyIds?.includes(id) ? sc.competencyIds.filter(x => x !== id) : [...(sc.competencyIds || []), id] });
  return <div class="b-grid">
    <section class="card">
      <h3>Scenario details</h3>
      <div class="form-grid">
        <Field label="Program level" id="o-prog"><select id="o-prog" value={sc.program || 'LPN'} onChange={e => up({ program: e.target.value })}><option value="LPN">LPN/LVN (practical nursing)</option><option value="LPN/RN">LPN & RN (dual level)</option><option value="RN">RN</option></select></Field>
        <Field label="Course" id="o-course"><select id="o-course" value={sc.course || 'Medical-Surgical Nursing'} onChange={e => up({ course: e.target.value })}>{['Fundamentals of Nursing', 'Medical-Surgical Nursing', 'Family-Centered Nursing', 'Mental Health Nursing', 'Geriatric Nursing', 'Pharmacology'].map(x => <option>{x}</option>)}</select></Field>
        <Field label="Specialty" id="o-spec"><input id="o-spec" list="specs" value={sc.specialty} onInput={e => up({ specialty: e.target.value })} /><datalist id="specs">{['Medical-Surgical', 'Emergency', 'Critical Care', 'Cardiac / Telemetry', 'Pediatrics', 'Maternal-Newborn', 'Mental Health', 'Community / Home Health', 'Fundamentals'].map(x => <option value={x} />)}</datalist></Field>
        <Field label="Difficulty" id="o-diff"><select id="o-diff" value={sc.difficulty} onChange={e => up({ difficulty: e.target.value })}>{['Beginner', 'Intermediate', 'Advanced'].map(x => <option>{x}</option>)}</select></Field>
        <Field label="Expected duration (min)" id="o-dur"><input id="o-dur" type="number" min="5" max="90" value={sc.durationMin} onInput={e => up({ durationMin: Number(e.target.value) })} /></Field>
        <Field label="AI scenario director" id="o-ai"><select id="o-ai" value={sc.aiDirector !== false ? '1' : '0'} onChange={e => up({ aiDirector: e.target.value === '1' })}><option value="1">On — AI adapts physiology to student actions</option><option value="0">Off — deterministic handlers only</option></select></Field>
      </div>
      <Field label="Summary (shown in library and pre-brief)" id="o-sum"><textarea id="o-sum" rows="3" value={sc.summary} onInput={e => up({ summary: e.target.value })} /></Field>
      <Field label="Scope-of-practice framing (shown in the pre-brief)" id="o-scope" hint="Tell the learner what is theirs to do as an LPN and what is reported to the RN."><textarea id="o-scope" rows="3" value={sc.scope || ''} onInput={e => up({ scope: e.target.value })} /></Field>
      <h4>Starting conditions</h4>
      <div class="form-grid">
        <Field label="Oxygen at start" id="o-o2"><select id="o-o2" value={sc.start?.o2 || ''} onChange={e => up({ start: { ...(sc.start || {}), o2: e.target.value || null } })}><option value="">Room air</option><option value="nc">Nasal cannula</option><option value="nrb">Non-rebreather</option></select></Field>
        <Field label="Monitor at start" id="o-mon"><select id="o-mon" value={sc.start?.monitor ? '1' : '0'} onChange={e => up({ start: { ...(sc.start || {}), monitor: e.target.value === '1' } })}><option value="0">Not attached</option><option value="1">Attached and displaying</option></select></Field>
        <Field label="Foley catheter" id="o-foley"><select id="o-foley" value={sc.start?.foley ? '1' : '0'} onChange={e => up({ start: { ...(sc.start || {}), foley: e.target.value === '1' } })}><option value="0">None</option><option value="1">In place (bag on bed frame)</option></select></Field>
      </div>
      <h4>Learning objectives</h4>
      {sc.objectives.map((o, i) => <div class="row gap"><input aria-label={`Objective ${i + 1}`} value={o} onInput={e => setObj(i, e.target.value)} /><Btn small kind="ghost" icon="trash" aria-label="Remove objective" onClick={() => up({ objectives: sc.objectives.filter((_, j) => j !== i) })} /></div>)}
      <Btn small icon="plus" onClick={() => up({ objectives: [...sc.objectives, ''] })}>Add objective</Btn>
    </section>
    <div class="stack">
      <section class="card">
        <h3>Readiness check</h3>
        {issues.length ? <ul class="issues">{issues.map(i => <li class={`iss-${i.level}`}><Icon name={i.level === 'error' ? 'alert' : 'flag'} size={16} />{i.msg}</li>)}</ul> : <p class="good-text"><Icon name="check" /> Ready to publish.</p>}
      </section>
      <section class="card">
        <h3>Target competencies</h3>
        <p class="small muted">Shown to students in the pre-brief. Scoring uses the competencies mapped to each expected action.</p>
        <div class="check-list">{comps.map(c => <label class="check"><input type="checkbox" checked={sc.competencyIds?.includes(c.id)} onChange={() => toggleComp(c.id)} /><span><code>{c.code}</code> {c.name}</span></label>)}</div>
      </section>
    </div>
  </div>;
}

// ---------------- Patient ----------------
function PatientTab({ sc, up }) {
  const p = sc.patient;
  const setP = (patch) => up({ patient: { ...p, ...patch } });
  const setA = (patch) => setP({ appearance: { ...p.appearance, ...patch } });
  const list = (k) => (p[k] || []).join('\n');
  const env = useMemo(() => ({ ...sc.environment }), [sc.environment]);
  return <div class="b-grid">
    <section class="card">
      <h3>Demographics & history</h3>
      <div class="form-grid">
        <Field label="Name" id="p-name"><input id="p-name" value={p.name} onInput={e => setP({ name: e.target.value })} /></Field>
        <Field label="Age" id="p-age"><input id="p-age" type="number" value={p.age} onInput={e => setP({ age: Number(e.target.value) })} /></Field>
        <Field label="Sex" id="p-sex"><select id="p-sex" value={p.sex} onChange={e => setP({ sex: e.target.value })}><option value="F">Female</option><option value="M">Male</option><option value="X">Other / unspecified</option></select></Field>
        <Field label="Weight (kg)" id="p-wt"><input id="p-wt" type="number" value={p.weightKg} onInput={e => setP({ weightKg: Number(e.target.value) })} /></Field>
        <Field label="MRN" id="p-mrn"><input id="p-mrn" value={p.mrn} onInput={e => setP({ mrn: e.target.value })} /></Field>
        <Field label="Date of birth" id="p-dob"><input id="p-dob" type="date" value={p.dob} onInput={e => setP({ dob: e.target.value })} /></Field>
        <Field label="Code status" id="p-code"><input id="p-code" value={p.codeStatus} onInput={e => setP({ codeStatus: e.target.value })} /></Field>
        <Field label="Isolation" id="p-iso"><input id="p-iso" value={p.isolation} onInput={e => setP({ isolation: e.target.value })} /></Field>
      </div>
      <Field label="Admitting diagnosis" id="p-dx"><input id="p-dx" value={p.diagnosis} onInput={e => setP({ diagnosis: e.target.value })} /></Field>
      <Field label="Chief complaint" id="p-cc"><input id="p-cc" value={p.chiefComplaint} onInput={e => setP({ chiefComplaint: e.target.value })} /></Field>
      <Field label="Allergies (one per line)" id="p-all"><textarea id="p-all" rows="2" value={list('allergies')} onInput={e => setP({ allergies: e.target.value.split('\n') })} /></Field>
      <Field label="Medical history" id="p-hx"><textarea id="p-hx" rows="2" value={p.history} onInput={e => setP({ history: e.target.value })} /></Field>
      <Field label="Social history" id="p-soc"><textarea id="p-soc" rows="2" value={p.social} onInput={e => setP({ social: e.target.value })} /></Field>
      <Field label="Home medications (one per line)" id="p-hm"><textarea id="p-hm" rows="3" value={list('homeMeds')} onInput={e => setP({ homeMeds: e.target.value.split('\n') })} /></Field>
    </section>
    <div class="stack">
      <section class="card">
        <h3>Patient avatar</h3>
        <p class="small muted">Photo-textured, fully rigged patients with facial expressions, breathing and lip-synced voice. Skin colour responds to oxygenation, perfusion and fever during the scenario.</p>
        <div class="preview-3d"><Scene3D environment={env} patient={p} camera="face" /></div>
        <div class="avatar-grid" role="radiogroup" aria-label="Patient avatar">{AVATARS.map(a => <button role="radio" aria-checked={p.appearance.avatarId === a.id} class={`avatar-opt${p.appearance.avatarId === a.id ? ' on' : ''}`} onClick={() => setA({ avatarId: a.id })} title={a.label}><img src={avatarThumb(a.id)} alt={a.label} loading="lazy" /><span>{a.label}</span></button>)}</div>
        <div class="swatch-row"><span class="field-label">Gown</span><div class="swatches">{GOWN.map(c => <button class={`sw${p.appearance.gown === c ? ' on' : ''}`} style={{ background: c }} aria-label={`Gown ${c}`} onClick={() => setA({ gown: c })} />)}</div></div>
        <div class="row gap wrap"><Btn small icon="volume" onClick={() => { unlockAudio(); speak(`Hi, I'm ${p.name.split(' ')[0]}. ${p.chiefComplaint || 'Nice to meet you.'}`, { sex: p.sex, age: p.age }); }}>Hear patient voice</Btn><span class="credit">Avatars: Microsoft Rocketbox library (MIT license).</span></div>
      </section>
      <section class="card">
        <h3>AI patient persona & voice</h3>
        <p class="small muted">The AI patient speaks in character using this persona, the current state’s cues and findings, and the conversation so far. The voice is matched to sex, age, and language background.</p>
        <Field label="Personality & speech style" id="p-pers"><textarea id="p-pers" rows="3" value={p.personality} onInput={e => setP({ personality: e.target.value })} /></Field>
        <VoiceFields voice={{ gender: p.sex === 'X' ? 'F' : p.sex, age: p.age, accent: 'en-US', ...(p.voice || {}) }} onChange={(v) => setP({ voice: v })} sample={`Hi… I’m ${p.name.split(' ')[0]}. ${p.chiefComplaint || 'Nice to meet you.'}`} idp="pv" />
        <h3>Family member at the bedside</h3>
        <p class="small muted">A seated family member who talks, reacts to your care and asks questions. Family-centered care actions apply to them.</p>
        {sc.family ? <div>
          <div class="form-grid">
            <Field label="Name" id="f-name"><input id="f-name" value={sc.family.name} onInput={e => up({ family: { ...sc.family, name: e.target.value } })} /></Field>
            <Field label="Relationship" id="f-rel"><input id="f-rel" value={sc.family.relation} onInput={e => up({ family: { ...sc.family, relation: e.target.value } })} /></Field>
            <Field label="Age" id="f-age"><input id="f-age" type="number" value={sc.family.age} onInput={e => up({ family: { ...sc.family, age: Number(e.target.value), voice: { ...(sc.family.voice || {}), age: Number(e.target.value) } } })} /></Field>
            <Field label="Sex" id="f-sex"><select id="f-sex" value={sc.family.sex} onChange={e => up({ family: { ...sc.family, sex: e.target.value, voice: { ...(sc.family.voice || {}), gender: e.target.value } } })}><option value="F">Female</option><option value="M">Male</option></select></Field>
          </div>
          <Field label="Personality, concerns and what they know" id="f-pers"><textarea id="f-pers" rows="3" value={sc.family.personality} onInput={e => up({ family: { ...sc.family, personality: e.target.value } })} /></Field>
          <span class="field-label">Avatar</span>
          <div class="avatar-grid">{AVATARS.filter(a => !a.age).map(a => <button class={`avatar-opt${sc.family.avatarId === a.id ? ' on' : ''}`} onClick={() => up({ family: { ...sc.family, avatarId: a.id, sex: a.sex, voice: { ...(sc.family.voice || {}), gender: a.sex } } })} title={a.label}><img src={avatarThumb(a.id)} alt={a.label} loading="lazy" /><span>{a.label}</span></button>)}</div>
          <VoiceFields voice={{ gender: sc.family.sex, age: sc.family.age, accent: 'en-US', ...(sc.family.voice || {}) }} onChange={(v) => up({ family: { ...sc.family, voice: v } })} sample={`Hello — I’m ${sc.family.name.split(' ')[0]}, ${p.name.split(' ')[0]}’s ${sc.family.relation}. Is ${p.sex === 'F' ? 'she' : 'he'} going to be all right?`} idp="fv" />
          <Btn small kind="ghost" icon="trash" onClick={() => up({ family: null })}>Remove family member</Btn>
        </div> : <Btn small icon="plus" onClick={() => up({ family: { name: 'Family member', relation: 'spouse', age: 50, sex: 'F', avatarId: 'Female_Adult_09', seat: 'chair', personality: 'Worried, asks practical questions, wants to help.', voice: { gender: 'F', age: 50, accent: 'en-US', style: 'warm, worried' } } })}>Add a family member</Btn>}
        <h4>Scripted responses (fallback when AI is off)</h4>
        {(sc.script || []).map((l, i) => <div class="script-row">
          <input aria-label="Keywords" placeholder="keywords, comma separated" value={l.k.join(', ')} onInput={e => up({ script: sc.script.map((x, j) => (j === i ? { ...x, k: e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) } : x)) })} />
          <input aria-label="Response" placeholder="Patient says…" value={l.r} onInput={e => up({ script: sc.script.map((x, j) => (j === i ? { ...x, r: e.target.value } : x)) })} />
          <Btn small kind="ghost" icon="trash" aria-label="Remove line" onClick={() => up({ script: sc.script.filter((_, j) => j !== i) })} />
        </div>)}
        <Btn small icon="plus" onClick={() => up({ script: [...(sc.script || []), { k: [], r: '' }] })}>Add response</Btn>
      </section>
    </div>
  </div>;
}

// ---------------- Environment (drag & drop 3D) ----------------
function EnvironmentTab({ sc, up }) {
  const env = sc.environment;
  const [sel, setSel] = useState(null);
  const sceneRef = useRef(null);
  const setEnv = (patch) => up({ environment: { ...env, ...patch } });
  const item = env.items.find(i => i.uid === sel);
  const setItem = (patch) => setEnv({ items: env.items.map(i => (i.uid === sel ? { ...i, ...patch, props: { ...i.props, ...(patch.props || {}) } } : i)) });
  const addItem = (type) => { const it = { uid: uid('it-'), type, x: 0.5 + Math.random(), z: 0.5 + Math.random(), rot: 0, props: { ...(EQUIP_MAP[type]?.props || {}) } }; setEnv({ items: [...env.items, it] }); setSel(it.uid); };
  const cats = [...new Set(EQUIPMENT.map(e => e.cat))];
  useEffect(() => { sceneRef.current?.select(sel); }, [sel, env]);
  const onKey = (e) => {
    if (!sel || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { setEnv({ items: env.items.filter(i => i.uid !== sel) }); setSel(null); }
    if (e.key === 'r' || e.key === 'R') setItem({ rot: (item.rot || 0) + Math.PI / 12 });
  };
  useEffect(() => { window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); });
  const envForScene = useMemo(() => env, [env]);
  return <div class="env-editor">
    <aside class="palette" aria-label="Equipment palette">
      <h4>Equipment</h4>
      <p class="small muted">Drag into the room, or click to add.</p>
      {cats.map(c => <div class="pal-group"><span class="eyebrow">{c}</span>
        {EQUIPMENT.filter(e => e.cat === c).map(e => <button class="pal-item" draggable onDragStart={ev => { ev.dataTransfer.setData('text/simward-equipment', e.type); ev.dataTransfer.effectAllowed = 'copy'; }} onClick={() => addItem(e.type)}><Icon name="cube" size={15} />{e.name}</button>)}
      </div>)}
    </aside>
    <div class="env-stage">
      <Scene3D environment={envForScene} patient={sc.patient} editable apiRef={sceneRef} onSelect={setSel} onChange={(items, u) => { setEnv({ items }); setSel(u); }} />
      <div class="stage-tools">
        {['room', 'top', 'bedside', 'face'].map(c => <button onClick={() => sceneRef.current?.setCamera(c)}>{c === 'top' ? 'Top-down' : c[0].toUpperCase() + c.slice(1)}</button>)}
      </div>
      <div class="stage-hint small">Drag items to move · R rotates · Delete removes · right-drag pans</div>
    </div>
    <aside class="inspector">
      <h4>Room</h4>
      <Field label="Preset" id="e-preset"><select id="e-preset" value={env.preset} onChange={async e => { const k = e.target.value; if (await confirmAsk(`Replace the room with the “${ROOM_PRESETS[k].label}” preset? Placed equipment will be replaced.`, { okLabel: 'Replace room' })) { setEnv(presetEnvironment(k)); setSel(null); } }}>{Object.entries(ROOM_PRESETS).map(([k, v]) => <option value={k}>{v.label}</option>)}</select></Field>
      <div class="color-row"><label>Walls<input type="color" value={env.wallColor} onInput={e => setEnv({ wallColor: e.target.value })} /></label><label>Accent<input type="color" value={env.accentColor} onInput={e => setEnv({ accentColor: e.target.value })} /></label><label>Floor<input type="color" value={env.floorColor} onInput={e => setEnv({ floorColor: e.target.value })} /></label></div>
      <Field label="Lighting" id="e-light"><select id="e-light" value={env.lighting} onChange={e => setEnv({ lighting: e.target.value })}><option value="day">Daylight</option><option value="bright">Bright clinical</option><option value="dim">Dim / evening</option><option value="night">Night shift</option></select></Field>
      <hr />
      {item ? <div class="insp-item">
        <h4>{EQUIP_MAP[item.type]?.name}</h4>
        <Field label={`Rotation ${Math.round(((item.rot || 0) * 180) / Math.PI) % 360}°`} id="i-rot"><input id="i-rot" type="range" min="-180" max="180" step="15" value={Math.round(((item.rot || 0) * 180) / Math.PI)} onInput={e => setItem({ rot: (Number(e.target.value) * Math.PI) / 180 })} /></Field>
        <div class="form-grid tight">
          <Field label="X (m)" id="i-x"><input id="i-x" type="number" step="0.05" value={item.x.toFixed(2)} onInput={e => setItem({ x: Number(e.target.value) })} /></Field>
          <Field label="Z (m)" id="i-z"><input id="i-z" type="number" step="0.05" value={item.z.toFixed(2)} onInput={e => setItem({ z: Number(e.target.value) })} /></Field>
        </div>
        {(item.type === 'bed' || item.type === 'stretcher') && <Field label={`Head of bed ${item.props.hob ?? 30}°`} id="i-hob"><input id="i-hob" type="range" min="0" max="80" step="5" value={item.props.hob ?? 30} onInput={e => setItem({ props: { hob: Number(e.target.value) } })} /></Field>}
        {item.type === 'bed' && <label class="check"><input type="checkbox" checked={item.props.rails !== false} onChange={e => setItem({ props: { rails: e.target.checked } })} /> Side rails up</label>}
        {item.type === 'ivpole' && <Field label="IV bags" id="i-bags"><select id="i-bags" value={item.props.bags || 1} onChange={e => setItem({ props: { bags: Number(e.target.value) } })}>{[1, 2, 3].map(n => <option value={n}>{n}</option>)}</select></Field>}
        {['chair', 'curtain', 'bed'].includes(item.type) && <label class="color-row"><span>Color</span><input type="color" value={item.props.color || '#888888'} onInput={e => setItem({ props: { color: e.target.value } })} /></label>}
        <div class="row gap"><Btn small icon="copy" onClick={() => { const c = { ...clone(item), uid: uid('it-'), x: item.x + 0.4 }; setEnv({ items: [...env.items, c] }); setSel(c.uid); }}>Duplicate</Btn><Btn small kind="danger" icon="trash" onClick={() => { setEnv({ items: env.items.filter(i => i.uid !== sel) }); setSel(null); }}>Remove</Btn></div>
      </div> : <p class="small muted">Select an item in the room to edit it.</p>}
      <hr />
      <h4>In this room ({env.items.length})</h4>
      <ul class="item-list">{env.items.map(i => <li><button class={i.uid === sel ? 'on' : ''} onClick={() => setSel(i.uid)}>{EQUIP_MAP[i.type]?.name || i.type}</button></li>)}</ul>
    </aside>
  </div>;
}

// ---------------- States & progression (node canvas) ----------------
function FlowTab({ sc, up }) {
  const [sel, setSel] = useState(sc.initialStateId);
  const [link, setLink] = useState(null); // {from, x, y}
  const [editT, setEditT] = useState(null);
  const canvas = useRef(null);
  const st = sc.states.find(s => s.id === sel);
  const setSt = (patch) => up({ states: sc.states.map(s => (s.id === sel ? { ...s, ...patch } : s)) });
  const addState = () => { const id = `s${Date.now().toString(36).slice(-4)}`; const base = clone(sc.states.find(s => s.id === sel) || sc.states[0]); up({ states: [...sc.states, { ...base, id, name: 'New state', x: 80 + sc.states.length * 40, y: 300 }] }); setSel(id); };
  const delState = async () => { if (sc.states.length < 2) return toast('A scenario needs at least one state', 'bad'); if (await confirmAsk(`Delete state “${st.name}” and its transitions?`, { okLabel: 'Delete', danger: true })) { up({ states: sc.states.filter(s => s.id !== sel), transitions: sc.transitions.filter(t => t.from !== sel && t.to !== sel), initialStateId: sc.initialStateId === sel ? sc.states.find(s => s.id !== sel).id : sc.initialStateId }); setSel(sc.states.find(s => s.id !== sel).id); } };
  const dragNode = (e, s) => {
    if (e.target.closest('.port')) return;
    const r = canvas.current.getBoundingClientRect(); const ox = e.clientX - r.left - s.x, oy = e.clientY - r.top - s.y;
    setSel(s.id);
    const move = (ev) => { const x = Math.max(0, ev.clientX - r.left - ox + canvas.current.scrollLeft * 0), y = Math.max(0, ev.clientY - r.top - oy); up(sc2 => ({ states: sc2.states.map(z => (z.id === s.id ? { ...z, x: Math.round(x), y: Math.round(y) } : z)) })); };
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop);
  };
  const startLink = (e, s) => {
    e.stopPropagation();
    const r = canvas.current.getBoundingClientRect();
    setLink({ from: s.id, x: e.clientX - r.left, y: e.clientY - r.top });
    const move = (ev) => setLink(l => l && ({ ...l, x: ev.clientX - r.left, y: ev.clientY - r.top }));
    const stop = (ev) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop);
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-state]');
      const to = el?.getAttribute('data-state');
      setLink(null);
      if (to && to !== s.id) { const t = { id: uid('t'), from: s.id, to, label: 'New handler', trigger: { type: 'actions', mode: 'all', actions: [] } }; up(sc2 => ({ transitions: [...sc2.transitions, t] })); setEditT(t); }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop);
  };
  const NW = 250, NH = 96;
  const center = (s) => [s.x + NW / 2, s.y + NH / 2];
  const edge = (a, b) => {
    const [x1, y1] = center(a), [x2, y2] = center(b);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const clipA = Math.min(NW / 2 / Math.abs(dx / len || 1e-9), NH / 2 / Math.abs(dy / len || 1e-9)), clipB = clipA;
    return [x1 + dx / len * clipA, y1 + dy / len * clipA, x2 - dx / len * (clipB + 6), y2 - dy / len * (clipB + 6)];
  };
  return <div class="flow-wrap">
    <div class="flow-canvas" ref={canvas}>
      <svg class="flow-svg" width="1200" height="620">
        <defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" class="arrowhead" /></marker></defs>
        {sc.transitions.map((t, i) => {
          const a = sc.states.find(s => s.id === t.from), b = sc.states.find(s => s.id === t.to); if (!a || !b) return null;
          const back = sc.transitions.some(o => o.from === t.to && o.to === t.from);
          const dup = sc.transitions.filter(o => o.from === t.from && o.to === t.to).indexOf(t);
          let [x1, y1, x2, y2] = edge(a, b);
          const nx = -(y2 - y1), ny = x2 - x1, nl = Math.hypot(nx, ny) || 1;
          const off = (back ? 22 : 0) + dup * 26;
          const mx = (x1 + x2) / 2 + nx / nl * off * 1.6, my = (y1 + y2) / 2 + ny / nl * off * 1.6;
          const tone = t.trigger.type === 'time' ? 'time' : t.trigger.type === 'vital' ? 'vital' : 'act';
          return <g class={`edge e-${tone}`} onClick={() => setEditT(t)}>
            <path d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} marker-end="url(#arr)" />
            <text x={(x1 + 2 * mx + x2) / 4} y={(y1 + 2 * my + y2) / 4 - 6} text-anchor="middle">{t.trigger.type === 'time' ? `⏱ ${t.trigger.seconds}s` : t.trigger.type === 'vital' ? `${t.trigger.vital} ${t.trigger.op} ${t.trigger.value}` : `${(t.trigger.actions || []).length} action${(t.trigger.actions || []).length === 1 ? '' : 's'} (${t.trigger.mode})`}</text>
          </g>;
        })}
        {link && (() => { const a = sc.states.find(s => s.id === link.from); const [x, y] = center(a); return <line class="link-draft" x1={x} y1={y} x2={link.x} y2={link.y} />; })()}
      </svg>
      {sc.states.map(s => <div data-state={s.id} class={`node${s.id === sel ? ' on' : ''}${s.id === sc.initialStateId ? ' initial' : ''}`} style={{ left: `${s.x}px`, top: `${s.y}px`, width: `${NW}px` }} onPointerDown={e => dragNode(e, s)}>
        {s.id === sc.initialStateId && <span class="node-start">START</span>}
        <strong>{s.name}</strong>
        <span class="node-vitals">HR {s.vitals.hr} · BP {s.vitals.sbp}/{s.vitals.dbp} · SpO₂ {s.vitals.spo2}%</span>
        <span class="node-vitals">RR {s.vitals.rr} · T {s.vitals.temp} · {s.vitals.loc}</span>
        <button class="port" title="Drag to another state to add a transition" aria-label="Add transition" onPointerDown={e => startLink(e, s)} />
      </div>)}
    </div>
    <aside class="flow-side">
      <div class="row between"><h4>State</h4><div class="row gap"><Btn small icon="plus" onClick={addState}>Add state</Btn></div></div>
      {st && <>
        <Field label="Name" id="st-name"><input id="st-name" value={st.name} onInput={e => setSt({ name: e.target.value })} /></Field>
        <label class="check"><input type="checkbox" checked={sc.initialStateId === st.id} onChange={() => up({ initialStateId: st.id })} /> Scenario starts in this state</label>
        <Field label="Visible cues (drives 3D appearance & AI)" id="st-cues" hint="Words like diaphoretic, clammy or sweaty make the 3D patient’s skin glisten."><textarea id="st-cues" rows="2" value={st.cues} onInput={e => setSt({ cues: e.target.value })} /></Field>
        <h4>Vital signs targets</h4>
        <div class="vitals-edit">{VITAL_FIELDS.map(([k, label, unit, min, max, step]) => <label class="vrow"><span>{label}</span><input type="range" min={min} max={max} step={step} value={st.vitals[k]} onInput={e => setSt({ vitals: { ...st.vitals, [k]: Number(e.target.value) } })} aria-label={label} /><input type="number" class="vnum" min={min} max={max} step={step} value={st.vitals[k]} onInput={e => setSt({ vitals: { ...st.vitals, [k]: Number(e.target.value) } })} aria-label={`${label} value`} /><em>{unit}</em></label>)}</div>
        <div class="form-grid">
          <Field label="Level of consciousness" id="st-loc"><input id="st-loc" list="locs" value={st.vitals.loc} onInput={e => setSt({ vitals: { ...st.vitals, loc: e.target.value } })} /><datalist id="locs">{['Alert', 'Alert, anxious', 'Confused', 'Drowsy', 'Lethargic', 'Responds to pain only', 'Unresponsive'].map(x => <option value={x} />)}</datalist></Field>
          <Field label="Rhythm" id="st-rhy"><input id="st-rhy" list="rhythms" value={st.vitals.rhythm} onInput={e => setSt({ vitals: { ...st.vitals, rhythm: e.target.value } })} /><datalist id="rhythms">{['Sinus rhythm', 'Sinus tachycardia', 'Sinus bradycardia', 'Atrial fibrillation', 'Atrial fibrillation RVR'].map(x => <option value={x} />)}</datalist></Field>
        </div>
        <h4>Auscultation audio</h4>
        <div class="form-grid">
          <Field label="Lung sounds" id="st-lung"><select id="st-lung" value={st.sounds?.lung || ''} onChange={e => setSt({ sounds: { ...st.sounds, lung: e.target.value || undefined } })}><option value="">Auto from findings ({LUNG_TYPES[lungTypeFor({ findings: st.findings })]})</option>{Object.entries(LUNG_TYPES).map(([k, l]) => <option value={k}>{l}</option>)}</select></Field>
          <Field label="Heart sounds" id="st-heart"><select id="st-heart" value={st.sounds?.heart || ''} onChange={e => setSt({ sounds: { ...st.sounds, heart: e.target.value || undefined } })}><option value="">Auto from findings ({HEART_TYPES[heartTypeFor({ findings: st.findings, vitals: st.vitals })]})</option>{Object.entries(HEART_TYPES).map(([k, l]) => <option value={k}>{l}</option>)}</select></Field>
        </div>
        <div class="row gap"><Btn small icon="steth" onClick={() => { unlockAudio(); playLungs(lungTypeFor(st), st.vitals.rr, 6); }}>Preview lungs</Btn><Btn small icon="heart" onClick={() => { unlockAudio(); playHeart(heartTypeFor(st), st.vitals.hr, 6); }}>Preview heart</Btn></div>
        <h4>Assessment findings</h4>
        {FINDINGS.map(([k, l]) => <Field label={l} id={`f-${k}`}><textarea id={`f-${k}`} rows="2" value={st.findings?.[k] || ''} onInput={e => setSt({ findings: { ...st.findings, [k]: e.target.value } })} /></Field>)}
        <Btn small kind="danger" icon="trash" onClick={delState}>Delete state</Btn>
      </>}
      <hr />
      <h4>Transitions</h4>
      <p class="small muted">Drag from a state’s port (the dot) to another state to add a handler. Click an arrow to edit it.</p>
      <ul class="t-list">{sc.transitions.map(t => <li><button onClick={() => setEditT(t)}><strong>{sc.states.find(s => s.id === t.from)?.name}</strong> → <strong>{sc.states.find(s => s.id === t.to)?.name}</strong><span class="small muted">{t.label}</span></button></li>)}</ul>
    </aside>
    {editT && <TransitionModal sc={sc} t={editT} onClose={() => setEditT(null)} onSave={(t) => { up({ transitions: sc.transitions.map(x => (x.id === t.id ? t : x)) }); setEditT(null); }} onDelete={() => { up({ transitions: sc.transitions.filter(x => x.id !== editT.id) }); setEditT(null); }} />}
  </div>;
}

function ActionPicker({ sc, value = [], onChange, placeholder = 'Add action…' }) {
  const [q, setQ] = useState('');
  const all = [...ACTIONS.map(a => ({ id: a.id, label: a.label, cat: a.kind })), ...(sc.meds || []).map(m => ({ id: `med:${m.id}`, label: `Administer ${m.name} ${m.dose} ${m.route}`, cat: 'med' }))];
  const hits = q ? all.filter(a => a.label.toLowerCase().includes(q.toLowerCase()) && !value.includes(a.id)).slice(0, 8) : [];
  return <div class="picker">
    <div class="chips">{value.map(id => <span class="chip">{actionLabel(id, sc)}<button aria-label="Remove" onClick={() => onChange(value.filter(v => v !== id))}>×</button></span>)}</div>
    <input value={q} placeholder={placeholder} aria-label={placeholder} onInput={e => setQ(e.target.value)} />
    {hits.length > 0 && <ul class="picker-list">{hits.map(a => <li><button onClick={() => { onChange([...value, a.id]); setQ(''); }}><span class={`kind k-${a.cat}`}>{a.cat}</span>{a.label}</button></li>)}</ul>}
  </div>;
}

function TransitionModal({ sc, t, onClose, onSave, onDelete }) {
  const [x, setX] = useState(clone(t));
  const tr = x.trigger;
  const setTr = (p) => setX({ ...x, trigger: { ...tr, ...p } });
  return <Modal title="Transition handler" onClose={onClose} wide footer={<><Btn kind="danger" icon="trash" onClick={onDelete}>Delete</Btn><span class="grow" /><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={() => onSave(x)}>Save handler</Btn></>}>
    <div class="form-grid">
      <Field label="From" id="t-from"><select id="t-from" value={x.from} onChange={e => setX({ ...x, from: e.target.value })}>{sc.states.map(s => <option value={s.id}>{s.name}</option>)}</select></Field>
      <Field label="To" id="t-to"><select id="t-to" value={x.to} onChange={e => setX({ ...x, to: e.target.value })}>{sc.states.map(s => <option value={s.id}>{s.name}</option>)}</select></Field>
      <Field label="Label" id="t-label"><input id="t-label" value={x.label} onInput={e => setX({ ...x, label: e.target.value })} /></Field>
      <Field label="Trigger" id="t-type"><select id="t-type" value={tr.type} onChange={e => setX({ ...x, trigger: e.target.value === 'time' ? { type: 'time', seconds: 300 } : e.target.value === 'vital' ? { type: 'vital', vital: 'spo2', op: '<', value: 88 } : { type: 'actions', mode: 'all', actions: [] } })}><option value="actions">Student actions</option><option value="time">Time in state (trend)</option><option value="vital">Vital sign threshold</option></select></Field>
    </div>
    {tr.type === 'actions' && <>
      <Field label="Fires when the student has performed" id="t-mode"><select id="t-mode" value={tr.mode} onChange={e => setTr({ mode: e.target.value })}><option value="all">ALL of these actions (anytime in the run)</option><option value="any">ANY of these actions (while in this state)</option></select></Field>
      <ActionPicker sc={sc} value={tr.actions} onChange={(actions) => setTr({ actions })} />
    </>}
    {tr.type === 'time' && <Field label="Seconds in the ‘from’ state before transitioning" id="t-sec" hint="Use for untreated deterioration."><input id="t-sec" type="number" min="10" value={tr.seconds} onInput={e => setTr({ seconds: Number(e.target.value) })} /></Field>}
    {tr.type === 'vital' && <div class="form-grid">
      <Field label="Vital" id="t-v"><select id="t-v" value={tr.vital} onChange={e => setTr({ vital: e.target.value })}>{VITAL_FIELDS.map(([k, l]) => <option value={k}>{l}</option>)}</select></Field>
      <Field label="Operator" id="t-op"><select id="t-op" value={tr.op} onChange={e => setTr({ op: e.target.value })}><option value="<">below</option><option value=">">above</option></select></Field>
      <Field label="Value" id="t-val"><input id="t-val" type="number" value={tr.value} onInput={e => setTr({ value: Number(e.target.value) })} /></Field>
    </div>}
  </Modal>;
}

// ---------------- Scoring (drag actions into expected / harmful) ----------------
function ScoringTab({ sc, up }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [over, setOver] = useState(null);
  const medActs = (sc.meds || []).map(m => ({ id: `med:${m.id}`, label: `Administer ${m.name} ${m.dose} ${m.route}`, kind: 'med' }));
  const pool = [...ACTIONS, ...medActs].filter(a => (cat === 'all' || a.kind === cat) && (!q || a.label.toLowerCase().includes(q.toLowerCase())));
  const addExpected = (id) => up({ expected: [...sc.expected, { key: uid('e'), actions: [id], points: 5, critical: false }] });
  const addHarm = (id) => { if (!sc.harmful.some(h => h.actionId === id)) up({ harmful: [...sc.harmful, { actionId: id, penalty: 10, critical: false, rationale: '' }] }); };
  const drop = (zone) => (e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/simward-action'); if (!id) return; zone === 'exp' ? addExpected(id) : addHarm(id); };
  const setE = (i, p) => up({ expected: sc.expected.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const setH = (i, p) => up({ harmful: sc.harmful.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const total = sc.expected.reduce((s, e) => s + (Number(e.points) || 0), 0);
  const allIds = [...ACTIONS.map(a => a.id), ...medActs.map(a => a.id)];
  return <div class="scoring">
    <aside class="palette">
      <h4>Action library</h4>
      <input class="search" placeholder="Search actions" aria-label="Search actions" value={q} onInput={e => setQ(e.target.value)} />
      <div class="seg wrap">{[['all', 'All'], ...ACTION_CATEGORIES.map(c => [c.id, c.label]), ['med', 'Meds']].map(([k, l]) => <button class={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{l}</button>)}</div>
      <div class="pal-scroll">{pool.map(a => <button class="pal-item" draggable onDragStart={e => { e.dataTransfer.setData('text/simward-action', a.id); e.dataTransfer.effectAllowed = 'copy'; }} onClick={() => addExpected(a.id)} title="Drag to Expected or Harmful, or click to add as expected"><span class={`kind k-${a.kind}`}>{a.kind}</span>{a.label}</button>)}</div>
    </aside>
    <div class="score-main">
      <section class={`card dropzone${over === 'exp' ? ' over' : ''}`} onDragOver={e => { e.preventDefault(); setOver('exp'); }} onDragLeave={() => setOver(null)} onDrop={drop('exp')}>
        <div class="row between wrap"><h3><Icon name="check" /> Expected actions</h3><span class="small muted">{sc.expected.length} items · {total} points</span></div>
        <p class="small muted">Drop actions here. Group alternatives in one row (e.g. vitals OR monitor). Timing windows use scenario time.</p>
        {sc.expected.length ? <div class="table-wrap"><table class="table exp-table">
          <thead><tr><th>Action(s)</th><th>Match</th><th>Critical</th><th>Points</th><th>Within (s)</th><th>Must precede</th><th>Must follow</th><th>Rationale (shown in feedback)</th><th /></tr></thead>
          <tbody>{sc.expected.map((e, i) => <tr>
            <td class="wide"><ActionPicker sc={sc} value={e.actions} onChange={(actions) => setE(i, { actions })} placeholder="Add alternative…" /></td>
            <td><select aria-label="Match mode" value={e.mode || (e.actions.length > 1 ? 'any' : 'all')} onChange={ev => setE(i, { mode: ev.target.value })}><option value="any">any</option><option value="all">all</option></select></td>
            <td><input type="checkbox" aria-label="Critical" checked={!!e.critical} onChange={ev => setE(i, { critical: ev.target.checked })} /></td>
            <td><input class="num-in" type="number" min="1" aria-label="Points" value={e.points} onInput={ev => setE(i, { points: Number(ev.target.value) })} /></td>
            <td><input class="num-in" type="number" min="0" aria-label="Within seconds" value={e.withinSec || ''} placeholder="—" onInput={ev => setE(i, { withinSec: ev.target.value ? Number(ev.target.value) : undefined })} /></td>
            <td><select aria-label="Must precede" value={e.before || ''} onChange={ev => setE(i, { before: ev.target.value || undefined })}><option value="">—</option>{allIds.map(id => <option value={id}>{actionLabel(id, sc)}</option>)}</select></td>
            <td><select aria-label="Must follow" value={Array.isArray(e.after) ? e.after[0] : e.after || ''} onChange={ev => setE(i, { after: ev.target.value || undefined })}><option value="">—</option>{allIds.map(id => <option value={id}>{actionLabel(id, sc)}</option>)}</select></td>
            <td><input aria-label="Rationale" value={e.rationale || ''} onInput={ev => setE(i, { rationale: ev.target.value })} /></td>
            <td><Btn small kind="ghost" icon="trash" aria-label="Remove" onClick={() => up({ expected: sc.expected.filter((_, j) => j !== i) })} /></td>
          </tr>)}</tbody>
        </table></div> : <Empty icon="target" title="Drop expected actions here" />}
      </section>
      <section class={`card dropzone harm${over === 'harm' ? ' over' : ''}`} onDragOver={e => { e.preventDefault(); setOver('harm'); }} onDragLeave={() => setOver(null)} onDrop={drop('harm')}>
        <h3><Icon name="alert" /> Harmful actions (penalties)</h3>
        <p class="small muted">Contraindicated medications are penalized automatically. Add anything else unsafe here, optionally only in certain states.</p>
        {sc.harmful.length ? <div class="table-wrap"><table class="table">
          <thead><tr><th>Action</th><th>Penalty</th><th>Critical</th><th>Only in states</th><th>Rationale</th><th /></tr></thead>
          <tbody>{sc.harmful.map((h, i) => <tr>
            <td>{actionLabel(h.actionId, sc)}</td>
            <td><input class="num-in" type="number" aria-label="Penalty" value={h.penalty} onInput={e => setH(i, { penalty: Number(e.target.value) })} /></td>
            <td><input type="checkbox" aria-label="Critical" checked={!!h.critical} onChange={e => setH(i, { critical: e.target.checked })} /></td>
            <td><select aria-label="Only in state" value={h.inStates?.[0] || ''} onChange={e => setH(i, { inStates: e.target.value ? [e.target.value] : undefined })}><option value="">Any state</option>{sc.states.map(s => <option value={s.id}>{s.name}</option>)}</select></td>
            <td><input aria-label="Rationale" value={h.rationale} onInput={e => setH(i, { rationale: e.target.value })} /></td>
            <td><Btn small kind="ghost" icon="trash" aria-label="Remove" onClick={() => up({ harmful: sc.harmful.filter((_, j) => j !== i) })} /></td>
          </tr>)}</tbody>
        </table></div> : <Empty icon="shield" title="Drop harmful actions here" />}
      </section>
    </div>
  </div>;
}

// ---------------- EHR ----------------
function EhrTab({ sc, up }) {
  const setHo = (k, v) => up({ handoff: { ...sc.handoff, [k]: v } });
  const setList = (key, i, p) => up({ [key]: sc[key].map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return <div class="b-grid">
    <section class="card">
      <h3>SBAR hand-off (pre-brief)</h3>
      {[['situation', 'Situation'], ['background', 'Background'], ['assessment', 'Assessment'], ['recommendation', 'Recommendation']].map(([k, l]) => <Field label={l} id={`ho-${k}`}><textarea id={`ho-${k}`} rows="2" value={sc.handoff[k]} onInput={e => setHo(k, e.target.value)} /></Field>)}
      <h3>Provider orders</h3>
      {sc.orders.map((o, i) => <div class="row gap"><select aria-label="Order type" value={o.type} onChange={e => setList('orders', i, { type: e.target.value })}><option value="nursing">Nursing</option><option value="med">Medication</option><option value="lab">Lab / diagnostic</option></select><input aria-label="Order text" value={o.text} onInput={e => setList('orders', i, { text: e.target.value })} /><Btn small kind="ghost" icon="trash" aria-label="Remove order" onClick={() => up({ orders: sc.orders.filter((_, j) => j !== i) })} /></div>)}
      <Btn small icon="plus" onClick={() => up({ orders: [...sc.orders, { id: uid('o'), type: 'nursing', text: '' }] })}>Add order</Btn>
      <h3>Labs & diagnostics</h3>
      <div class="table-wrap"><table class="table"><thead><tr><th>Test</th><th>Value</th><th>Unit</th><th>Reference</th><th>Flag</th><th /></tr></thead><tbody>
        {sc.labs.map((l, i) => <tr>{['name', 'value', 'unit', 'ref'].map(k => <td><input aria-label={k} value={l[k]} onInput={e => setList('labs', i, { [k]: e.target.value })} /></td>)}<td><select aria-label="Flag" value={l.flag} onChange={e => setList('labs', i, { flag: e.target.value })}><option value="">—</option><option value="H">H</option><option value="L">L</option><option value="A">Abn</option></select></td><td><Btn small kind="ghost" icon="trash" aria-label="Remove lab" onClick={() => up({ labs: sc.labs.filter((_, j) => j !== i) })} /></td></tr>)}
      </tbody></table></div>
      <Btn small icon="plus" onClick={() => up({ labs: [...sc.labs, { name: '', value: '', unit: '', ref: '', flag: '' }] })}>Add result</Btn>
    </section>
    <section class="card">
      <h3>Medication administration record</h3>
      <p class="small muted">Each medication becomes an administrable action for students. Effects shift the patient’s vitals; contraindications are penalized automatically.</p>
      {sc.meds.map((m, i) => <div class="med-edit">
        <div class="form-grid">
          {[['name', 'Drug'], ['dose', 'Dose'], ['route', 'Route'], ['freq', 'Frequency'], ['indication', 'Indication'], ['category', 'Class']].map(([k, l]) => <Field label={l} id={`m${i}${k}`}><input id={`m${i}${k}`} value={m[k] || ''} onInput={e => setList('meds', i, { [k]: e.target.value })} /></Field>)}
        </div>
        <label class="check"><input type="checkbox" checked={!!m.highAlert} onChange={e => setList('meds', i, { highAlert: e.target.checked })} /> High-alert medication</label>
        <Field label="Contraindicated because… (leave blank if safe)" id={`m${i}ci`}><input id={`m${i}ci`} value={m.contraindicated || ''} onInput={e => setList('meds', i, { contraindicated: e.target.value || undefined })} /></Field>
        <Field label="Caution shown on MAR" id={`m${i}ca`}><input id={`m${i}ca`} value={m.caution || ''} onInput={e => setList('meds', i, { caution: e.target.value || undefined })} /></Field>
        <div class="effects"><span class="field-label">Physiological effect</span>{['hr', 'sbp', 'rr', 'spo2', 'temp', 'pain', 'glucose'].map(k => <label>{k}<input type="number" step={k === 'temp' ? 0.1 : 1} value={m.effect?.[k] ?? ''} onInput={e => setList('meds', i, { effect: { ...(m.effect || {}), [k]: e.target.value === '' ? undefined : Number(e.target.value) } })} /></label>)}</div>
        <Btn small kind="ghost" icon="trash" onClick={() => up({ meds: sc.meds.filter((_, j) => j !== i) })}>Remove medication</Btn>
      </div>)}
      <Btn small icon="plus" onClick={() => up({ meds: [...sc.meds, { id: uid('m'), name: '', dose: '', route: 'PO', freq: '', indication: '', category: '', effect: {} }] })}>Add medication</Btn>
    </section>
  </div>;
}

function DebriefTab({ sc, up }) {
  return <div class="b-grid one"><section class="card">
    <h3>Debrief reflection questions</h3>
    <p class="small muted">Students answer these after the scenario; answers are included in the AI debrief and visible to instructors. Structure follows PEARLS (reactions → analysis → summary).</p>
    {sc.debrief.map((q, i) => <div class="row gap"><span class="num-badge">{i + 1}</span><input aria-label={`Question ${i + 1}`} value={q} onInput={e => up({ debrief: sc.debrief.map((x, j) => (j === i ? e.target.value : x)) })} /><Btn small kind="ghost" icon="trash" aria-label="Remove" onClick={() => up({ debrief: sc.debrief.filter((_, j) => j !== i) })} /></div>)}
    <Btn small icon="plus" onClick={() => up({ debrief: [...sc.debrief, ''] })}>Add question</Btn>
  </section></div>;
}


function VoiceFields({ voice, onChange, sample, idp }) {
  const v = voice;
  return <div class="voice-fields">
    <div class="form-grid">
      <Field label="Voice" id={`${idp}-g`}><select id={`${idp}-g`} value={v.gender} onChange={e => onChange({ ...v, gender: e.target.value })}><option value="F">Female</option><option value="M">Male</option></select></Field>
      <Field label="Accent / language background" id={`${idp}-a`}><select id={`${idp}-a`} value={v.accent} onChange={e => onChange({ ...v, accent: e.target.value })}>{ACCENT_OPTIONS.map(([k, l]) => <option value={k}>{l}</option>)}</select></Field>
    </div>
    <Field label="Manner of speaking (used by studio voices and the AI)" id={`${idp}-s`} hint="e.g. breathless, short phrases; soft Irish lilt; gruff and understated"><input id={`${idp}-s`} value={v.style || ''} onInput={e => onChange({ ...v, style: e.target.value })} /></Field>
    <Btn small icon="volume" onClick={() => { cancelSpeech(); speakAs('patient', sample, v, { distress: /breathless|short of breath/i.test(v.style || '') ? 1 : 0 }); }}>Hear this voice</Btn>
  </div>;
}

const EVENT_KINDS = [['patient', 'Patient says something'], ['family', 'Family member speaks'], ['phone', 'Phone call'], ['pump', 'Equipment alarm'], ['callLight', 'Call light'], ['environment', 'Something happens in the room']];
function EventsTab({ sc, up }) {
  const evs = sc.events || [];
  const set = (i, patch) => up({ events: evs.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const add = () => up({ events: [...evs, { id: uid('ev'), trigger: { type: 'time', seconds: 120 }, kind: 'family', text: '', respond: [], points: 3, rationale: '' }] });
  return <div class="b-grid one"><section class="card">
    <h3>Cues & scenario events</h3>
    <p class="small muted">Realistic interruptions and prompts that fire during the scenario: a family question, a pump alarm, a phone call from the provider, a spontaneous remark from the patient. Patient and family cues are spoken aloud in their voices. If you list expected responses, the student earns the points by performing one of them within 3 minutes.</p>
    {evs.map((e, i) => <div class="med-edit">
      <div class="form-grid">
        <Field label="Kind" id={`ev${i}k`}><select id={`ev${i}k`} value={e.kind} onChange={ev => set(i, { kind: ev.target.value })}>{EVENT_KINDS.map(([k, l]) => <option value={k}>{l}</option>)}</select></Field>
        <Field label="Fires" id={`ev${i}t`}><select id={`ev${i}t`} value={e.trigger.type} onChange={ev => set(i, { trigger: ev.target.value === 'time' ? { type: 'time', seconds: 120 } : ev.target.value === 'state' ? { type: 'state', stateId: sc.states[0]?.id } : { type: 'action', actionId: 'hand-hygiene' } })}><option value="time">At scenario time</option><option value="state">When a state is entered</option><option value="action">After an action</option></select></Field>
        {e.trigger.type === 'time' && <Field label="Seconds" id={`ev${i}s`}><input id={`ev${i}s`} type="number" min="5" value={e.trigger.seconds} onInput={ev => set(i, { trigger: { type: 'time', seconds: Number(ev.target.value) } })} /></Field>}
        {e.trigger.type === 'state' && <Field label="State" id={`ev${i}st`}><select id={`ev${i}st`} value={e.trigger.stateId} onChange={ev => set(i, { trigger: { type: 'state', stateId: ev.target.value } })}>{sc.states.map(st => <option value={st.id}>{st.name}</option>)}</select></Field>}
        {e.trigger.type === 'action' && <Field label="Action" id={`ev${i}ac`}><select id={`ev${i}ac`} value={e.trigger.actionId} onChange={ev => set(i, { trigger: { type: 'action', actionId: ev.target.value } })}>{ACTIONS.map(a => <option value={a.id}>{a.label}</option>)}</select></Field>}
        <Field label="Points" id={`ev${i}p`}><input id={`ev${i}p`} type="number" min="0" value={e.points} onInput={ev => set(i, { points: Number(ev.target.value) })} /></Field>
      </div>
      <Field label="What happens / what is said" id={`ev${i}x`}><textarea id={`ev${i}x`} rows="2" value={e.text} onInput={ev => set(i, { text: ev.target.value })} /></Field>
      <span class="field-label">Appropriate responses (any one earns the points)</span>
      <ActionPicker sc={sc} value={e.respond || []} onChange={(respond) => set(i, { respond })} placeholder="Add an expected response…" />
      <Field label="Rationale (shown in the debrief)" id={`ev${i}r`}><input id={`ev${i}r`} value={e.rationale || ''} onInput={ev => set(i, { rationale: ev.target.value })} /></Field>
      <Btn small kind="ghost" icon="trash" onClick={() => up({ events: evs.filter((_, j) => j !== i) })}>Remove event</Btn>
    </div>)}
    <Btn small icon="plus" onClick={add}>Add event</Btn>
  </section></div>;
}
