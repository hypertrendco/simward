// In-browser demo backend (claude.ai artifact build). Mirrors the REST API and its role checks.
import { SEED_SCENARIOS } from '../data/scenarios.js';
import { COMPETENCIES } from '../data/competencies.js';
import { SEED_USERS, SEED_COHORTS, SEED_ASSIGNMENTS, seedAttempts, DEFAULT_SETTINGS } from '../data/seed.js';
import { scoreAttempt } from '../sim/scoring.js';

const KEY = 'simward-demo-v3';
const clone = (x) => JSON.parse(JSON.stringify(x));
const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();

function fresh() {
  return {
    users: SEED_USERS.map(u => ({ ...u, active: true, createdAt: '2026-08-20T12:00:00Z' })),
    cohorts: clone(SEED_COHORTS),
    competencies: clone(COMPETENCIES),
    scenarios: clone(SEED_SCENARIOS).map(s => ({ ...s, authorId: 'u-inst', updatedAt: '2026-09-01T12:00:00Z' })),
    assignments: SEED_ASSIGNMENTS.map(a => ({ ...a, createdAt: '2026-09-01T12:00:00Z' })),
    attempts: seedAttempts(),
    settings: { ...DEFAULT_SETTINGS },
    audit: [{ id: 'au-0', userId: 'u-admin', userName: 'Morgan Ellis', action: 'system.seed', detail: { note: 'Demo organization created' }, at: '2026-08-20T12:00:00Z' }],
    session: null,
  };
}
let db;
function load() {
  if (db) return db;
  try { const raw = localStorage.getItem(KEY); if (raw) db = JSON.parse(raw); } catch { /* storage unavailable */ }
  if (!db) db = fresh();
  return db;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* quota or blocked */ } }
const me = () => load().users.find(u => u.id === load().session);
function need(...roles) {
  const u = me();
  if (!u) throw Object.assign(new Error('Please sign in.'), { status: 401 });
  if (roles.length && !roles.includes(u.role)) throw Object.assign(new Error('You don’t have permission to do that.'), { status: 403 });
  return u;
}
function audit(action, detail) { const u = me(); load().audit.unshift({ id: uid('au'), userId: u?.id, userName: u?.name, action, detail, at: now() }); }
const ok = async (fn) => { const r = fn(); save(); return clone(r); };

function visibleAttempts(u) {
  const d = load();
  if (u.role === 'admin') return d.attempts;
  if (u.role === 'student') return d.attempts.filter(a => a.studentId === u.id);
  const cohortIds = d.cohorts.filter(c => c.instructorId === u.id).map(c => c.id);
  const students = new Set(d.users.filter(x => cohortIds.includes(x.cohortId)).map(x => x.id));
  return d.attempts.filter(a => students.has(a.studentId));
}

export const localApi = {
  resetDemo: async () => { db = fresh(); save(); return true; },
  demoAccounts: async () => SEED_USERS.slice(0, 3).map(u => ({ email: u.email, role: u.role, name: u.name, password: 'demo' })),
  login: async (email) => ok(() => {
    const u = load().users.find(x => x.email.toLowerCase() === String(email).toLowerCase().trim() && x.active);
    if (!u) throw Object.assign(new Error('No active account with that email. Try one of the demo accounts.'), { status: 401 });
    load().session = u.id; audit('auth.login', { email }); return u;
  }),
  logout: async () => ok(() => { load().session = null; return true; }),
  me: async () => clone(me() || null),
  changePassword: async () => true,
  listUsers: async () => ok(() => { need('admin', 'instructor'); return load().users; }),
  createUser: async (x) => ok(() => {
    need('admin');
    if (load().users.some(u => u.email.toLowerCase() === x.email.toLowerCase())) throw new Error('That email is already in use.');
    const u = { id: uid('u'), email: x.email, name: x.name, role: x.role, cohortId: x.cohortId || null, active: true, createdAt: now() };
    load().users.push(u); audit('user.create', { email: u.email, role: u.role }); return u;
  }),
  updateUser: async (id, x) => ok(() => {
    need('admin'); const u = load().users.find(z => z.id === id); if (!u) throw new Error('User not found');
    Object.assign(u, { name: x.name ?? u.name, role: x.role ?? u.role, cohortId: x.cohortId !== undefined ? x.cohortId : u.cohortId, active: x.active ?? u.active, email: x.email ?? u.email });
    audit('user.update', { email: u.email }); return u;
  }),
  deleteUser: async (id) => ok(() => { const a = need('admin'); if (a.id === id) throw new Error('You can’t delete your own account.'); load().users = load().users.filter(u => u.id !== id); audit('user.delete', { id }); return true; }),
  listCohorts: async () => ok(() => { need(); return load().cohorts; }),
  saveCohort: async (x) => ok(() => {
    need('admin', 'instructor');
    if (x.id) { const c = load().cohorts.find(z => z.id === x.id); Object.assign(c, x); audit('cohort.update', { name: c.name }); return c; }
    const c = { ...x, id: uid('co') }; load().cohorts.push(c); audit('cohort.create', { name: c.name }); return c;
  }),
  deleteCohort: async (id) => ok(() => { need('admin'); load().cohorts = load().cohorts.filter(c => c.id !== id); audit('cohort.delete', { id }); return true; }),
  listCompetencies: async () => ok(() => load().competencies),
  saveCompetency: async (x) => ok(() => {
    need('admin'); const d = load();
    const { _new, ...c } = x;
    if (_new) { if (d.competencies.some(z => z.id === c.id)) throw new Error('A competency with that ID exists.'); d.competencies.push(c); }
    else Object.assign(d.competencies.find(z => z.id === c.id), c);
    audit('competency.save', { id: c.id }); return c;
  }),
  deleteCompetency: async (id) => ok(() => { need('admin'); load().competencies = load().competencies.filter(c => c.id !== id); audit('competency.delete', { id }); return true; }),
  listScenarios: async () => ok(() => {
    const u = need();
    const all = load().scenarios;
    return u.role === 'student' ? all.filter(s => s.status === 'published') : all;
  }),
  getScenario: async (id) => ok(() => { need(); const s = load().scenarios.find(z => z.id === id); if (!s) throw new Error('Scenario not found'); return s; }),
  saveScenario: async (x) => ok(() => {
    const u = need('admin', 'instructor'); const d = load();
    if (x.id && d.scenarios.some(s => s.id === x.id)) {
      const i = d.scenarios.findIndex(s => s.id === x.id);
      d.scenarios[i] = { ...x, updatedAt: now() }; audit('scenario.update', { title: x.title, status: x.status }); return d.scenarios[i];
    }
    const s = { ...x, id: uid('sc'), authorId: u.id, updatedAt: now() }; d.scenarios.push(s); audit('scenario.create', { title: s.title }); return s;
  }),
  deleteScenario: async (id) => ok(() => { need('admin', 'instructor'); load().scenarios = load().scenarios.filter(s => s.id !== id); audit('scenario.delete', { id }); return true; }),
  listAssignments: async () => ok(() => {
    const u = need(); const d = load();
    return u.role === 'student' ? d.assignments.filter(a => a.cohortId === u.cohortId) : d.assignments;
  }),
  saveAssignment: async (x) => ok(() => { const u = need('admin', 'instructor'); const a = { ...x, id: uid('as'), createdBy: u.id, createdAt: now() }; load().assignments.push(a); audit('assignment.create', { scenarioId: a.scenarioId, cohortId: a.cohortId }); return a; }),
  deleteAssignment: async (id) => ok(() => { need('admin', 'instructor'); load().assignments = load().assignments.filter(a => a.id !== id); return true; }),
  listAttempts: async () => ok(() => visibleAttempts(need()).map(({ events, ...a }) => ({ ...a, eventsCount: events?.length || 0 }))),
  getAttempt: async (id) => ok(() => { const a = visibleAttempts(need()).find(z => z.id === id); if (!a) throw new Error('Attempt not found'); return a; }),
  startAttempt: async (scenarioId) => ok(() => {
    const u = need(); const sc = load().scenarios.find(s => s.id === scenarioId);
    const a = { id: uid('at'), scenarioId, scenarioTitle: sc?.title, studentId: u.id, studentName: u.name, startedAt: now(), status: 'in-progress', events: [], result: null, reflections: {}, aiFeedback: null };
    load().attempts.push(a); return a;
  }),
  finishAttempt: async (id, x) => ok(() => {
    const u = need(); const d = load(); const a = d.attempts.find(z => z.id === id && z.studentId === u.id);
    if (!a) throw new Error('Attempt not found');
    const sc = d.scenarios.find(s => s.id === a.scenarioId);
    a.events = x.events; a.result = scoreAttempt(sc, x.events, { passingScore: d.settings.passingScore }); a.score = a.result.score;
    a.status = 'completed'; a.completedAt = now(); audit('attempt.complete', { scenario: sc.title, score: a.score }); return a;
  }),
  updateAttempt: async (id, x) => ok(() => {
    const u = need(); const a = load().attempts.find(z => z.id === id);
    if (!a || (u.role === 'student' && a.studentId !== u.id)) throw new Error('Attempt not found');
    if (x.reflections) a.reflections = x.reflections;
    if (x.aiFeedback !== undefined) a.aiFeedback = x.aiFeedback;
    if (x.instructorNote !== undefined && u.role !== 'student') a.instructorNote = x.instructorNote;
    if (x.remediation !== undefined && u.role !== 'student') a.remediation = x.remediation;
    return a;
  }),
  getSettings: async () => ok(() => load().settings),
  saveSettings: async (x) => ok(() => { need('admin'); Object.assign(load().settings, x); audit('settings.update', x); return load().settings; }),
  listAudit: async () => ok(() => { need('admin'); return load().audit.slice(0, 300); }),
  ai: async () => ({ disabled: true }),
};
