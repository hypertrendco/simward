import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { q, migrateAndSeed, newId } from './db.js';
import { scoreAttempt } from '../src/sim/scoring.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) console.warn('[auth] JWT_SECRET not set — sessions reset on every restart.');
const PROD = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;

app.set('trust proxy', 1);
app.use(compression());
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); next(); });

// ---------- helpers ----------
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error(e);
  res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong on the server.' });
});
const httpErr = (status, message) => Object.assign(new Error(message), { status });
const userOut = (u) => u && ({ id: u.id, email: u.email, name: u.name, role: u.role, cohortId: u.cohort_id, active: u.active, createdAt: u.created_at });
async function audit(req, action, detail) {
  try { await q('insert into audit_log(user_id,user_name,action,detail) values($1,$2,$3,$4)', [req.user?.id, req.user?.name, action, JSON.stringify(detail || {})]); } catch (e) { console.error('audit', e.message); }
}
async function getSettings() { const { rows } = await q("select value from settings where key='app'"); return rows[0]?.value || {}; }

// ---------- auth ----------
async function authenticate(req, _res, next) {
  const tok = req.cookies?.sw_session;
  if (tok) {
    try {
      const { sub } = jwt.verify(tok, SECRET);
      const { rows } = await q('select * from users where id=$1 and active', [sub]);
      if (rows[0]) req.user = rows[0];
    } catch { /* invalid token */ }
  }
  next();
}
const need = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'You don’t have permission to do that.' });
  next();
};
app.use('/api', authenticate);

const loginAttempts = new Map();
app.post('/api/auth/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const key = `${req.ip}|${email}`;
  const la = loginAttempts.get(key) || { n: 0, at: Date.now() };
  if (Date.now() - la.at > 15 * 60e3) { la.n = 0; la.at = Date.now(); }
  if (la.n >= 10) throw httpErr(429, 'Too many sign-in attempts. Wait 15 minutes and try again.');
  const { rows } = await q('select * from users where lower(email)=$1 and active', [email]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.password_hash))) {
    la.n++; loginAttempts.set(key, la);
    throw httpErr(401, 'Email or password is incorrect.');
  }
  loginAttempts.delete(key);
  const token = jwt.sign({ sub: u.id, role: u.role }, SECRET, { expiresIn: '12h' });
  res.cookie('sw_session', token, { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 12 * 3600e3 });
  req.user = u; await audit(req, 'auth.login', { email });
  res.json(userOut(u));
}));
app.post('/api/auth/logout', (req, res) => { res.clearCookie('sw_session'); res.json({ ok: true }); });
app.get('/api/auth/me', (req, res) => res.json(req.user ? userOut(req.user) : null));
app.get('/api/auth/demo', (req, res) => {
  if (process.env.SEED_DEMO === 'false' || process.env.SHOW_DEMO_LOGINS === 'false') return res.json([]);
  res.json([
    { role: 'instructor', email: 'instructor@simward.edu', name: 'Prof. Alana Reyes' },
    { role: 'student', email: 'student@simward.edu', name: 'Jordan Patel' },
  ]);
});
app.post('/api/auth/password', need(), wrap(async (req, res) => {
  const { current, next } = req.body;
  if (!next || String(next).length < 10) throw httpErr(400, 'New password must be at least 10 characters.');
  if (!(await bcrypt.compare(String(current || ''), req.user.password_hash))) throw httpErr(400, 'Current password is incorrect.');
  await q('update users set password_hash=$1 where id=$2', [await bcrypt.hash(next, 10), req.user.id]);
  await audit(req, 'auth.password_change', {});
  res.json({ ok: true });
}));

// ---------- users ----------
app.get('/api/users', need('admin', 'instructor'), wrap(async (req, res) => {
  const { rows } = await q('select * from users order by role, name');
  res.json(rows.map(userOut));
}));
app.post('/api/users', need('admin'), wrap(async (req, res) => {
  const { email, name, role, cohortId, password } = req.body;
  if (!email || !name || !['admin', 'instructor', 'student'].includes(role)) throw httpErr(400, 'Name, email and a valid role are required.');
  const pw = password || crypto.randomBytes(8).toString('base64url');
  try {
    const { rows } = await q('insert into users(id,email,name,role,cohort_id,password_hash) values($1,$2,$3,$4,$5,$6) returning *', [newId('u'), email.toLowerCase().trim(), name, role, cohortId || null, await bcrypt.hash(pw, 10)]);
    await audit(req, 'user.create', { email, role });
    res.json({ ...userOut(rows[0]), tempPassword: password ? undefined : pw });
  } catch (e) { if (e.code === '23505') throw httpErr(409, 'That email is already in use.'); throw e; }
}));
app.put('/api/users/:id', need('admin'), wrap(async (req, res) => {
  const { name, role, cohortId, active, email, password } = req.body;
  const { rows } = await q(`update users set name=coalesce($2,name), role=coalesce($3,role), cohort_id=case when $7 then $4 else cohort_id end, active=coalesce($5,active), email=coalesce($6,email) where id=$1 returning *`,
    [req.params.id, name, role, cohortId || null, active, email, cohortId !== undefined]);
  if (!rows[0]) throw httpErr(404, 'User not found');
  if (password) await q('update users set password_hash=$1 where id=$2', [await bcrypt.hash(password, 10), req.params.id]);
  await audit(req, 'user.update', { id: req.params.id, role, active });
  res.json(userOut(rows[0]));
}));
app.delete('/api/users/:id', need('admin'), wrap(async (req, res) => {
  if (req.params.id === req.user.id) throw httpErr(400, 'You can’t delete your own account.');
  await q('delete from users where id=$1', [req.params.id]);
  await audit(req, 'user.delete', { id: req.params.id });
  res.json({ ok: true });
}));

// ---------- cohorts ----------
const cohortOut = (c) => ({ id: c.id, name: c.name, term: c.term, instructorId: c.instructor_id });
app.get('/api/cohorts', need(), wrap(async (req, res) => { const { rows } = await q('select * from cohorts order by name'); res.json(rows.map(cohortOut)); }));
app.post('/api/cohorts', need('admin', 'instructor'), wrap(async (req, res) => {
  const { name, term, instructorId } = req.body;
  const { rows } = await q('insert into cohorts(id,name,term,instructor_id) values($1,$2,$3,$4) returning *', [newId('co'), name, term, instructorId || (req.user.role === 'instructor' ? req.user.id : null)]);
  await audit(req, 'cohort.create', { name }); res.json(cohortOut(rows[0]));
}));
app.put('/api/cohorts/:id', need('admin', 'instructor'), wrap(async (req, res) => {
  const { name, term, instructorId } = req.body;
  const { rows } = await q('update cohorts set name=$2, term=$3, instructor_id=$4 where id=$1 returning *', [req.params.id, name, term, instructorId || null]);
  await audit(req, 'cohort.update', { name }); res.json(cohortOut(rows[0]));
}));
app.delete('/api/cohorts/:id', need('admin'), wrap(async (req, res) => { await q('update users set cohort_id=null where cohort_id=$1', [req.params.id]); await q('delete from cohorts where id=$1', [req.params.id]); await audit(req, 'cohort.delete', { id: req.params.id }); res.json({ ok: true }); }));

// ---------- competencies ----------
app.get('/api/competencies', need(), wrap(async (req, res) => { const { rows } = await q('select * from competencies order by sort, code'); res.json(rows); }));
app.post('/api/competencies', need('admin'), wrap(async (req, res) => {
  const c = req.body;
  if (!c.id || !c.name) throw httpErr(400, 'ID and name are required.');
  await q('insert into competencies(id,code,domain,name,description,remediation,sort) values($1,$2,$3,$4,$5,$6,(select coalesce(max(sort),0)+1 from competencies))', [c.id, c.code, c.domain, c.name, c.description, c.remediation]);
  await audit(req, 'competency.create', { id: c.id }); res.json(c);
}));
app.put('/api/competencies/:id', need('admin'), wrap(async (req, res) => {
  const c = req.body;
  await q('update competencies set code=$2, domain=$3, name=$4, description=$5, remediation=$6 where id=$1', [req.params.id, c.code, c.domain, c.name, c.description, c.remediation]);
  await audit(req, 'competency.update', { id: req.params.id }); res.json(c);
}));
app.delete('/api/competencies/:id', need('admin'), wrap(async (req, res) => { await q('delete from competencies where id=$1', [req.params.id]); await audit(req, 'competency.delete', { id: req.params.id }); res.json({ ok: true }); }));

// ---------- scenarios ----------
const scOut = (r) => ({ ...r.data, id: r.id, title: r.title, status: r.status, authorId: r.author_id, updatedAt: r.updated_at });
app.get('/api/scenarios', need(), wrap(async (req, res) => {
  const { rows } = await q(req.user.role === 'student' ? "select * from scenarios where status='published' order by title" : 'select * from scenarios order by updated_at desc');
  res.json(rows.map(scOut));
}));
app.get('/api/scenarios/:id', need(), wrap(async (req, res) => {
  const { rows } = await q('select * from scenarios where id=$1', [req.params.id]);
  if (!rows[0] || (req.user.role === 'student' && rows[0].status !== 'published')) throw httpErr(404, 'Scenario not found');
  res.json(scOut(rows[0]));
}));
function validateScenario(s) {
  if (!s.title?.trim()) throw httpErr(400, 'Give the scenario a title.');
  if (!Array.isArray(s.states) || !s.states.length) throw httpErr(400, 'A scenario needs at least one patient state.');
  if (JSON.stringify(s).length > 1_500_000) throw httpErr(413, 'Scenario is too large.');
}
app.post('/api/scenarios', need('admin', 'instructor'), wrap(async (req, res) => {
  const s = req.body; validateScenario(s);
  const id = newId('sc');
  const { rows } = await q('insert into scenarios(id,title,status,author_id,data) values($1,$2,$3,$4,$5) returning *', [id, s.title, s.status || 'draft', req.user.id, JSON.stringify({ ...s, id })]);
  await audit(req, 'scenario.create', { title: s.title }); res.json(scOut(rows[0]));
}));
app.put('/api/scenarios/:id', need('admin', 'instructor'), wrap(async (req, res) => {
  const s = req.body; validateScenario(s);
  const { rows: ex } = await q('select author_id from scenarios where id=$1', [req.params.id]);
  if (!ex[0]) throw httpErr(404, 'Scenario not found');
  const { rows } = await q('update scenarios set title=$2, status=$3, data=$4, updated_at=now() where id=$1 returning *', [req.params.id, s.title, s.status || 'draft', JSON.stringify(s)]);
  await audit(req, 'scenario.update', { title: s.title, status: s.status }); res.json(scOut(rows[0]));
}));
app.delete('/api/scenarios/:id', need('admin', 'instructor'), wrap(async (req, res) => {
  const { rows } = await q('select author_id from scenarios where id=$1', [req.params.id]);
  if (req.user.role === 'instructor' && rows[0] && rows[0].author_id !== req.user.id) throw httpErr(403, 'Only the author or an admin can delete this scenario.');
  await q('delete from scenarios where id=$1', [req.params.id]); await audit(req, 'scenario.delete', { id: req.params.id }); res.json({ ok: true });
}));

// ---------- assignments ----------
const asOut = (a) => ({ id: a.id, scenarioId: a.scenario_id, cohortId: a.cohort_id, dueAt: a.due_at, createdBy: a.created_by, createdAt: a.created_at });
app.get('/api/assignments', need(), wrap(async (req, res) => {
  const { rows } = req.user.role === 'student' ? await q('select * from assignments where cohort_id=$1 order by due_at', [req.user.cohort_id]) : await q('select * from assignments order by due_at');
  res.json(rows.map(asOut));
}));
app.post('/api/assignments', need('admin', 'instructor'), wrap(async (req, res) => {
  const { scenarioId, cohortId, dueAt } = req.body;
  const { rows } = await q('insert into assignments(id,scenario_id,cohort_id,due_at,created_by) values($1,$2,$3,$4,$5) returning *', [newId('as'), scenarioId, cohortId, dueAt || null, req.user.id]);
  await audit(req, 'assignment.create', { scenarioId, cohortId }); res.json(asOut(rows[0]));
}));
app.delete('/api/assignments/:id', need('admin', 'instructor'), wrap(async (req, res) => { await q('delete from assignments where id=$1', [req.params.id]); res.json({ ok: true }); }));

// ---------- attempts ----------
const atOut = (a, full = true) => ({
  id: a.id, scenarioId: a.scenario_id, scenarioTitle: a.scenario_title, studentId: a.student_id, studentName: a.student_name,
  startedAt: a.started_at, completedAt: a.completed_at, status: a.status, result: a.result, score: a.score,
  reflections: a.reflections, aiFeedback: a.ai_feedback, instructorNote: a.instructor_note, remediation: a.remediation,
  ...(full ? { events: a.events } : { eventsCount: a.events_count }),
});
function attemptScope(user) {
  if (user.role === 'admin') return ['true', []];
  if (user.role === 'student') return ['a.student_id=$1', [user.id]];
  return ['u.cohort_id in (select id from cohorts where instructor_id=$1)', [user.id]];
}
app.get('/api/attempts', need(), wrap(async (req, res) => {
  const [where, params] = attemptScope(req.user);
  const { rows } = await q(`select a.id,a.scenario_id,a.student_id,a.started_at,a.completed_at,a.status,a.result,a.score,a.reflections,a.ai_feedback,a.instructor_note,a.remediation,
    jsonb_array_length(a.events) as events_count, s.title as scenario_title, u.name as student_name
    from attempts a join scenarios s on s.id=a.scenario_id join users u on u.id=a.student_id where ${where} order by a.started_at desc limit 2000`, params);
  res.json(rows.map(r => atOut(r, false)));
}));
app.get('/api/attempts/:id', need(), wrap(async (req, res) => {
  const [where, params] = attemptScope(req.user);
  const { rows } = await q(`select a.*, s.title as scenario_title, u.name as student_name from attempts a join scenarios s on s.id=a.scenario_id join users u on u.id=a.student_id where a.id=$${params.length + 1} and ${where}`, [...params, req.params.id]);
  if (!rows[0]) throw httpErr(404, 'Attempt not found');
  res.json(atOut(rows[0]));
}));
app.post('/api/attempts', need(), wrap(async (req, res) => {
  const { rows: sc } = await q('select id,title,status from scenarios where id=$1', [req.body.scenarioId]);
  if (!sc[0] || (req.user.role === 'student' && sc[0].status !== 'published')) throw httpErr(404, 'Scenario not found');
  const id = newId('at');
  await q('insert into attempts(id,scenario_id,student_id) values($1,$2,$3)', [id, sc[0].id, req.user.id]);
  res.json({ id, scenarioId: sc[0].id, scenarioTitle: sc[0].title, studentId: req.user.id, studentName: req.user.name, status: 'in-progress', startedAt: new Date().toISOString(), events: [] });
}));
app.post('/api/attempts/:id/finish', need(), wrap(async (req, res) => {
  const { rows } = await q('select a.*, s.data from attempts a join scenarios s on s.id=a.scenario_id where a.id=$1 and a.student_id=$2', [req.params.id, req.user.id]);
  if (!rows[0]) throw httpErr(404, 'Attempt not found');
  const events = Array.isArray(req.body.events) ? req.body.events.slice(0, 3000) : [];
  const settings = await getSettings();
  const result = scoreAttempt(rows[0].data, events, { passingScore: settings.passingScore || 75 }); // server-authoritative scoring
  await q("update attempts set events=$2, result=$3, score=$4, status='completed', completed_at=now() where id=$1", [req.params.id, JSON.stringify(events), JSON.stringify(result), result.score]);
  await audit(req, 'attempt.complete', { scenario: rows[0].data.title, score: result.score });
  const { rows: out } = await q('select a.*, s.title as scenario_title, u.name as student_name from attempts a join scenarios s on s.id=a.scenario_id join users u on u.id=a.student_id where a.id=$1', [req.params.id]);
  res.json(atOut(out[0]));
}));
app.put('/api/attempts/:id', need(), wrap(async (req, res) => {
  const [where, params] = attemptScope(req.user);
  const { rows } = await q(`select a.id from attempts a join users u on u.id=a.student_id where a.id=$${params.length + 1} and ${where}`, [...params, req.params.id]);
  if (!rows[0]) throw httpErr(404, 'Attempt not found');
  const b = req.body;
  if (b.reflections && req.user.role === 'student') await q('update attempts set reflections=$2 where id=$1', [req.params.id, JSON.stringify(b.reflections)]);
  if (b.aiFeedback !== undefined) await q('update attempts set ai_feedback=$2 where id=$1', [req.params.id, String(b.aiFeedback).slice(0, 20000)]);
  if (req.user.role !== 'student') {
    if (b.instructorNote !== undefined) await q('update attempts set instructor_note=$2 where id=$1', [req.params.id, b.instructorNote]);
    if (b.remediation !== undefined) await q('update attempts set remediation=$2 where id=$1', [req.params.id, b.remediation]);
  }
  res.json({ ok: true });
}));

// ---------- settings & audit ----------
app.get('/api/settings', need(), wrap(async (req, res) => {
  const s = await getSettings();
  res.json({ ...s, aiConfigured: !!process.env.ANTHROPIC_API_KEY, ttsProvider: TTS_PROVIDER });
}));
app.put('/api/settings', need('admin'), wrap(async (req, res) => {
  const cur = await getSettings();
  const { aiConfigured, ...rest } = req.body;
  const next = { ...cur, ...rest, passingScore: Math.max(0, Math.min(100, Number(rest.passingScore ?? cur.passingScore ?? 75))) };
  await q("insert into settings(key,value) values('app',$1) on conflict (key) do update set value=$1", [JSON.stringify(next)]);
  await audit(req, 'settings.update', rest); res.json({ ...next, aiConfigured: !!process.env.ANTHROPIC_API_KEY });
}));
app.get('/api/audit', need('admin'), wrap(async (req, res) => {
  const { rows } = await q('select id, user_id as "userId", user_name as "userName", action, detail, at from audit_log order by at desc limit 300');
  res.json(rows);
}));

// ---------- AI (Anthropic Claude) ----------
const aiBuckets = new Map();
const AI_KINDS = new Set(['patient', 'family', 'nurse', 'director', 'debrief', 'remediation', 'scenario']);
app.post('/api/ai', need(), wrap(async (req, res) => {
  const { kind, prompt, json, tier } = req.body || {};
  if (!AI_KINDS.has(kind) || typeof prompt !== 'string' || prompt.length > 60000) throw httpErr(400, 'Invalid AI request.');
  if ((kind === 'remediation' || kind === 'scenario') && req.user.role === 'student') throw httpErr(403, 'Not allowed.');
  const settings = await getSettings();
  if (!process.env.ANTHROPIC_API_KEY) return res.json({ disabled: true, reason: 'ANTHROPIC_API_KEY is not configured' });
  if (settings.aiEnabled === false) return res.json({ disabled: true, reason: 'AI is turned off by the administrator' });
  const b = aiBuckets.get(req.user.id) || { n: 0, at: Date.now() };
  if (Date.now() - b.at > 60e3) { b.n = 0; b.at = Date.now(); }
  if (++b.n > 40) throw httpErr(429, 'AI rate limit reached — wait a minute.');
  aiBuckets.set(req.user.id, b);
  const model = settings.model || process.env.ANTHROPIC_MODEL || (tier === 'quick' ? 'claude-haiku-4-5' : 'claude-sonnet-4-5');
  const maxTokens = { patient: 300, family: 300, nurse: 160, director: 400, debrief: 1400, remediation: 1400, scenario: 6000 }[kind];
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt + (json ? '\n\nRespond with only the JSON value.' : '') }] }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('[ai]', r.status, data?.error?.message); return res.json({ disabled: true, reason: data?.error?.message || `AI error ${r.status}` }); }
  const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  let parsed = null;
  if (json) {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = m ? m[1] : text.slice(Math.min(...['{', '['].map(c => (text.indexOf(c) + 1 || 1e9) - 1)), Math.max(text.lastIndexOf('}'), text.lastIndexOf(']')) + 1);
    try { parsed = JSON.parse(raw); } catch { return res.json({ disabled: true, reason: 'AI returned invalid JSON' }); }
  }
  res.json({ text, json: parsed, model });
}));

// ---------- Text-to-speech (OpenAI gpt-4o-mini-tts or ElevenLabs; browser voices otherwise) ----------
const TTS_PROVIDER = process.env.TTS_PROVIDER || (process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : process.env.OPENAI_API_KEY ? 'openai' : null);
app.get('/api/tts/status', need(), (req, res) => res.json({ provider: TTS_PROVIDER }));
const ttsCache = new Map(); // key → Buffer (bounded)
const ttsBuckets = new Map();
function openaiVoiceFor(p = {}) {
  const age = Number(p.age) || 45;
  if (age < 13) return p.gender === 'F' ? 'coral' : 'alloy';
  if (p.gender === 'F') return age > 65 ? 'sage' : /ja|zh|so|ar/.test(p.accent || '') ? 'shimmer' : 'nova';
  return age > 65 ? 'onyx' : /ja|zh|so|ar/.test(p.accent || '') ? 'ash' : 'echo';
}
const ACCENT_WORDS = { 'en-US': 'a neutral American accent', 'en-GB': 'a British accent', 'en-IE': 'a gentle Irish accent', 'en-IN': 'an Indian English accent', 'en-AU': 'an Australian accent', 'en-ZA': 'a South African accent', 'es-US': 'English with a Spanish accent', 'en-US-ja': 'English with a soft Japanese accent', 'en-US-so': 'English with a Somali accent, searching for words', 'en-US-zh': 'English with a Mandarin accent', 'en-US-ar': 'English with an Arabic accent', 'en-US-ht': 'English with a Haitian Creole accent', 'en-US-pt': 'English with a Portuguese accent' };
function ttsInstructions(p = {}, distress = 0, who = 'patient') {
  const age = Number(p.age) || 45;
  const parts = [`Voice: ${p.gender === 'F' ? 'female' : 'male'}, ${age < 13 ? `a ${age}-year-old child` : age < 20 ? 'a teenager' : age > 70 ? `an older adult of ${age}` : `an adult of about ${age}`}.`];
  parts.push(`Accent: ${ACCENT_WORDS[p.accent] || 'a neutral American accent'}.`);
  if (p.style) parts.push(`Manner: ${p.style}.`);
  if (who === 'nurse') parts.push('Tone: calm, warm, clear and professional, like a nurse speaking to a patient at the bedside.');
  if (distress >= 2) parts.push('The speaker is severely short of breath: speak in short broken phrases with audible effort and pauses.');
  else if (distress === 1) parts.push('The speaker is mildly short of breath and anxious; pause between phrases.');
  return parts.join(' ');
}
app.post('/api/tts', need(), wrap(async (req, res) => {
  const { text, profile = {}, distress = 0, who = 'patient' } = req.body || {};
  if (!TTS_PROVIDER) return res.status(404).json({ error: 'No TTS provider configured' });
  const clean = String(text || '').slice(0, 600);
  if (!clean.trim()) throw httpErr(400, 'Nothing to say.');
  const b = ttsBuckets.get(req.user.id) || { n: 0, at: Date.now() };
  if (Date.now() - b.at > 60e3) { b.n = 0; b.at = Date.now(); }
  if (++b.n > 90) throw httpErr(429, 'Voice rate limit reached — wait a minute.');
  ttsBuckets.set(req.user.id, b);
  const key = crypto.createHash('sha1').update(JSON.stringify([TTS_PROVIDER, clean, profile, distress, who])).digest('hex');
  let buf = ttsCache.get(key), type = 'audio/mpeg';
  if (!buf) {
    if (TTS_PROVIDER === 'elevenlabs') {
      const map = (() => { try { return JSON.parse(process.env.ELEVENLABS_VOICES || '{}'); } catch { return {}; } })();
      const age = Number(profile.age) || 45;
      const slot = age < 13 ? (profile.gender === 'F' ? 'girl' : 'boy') : profile.gender === 'F' ? (age > 65 ? 'olderFemale' : 'female') : (age > 65 ? 'olderMale' : 'male');
      const voiceId = map[slot] || map.female || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, { method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ text: clean, model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2', voice_settings: { stability: distress ? 0.3 : 0.5, similarity_boost: 0.8, style: distress ? 0.6 : 0.2 } }) });
      if (!r.ok) { console.error('[tts] elevenlabs', r.status, await r.text().catch(() => '')); return res.status(502).json({ error: 'TTS failed' }); }
      buf = Buffer.from(await r.arrayBuffer());
    } else {
      const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts', voice: profile.openaiVoice || openaiVoiceFor(profile), input: clean, instructions: ttsInstructions(profile, Number(distress) || 0, who), response_format: 'mp3', speed: Number(profile.age) > 75 ? 0.92 : 1 }) });
      if (!r.ok) { console.error('[tts] openai', r.status, await r.text().catch(() => '')); return res.status(502).json({ error: 'TTS failed' }); }
      buf = Buffer.from(await r.arrayBuffer());
    }
    if (ttsCache.size > 400) ttsCache.delete(ttsCache.keys().next().value);
    ttsCache.set(key, buf);
  }
  res.setHeader('Content-Type', type); res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(buf);
}));

app.get('/api/health', wrap(async (req, res) => { await q('select 1'); res.json({ ok: true, ai: !!process.env.ANTHROPIC_API_KEY }); }));

// ---------- static SPA ----------
const pub = path.join(__dirname, '..', 'public');
app.use(express.static(pub, { maxAge: '1h', index: false }));
app.get('*', (req, res) => res.sendFile(path.join(pub, 'index.html')));

migrateAndSeed()
  .then((r) => { if (r.seeded) console.log('[db] seeded'); })
  .catch((e) => console.error('[db] migration failed', e))
  .finally(() => app.listen(PORT, () => console.log(`SimWard listening on :${PORT}`)));
