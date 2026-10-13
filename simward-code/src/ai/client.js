// AI client: routes to the Railway server (/api/ai → Anthropic Claude) or, in the claude.ai artifact build,
// to the viewer's Claude via the `sample` capability. Returns null on any failure so callers fall back to rules.
import { api, MODE } from '../api/index.js';

let samplePromise = null;
async function getSample() {
  if (!window.claude?.use) return null;
  samplePromise = samplePromise || window.claude.use('sample').catch(() => null);
  return samplePromise;
}

let disabledReason = null;
export const aiStatus = () => disabledReason;

export async function aiText(kind, prompt, { json = false, tier = 'default', onText, signal } = {}) {
  try {
    if (MODE === 'local') {
      const sample = await getSample();
      if (!sample) { disabledReason = 'AI unavailable in this view'; return null; }
      const opts = { modelTier: tier, cache: false, signal };
      if (onText) opts.onText = onText;
      if (json) return await sample.json(prompt, opts);
      const r = await sample(prompt, opts);
      return r.text;
    }
    const r = await api.ai({ kind, prompt, json, tier });
    if (!r || r.disabled) { disabledReason = r?.reason || 'AI disabled'; return null; }
    if (onText && r.text) onText({ text: r.text, delta: r.text });
    return json ? r.json : r.text;
  } catch (e) {
    if (['not_granted', 'sampling_disabled', 'not_declared'].includes(e?.code)) disabledReason = 'AI not permitted in this view';
    return null;
  }
}
