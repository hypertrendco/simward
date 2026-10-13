import { remoteApi } from './remote.js';
import { localApi } from './local.js';
// Build-time flag: the claude.ai artifact build runs fully in-browser ("local"); Railway uses the REST API.
export const MODE = (typeof window !== 'undefined' && window.__SIMWARD_MODE__) || 'remote';
export const api = MODE === 'local' ? localApi : remoteApi;
