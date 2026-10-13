import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { api } from '../api/index.js';
import { useApp } from '../store.jsx';
import { Btn, Modal, Field, Badge, Empty, Icon, toast, confirmAsk, Avatar, fmtDate, fmtDateTime, Bar, Spark, Radar, Markdown, Spinner } from '../ui/components.jsx';
import { PageHead } from './Admin.jsx';
import { competencyProfile, band } from '../sim/scoring.js';
import { presetEnvironment } from '../data/equipment.js';
import { aiText } from '../ai/client.js';
import { remediationPrompt } from '../ai/prompts.js';
import { remediationFallback } from '../ai/fallback.js';

function myStudents(data, user) {
  const cohorts = (data.cohorts || []).filter(c => user.role === 'admin' || c.instructorId === user.id);
  const ids = new Set(cohorts.map(c => c.id));
  return { cohorts, students: (data.users || []).filter(u => u.role === 'student' && ids.has(u.cohortId)) };
}

export function InstructorDashboard() {
  const { data, user, nav } = useApp();
  const { cohorts, students } = myStudents(data, user);
  const attempts = (data.attempts || []).filter(a => a.status === 'completed');
  const atRisk = students.map(s => {
    const mine = attempts.filter(a => a.studentId === s.id);
    const prof = competencyProfile(mine);
    const low = Object.entries(prof).filter(([, v]) => v.pct < 60).length;
    const harm = mine.reduce((n, a) => n + (a.result?.harmful?.length || 0), 0);
    const avg = mine.length ? Math.round(mine.reduce((x, a) => x + a.score, 0) / mine.length) : null;
    return { s, mine, low, harm, avg };
  }).filter(x => x.avg != null && (x.avg < 70 || x.harm > 0 || x.low >= 3)).sort((a, b) => a.avg - b.avg);
  const upcoming = (data.assignments || []).filter(a => cohorts.some(c => c.id === a.cohortId)).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const sc = (id) => (data.scenarios || []).find(s => s.id === id);
  return <div class="page">
    <PageHead eyebrow="Instructor" title={`Good to see you, ${user.name.split(/[ ,]/).filter(w => !/^(Prof\.|Dr\.)$/.test(w))[0]}`} sub="Who needs you this week, and how your cohorts are progressing.">
      <Btn kind="primary" icon="plus" onClick={() => nav('builder', {})}>New scenario</Btn>
    </PageHead>
    <div class="kpis">
      <div class="kpi"><span>Students</span><strong>{students.length}</strong><em>in {cohorts.length} cohort{cohorts.length === 1 ? '' : 's'}</em></div>
      <div class="kpi"><span>Completed attempts</span><strong>{attempts.filter(a => students.some(s => s.id === a.studentId)).length}</strong><em>across assigned scenarios</em></div>
      <div class="kpi warn"><span>Need follow-up</span><strong>{atRisk.length}</strong><em>below standard or safety events</em></div>
      <div class="kpi"><span>Open assignments</span><strong>{upcoming.length}</strong><em>next due {fmtDate(upcoming[0]?.dueAt)}</em></div>
    </div>
    <div class="grid-2">
      <section class="card">
        <h3><Icon name="alert" /> Students needing follow-up</h3>
        {atRisk.length ? <ul class="risk-list">{atRisk.map(x => <li>
          <button class="linkish" onClick={() => nav('student', { studentId: x.s.id })}><Avatar name={x.s.name} size={28} /><strong>{x.s.name}</strong></button>
          <span class="chips">{x.avg < 70 && <Badge tone="warn">avg {x.avg}%</Badge>}{x.harm > 0 && <Badge tone="bad">{x.harm} safety event{x.harm > 1 ? 's' : ''}</Badge>}{x.low >= 3 && <Badge>{x.low} weak competencies</Badge>}</span>
        </li>)}</ul> : <Empty icon="check" title="Everyone is on track" />}
      </section>
      <section class="card">
        <h3><Icon name="flag" /> Upcoming assignments</h3>
        <ul class="plain-list">{upcoming.slice(0, 6).map(a => {
          const done = new Set(attempts.filter(t => t.scenarioId === a.scenarioId).map(t => t.studentId));
          const members = students.filter(s => s.cohortId === a.cohortId);
          const pct = members.length ? Math.round(members.filter(m => done.has(m.id)).length / members.length * 100) : 0;
          return <li><div><strong>{sc(a.scenarioId)?.title}</strong><span class="small muted">{cohorts.find(c => c.id === a.cohortId)?.name} · due {fmtDate(a.dueAt)}</span></div><div class="mini-prog"><Bar pct={pct} tone="info" /><span class="small num">{pct}% done</span></div></li>;
        })}</ul>
      </section>
    </div>
    <CohortHeatmap />
  </div>;
}

function CohortHeatmap({ compact }) {
  const { data, user, nav } = useApp();
  const { cohorts, students } = myStudents(data, user);
  const [cohort, setCohort] = useState('all');
  const comps = data.competencies || [];
  const list = students.filter(s => cohort === 'all' || s.cohortId === cohort);
  const attempts = (data.attempts || []).filter(a => a.status === 'completed');
  return <section class="card">
    <div class="row between wrap"><h3><Icon name="grid" /> Competency heatmap</h3>
      <select aria-label="Cohort" value={cohort} onChange={e => setCohort(e.target.value)}><option value="all">All my cohorts</option>{cohorts.map(c => <option value={c.id}>{c.name}</option>)}</select></div>
    <p class="small muted">Average competency score per student across completed simulations. Select a student for their full profile and remediation plan.</p>
    <div class="table-wrap"><table class="heat">
      <thead><tr><th>Student</th>{comps.map(c => <th title={c.name}><span>{c.code}</span></th>)}<th>Avg</th></tr></thead>
      <tbody>{list.map(s => {
        const mine = attempts.filter(a => a.studentId === s.id);
        const prof = competencyProfile(mine);
        const avg = mine.length ? Math.round(mine.reduce((x, a) => x + a.score, 0) / mine.length) : null;
        return <tr><th><button class="linkish" onClick={() => nav('student', { studentId: s.id })}>{s.name}</button></th>
          {comps.map(c => { const p = prof[c.id]; return <td class={`hc hc-${band(p?.pct)}`} title={`${c.name}: ${p?.pct ?? '—'}%`}>{p?.pct ?? '·'}</td>; })}
          <td class="num"><strong>{avg ?? '—'}</strong></td></tr>;
      })}</tbody>
    </table></div>
    <div class="legend"><span class="hc-mastered">≥ 85 mastered</span><span class="hc-proficient">70–84 proficient</span><span class="hc-developing">50–69 developing</span><span class="hc-beginning">&lt; 50 beginning</span></div>
  </section>;
}

export function StudentsView() {
  return <div class="page"><PageHead title="Students & competencies" sub="Track each learner against QSEN and the NCSBN Clinical Judgment Measurement Model." /><CohortHeatmap /></div>;
}

export function StudentDetail({ studentId }) {
  const { data, nav, load } = useApp();
  const s = (data.users || []).find(u => u.id === studentId);
  const attempts = (data.attempts || []).filter(a => a.studentId === studentId && a.status === 'completed').sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  const prof = competencyProfile(attempts);
  const comps = data.competencies || [];
  const [plan, setPlan] = useState(attempts.find(a => a.remediation)?.remediation || '');
  const [busy, setBusy] = useState(false);
  if (!s) return <div class="page"><Empty title="Student not found" /></div>;
  const gen = async () => {
    setBusy(true);
    const withTitles = [...attempts].reverse();
    let text = await aiText('remediation', remediationPrompt(s, prof, withTitles, comps), { onText: ({ text }) => setPlan(text) });
    if (!text) { text = remediationFallback(s, prof, withTitles); toast('AI unavailable — generated a rule-based plan', 'info'); }
    setPlan(text); setBusy(false);
    if (attempts[0]) { await api.updateAttempt(attempts[0].id, { remediation: text }); load('attempts'); }
  };
  const cj = comps.filter(c => c.id.startsWith('cj-'));
  return <div class="page">
    <button class="back" onClick={() => nav('students')}><Icon name="arrowLeft" size={16} /> All students</button>
    <PageHead eyebrow={(data.cohorts || []).find(c => c.id === s.cohortId)?.name} title={s.name} sub={s.email} />
    <div class="grid-2">
      <section class="card">
        <h3>Clinical judgment profile</h3>
        {cj.length >= 3 && Object.keys(prof).length ? <Radar data={cj.map(c => ({ label: c.name, value: prof[c.id]?.pct ?? 0 }))} size={300} /> : <Empty title="No completed simulations yet" />}
      </section>
      <section class="card">
        <h3>All competencies</h3>
        <div class="comp-list">{comps.map(c => { const p = prof[c.id]; return <div class="comp-row"><span><strong>{c.code}</strong> {c.name}</span><Spark values={p?.trend || []} /><Bar pct={p?.pct} /><b class="num">{p?.pct ?? '—'}</b></div>; })}</div>
      </section>
    </div>
    <section class="card">
      <div class="row between wrap"><h3><Icon name="sparkle" /> Remediation plan</h3><Btn kind="primary" icon="sparkle" onClick={gen} disabled={busy || !attempts.length}>{busy ? 'Writing plan…' : plan ? 'Regenerate plan' : 'Generate remediation plan'}</Btn></div>
      {plan ? <Markdown text={plan} /> : <p class="muted">Generate a plan that analyzes this student’s patterns across attempts and recommends targeted remediation, a re-simulation schedule and coaching talking points.</p>}
    </section>
    <section class="card">
      <h3>Attempts</h3>
      {attempts.length ? <div class="table-wrap"><table class="table">
        <thead><tr><th>Scenario</th><th>Completed</th><th>Score</th><th>Critical misses</th><th>Safety events</th><th /></tr></thead>
        <tbody>{attempts.map(a => <tr>
          <td><strong>{a.scenarioTitle}</strong></td><td class="small">{fmtDateTime(a.completedAt)}</td>
          <td><Badge tone={a.result?.passed ? 'good' : 'bad'}>{a.score}%</Badge></td>
          <td class="small">{a.result?.criticalMissed?.length || 0}</td><td class="small">{a.result?.harmful?.length || 0}</td>
          <td><Btn small icon="eye" onClick={() => nav('report', { attemptId: a.id })}>Review</Btn></td></tr>)}</tbody>
      </table></div> : <Empty title="No attempts yet" />}
    </section>
  </div>;
}

export function ScenarioLibrary() {
  const { data, nav, load, user } = useApp();
  const [q, setQ] = useState('');
  const [course, setCourse] = useState('all');
  const [assign, setAssign] = useState(null);
  const ORDER = ['Fundamentals of Nursing', 'Medical-Surgical Nursing', 'Family-Centered Nursing'];
  const courses = [...new Set((data.scenarios || []).map(s => s.course).filter(Boolean))].sort((a, b) => (ORDER.indexOf(a) + 99) % 100 - (ORDER.indexOf(b) + 99) % 100);
  const list = (data.scenarios || []).filter(s => (course === 'all' || s.course === course) && (!q || `${s.title} ${s.specialty} ${s.summary} ${s.course || ''}`.toLowerCase().includes(q.toLowerCase())));
  const dup = async (s) => { const { id, ...rest } = s; await api.saveScenario({ ...rest, title: `${s.title} (copy)`, status: 'draft' }); load('scenarios'); toast('Scenario duplicated', 'good'); };
  const del = async (s) => { if (await confirmAsk(`Delete “${s.title}”? Assignments and attempts for it will be removed.`, { okLabel: 'Delete scenario', danger: true })) { try { await api.deleteScenario(s.id); load('scenarios', 'assignments', 'attempts'); } catch (e) { toast(e.message, 'bad'); } } };
  return <div class="page">
    <PageHead title="Scenario library" sub="Author, preview, publish and assign simulation scenarios.">
      <Btn kind="primary" icon="plus" onClick={() => nav('builder', {})}>New scenario</Btn>
    </PageHead>
    <div class="toolbar"><input class="search" placeholder="Search scenarios" aria-label="Search scenarios" value={q} onInput={e => setQ(e.target.value)} />
      <div class="seg wrap"><button class={course === 'all' ? 'on' : ''} onClick={() => setCourse('all')}>All courses</button>{courses.map(c => <button class={course === c ? 'on' : ''} onClick={() => setCourse(c)}>{c.replace(' Nursing', '')}</button>)}</div></div>
    <div class="sc-grid">{list.map(s => <article class="sc-card">
      <div class={`sc-art art-${s.environment?.preset || 'medsurg'}`}><span class="sc-spec">{s.specialty}</span><Badge tone={s.status === 'published' ? 'good' : 'warn'}>{s.status}</Badge></div>
      <div class="sc-body">
        <h3>{s.title}</h3>
        <p class="small muted">{s.patient?.name}, {s.patient?.age}{s.patient?.sex} · {s.difficulty} · {s.durationMin} min{s.family ? ' · family at bedside' : ''}</p>
        <p class="small">{s.summary}</p>
        <p class="small"><span class="course-pill">{s.program || 'LPN'}</span><span class="course-pill">{s.course || s.specialty}</span></p>
      </div>
      <div class="sc-foot">
        <Btn small icon="edit" onClick={() => nav('builder', { id: s.id })}>Edit</Btn>
        <Btn small icon="play" onClick={() => nav('player', { scenarioId: s.id, preview: true })}>Preview</Btn>
        <Btn small icon="flag" onClick={() => setAssign({ scenarioId: s.id, cohortId: (data.cohorts || [])[0]?.id, dueAt: '' })} disabled={s.status !== 'published'} title={s.status !== 'published' ? 'Publish before assigning' : ''}>Assign</Btn>
        <Btn small kind="ghost" icon="copy" onClick={() => dup(s)} aria-label="Duplicate" />
        {(user.role === 'admin' || s.authorId === user.id) && <Btn small kind="ghost" icon="trash" onClick={() => del(s)} aria-label="Delete" />}
      </div>
    </article>)}</div>
    {assign && <AssignModal init={assign} onClose={() => setAssign(null)} />}
  </div>;
}

function AssignModal({ init, onClose }) {
  const { data, load, user } = useApp();
  const [a, setA] = useState(init);
  const cohorts = (data.cohorts || []).filter(c => user.role === 'admin' || c.instructorId === user.id);
  const save = async () => { try { await api.saveAssignment({ ...a, dueAt: a.dueAt ? new Date(a.dueAt).toISOString() : null }); load('assignments'); toast('Scenario assigned', 'good'); onClose(); } catch (e) { toast(e.message, 'bad'); } };
  return <Modal title="Assign scenario" onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={save} disabled={!a.cohortId || !a.scenarioId}>Assign</Btn></>}>
    <div class="form-grid">
      <Field label="Scenario" id="a-sc"><select id="a-sc" value={a.scenarioId} onChange={e => setA({ ...a, scenarioId: e.target.value })}>{(data.scenarios || []).filter(s => s.status === 'published').map(s => <option value={s.id}>{s.title}</option>)}</select></Field>
      <Field label="Cohort" id="a-co"><select id="a-co" value={a.cohortId} onChange={e => setA({ ...a, cohortId: e.target.value })}>{cohorts.map(c => <option value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Due date" id="a-due"><input id="a-due" type="datetime-local" value={a.dueAt} onInput={e => setA({ ...a, dueAt: e.target.value })} /></Field>
    </div>
  </Modal>;
}

export function AssignmentsView() {
  const { data, load, user } = useApp();
  const [adding, setAdding] = useState(false);
  const cohorts = (data.cohorts || []).filter(c => user.role === 'admin' || c.instructorId === user.id);
  const list = (data.assignments || []).filter(a => cohorts.some(c => c.id === a.cohortId)).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const attempts = (data.attempts || []).filter(a => a.status === 'completed');
  return <div class="page">
    <PageHead title="Assignments" sub="Scenarios assigned to cohorts, with completion and performance.">
      <Btn kind="primary" icon="plus" onClick={() => setAdding(true)}>Assign scenario</Btn>
    </PageHead>
    {list.length ? <div class="table-wrap"><table class="table">
      <thead><tr><th>Scenario</th><th>Cohort</th><th>Due</th><th>Completion</th><th>Avg score</th><th>Pass rate</th><th /></tr></thead>
      <tbody>{list.map(a => {
        const members = (data.users || []).filter(u => u.cohortId === a.cohortId && u.role === 'student');
        const at = attempts.filter(t => t.scenarioId === a.scenarioId && members.some(m => m.id === t.studentId));
        const done = new Set(at.map(t => t.studentId)).size;
        const avg = at.length ? Math.round(at.reduce((s, t) => s + t.score, 0) / at.length) : null;
        const pr = at.length ? Math.round(at.filter(t => t.result?.passed).length / at.length * 100) : null;
        return <tr><td><strong>{(data.scenarios || []).find(s => s.id === a.scenarioId)?.title}</strong></td><td class="small">{cohorts.find(c => c.id === a.cohortId)?.name}</td><td class="small">{fmtDate(a.dueAt)}</td>
          <td><div class="mini-prog"><Bar pct={members.length ? Math.round(done / members.length * 100) : 0} tone="info" /><span class="small num">{done}/{members.length}</span></div></td>
          <td class="num">{avg ?? '—'}</td><td class="num">{pr != null ? `${pr}%` : '—'}</td>
          <td><Btn small kind="ghost" icon="trash" aria-label="Remove assignment" onClick={async () => { if (await confirmAsk('Remove this assignment? Attempts are kept.', { okLabel: 'Remove' })) { await api.deleteAssignment(a.id); load('assignments'); } }} /></td></tr>;
      })}</tbody>
    </table></div> : <Empty icon="flag" title="No assignments yet">Publish a scenario, then assign it to a cohort.</Empty>}
    {adding && <AssignModal init={{ scenarioId: (data.scenarios || []).find(s => s.status === 'published')?.id, cohortId: cohorts[0]?.id, dueAt: '' }} onClose={() => setAdding(false)} />}
  </div>;
}

export function newScenario() {
  return {
    title: 'Untitled scenario', program: 'LPN', course: 'Fundamentals of Nursing', specialty: 'Fundamentals', difficulty: 'Beginner', durationMin: 15, status: 'draft', scope: 'You are the LPN/LVN assigned to this patient under the supervision of the RN. Collect data, intervene within your scope, administer medications per facility policy, and report changes in condition to the RN using SBAR.', family: null, events: [], start: { o2: null, monitor: false },
    summary: '', objectives: [''], competencyIds: ['cj-recognize', 'cj-act', 'qsen-safety'],
    patient: { name: 'New Patient', age: 60, sex: 'F', weightKg: 70, heightCm: 165, mrn: '000-00-0000', dob: '1966-01-01', allergies: ['No known drug allergies'], codeStatus: 'Full code', isolation: 'Standard', diagnosis: '', chiefComplaint: '', history: '', social: '', homeMeds: [], personality: 'Cooperative and friendly.', voice: { gender: 'F', age: 60, accent: 'en-US', style: '' }, appearance: { avatarId: 'Female_Adult_09', skinTone: '#d7a98a', hair: '#4a3728', hairStyle: 'short', build: 'average', gown: '#8fb3c9' } },
    handoff: { situation: '', background: '', assessment: '', recommendation: '' },
    orders: [], meds: [], labs: [],
    states: [{ id: 's1', name: 'Baseline', x: 60, y: 60, cues: '', vitals: { hr: 88, sbp: 128, dbp: 78, rr: 16, spo2: 97, temp: 37, pain: 2, glucose: 110, loc: 'Alert', rhythm: 'Sinus rhythm' }, findings: { neuro: '', resp: '', cardio: '', skin: '', pain: '', gi: '', gu: '' } }],
    initialStateId: 's1', transitions: [], expected: [{ key: 'e1', actions: ['hand-hygiene'], critical: true, points: 5 }, { key: 'e2', actions: ['identify'], critical: true, points: 5 }], harmful: [], script: [], debrief: ['What cues did you notice first?'],
    environment: presetEnvironment('medsurg'), aiDirector: true,
  };
}
