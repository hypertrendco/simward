import { ACTION_MAP, actionLabel } from '../data/actions.js';

// Scenario engine: Laerdal-style state machine (states + trends + handlers) with a simple physiology layer.
// - Vitals trend toward the active state's targets (exponential approach, like LLEAP "trends")
// - Interventions and medications apply persistent offsets (e.g. O2 raises SpO2)
// - Transitions fire on actions (all/any), time-in-state, or vital thresholds
// - An optional AI director (see ai/director) may nudge vitals or request a transition to a *defined* state
const LIMITS = { hr: [20, 200], sbp: [40, 230], dbp: [20, 140], rr: [4, 50], spo2: [60, 100], temp: [33, 42], pain: [0, 10], glucose: [15, 600] };
const clamp = (k, x) => (LIMITS[k] ? Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], x)) : x);
const NUMERIC = ['hr', 'sbp', 'dbp', 'rr', 'spo2', 'temp', 'pain', 'glucose'];

export class SimEngine {
  constructor(scenario, { onUpdate, onEvent } = {}) {
    this.sc = scenario;
    this.onUpdate = onUpdate || (() => {});
    this.onEvent = onEvent || (() => {});
    const st = this.stateById(scenario.initialStateId) || scenario.states[0];
    this.stateId = st.id;
    this.clock = 0;
    this.stateEnteredAt = 0;
    this.vitals = { ...st.vitals };
    this.offsets = {};
    this.events = [];
    this.performed = new Set();
    this.revealed = { monitor: false, labs: false, vitalsAt: null };
    this.hob = scenario.environment?.items?.find(i => i.type === 'bed' || i.type === 'stretcher')?.props?.hob ?? 30;
    this.o2 = scenario.start?.o2 || null;
    if (scenario.start?.monitor) this.revealed.monitor = true;
    this.firedEvents = new Set();
    this.pendingEvents = []; // events awaiting a response (for scoring)
    this.running = false;
    this.ended = false;
    this.speed = 1;
  }
  stateById(id) { return this.sc.states.find(s => s.id === id); }
  get state() { return this.stateById(this.stateId); }

  log(ev) {
    const e = { t: Math.round(this.clock), tRaw: this.clock, stateId: this.stateId, ...ev };
    this.events.push(e);
    this.onEvent(e);
    return e;
  }

  start() { if (!this.running) { this.running = true; this.log({ type: 'start', label: 'Simulation started' }); } }

  tick(dt) {
    if (!this.running || this.ended) return;
    this.clock += dt * this.speed;
    const target = this.targetVitals();
    const k = 1 - Math.exp(-dt * this.speed / 18); // ~18 s time-constant trend
    for (const key of NUMERIC) {
      if (target[key] == null) continue;
      const cur = this.vitals[key] ?? target[key];
      let next = cur + (target[key] - cur) * k;
      next = clamp(key, next);
      this.vitals[key] = next;
    }
    this.vitals.loc = this.state.vitals.loc;
    this.vitals.rhythm = this.state.vitals.rhythm;
    this.checkTransitions();
    this.checkEvents();
    this.onUpdate(this.snapshot());
  }

  targetVitals() {
    const base = this.state.vitals;
    const out = {};
    for (const key of NUMERIC) {
      if (base[key] == null) continue;
      out[key] = clamp(key, base[key] + (this.offsets[key] || 0));
    }
    return out;
  }
  // displayed values include small physiological noise
  displayVitals(t = this.clock) {
    const v = { ...this.vitals };
    const n = (a, f) => Math.sin(t * f) * a + Math.sin(t * f * 2.7) * a * 0.4;
    v.hr = v.hr + n(1.5, 0.37); v.spo2 = Math.min(100, v.spo2 + n(0.6, 0.21)); v.rr = v.rr + n(0.8, 0.13);
    return v;
  }

  addOffset(effect = {}, scale = 1) {
    for (const [k, d] of Object.entries(effect)) {
      const cap = k === 'glucose' ? 300 : k === 'spo2' ? 10 : k === 'temp' ? 1.5 : 25;
      this.offsets[k] = Math.max(-cap, Math.min(cap, (this.offsets[k] || 0) + d * scale));
    }
  }

  performedSince(t0) {
    return new Set(this.events.filter(e => e.type === 'action' && (e.tRaw ?? e.t) >= t0).map(e => e.actionId));
  }

  firstTime(id) { const e = this.events.find(x => x.type === 'action' && x.actionId === id); return e ? e.t : null; }

  checkTransitions(causeActionId) {
    const inState = this.clock - this.stateEnteredAt;
    const candidates = this.sc.transitions.filter(t => t.from === this.stateId);
    // action handlers take precedence over time trends
    const ordered = [...candidates].sort((a, b) => (a.trigger.type === 'actions' ? -1 : 1) - (b.trigger.type === 'actions' ? -1 : 1));
    for (const t of ordered) {
      const tr = t.trigger || {};
      let fire = false;
      if (tr.type === 'actions') {
        const acts = tr.actions || [];
        // "any" handlers only fire on actions performed while in this state; "all" counts the whole run
        const pool = tr.mode === 'any' ? this.performedSince(this.stateEnteredAt) : this.performed;
        fire = tr.mode === 'any' ? acts.some(a => pool.has(a)) : acts.length > 0 && acts.every(a => pool.has(a));
      } else if (tr.type === 'time') fire = inState >= (tr.seconds || 0);
      else if (tr.type === 'vital') {
        const val = this.vitals[tr.vital];
        fire = tr.op === '<' ? val < tr.value : val > tr.value;
      }
      if (fire) { this.transition(t.to, t.label || 'Transition', 'rule'); return true; }
    }
    return false;
  }

  // Scenario events: timed / state-triggered cues (family questions, alarms, phone calls, spontaneous patient remarks)
  checkEvents() {
    for (const ev of this.sc.events || []) {
      if (this.firedEvents.has(ev.id)) continue;
      const tr = ev.trigger || {};
      let fire = false;
      if (tr.type === 'time') fire = this.clock >= tr.seconds;
      else if (tr.type === 'state') fire = this.stateId === tr.stateId && (this.clock - this.stateEnteredAt) >= (tr.afterSeconds || 2);
      else if (tr.type === 'action') fire = this.performed.has(tr.actionId);
      if (!fire) continue;
      this.firedEvents.add(ev.id);
      const e = this.log({ type: 'event', eventId: ev.id, kind: ev.kind, label: ev.text, detail: ev.rationale || '', respond: ev.respond || [], points: ev.points || 0 });
      if (ev.respond?.length) this.pendingEvents.push({ id: ev.id, t: e.t, respond: ev.respond });
    }
  }

  transition(toId, reason, source = 'rule') {
    const to = this.stateById(toId);
    if (!to || to.id === this.stateId) return false;
    const from = this.state;
    this.stateId = to.id;
    this.stateEnteredAt = this.clock;
    // halve offsets: the new state already reflects accumulated treatment
    for (const k of Object.keys(this.offsets)) this.offsets[k] = this.offsets[k] * 0.4;
    this.log({ type: 'transition', from: from.id, to: to.id, label: `${from.name} → ${to.name}`, detail: reason, source });
    return true;
  }

  // Perform a nursing action. Returns { message, finding } for the UI.
  perform(actionId, params = {}) {
    if (this.ended) return { message: 'Scenario has ended.' };
    this.start();
    const isMed = actionId.startsWith('med:');
    const def = isMed ? null : ACTION_MAP[actionId];
    const med = isMed ? this.sc.meds.find(m => `med:${m.id}` === actionId) : null;
    const secs = isMed ? 60 : def?.secs || 20;
    this.clock += secs * 0.25; // actions consume scenario time (compressed)
    this.performed.add(actionId);
    const st = this.state;
    let message = actionLabel(actionId, this.sc);
    let finding = null;
    if (def?.finding) finding = st.findings?.[def.finding] || 'No abnormal findings.';
    if (def?.reveals === 'vitals') {
      const v = this.displayVitals();
      finding = `BP ${Math.round(v.sbp)}/${Math.round(v.dbp)} · HR ${Math.round(v.hr)} · RR ${Math.round(v.rr)} · SpO₂ ${Math.round(v.spo2)}% · T ${v.temp.toFixed(1)} °C · Pain ${Math.round(v.pain)}/10`;
      this.revealed.vitalsAt = this.clock;
    }
    if (def?.reveals === 'monitor') { this.revealed.monitor = true; finding = 'Monitor attached — continuous ECG, SpO₂, NIBP q5min.'; }
    if (def?.reveals === 'labs') { this.revealed.labs = true; finding = 'Labs opened in the EHR.'; }
    if (def?.reveals === 'glucose') finding = `POC glucose: ${Math.round(this.vitals.glucose)} mg/dL`;
    if (def?.reveals === 'spo2') finding = `SpO₂ ${Math.round(this.displayVitals().spo2)}% · pulse ${Math.round(this.displayVitals().hr)}`;
    if (def?.reveals === 'temp') finding = `Temperature ${this.vitals.temp.toFixed(1)} °C (${(this.vitals.temp * 9 / 5 + 32).toFixed(1)} °F)`;
    if (def?.hob != null) this.hob = def.hob;
    if (def?.device) this.o2 = def.device;
    if (def?.effect) this.addOffset(def.effect);
    let harmful = false;
    if (med) {
      if (med.effect) this.addOffset(med.effect);
      message = `Administered ${med.name} ${med.dose} ${med.route}`;
      if (med.contraindicated) harmful = true;
      finding = params.rightsChecked ? `Rights verified: ${Object.keys(params.rightsChecked).filter(k => params.rightsChecked[k]).join(', ') || 'none'}` : null;
    }
    const ev = this.log({ type: 'action', actionId, label: message, detail: finding, kind: isMed ? 'med' : def?.kind, harmful, params: isMed ? params : undefined });
    this.checkTransitions(actionId);
    this.onUpdate(this.snapshot());
    return { message, finding, event: ev };
  }

  chat(role, text, to = 'patient') { return this.log({ type: 'chat', role, to, label: text }); }
  // the nurse verbalizing an action to the patient
  say(text, actionId) { return this.log({ type: 'say', actionId, label: text }); }

  // AI director adjustments are constrained to defined states and bounded nudges
  applyDirector(d, reason = 'AI director') {
    if (!d || this.ended) return;
    if (d.vitalNudge && typeof d.vitalNudge === 'object') {
      const safe = {};
      for (const k of NUMERIC) if (typeof d.vitalNudge[k] === 'number') safe[k] = Math.max(-8, Math.min(8, d.vitalNudge[k]));
      if (Object.keys(safe).length) { this.addOffset(safe); this.log({ type: 'ai', label: 'Physiology adjusted by AI director', detail: d.rationale || '', meta: safe }); }
    }
    if (d.transitionTo && this.stateById(d.transitionTo) && d.transitionTo !== this.stateId) {
      // Only allow transitions that exist in the scenario graph from the current state
      const allowed = this.sc.transitions.some(t => t.from === this.stateId && t.to === d.transitionTo);
      if (allowed) this.transition(d.transitionTo, d.rationale || reason, 'ai');
    }
  }

  end(reason = 'Student ended scenario') {
    if (this.ended) return;
    this.log({ type: 'end', label: reason });
    this.ended = true; this.running = false;
    this.onUpdate(this.snapshot());
  }

  snapshot() {
    return {
      clock: this.clock, stateId: this.stateId, stateName: this.state.name, cues: this.state.cues,
      vitals: this.displayVitals(), revealed: { ...this.revealed }, hob: this.hob, o2: this.o2,
      running: this.running, ended: this.ended, eventsCount: this.events.length,
    };
  }
}
