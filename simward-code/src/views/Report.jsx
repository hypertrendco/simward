import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { api } from '../api/index.js';
import { useApp } from '../store.jsx';
import { Btn, Badge, Icon, toast, Markdown, Bar, Radar, Spinner, Empty, Field, fmtDateTime } from '../ui/components.jsx';
import { fmt, band } from '../sim/scoring.js';
import { aiText } from '../ai/client.js';
import { debriefPrompt } from '../ai/prompts.js';
import { feedbackFallback } from '../ai/fallback.js';
import { COMPETENCIES } from '../data/competencies.js';
import { loadNurse } from '../sim/voice.js';

const STATUS = { met: ['good', 'Met'], late: ['warn', 'Late'], 'out-of-order': ['warn', 'Out of order'], missed: ['bad', 'Missed'] };

export function ReportView({ attemptId }) {
  const { nav, user, load } = useApp();
  const [attempt, setAttempt] = useState(null);
  const [sc, setSc] = useState(null);
  useEffect(() => { api.getAttempt(attemptId).then(async a => { setAttempt(a); setSc(await api.getScenario(a.scenarioId).catch(() => null)); load('attempts'); }).catch(e => toast(e.message, 'bad')); }, [attemptId]);
  if (!attempt || !sc) return <div class="page"><Spinner label="Loading results…" /></div>;
  return <div class="page report-page">
    <button class="back" onClick={() => nav(user.role === 'student' ? 'attempts' : 'student', { studentId: attempt.studentId })}><Icon name="arrowLeft" size={16} /> Back</button>
    <Report attempt={attempt} scenario={sc} persist />
  </div>;
}

export function Report({ attempt, scenario: sc, persist }) {
  const { user, nav, data } = useApp();
  const r = attempt.result;
  const [fb, setFb] = useState(attempt.aiFeedback || '');
  const [busy, setBusy] = useState(false);
  const [refl, setRefl] = useState(attempt.reflections || {});
  const [note, setNote] = useState(attempt.instructorNote || '');
  const comps = data.competencies?.length ? data.competencies : COMPETENCIES;
  const isStudent = user.role === 'student';
  const genFeedback = async () => {
    setBusy(true);
    let text = await aiText('debrief', debriefPrompt(sc, r, attempt.events || [], refl, loadNurse(user)), { onText: ({ text }) => setFb(text) });
    const ai = !!text;
    if (!text) text = feedbackFallback(sc, r);
    setFb(text); setBusy(false);
    if (persist) await api.updateAttempt(attempt.id, { aiFeedback: text }).catch(() => {});
    if (!ai) toast('Showing rule-based feedback (AI unavailable)', 'info');
  };
  useEffect(() => { if (!fb) { if (isStudent || !persist) genFeedback(); else setFb(feedbackFallback(sc, r)); } }, []);
  if (!r) return <Empty title="This attempt has no result yet" />;
  const cjIds = ['cj-recognize', 'cj-analyze', 'cj-prioritize', 'cj-generate', 'cj-act', 'cj-evaluate'];
  const radar = cjIds.map(id => ({ label: comps.find(c => c.id === id)?.name || id, value: r.competencies[id]?.pct ?? 0 }));
  const weak = Object.entries(r.competencies).filter(([, v]) => v.pct != null && v.pct < 70).map(([id]) => comps.find(c => c.id === id)).filter(Boolean);
  const events = attempt.events || [];
  const saveRefl = async () => { await api.updateAttempt(attempt.id, { reflections: refl }); toast('Reflection saved', 'good'); };
  return <div class="report">
    <section class={`rep-hero ${r.passed ? 'pass' : 'fail'}`}>
      <div class="score-ring" style={{ '--p': r.score }}><strong>{r.score}<small>%</small></strong><span>{r.passed ? 'Passed' : 'Not yet'}</span></div>
      <div class="rep-head">
        <span class="eyebrow">Debrief · {attempt.studentName}{attempt.completedAt ? ` · ${fmtDateTime(attempt.completedAt)}` : ''}</span>
        <h1>{sc.title}</h1>
        <p>Final patient state: <strong>{r.finalStateName}</strong> · Scenario time {fmt(r.stats.durationSec)} · {r.stats.actions} actions · {r.stats.questionsAsked} questions to the patient{r.stats.familyTalk ? ` · ${r.stats.familyTalk} to the family` : ''}{r.stats.eventsResponded ? ` · cues answered ${r.stats.eventsResponded}` : ''}</p>
        <div class="chips">
          {r.criticalMissed.length > 0 && <Badge tone="bad">{r.criticalMissed.length} critical action{r.criticalMissed.length > 1 ? 's' : ''} missed</Badge>}
          {r.harmful.length > 0 && <Badge tone="bad">{r.harmful.length} safety event{r.harmful.length > 1 ? 's' : ''}</Badge>}
          {r.rightsIssues.length > 0 && <Badge tone="warn">Med rights incomplete ×{r.rightsIssues.length}</Badge>}
          <Badge tone="neutral">Passing: {r.passingScore}% + all critical actions</Badge>
        </div>
      </div>
      {isStudent && persist && <Btn kind="primary" icon="rotate" onClick={() => nav('player', { scenarioId: sc.id })}>Try again</Btn>}
    </section>

    <div class="grid-2">
      <section class="card">
        <h3><Icon name="sparkle" /> Personalized feedback</h3>
        {fb ? <Markdown text={fb} /> : <Spinner label="Your facilitator is writing feedback…" />}
        {!busy && fb && <Btn small kind="ghost" icon="rotate" onClick={genFeedback}>Regenerate</Btn>}
      </section>
      <div class="stack">
        <section class="card">
          <h3>Clinical judgment (NCSBN CJMM)</h3>
          <Radar data={radar} size={280} />
        </section>
        <section class="card">
          <h3>Competencies this attempt</h3>
          <div class="comp-list">{Object.entries(r.competencies).filter(([, v]) => v.pct != null).sort((a, b) => a[1].pct - b[1].pct).map(([id, v]) => { const c = comps.find(x => x.id === id); return <div class="comp-row"><span><strong>{c?.code}</strong> {c?.name || id}</span><Bar pct={v.pct} /><b class="num">{v.pct}%</b></div>; })}</div>
        </section>
      </div>
    </div>

    <section class="card">
      <h3>Expected actions</h3>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Action</th><th>Status</th><th>Time</th><th>Points</th><th>Why it matters</th></tr></thead>
        <tbody>{r.items.map(i => { const [tone, label] = STATUS[i.status]; return <tr class={i.status === 'missed' && i.critical ? 'row-bad' : ''}>
          <td><strong>{i.label}</strong>{i.critical && <Badge tone="info">critical</Badge>}</td>
          <td><Badge tone={tone}>{label}</Badge>{i.note && <div class="small muted">{i.note}</div>}</td>
          <td class="num">{fmt(i.t)}</td><td class="num">{i.earned}/{i.points}</td><td class="small">{i.rationale}</td></tr>; })}</tbody>
      </table></div>
      {r.eventItems?.length > 0 && <><h3><Icon name="bell" /> Cues & interruptions</h3><div class="table-wrap"><table class="table ev-table"><thead><tr><th>Time</th><th>What happened</th><th>Your response</th><th>Points</th></tr></thead><tbody>{r.eventItems.map(e => <tr class={!e.responded && e.points ? 'row-bad' : ''}><td class="num">{fmt(e.t)}</td><td><strong>{e.kind}</strong><div class="small">{e.text}</div>{e.rationale && <div class="small muted">{e.rationale}</div>}</td><td>{e.responded ? <><Badge tone="good">Responded</Badge><div class="small">{e.responseLabel} at {fmt(e.responseT)}</div></> : <><Badge tone="bad">No response</Badge><div class="small muted">Expected: {e.expected.join(' / ')}</div></>}</td><td class="num">{e.responded ? e.points : 0}/{e.points}</td></tr>)}</tbody></table></div></>}
      {r.harmful.length > 0 && <><h3 class="bad-text"><Icon name="alert" /> Safety events</h3><ul class="harm-list">{r.harmful.map(h => <li><strong>{h.label}</strong> at {fmt(h.t)} (−{h.penalty}) — {h.rationale}</li>)}</ul></>}
      {r.rightsIssues.length > 0 && <><h3>Medication rights</h3><ul class="harm-list warn">{r.rightsIssues.map(x => <li><strong>{x.label}</strong> at {fmt(x.t)} — not verified: {x.missing.join(', ')}</li>)}</ul></>}
    </section>

    <div class="grid-2">
      <section class="card">
        <h3>Timeline</h3>
        <ol class="timeline">{events.filter(e => ['action', 'transition', 'note', 'event'].includes(e.type) || (e.type === 'chat' && e.role === 'student')).map(e => <li class={`tl-${e.type}${e.harmful ? ' harm' : ''}`}><span class="num">{fmt(e.t)}</span><div>{e.type === 'transition' ? <em>Patient condition changed: {e.label}</em> : e.type === 'event' ? <em>Cue ({e.kind}): {e.label}</em> : e.type === 'chat' ? <span>You said{e.to === 'family' ? ' to the family' : ''}: “{e.label}”</span> : <strong>{e.label}</strong>}{e.detail && e.type !== 'transition' && <p class="small muted">{e.detail}</p>}</div></li>)}</ol>
      </section>
      <div class="stack">
        {weak.length > 0 && <section class="card">
          <h3><Icon name="book" /> Remediation guidance</h3>
          <ul class="rem-list">{weak.map(c => <li><strong>{c.name}</strong> <span class={`band b-${band(r.competencies[c.id].pct)}`}>{r.competencies[c.id].pct}%</span><p class="small">{c.remediation}</p></li>)}</ul>
        </section>}
        <section class="card">
          <h3>Reflection</h3>
          {(sc.debrief || []).filter(Boolean).map((q, i) => <Field label={q} id={`rf-${i}`}><textarea id={`rf-${i}`} rows="2" value={refl[q] || ''} disabled={!isStudent || !persist} onInput={e => setRefl({ ...refl, [q]: e.target.value })} /></Field>)}
          {isStudent && persist && <div class="row gap"><Btn small icon="check" onClick={saveRefl}>Save reflection</Btn><Btn small kind="ghost" icon="sparkle" onClick={async () => { await saveRefl(); genFeedback(); }}>Update feedback with my reflection</Btn></div>}
        </section>
        {!isStudent && persist && <section class="card">
          <h3>Instructor note</h3>
          <textarea rows="3" aria-label="Instructor note" value={note} onInput={e => setNote(e.target.value)} placeholder="Private coaching note for this attempt" />
          <Btn small icon="check" onClick={async () => { await api.updateAttempt(attempt.id, { instructorNote: note }); toast('Note saved', 'good'); }}>Save note</Btn>
        </section>}
        {isStudent && attempt.instructorNote && <section class="card"><h3>Note from your instructor</h3><p>{attempt.instructorNote}</p></section>}
      </div>
    </div>
  </div>;
}
