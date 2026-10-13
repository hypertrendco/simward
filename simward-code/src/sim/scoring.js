import { ACTION_MAP, actionLabel } from '../data/actions.js';

// Deterministic scoring from the event log. Runs in the browser and is re-run on the server
// so the stored result can't be tampered with.
const MED_COMPS = ['cj-act', 'qsen-safety'];
const compsFor = (id) => (id?.startsWith('med:') ? MED_COMPS : ACTION_MAP[id]?.comps || []);

export function scoreAttempt(scenario, events, { passingScore = 75 } = {}) {
  const acts = events.filter(e => e.type === 'action');
  const first = {};
  for (const e of acts) if (first[e.actionId] == null) first[e.actionId] = e.t;
  const firstOf = (ids) => {
    const ts = (Array.isArray(ids) ? ids : [ids]).map(i => first[i]).filter(t => t != null);
    return ts.length ? Math.min(...ts) : null;
  };
  const items = [];
  const comp = {};
  const addComp = (ids, earned, possible) => {
    for (const c of ids) {
      comp[c] = comp[c] || { earned: 0, possible: 0 };
      comp[c].earned += earned; comp[c].possible += possible;
    }
  };
  let earned = 0, possible = 0;
  for (const ex of scenario.expected || []) {
    const ids = ex.actions || [];
    const mode = ex.mode || (ids.length > 1 ? 'any' : 'all');
    let t = null, status = 'missed', note = '';
    if (mode === 'all') {
      const ts = ids.map(i => first[i]);
      if (ts.every(x => x != null)) t = Math.max(...ts);
    } else t = firstOf(ids);
    if (ex.after) {
      const ta = firstOf(ex.after);
      if (ta == null) t = null;
      else {
        const later = acts.filter(e => ids.includes(e.actionId) && e.t > ta);
        t = later.length ? later[0].t : null;
        if (t == null) note = 'Not performed after the related intervention';
      }
    }
    let frac = 0;
    if (t != null) {
      status = 'met'; frac = 1;
      if (ex.withinSec && t > ex.withinSec) { status = 'late'; frac = 0.5; note = `Performed at ${fmt(t)} — target ≤ ${fmt(ex.withinSec)}`; }
      if (ex.before) {
        const tb = firstOf(ex.before);
        if (tb != null && t > tb) { status = 'out-of-order'; frac = Math.min(frac, 0.5); note = `Should precede: ${actionLabel(Array.isArray(ex.before) ? ex.before[0] : ex.before, scenario)}`; }
      }
    }
    const pts = ex.points || 1;
    const got = pts * frac;
    earned += got; possible += pts;
    const comps = ex.comps || [...new Set(ids.flatMap(compsFor))];
    addComp(comps, got, pts);
    items.push({ key: ex.key, label: ex.label || ids.map(i => actionLabel(i, scenario)).join(mode === 'any' ? ' / ' : ' + '), actions: ids, status, t, critical: !!ex.critical, points: pts, earned: got, rationale: ex.rationale || '', note, comps });
  }
  // Harmful actions (explicit list + any contraindicated medication)
  const harmList = [...(scenario.harmful || [])];
  for (const m of scenario.meds || []) {
    if (m.contraindicated && !harmList.some(h => h.actionId === `med:${m.id}`)) harmList.push({ actionId: `med:${m.id}`, penalty: 15, critical: true, rationale: m.contraindicated });
  }
  const harmful = [];
  let penalties = 0;
  for (const h of harmList) {
    const hits = acts.filter(e => e.actionId === h.actionId && (!h.inStates || h.inStates.includes(e.stateId)));
    if (hits.length) {
      penalties += h.penalty || 10;
      harmful.push({ ...h, label: actionLabel(h.actionId, scenario), t: hits[0].t });
      addComp([...new Set([...compsFor(h.actionId), 'qsen-safety'])], -(h.penalty || 10), 0);
    }
  }
  // Scenario events: did the student respond with one of the expected actions within 3 minutes?
  const eventItems = [];
  for (const ev of events.filter(e => e.type === 'event' && e.respond?.length)) {
    const hit = acts.find(a => a.t > ev.t && a.t <= ev.t + 180 && ev.respond.includes(a.actionId));
    const pts = ev.points || 0;
    const got = hit ? pts : 0;
    earned += got; possible += pts;
    const comps = [...new Set(ev.respond.flatMap(compsFor))];
    if (pts) addComp(comps.length ? comps : ['cj-prioritize'], got, pts);
    eventItems.push({ id: ev.eventId, kind: ev.kind, text: ev.label, t: ev.t, responded: !!hit, responseLabel: hit ? actionLabel(hit.actionId, scenario) : null, responseT: hit?.t ?? null, expected: ev.respond.map(a => actionLabel(a, scenario)), points: pts, rationale: ev.detail || '' });
  }
  // Medication rights checks
  const medEvents = acts.filter(e => e.actionId.startsWith('med:'));
  const rightsIssues = [];
  for (const e of medEvents) {
    const r = e.params?.rightsChecked || {};
    const missing = ['patient', 'allergy', 'dose', 'route', 'time'].filter(k => !r[k]);
    if (missing.length) rightsIssues.push({ label: e.label, t: e.t, missing });
  }
  if (rightsIssues.length) {
    const pen = Math.min(10, rightsIssues.length * 3);
    penalties += pen;
    addComp(['qsen-safety'], -pen, 0);
  }
  const score = possible ? Math.max(0, Math.round(((earned - penalties) / possible) * 100)) : 0;
  const criticalMissed = items.filter(i => i.critical && i.status === 'missed');
  const criticalHarm = harmful.filter(h => h.critical);
  const competencies = {};
  for (const [id, c] of Object.entries(comp)) {
    competencies[id] = { earned: Math.round(c.earned * 10) / 10, possible: c.possible, pct: c.possible ? Math.max(0, Math.round((c.earned / c.possible) * 100)) : (c.earned < 0 ? 0 : null) };
  }
  const transitions = events.filter(e => e.type === 'transition');
  const endEv = events.find(e => e.type === 'end');
  const firstAssess = acts.find(e => ACTION_MAP[e.actionId]?.kind === 'assess');
  const stats = {
    durationSec: endEv ? endEv.t : (events.at(-1)?.t || 0),
    actions: acts.length,
    assessments: acts.filter(e => ACTION_MAP[e.actionId]?.kind === 'assess').length,
    interventions: acts.filter(e => ACTION_MAP[e.actionId]?.kind === 'intervene' || e.actionId.startsWith('med:')).length,
    communications: acts.filter(e => ACTION_MAP[e.actionId]?.kind === 'communicate').length + events.filter(e => e.type === 'chat' && e.role === 'student').length,
    questionsAsked: events.filter(e => e.type === 'chat' && e.role === 'student').length,
    familyTalk: events.filter(e => e.type === 'chat' && e.role === 'student' && e.to === 'family').length,
    eventsResponded: events.filter(e => e.type === 'event' && e.respond?.length).length ? `${eventItems.filter(x => x.responded).length}/${eventItems.length}` : null,
    timeToFirstAssessment: firstAssess ? firstAssess.t : null,
    finalState: transitions.length ? transitions.at(-1).to : scenario.initialStateId,
    deteriorated: transitions.some(t => /worsen|shock|failure|severe|flash|impending|deterior/i.test(scenario.states.find(s => s.id === t.to)?.name || '')),
  };
  const finalStateName = scenario.states.find(s => s.id === stats.finalState)?.name;
  return {
    score, passed: score >= passingScore && !criticalMissed.length && !criticalHarm.length, passingScore,
    earned: Math.round(earned * 10) / 10, possible, penalties,
    items, eventItems, harmful, rightsIssues, criticalMissed: criticalMissed.map(i => i.label), competencies, stats, finalStateName,
  };
}

export const fmt = (s) => {
  if (s == null) return '—';
  s = Math.round(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Aggregate competency performance across attempts → {compId: {pct, n, trend: [pct...]}}
export function competencyProfile(attempts) {
  const out = {};
  const sorted = [...attempts].filter(a => a.result).sort((a, b) => new Date(a.completedAt || a.startedAt) - new Date(b.completedAt || b.startedAt));
  for (const a of sorted) {
    for (const [id, c] of Object.entries(a.result.competencies || {})) {
      if (c.pct == null) continue;
      out[id] = out[id] || { sum: 0, n: 0, trend: [] };
      out[id].sum += c.pct; out[id].n++; out[id].trend.push(c.pct);
    }
  }
  for (const v of Object.values(out)) { v.pct = Math.round(v.sum / v.n); v.latest = v.trend.at(-1); }
  return out;
}

export const band = (pct) => (pct == null ? 'none' : pct >= 85 ? 'mastered' : pct >= 70 ? 'proficient' : pct >= 50 ? 'developing' : 'beginning');
