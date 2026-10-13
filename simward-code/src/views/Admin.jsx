import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { api, MODE } from '../api/index.js';
import { useApp } from '../store.jsx';
import { Btn, Modal, Field, Badge, Empty, Icon, toast, confirmAsk, Avatar, fmtDate, fmtDateTime, useAsync, Spinner, Bar } from '../ui/components.jsx';
import { competencyProfile } from '../sim/scoring.js';

export function PageHead({ title, sub, children, eyebrow }) {
  return <div class="page-head"><div>{eyebrow && <span class="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{sub && <p class="sub">{sub}</p>}</div><div class="page-actions">{children}</div></div>;
}

export function AdminOverview() {
  const { data, nav } = useApp();
  const users = data.users || [], attempts = data.attempts || [], scenarios = data.scenarios || [];
  const completed = attempts.filter(a => a.status === 'completed');
  const passRate = completed.length ? Math.round(completed.filter(a => a.result?.passed).length / completed.length * 100) : 0;
  const avg = completed.length ? Math.round(completed.reduce((s, a) => s + (a.score || 0), 0) / completed.length) : 0;
  const prof = competencyProfile(completed);
  const byRole = (r) => users.filter(u => u.role === r).length;
  return <div class="page">
    <PageHead eyebrow={data.settings?.institution} title="Program overview" sub="Simulation activity, outcomes and system health across all cohorts." />
    <div class="kpis">
      <div class="kpi"><span>Active learners</span><strong>{byRole('student')}</strong><em>{byRole('instructor')} faculty · {byRole('admin')} admin</em></div>
      <div class="kpi"><span>Scenarios</span><strong>{scenarios.length}</strong><em>{scenarios.filter(s => s.status === 'published').length} published</em></div>
      <div class="kpi"><span>Completed attempts</span><strong>{completed.length}</strong><em>avg score {avg}%</em></div>
      <div class="kpi"><span>First-pass standard</span><strong>{passRate}%</strong><em>of attempts passed</em></div>
    </div>
    <div class="grid-2">
      <section class="card">
        <h3>Program competency profile</h3>
        <p class="muted small">Average across all completed attempts. Weakest first.</p>
        <div class="comp-list">
          {(data.competencies || []).map(c => ({ c, p: prof[c.id] })).filter(x => x.p).sort((a, b) => a.p.pct - b.p.pct).map(({ c, p }) => <div class="comp-row"><span><strong>{c.code}</strong> {c.name}</span><Bar pct={p.pct} /><b class="num">{p.pct}%</b></div>)}
        </div>
      </section>
      <section class="card">
        <h3>Recent activity</h3>
        <ul class="activity">{completed.slice(0, 8).map(a => <li><Avatar name={a.studentName} size={26} /><div><strong>{a.studentName}</strong> completed <em>{a.scenarioTitle}</em><span class="muted small"> · {fmtDateTime(a.completedAt)}</span></div><Badge tone={a.result?.passed ? 'good' : 'bad'}>{a.score}%</Badge></li>)}</ul>
        <div class="row gap"><Btn small icon="users" onClick={() => nav('users')}>Manage users</Btn><Btn small icon="gear" onClick={() => nav('settings')}>Settings</Btn></div>
      </section>
    </div>
  </div>;
}

export function AdminUsers() {
  const { data, load, user: me } = useApp();
  const [edit, setEdit] = useState(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const users = (data.users || []).filter(u => (filter === 'all' || u.role === filter) && (!q || `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())));
  const cohorts = data.cohorts || [];
  const cohortName = (id) => cohorts.find(c => c.id === id)?.name || '—';
  const save = async () => {
    try {
      const r = edit.id ? await api.updateUser(edit.id, edit) : await api.createUser(edit);
      toast(r.tempPassword ? `User created. Temporary password: ${r.tempPassword}` : 'User saved', 'good');
      setEdit(null); load('users');
    } catch (e) { toast(e.message, 'bad'); }
  };
  const del = async (u) => { if (await confirmAsk(`Delete ${u.name}? Their attempts will also be removed.`, { okLabel: 'Delete user', danger: true })) { try { await api.deleteUser(u.id); load('users', 'attempts'); toast('User deleted'); } catch (e) { toast(e.message, 'bad'); } } };
  return <div class="page">
    <PageHead title="Users & roles" sub="Role-based access: admins manage the platform, instructors author scenarios and review learners, students run assigned simulations.">
      <Btn kind="primary" icon="plus" onClick={() => setEdit({ name: '', email: '', role: 'student', cohortId: cohorts[0]?.id || null })}>Add user</Btn>
    </PageHead>
    <div class="toolbar">
      <input class="search" placeholder="Search name or email" value={q} onInput={e => setQ(e.target.value)} aria-label="Search users" />
      <div class="seg">{['all', 'admin', 'instructor', 'student'].map(r => <button class={filter === r ? 'on' : ''} onClick={() => setFilter(r)}>{r === 'all' ? 'All' : r[0].toUpperCase() + r.slice(1) + 's'}</button>)}</div>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Name</th><th>Role</th><th>Cohort</th><th>Status</th><th>Created</th><th /></tr></thead>
      <tbody>{users.map(u => <tr>
        <td><div class="who"><Avatar name={u.name} size={28} /><div><strong>{u.name}</strong><span class="muted small">{u.email}</span></div></div></td>
        <td><span class={`role-pill r-${u.role}`}>{u.role}</span></td>
        <td class="small">{u.role === 'student' ? cohortName(u.cohortId) : '—'}</td>
        <td>{u.active ? <Badge tone="good">Active</Badge> : <Badge>Suspended</Badge>}</td>
        <td class="small muted">{fmtDate(u.createdAt)}</td>
        <td class="actions"><Btn small kind="ghost" icon="edit" onClick={() => setEdit({ ...u })} aria-label={`Edit ${u.name}`} />{u.id !== me.id && <Btn small kind="ghost" icon="trash" onClick={() => del(u)} aria-label={`Delete ${u.name}`} />}</td>
      </tr>)}</tbody>
    </table></div>
    {edit && <Modal title={edit.id ? 'Edit user' : 'Add user'} onClose={() => setEdit(null)} footer={<><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" onClick={save}>Save user</Btn></>}>
      <div class="form-grid">
        <Field label="Full name" id="u-name"><input id="u-name" value={edit.name} onInput={e => setEdit({ ...edit, name: e.target.value })} /></Field>
        <Field label="Email" id="u-email"><input id="u-email" type="email" value={edit.email} onInput={e => setEdit({ ...edit, email: e.target.value })} /></Field>
        <Field label="Role" id="u-role"><select id="u-role" value={edit.role} onChange={e => setEdit({ ...edit, role: e.target.value })}><option value="student">Student</option><option value="instructor">Instructor</option><option value="admin">Admin</option></select></Field>
        {edit.role === 'student' && <Field label="Cohort" id="u-cohort"><select id="u-cohort" value={edit.cohortId || ''} onChange={e => setEdit({ ...edit, cohortId: e.target.value || null })}><option value="">No cohort</option>{cohorts.map(c => <option value={c.id}>{c.name}</option>)}</select></Field>}
        {MODE !== 'local' && <Field label={edit.id ? 'Reset password (optional)' : 'Password (leave blank to generate)'} id="u-pw"><input id="u-pw" type="text" autocomplete="new-password" value={edit.password || ''} onInput={e => setEdit({ ...edit, password: e.target.value })} /></Field>}
        {edit.id && <Field label="Account status" id="u-active"><select id="u-active" value={edit.active ? '1' : '0'} onChange={e => setEdit({ ...edit, active: e.target.value === '1' })}><option value="1">Active</option><option value="0">Suspended</option></select></Field>}
      </div>
    </Modal>}
  </div>;
}

export function AdminCohorts() {
  const { data, load, user } = useApp();
  const [edit, setEdit] = useState(null);
  const instructors = (data.users || []).filter(u => u.role === 'instructor');
  const cohorts = (data.cohorts || []).filter(c => user.role === 'admin' || c.instructorId === user.id);
  const save = async () => { try { await api.saveCohort(edit); setEdit(null); load('cohorts'); toast('Cohort saved', 'good'); } catch (e) { toast(e.message, 'bad'); } };
  const del = async (c) => { if (await confirmAsk(`Delete cohort “${c.name}”? Students stay but lose this cohort.`, { okLabel: 'Delete', danger: true })) { await api.deleteCohort(c.id); load('cohorts', 'users'); } };
  return <div class="page">
    <PageHead title="Cohorts" sub="Group students by course section to assign scenarios and compare performance.">
      <Btn kind="primary" icon="plus" onClick={() => setEdit({ name: '', term: 'Spring 2027', instructorId: user.role === 'instructor' ? user.id : instructors[0]?.id })}>New cohort</Btn>
    </PageHead>
    <div class="cards">{cohorts.map(c => {
      const members = (data.users || []).filter(u => u.cohortId === c.id);
      const inst = (data.users || []).find(u => u.id === c.instructorId);
      return <div class="card cohort-card">
        <span class="eyebrow">{c.term}</span><h3>{c.name}</h3>
        <p class="muted small">Faculty: {inst?.name || 'Unassigned'}</p>
        <div class="avatars">{members.slice(0, 8).map(m => <Avatar name={m.name} size={28} />)}<span class="small muted">{members.length} student{members.length === 1 ? '' : 's'}</span></div>
        <div class="row gap"><Btn small icon="edit" onClick={() => setEdit({ ...c })}>Edit</Btn>{user.role === 'admin' && <Btn small kind="ghost" icon="trash" onClick={() => del(c)}>Delete</Btn>}</div>
      </div>;
    })}</div>
    {edit && <Modal title={edit.id ? 'Edit cohort' : 'New cohort'} onClose={() => setEdit(null)} footer={<><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" onClick={save}>Save</Btn></>}>
      <div class="form-grid">
        <Field label="Cohort name" id="c-name"><input id="c-name" value={edit.name} onInput={e => setEdit({ ...edit, name: e.target.value })} /></Field>
        <Field label="Term" id="c-term"><input id="c-term" value={edit.term} onInput={e => setEdit({ ...edit, term: e.target.value })} /></Field>
        {user.role === 'admin' && <Field label="Lead instructor" id="c-inst"><select id="c-inst" value={edit.instructorId || ''} onChange={e => setEdit({ ...edit, instructorId: e.target.value })}><option value="">Unassigned</option>{instructors.map(i => <option value={i.id}>{i.name}</option>)}</select></Field>}
      </div>
    </Modal>}
  </div>;
}

export function AdminCompetencies() {
  const { data, load, user } = useApp();
  const [edit, setEdit] = useState(null);
  const list = data.competencies || [];
  const domains = [...new Set(list.map(c => c.domain))];
  const save = async () => { try { await api.saveCompetency(edit); setEdit(null); load('competencies'); toast('Competency saved', 'good'); } catch (e) { toast(e.message, 'bad'); } };
  const canEdit = user.role === 'admin';
  return <div class="page">
    <PageHead title="Competency framework" sub="Every nursing action maps to these competencies. Scores roll up per attempt, per student and per cohort. Remediation text feeds student and instructor feedback.">
      {canEdit && <Btn kind="primary" icon="plus" onClick={() => setEdit({ _new: true, id: '', code: '', domain: domains[0] || 'Custom', name: '', description: '', remediation: '' })}>Add competency</Btn>}
    </PageHead>
    {domains.map(d => <section class="card">
      <h3>{d}</h3>
      <div class="comp-grid">{list.filter(c => c.domain === d).map(c => <div class="comp-card">
        <div class="row between"><code>{c.code}</code>{canEdit && <div><Btn small kind="ghost" icon="edit" onClick={() => setEdit({ ...c })} aria-label="Edit" /><Btn small kind="ghost" icon="trash" onClick={async () => { if (await confirmAsk(`Delete ${c.name}?`, { danger: true, okLabel: 'Delete' })) { await api.deleteCompetency(c.id); load('competencies'); } }} aria-label="Delete" /></div>}</div>
        <strong>{c.name}</strong><p class="small">{c.description}</p>
        <details><summary class="small">Remediation guidance</summary><p class="small muted">{c.remediation}</p></details>
      </div>)}</div>
    </section>)}
    {edit && <Modal title={edit._new ? 'Add competency' : 'Edit competency'} onClose={() => setEdit(null)} wide footer={<><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" onClick={save}>Save</Btn></>}>
      <div class="form-grid">
        <Field label="ID (unique, no spaces)" id="k-id"><input id="k-id" value={edit.id} disabled={!edit._new} onInput={e => setEdit({ ...edit, id: e.target.value.replace(/\s/g, '-').toLowerCase() })} /></Field>
        <Field label="Code" id="k-code"><input id="k-code" value={edit.code} onInput={e => setEdit({ ...edit, code: e.target.value })} /></Field>
        <Field label="Domain" id="k-dom"><input id="k-dom" list="domains" value={edit.domain} onInput={e => setEdit({ ...edit, domain: e.target.value })} /><datalist id="domains">{domains.map(d => <option value={d} />)}</datalist></Field>
        <Field label="Name" id="k-name"><input id="k-name" value={edit.name} onInput={e => setEdit({ ...edit, name: e.target.value })} /></Field>
      </div>
      <Field label="Description" id="k-desc"><textarea id="k-desc" rows="2" value={edit.description} onInput={e => setEdit({ ...edit, description: e.target.value })} /></Field>
      <Field label="Remediation guidance" id="k-rem" hint="Shown to students and instructors when this competency scores below 70%."><textarea id="k-rem" rows="3" value={edit.remediation} onInput={e => setEdit({ ...edit, remediation: e.target.value })} /></Field>
    </Modal>}
  </div>;
}

export function AdminSettings() {
  const { data, load } = useApp();
  const [s, setS] = useState(null);
  const cur = s || data.settings || {};
  const set = (k, v) => setS({ ...cur, [k]: v });
  const save = async () => { try { await api.saveSettings(cur); load('settings'); setS(null); toast('Settings saved', 'good'); } catch (e) { toast(e.message, 'bad'); } };
  return <div class="page narrow">
    <PageHead title="Settings" sub="Platform-wide configuration." />
    <section class="card">
      <h3>Institution</h3>
      <div class="form-grid">
        <Field label="Institution name" id="s-inst"><input id="s-inst" value={cur.institution || ''} onInput={e => set('institution', e.target.value)} /></Field>
        <Field label="Passing score (%)" id="s-pass" hint="Students must also complete every critical action with no critical safety events."><input id="s-pass" type="number" min="0" max="100" value={cur.passingScore ?? 75} onInput={e => set('passingScore', Number(e.target.value))} /></Field>
        <Field label="Allow retakes" id="s-retake"><select id="s-retake" value={cur.allowRetakes !== false ? '1' : '0'} onChange={e => set('allowRetakes', e.target.value === '1')}><option value="1">Yes — unlimited attempts</option><option value="0">No — one attempt per assignment</option></select></Field>
      </div>
    </section>
    <section class="card">
      <h3>AI engine</h3>
      <p class="small muted">{MODE === 'local' ? 'In this demo build, AI runs through your own Claude account when you allow it.' : cur.aiConfigured ? 'Anthropic Claude is connected (ANTHROPIC_API_KEY is set on the server).' : 'ANTHROPIC_API_KEY is not set on the server. Rule-based patient responses and feedback are used until it is added.'}</p>
      <p class="small muted">{MODE === 'local' ? 'Voices use each viewer’s device speech engine.' : cur.ttsProvider ? `Studio voices: ${cur.ttsProvider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI gpt-4o-mini-tts'} (persona-matched for sex, age, accent and distress).` : 'No studio voice provider configured (set OPENAI_API_KEY or ELEVENLABS_API_KEY). Browser voices are used, matched to sex, age and accent where the device offers them.'}</p>
      <div class="form-grid">
        <Field label="AI patient & feedback" id="s-ai"><select id="s-ai" value={cur.aiEnabled !== false ? '1' : '0'} onChange={e => set('aiEnabled', e.target.value === '1')}><option value="1">On</option><option value="0">Off — rule-based only</option></select></Field>
        <Field label="AI patient dialogue" id="s-pat" hint="The patient answers questions, reacts to every verbalized action, and speaks up when their condition changes or the nurse goes quiet. Off uses scripted lines only."><select id="s-pat" value={cur.aiPatient !== false ? '1' : '0'} onChange={e => set('aiPatient', e.target.value === '1')}><option value="1">On</option><option value="0">Off — scripted responses</option></select></Field>
        <Field label="AI scenario director" id="s-dir" hint="Lets AI nudge vitals and choose between scenario-defined transitions."><select id="s-dir" value={cur.aiDirector !== false ? '1' : '0'} onChange={e => set('aiDirector', e.target.value === '1')}><option value="1">On</option><option value="0">Off — deterministic handlers only</option></select></Field>
        {MODE !== 'local' && <Field label="Model override (optional)" id="s-model" hint="Leave blank to use the server default."><input id="s-model" value={cur.model || ''} placeholder="claude-sonnet-4-5" onInput={e => set('model', e.target.value)} /></Field>}
      </div>
    </section>
    <div class="row end"><Btn kind="primary" icon="check" onClick={save} disabled={!s}>Save settings</Btn></div>
  </div>;
}

export function AdminAudit() {
  const { data, loading } = useAsync(() => api.listAudit(), []);
  if (loading) return <div class="page"><Spinner /></div>;
  return <div class="page">
    <PageHead title="Audit log" sub="Sign-ins and every change to users, cohorts, scenarios, settings and attempts." />
    <div class="table-wrap"><table class="table">
      <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead>
      <tbody>{(data || []).map(a => <tr><td class="small nowrap">{fmtDateTime(a.at)}</td><td>{a.userName || '—'}</td><td><code>{a.action}</code></td><td class="small muted mono-wrap">{JSON.stringify(a.detail)}</td></tr>)}</tbody>
    </table></div>
  </div>;
}
