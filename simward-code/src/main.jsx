import { h, render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api, MODE } from './api/index.js';
import { AppProvider, useApp } from './store.jsx';
import { Toaster, ConfirmHost, Spinner, Icon, Btn, toast, Avatar, BrandMark } from './ui/components.jsx';
import { Login } from './views/Login.jsx';
import { AdminOverview, AdminUsers, AdminCohorts, AdminCompetencies, AdminSettings, AdminAudit } from './views/Admin.jsx';
import { InstructorDashboard, ScenarioLibrary, AssignmentsView, StudentsView, StudentDetail } from './views/Instructor.jsx';
import { Builder } from './views/Builder.jsx';
import { StudentDashboard, MyCompetencies, MyAttempts } from './views/Student.jsx';
import { Player } from './views/Player.jsx';
import { ReportView } from './views/Report.jsx';

const NAV = {
  admin: [
    { id: 'home', label: 'Overview', icon: 'home' },
    { id: 'users', label: 'Users & roles', icon: 'users' },
    { id: 'cohorts', label: 'Cohorts', icon: 'grid' },
    { id: 'library', label: 'Scenario library', icon: 'layers' },
    { id: 'competencies', label: 'Competency framework', icon: 'target' },
    { id: 'students', label: 'Competency tracking', icon: 'chart' },
    { id: 'settings', label: 'Settings', icon: 'gear' },
    { id: 'audit', label: 'Audit log', icon: 'log' },
  ],
  instructor: [
    { id: 'home', label: 'Dashboard', icon: 'home' },
    { id: 'library', label: 'Scenarios', icon: 'layers' },
    { id: 'assignments', label: 'Assignments', icon: 'flag' },
    { id: 'students', label: 'Students & competencies', icon: 'chart' },
    { id: 'cohorts', label: 'Cohorts', icon: 'grid' },
  ],
  student: [
    { id: 'home', label: 'My simulations', icon: 'home' },
    { id: 'attempts', label: 'Results & feedback', icon: 'file' },
    { id: 'competencies', label: 'My competencies', icon: 'target' },
  ],
};

function Shell() {
  const { user, setUser, route, nav } = useApp();
  const [menu, setMenu] = useState(false);
  const full = ['builder', 'player'].includes(route.name);
  const role = user.role;
  const page = (() => {
    const p = route.params;
    switch (route.name) {
      case 'builder': return <Builder id={p.id} />;
      case 'player': return <Player scenarioId={p.scenarioId} preview={p.preview} />;
      case 'report': return <ReportView attemptId={p.attemptId} />;
      case 'student': return <StudentDetail studentId={p.studentId} />;
      case 'library': return <ScenarioLibrary />;
      case 'assignments': return <AssignmentsView />;
      case 'students': return <StudentsView />;
      case 'users': return <AdminUsers />;
      case 'cohorts': return <AdminCohorts />;
      case 'competencies': return role === 'student' ? <MyCompetencies /> : <AdminCompetencies />;
      case 'settings': return <AdminSettings />;
      case 'audit': return <AdminAudit />;
      case 'attempts': return <MyAttempts />;
      default: return role === 'admin' ? <AdminOverview /> : role === 'instructor' ? <InstructorDashboard /> : <StudentDashboard />;
    }
  })();
  if (full) return <div class="full-page">{page}</div>;
  const logout = async () => { await api.logout(); setUser(null); };
  return <div class={`shell${menu ? ' menu-open' : ''}`}>
    <aside class="side">
      <div class="brand"><BrandMark /><div><strong>SimWard</strong><span>Virtual Clinical Simulation</span></div></div>
      <nav>{NAV[role].map(n => <button class={`nav-item${route.name === n.id || (n.id === 'home' && route.name === 'home') ? ' on' : ''}`} onClick={() => { nav(n.id); setMenu(false); }}><Icon name={n.icon} />{n.label}</button>)}</nav>
      <div class="side-foot">
        <div class="me"><Avatar name={user.name} /><div><strong>{user.name}</strong><span class={`role-pill r-${role}`}>{role}</span></div></div>
        <Btn kind="ghost" icon="logout" small onClick={logout}>Sign out</Btn>
        {MODE === 'local' && <Btn kind="ghost" icon="rotate" small onClick={async () => { await api.resetDemo(); toast('Demo data reset'); location.reload(); }}>Reset demo data</Btn>}
      </div>
    </aside>
    <header class="topbar"><button class="icon-btn" aria-label="Menu" onClick={() => setMenu(!menu)}><Icon name="menu" /></button><BrandMark /><strong>SimWard</strong></header>
    <main class="main">{page}</main>
  </div>;
}


function App() {
  const { user, setUser, load } = useApp();
  useEffect(() => { if (user) load('scenarios', 'cohorts', 'assignments', 'attempts', 'competencies', 'settings', ...(user.role !== 'student' ? ['users'] : [])); }, [user?.id]);
  if (!user) return <Login onLogin={setUser} />;
  return <Shell />;
}

function Root() {
  const [boot, setBoot] = useState({ ready: false, user: null });
  useEffect(() => { api.me().then(u => setBoot({ ready: true, user: u })).catch(() => setBoot({ ready: true, user: null })); }, []);
  if (!boot.ready) return <div class="boot"><Spinner label="Starting SimWard…" /></div>;
  return <AppProvider initialUser={boot.user}><App /><Toaster /><ConfirmHost /></AppProvider>;
}

render(<Root />, document.getElementById('app'));
