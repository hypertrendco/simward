import { h } from 'preact';
import { useApp } from '../store.jsx';
import { Btn, Badge, Icon, Empty, Bar, Spark, Radar, fmtDate, fmtDateTime } from '../ui/components.jsx';
import { PageHead } from './Admin.jsx';
import { competencyProfile, band } from '../sim/scoring.js';

export function StudentDashboard() {
  const { data, user, nav } = useApp();
  const scenarios = data.scenarios || [];
  const attempts = (data.attempts || []).filter(a => a.studentId === user.id && a.status === 'completed');
  const assigned = (data.assignments || []).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const practice = scenarios.filter(s => s.status === 'published' && !assigned.some(a => a.scenarioId === s.id));
  const prof = competencyProfile(attempts);
  const cj = (data.competencies || []).filter(c => c.id.startsWith('cj-'));
  const card = (s, a) => {
    const mine = attempts.filter(t => t.scenarioId === s.id);
    const best = mine.length ? Math.max(...mine.map(t => t.score)) : null;
    const passed = mine.some(t => t.result?.passed);
    const overdue = a?.dueAt && new Date(a.dueAt) < new Date() && !passed;
    return <article class="sc-card">
      <div class={`sc-art art-${s.environment?.preset || 'medsurg'}`}><span class="sc-spec">{s.specialty}</span>{passed ? <Badge tone="good">Passed</Badge> : mine.length ? <Badge tone="warn">In progress</Badge> : overdue ? <Badge tone="bad">Overdue</Badge> : <Badge>Not started</Badge>}</div>
      <div class="sc-body"><h3>{s.title}</h3><p class="small muted">{s.patient?.name}, {s.patient?.age}{s.patient?.sex} · {s.difficulty} · {s.durationMin} min</p><p class="small">{s.summary}</p><p class="small"><span class="course-pill">{s.course || s.specialty}</span>{s.family && <span class="course-pill">family at bedside</span>}</p>
        {a && <p class="small"><Icon name="clock" size={14} /> Due {fmtDate(a.dueAt)}</p>}
        {best != null && <p class="small">Best score <strong>{best}%</strong> · {mine.length} attempt{mine.length > 1 ? 's' : ''}</p>}</div>
      <div class="sc-foot"><Btn kind="primary" small icon="play" onClick={() => nav('player', { scenarioId: s.id })}>{mine.length ? 'Run again' : 'Start'}</Btn>{mine[0] && <Btn small icon="file" onClick={() => nav('report', { attemptId: mine[0].id })}>Latest debrief</Btn>}</div>
    </article>;
  };
  return <div class="page">
    <PageHead eyebrow="Student" title={`Welcome back, ${user.name.split(' ')[0]}`} sub="Complete your assigned simulations, then review the debrief and remediation for each one." />
    <div class="grid-2 top">
      <section>
        <h2 class="section-title">Assigned to you</h2>
        {assigned.length ? <div class="sc-grid two">{assigned.map(a => { const s = scenarios.find(x => x.id === a.scenarioId); return s ? card(s, a) : null; })}</div> : <Empty icon="flag" title="Nothing assigned yet" />}
      </section>
      <section class="card">
        <h3>Your clinical judgment</h3>
        {attempts.length ? <Radar data={cj.map(c => ({ label: c.name, value: prof[c.id]?.pct ?? 0 }))} size={280} /> : <Empty icon="target" title="Complete a simulation to see your profile" />}
        <Btn small icon="target" onClick={() => nav('competencies')}>All competencies</Btn>
      </section>
    </div>
    {practice.length > 0 && <><h2 class="section-title">Practice library</h2><div class="sc-grid">{practice.map(s => card(s))}</div></>}
  </div>;
}

export function MyAttempts() {
  const { data, user, nav } = useApp();
  const attempts = (data.attempts || []).filter(a => a.studentId === user.id && a.status === 'completed').sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  return <div class="page">
    <PageHead title="Results & feedback" sub="Every completed attempt with its score, debrief and remediation guidance." />
    {attempts.length ? <div class="table-wrap"><table class="table">
      <thead><tr><th>Scenario</th><th>Completed</th><th>Score</th><th>Result</th><th>Critical misses</th><th /></tr></thead>
      <tbody>{attempts.map(a => <tr><td><strong>{a.scenarioTitle}</strong></td><td class="small">{fmtDateTime(a.completedAt)}</td><td class="num">{a.score}%</td><td>{a.result?.passed ? <Badge tone="good">Passed</Badge> : <Badge tone="bad">Not yet</Badge>}</td><td class="small">{(a.result?.criticalMissed || []).join('; ') || '—'}</td><td><Btn small icon="file" onClick={() => nav('report', { attemptId: a.id })}>Debrief</Btn></td></tr>)}</tbody>
    </table></div> : <Empty icon="file" title="No completed simulations yet" />}
  </div>;
}

export function MyCompetencies() {
  const { data, user } = useApp();
  const attempts = (data.attempts || []).filter(a => a.studentId === user.id && a.status === 'completed');
  const prof = competencyProfile(attempts);
  const comps = data.competencies || [];
  const domains = [...new Set(comps.map(c => c.domain))];
  return <div class="page">
    <PageHead title="My competencies" sub="Averages across your completed simulations, with your trend over time." />
    {domains.map(d => <section class="card"><h3>{d}</h3>
      <div class="comp-list">{comps.filter(c => c.domain === d).map(c => { const p = prof[c.id]; return <div class="comp-row tall">
        <div><strong>{c.name}</strong><span class={`band b-${band(p?.pct)}`}>{p ? band(p.pct) : 'not yet assessed'}</span><p class="small muted">{c.description}</p>{p && p.pct < 70 && <p class="small rem"><Icon name="book" size={14} /> {c.remediation}</p>}</div>
        <Spark values={p?.trend || []} /><Bar pct={p?.pct} /><b class="num">{p?.pct ?? '—'}</b></div>; })}</div>
    </section>)}
  </div>;
}
