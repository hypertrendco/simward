import { SEED_SCENARIOS } from './scenarios.js';
import { scoreAttempt } from '../sim/scoring.js';

// Demo organization used by the in-browser demo and (optionally) the server's first boot.
export const SEED_COHORTS = [
  { id: 'co-a', name: 'PN 110 · Fundamentals of Nursing — Section A', term: 'Fall 2026', instructorId: 'u-inst' },
  { id: 'co-b', name: 'PN 210 · Medical-Surgical & Family Nursing — Section B', term: 'Fall 2026', instructorId: 'u-inst' },
];
export const SEED_USERS = [
  { id: 'u-admin', email: 'admin@simward.edu', name: 'Morgan Ellis', role: 'admin', cohortId: null },
  { id: 'u-inst', email: 'instructor@simward.edu', name: 'Prof. Alana Reyes, MSN, RN, CHSE', role: 'instructor', cohortId: null },
  { id: 'u-s1', email: 'student@simward.edu', name: 'Jordan Patel', role: 'student', cohortId: 'co-a' },
  { id: 'u-s2', email: 'amara.okafor@simward.edu', name: 'Amara Okafor', role: 'student', cohortId: 'co-a' },
  { id: 'u-s3', email: 'liam.chen@simward.edu', name: 'Liam Chen', role: 'student', cohortId: 'co-a' },
  { id: 'u-s4', email: 'sofia.alvarez@simward.edu', name: 'Sofia Alvarez', role: 'student', cohortId: 'co-a' },
  { id: 'u-s5', email: 'ethan.brooks@simward.edu', name: 'Ethan Brooks', role: 'student', cohortId: 'co-b' },
  { id: 'u-s6', email: 'nia.washington@simward.edu', name: 'Nia Washington', role: 'student', cohortId: 'co-b' },
];
export const SEED_ASSIGNMENTS = [
  { id: 'as-1', scenarioId: 'sc-hip-pod1', cohortId: 'co-a', dueAt: '2026-10-13T23:59:00Z', createdBy: 'u-inst' },
  { id: 'as-2', scenarioId: 'sc-ltc-uti', cohortId: 'co-a', dueAt: '2026-10-20T23:59:00Z', createdBy: 'u-inst' },
  { id: 'as-3', scenarioId: 'sc-hypogly', cohortId: 'co-a', dueAt: '2026-10-27T23:59:00Z', createdBy: 'u-inst' },
  { id: 'as-4', scenarioId: 'sc-copd', cohortId: 'co-b', dueAt: '2026-10-16T23:59:00Z', createdBy: 'u-inst' },
  { id: 'as-5', scenarioId: 'sc-stroke', cohortId: 'co-b', dueAt: '2026-10-23T23:59:00Z', createdBy: 'u-inst' },
  { id: 'as-6', scenarioId: 'sc-peds-gastro', cohortId: 'co-b', dueAt: '2026-10-30T23:59:00Z', createdBy: 'u-inst' },
  { id: 'as-7', scenarioId: 'sc-postpartum', cohortId: 'co-b', dueAt: '2026-11-06T23:59:00Z', createdBy: 'u-inst' },
];

// Deterministic PRNG so seeded analytics are stable
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function synthEvents(sc, skill, r) {
  const ev = [{ t: 0, type: 'start', label: 'Simulation started', stateId: sc.initialStateId }];
  let t = 5;
  for (const ex of sc.expected) {
    const doIt = r() < skill + (ex.critical ? 0.1 : 0);
    if (!doIt) continue;
    t += Math.round(10 + r() * (140 - skill * 100));
    const a = ex.actions[Math.floor(r() * ex.actions.length)];
    ev.push({ t, type: 'action', actionId: a, label: a, stateId: sc.initialStateId, params: a.startsWith('med:') ? { rightsChecked: { patient: r() < skill + 0.2, allergy: r() < skill + 0.1, dose: true, route: true, time: r() < skill + 0.3 } } : undefined });
  }
  for (const h of sc.harmful || []) if (r() < (1 - skill) * 0.35) { t += 20; ev.push({ t, type: 'action', actionId: h.actionId, label: h.actionId, stateId: (h.inStates || [sc.initialStateId])[0] }); }
  const q = Math.floor(r() * 5 * skill);
  for (let i = 0; i < q; i++) ev.push({ t: t - i * 7, type: 'chat', role: 'student', label: 'question' });
  ev.sort((a, b) => a.t - b.t);
  ev.push({ t: t + 30, type: 'end', label: 'Student ended scenario' });
  return ev;
}

export function seedAttempts() {
  const r = rng(20260929);
  const skills = { 'u-s1': 0.62, 'u-s2': 0.88, 'u-s3': 0.45, 'u-s4': 0.76, 'u-s5': 0.7, 'u-s6': 0.55 };
  const out = [];
  let n = 0;
  const base = new Date('2026-09-21T14:00:00Z').getTime();
  for (const as of SEED_ASSIGNMENTS) {
    const sc = SEED_SCENARIOS.find(s => s.id === as.scenarioId);
    for (const u of SEED_USERS.filter(x => x.cohortId === as.cohortId)) {
      if (u.id === 'u-s1' && (as.id === 'as-2' || as.id === 'as-3')) continue; // leave assignments open for the demo student
      const tries = r() < 0.35 ? 2 : 1;
      for (let k = 0; k < tries; k++) {
        const skill = Math.min(0.97, skills[u.id] + k * 0.12 + (r() - 0.5) * 0.1);
        const events = synthEvents(sc, skill, r);
        const result = scoreAttempt(sc, events);
        const started = new Date(base + (n++) * 7.3 * 3600e3);
        out.push({ id: `at-${n}`, scenarioId: sc.id, scenarioTitle: sc.title, studentId: u.id, studentName: u.name, startedAt: started.toISOString(), completedAt: new Date(started.getTime() + result.stats.durationSec * 1000 + 60e3).toISOString(), status: 'completed', events, result, score: result.score, reflections: {}, aiFeedback: null });
      }
    }
  }
  return out;
}

export const DEFAULT_SETTINGS = { institution: 'Ocean State Practical Nursing Program', program: 'LPN/LVN', passingScore: 75, aiEnabled: true, aiDirector: true, aiPatient: true, allowRetakes: true, model: '' };
