import { h, createContext } from 'preact';
import { useContext, useState, useCallback } from 'preact/hooks';
import { api } from './api/index.js';

// Lightweight app store: cached collections + current user + in-memory router.
const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const LOADERS = {
  scenarios: () => api.listScenarios(),
  cohorts: () => api.listCohorts(),
  users: () => api.listUsers(),
  assignments: () => api.listAssignments(),
  attempts: () => api.listAttempts(),
  competencies: () => api.listCompetencies(),
  settings: () => api.getSettings(),
};

export function AppProvider({ children, initialUser }) {
  const [user, setUser] = useState(initialUser);
  const [data, setData] = useState({});
  const [route, setRoute] = useState({ name: 'home', params: {} });
  const load = useCallback(async (...keys) => {
    const out = {};
    await Promise.all(keys.map(async k => { try { out[k] = await LOADERS[k](); } catch (e) { out[k] = k === 'settings' ? {} : []; } }));
    setData(d => ({ ...d, ...out }));
    return out;
  }, []);
  const nav = (name, params = {}) => { setRoute({ name, params }); window.scrollTo?.(0, 0); };
  const value = { user, setUser, data, load, route, nav };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
