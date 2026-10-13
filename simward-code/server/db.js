import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { SEED_SCENARIOS } from '../src/data/scenarios.js';
import { COMPETENCIES } from '../src/data/competencies.js';
import { SEED_USERS, SEED_COHORTS, SEED_ASSIGNMENTS, seedAttempts, DEFAULT_SETTINGS } from '../src/data/seed.js';

const { Pool } = pg;
const url = process.env.DATABASE_URL;
if (!url) console.warn('[db] DATABASE_URL is not set — the server will not be able to persist data.');
export const pool = new Pool({
  connectionString: url,
  ssl: url && !/localhost|127\.0\.0\.1|railway\.internal/.test(url) ? { rejectUnauthorized: false } : false,
  max: 10,
});
export const q = (text, params) => pool.query(text, params);

const SCHEMA = `
create table if not exists users (
  id text primary key, email text unique not null, name text not null,
  role text not null check (role in ('admin','instructor','student')),
  cohort_id text, password_hash text not null, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists cohorts (id text primary key, name text not null, term text, instructor_id text references users(id) on delete set null);
create table if not exists competencies (id text primary key, code text, domain text, name text not null, description text, remediation text, sort int default 0);
create table if not exists scenarios (
  id text primary key, title text not null, status text not null default 'draft', author_id text references users(id) on delete set null,
  data jsonb not null, updated_at timestamptz not null default now()
);
create table if not exists assignments (
  id text primary key, scenario_id text references scenarios(id) on delete cascade, cohort_id text references cohorts(id) on delete cascade,
  due_at timestamptz, created_by text references users(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists attempts (
  id text primary key, scenario_id text references scenarios(id) on delete cascade, student_id text references users(id) on delete cascade,
  started_at timestamptz not null default now(), completed_at timestamptz, status text not null default 'in-progress',
  events jsonb not null default '[]', result jsonb, score int, reflections jsonb default '{}', ai_feedback text,
  instructor_note text, remediation text
);
create index if not exists attempts_student on attempts(student_id);
create index if not exists attempts_scenario on attempts(scenario_id);
create table if not exists settings (key text primary key, value jsonb not null);
create table if not exists audit_log (id bigserial primary key, user_id text, user_name text, action text not null, detail jsonb, at timestamptz not null default now());
`;

export const newId = (p) => `${p}-${crypto.randomBytes(5).toString('hex')}`;

export async function migrateAndSeed() {
  await q(SCHEMA);
  const { rows } = await q('select count(*)::int as n from users');
  if (rows[0].n > 0) return { seeded: false };
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@simward.edu').toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  const demoPass = process.env.DEMO_PASSWORD || 'SimWard!2026';
  const seedDemo = process.env.SEED_DEMO !== 'false';
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const c of COMPETENCIES.map((c, i) => ({ ...c, sort: i }))) {
      await client.query('insert into competencies(id,code,domain,name,description,remediation,sort) values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing', [c.id, c.code, c.domain, c.name, c.description, c.remediation, c.sort]);
    }
    await client.query('insert into settings(key,value) values($1,$2) on conflict do nothing', ['app', JSON.stringify(DEFAULT_SETTINGS)]);
    const users = seedDemo ? SEED_USERS : SEED_USERS.filter(u => u.role === 'admin');
    for (const u of users) {
      const isAdmin = u.id === 'u-admin';
      const hash = await bcrypt.hash(isAdmin ? adminPass : demoPass, 10);
      await client.query('insert into users(id,email,name,role,cohort_id,password_hash) values($1,$2,$3,$4,$5,$6)', [u.id, isAdmin ? adminEmail : u.email, u.name, u.role, null, hash]);
    }
    if (seedDemo) {
      for (const c of SEED_COHORTS) await client.query('insert into cohorts(id,name,term,instructor_id) values($1,$2,$3,$4)', [c.id, c.name, c.term, c.instructorId]);
      for (const u of SEED_USERS.filter(x => x.cohortId)) await client.query('update users set cohort_id=$1 where id=$2', [u.cohortId, u.id]);
    }
    for (const s of SEED_SCENARIOS) await client.query('insert into scenarios(id,title,status,author_id,data) values($1,$2,$3,$4,$5)', [s.id, s.title, s.status, seedDemo ? 'u-inst' : 'u-admin', JSON.stringify(s)]);
    if (seedDemo) {
      for (const a of SEED_ASSIGNMENTS) await client.query('insert into assignments(id,scenario_id,cohort_id,due_at,created_by) values($1,$2,$3,$4,$5)', [a.id, a.scenarioId, a.cohortId, a.dueAt, a.createdBy]);
      for (const a of seedAttempts()) {
        await client.query('insert into attempts(id,scenario_id,student_id,started_at,completed_at,status,events,result,score,reflections) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [a.id, a.scenarioId, a.studentId, a.startedAt, a.completedAt, a.status, JSON.stringify(a.events), JSON.stringify(a.result), a.score, '{}']);
      }
    }
    await client.query("insert into audit_log(user_id,user_name,action,detail) values('u-admin','System','system.seed',$1)", [JSON.stringify({ demo: seedDemo })]);
    await client.query('commit');
  } catch (e) {
    await client.query('rollback'); throw e;
  } finally { client.release(); }
  console.log(`[seed] Admin account: ${adminEmail}${process.env.ADMIN_PASSWORD ? '' : ` / generated password: ${adminPass}`}`);
  if (seedDemo) console.log(`[seed] Demo instructor/student accounts use password from DEMO_PASSWORD (default SimWard!2026)`);
  return { seeded: true };
}
