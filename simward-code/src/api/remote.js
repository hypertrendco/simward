async function req(method, url, body) {
  const r = await fetch(url, { method, credentials: 'include', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await r.json(); } catch { /* empty */ }
  if (!r.ok) { const e = new Error(data?.error || `Request failed (${r.status})`); e.status = r.status; throw e; }
  return data;
}
const g = (u) => req('GET', u), p = (u, b) => req('POST', u, b), u_ = (u, b) => req('PUT', u, b), d = (u) => req('DELETE', u);
export const remoteApi = {
  login: (email, password) => p('/api/auth/login', { email, password }),
  logout: () => p('/api/auth/logout'),
  me: () => g('/api/auth/me').catch(() => null),
  demoAccounts: () => g('/api/auth/demo').catch(() => []),
  changePassword: (current, next) => p('/api/auth/password', { current, next }),
  listUsers: () => g('/api/users'),
  createUser: (x) => p('/api/users', x),
  updateUser: (id, x) => u_(`/api/users/${id}`, x),
  deleteUser: (id) => d(`/api/users/${id}`),
  listCohorts: () => g('/api/cohorts'),
  saveCohort: (x) => (x.id ? u_(`/api/cohorts/${x.id}`, x) : p('/api/cohorts', x)),
  deleteCohort: (id) => d(`/api/cohorts/${id}`),
  listCompetencies: () => g('/api/competencies'),
  saveCompetency: (x) => (x._new ? p('/api/competencies', x) : u_(`/api/competencies/${x.id}`, x)),
  deleteCompetency: (id) => d(`/api/competencies/${id}`),
  listScenarios: () => g('/api/scenarios'),
  getScenario: (id) => g(`/api/scenarios/${id}`),
  saveScenario: (x) => (x.id ? u_(`/api/scenarios/${x.id}`, x) : p('/api/scenarios', x)),
  deleteScenario: (id) => d(`/api/scenarios/${id}`),
  listAssignments: () => g('/api/assignments'),
  saveAssignment: (x) => p('/api/assignments', x),
  deleteAssignment: (id) => d(`/api/assignments/${id}`),
  listAttempts: () => g('/api/attempts'),
  getAttempt: (id) => g(`/api/attempts/${id}`),
  startAttempt: (scenarioId) => p('/api/attempts', { scenarioId }),
  finishAttempt: (id, x) => p(`/api/attempts/${id}/finish`, x),
  updateAttempt: (id, x) => u_(`/api/attempts/${id}`, x),
  getSettings: () => g('/api/settings'),
  saveSettings: (x) => u_('/api/settings', x),
  listAudit: () => g('/api/audit'),
  ai: (x) => p('/api/ai', x),
};
