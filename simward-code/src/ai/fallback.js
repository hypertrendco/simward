import { COMPETENCIES } from '../data/competencies.js';
import { fmt, band } from '../sim/scoring.js';

// Rule-based fallbacks used whenever AI is disabled/unavailable. They are complete on their own.

export function patientFallback(sc, snap, message) {
  const st = sc.states.find(s => s.id === snap.stateId);
  const loc = (st?.vitals?.loc || '').toLowerCase();
  if (/unresponsive|pain only/.test(loc)) return '(moans, no verbal response)';
  const m = message.toLowerCase();
  for (const line of sc.script || []) if (line.k.some(k => m.includes(k))) return line.r;
  if (/lethargic|drowsy/.test(loc)) return 'Mm… so tired…';
  if (/confus/.test(loc)) return 'Where… where am I? Who are you?';
  const generic = ['I’m not sure. Can you explain?', 'Okay… whatever you think is best.', 'I just want to feel better.', 'Is something wrong? You look worried.'];
  return generic[Math.floor(Math.random() * generic.length)];
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const locOf = (sc, snap) => ((sc.states.find(s => s.id === snap.stateId)?.vitals?.loc) || '').toLowerCase();
const isChild = (sc) => sc.patient.age < 13;

// Patient's one-line reaction to a nursing action (used when AI is unavailable)
export function reactionFallback(sc, snap, actionId) {
  const loc = locOf(sc, snap); const child = isChild(sc);
  if (/unresponsive|pain only/.test(loc)) return '(no response)';
  if (/lethargic|drowsy/.test(loc)) return pick(['Mm-hm…', '(nods slowly)', 'Okay…']);
  if (/confus/.test(loc)) return pick(['What are you doing? Who sent you?', 'I don’t… where’s my husband?', 'Leave it, I’m fine.']);
  const v = snap.vitals || {}; const pain = v.pain || 0; const sob = v.rr > 24;
  if (actionId.startsWith('med:')) { const m = sc.meds.find(x => `med:${x.id}` === actionId); return child ? pick(['Is it yucky?', 'Do I have to?', 'Okay… (swallows)']) : pick([`What’s that one for again?`, 'Alright. Hope it works fast.', `${m?.route === 'PO' ? 'Can I have some water with it?' : 'Okay, go ahead.'}`]); }
  switch (actionId) {
    case 'pain-assess': return pain >= 7 ? pick(['It’s bad — a seven, maybe eight. Sharp when I move.', 'It’s really hurting. Right here. Please.']) : pain >= 4 ? pick(['About a five. Aching, mostly.', 'It’s there. Manageable, I guess.']) : pick(['Not too bad right now, a two or three.', 'It’s much better than it was.']);
    case 'resp-assess': case 'pulse-ox-spot': case 'peak-flow': return sob ? pick(['I… can’t get… a full breath.', 'It feels tight… like a band.']) : pick(['Breathing’s okay, I think.', 'Deep breaths? Sure. (breathes)']);
    case 'cardio-assess': return v.hr > 100 ? 'It feels like my heart’s racing.' : 'Okay. (lies still)';
    case 'hob-up': return sob ? 'Oh… that’s a little better. Thank you.' : 'That’s better, thanks.';
    case 'o2-nc': case 'o2-nrb': return child ? 'I don’t like the thing on my face…' : sob ? 'Okay… (breathes) … that helps a bit.' : 'Do I really need this?';
    case 'introduce': return child ? pick(['Hi…', '(looks at parent)']) : pick(['Nice to meet you.', 'Okay. Are you the one giving my pills today?', 'Hello. Are you my nurse all day?']);
    case 'identify': return child ? pick(['(holds out wrist)', 'My birthday is…']) : pick([`${sc.patient.name}. You’ve got the band right there.`, 'Same as it was an hour ago. (smiles)']);
    case 'allergy-check': return sc.patient.allergies?.length ? `Just the ${sc.patient.allergies[0].split(' (')[0]}. Makes me ${/nausea|vomit/i.test(sc.patient.allergies[0]) ? 'sick to my stomach' : 'break out'}.` : 'No allergies that I know of.';
    case 'gu-assess': case 'foley-uo': case 'elimination': return pick(['Now that you mention it, I feel full down there.', 'I haven’t gone yet. I’ve been trying not to think about it.']);
    case 'gi-assess': return pick(['A little queasy, but I ate some breakfast.', 'My stomach’s okay. Haven’t had a bowel movement though.']);
    case 'glucose': return pick(['Ow. Fine. What’s the number?', 'Go ahead, I’m used to it.']);
    case 'temp-check': return pick(['I’ve been getting chills, actually.', 'Okay.']);
    case 'reposition': case 'turn-q2h': case 'nonpharm-comfort': return pick(['Oh, that’s better.', 'Thank you. My back was killing me.']);
    case 'ambulate': return pain >= 6 ? 'I want to, but it really hurts to move.' : 'Finally. Let’s go.';
    case 'scd-apply': return pick(['Those things squeeze. But okay.', 'Oh, those came off when they washed me.']);
    case 'incentive-spiro': return pick(['That thing? Nobody showed me how.', 'It makes me cough.']);
    case 'reassure': return pick(['Thank you. I needed to hear that.', 'Okay. I’m trying not to panic.']);
    case 'explain': case 'educate': case 'reinforce-teaching': return pick(['Okay, so… say that part again?', 'That makes sense. Thank you for explaining.', 'Will you write that down for me?']);
    case 'calf-check': return pick(['The left one’s been achy, actually.', 'Fine, I think. Why?']);
    case 'neuro-check': return pick(['My arm feels… heavy.', 'Okay. (squeezes)']);
    case 'swallow-screen': return pick(['(coughs) Went down the wrong way.', '(sips) Okay.']);
    case 'call-light': return 'Got it. I’ll push it if I need you.';
    case 'privacy': return 'Thank you.';
    case 'fall-precautions': case 'bed-safety': case 'hip-precautions': return pick(['I’m not an invalid, you know.', 'Alright, alright. I’ll call first.']);
    case 'peds-distraction': return pick(['(giggles)', 'Can I hold the bear?']);
    case 'offer-fluids': return 'Yes please, I’m so thirsty.';
    default: return pick(['Okay.', '(nods)', 'Alright.', 'Sure, go ahead.']);
  }
}

// Spontaneous patient remark when the state changes or the nurse goes quiet
export function spontaneousFallback(sc, snap, reason, pending = []) {
  const loc = locOf(sc, snap); const st = sc.states.find(s => s.id === snap.stateId);
  if (/unresponsive|pain only/.test(loc)) return '(moans)';
  if (st?.hints?.length) return pick(st.hints);
  if (/lethargic|drowsy/.test(loc)) return 'So… tired…';
  if (/confus/.test(loc)) return pick(['I need to get home, the dog needs feeding.', 'Who are you people?']);
  const v = snap.vitals || {};
  if (reason === 'better') return pick(['I think… I feel a bit better.', 'That helped. I can breathe easier.']);
  if (v.rr > 26) return 'Nurse… I can’t… catch my breath.';
  if (v.pain >= 7) return 'It’s really hurting now. Can you do something?';
  const ids = pending.flatMap(x => x.actions || []);
  if (ids.includes('gu-assess') || ids.includes('foley-uo')) return 'I feel kind of full… down low. I haven’t been able to go.';
  if (ids.includes('hob-up')) return 'Could you sit me up more? It’s hard to breathe like this.';
  if (ids.includes('calf-check')) return 'My leg’s been aching. The calf, mostly.';
  if (ids.includes('glucose') || ids.includes('oral-glucose')) return 'I feel shaky. And sweaty. Is that normal?';
  if (ids.includes('scd-apply')) return 'Those leg things came off this morning — should they be on?';
  if (ids.includes('incentive-spiro')) return 'What’s this plastic thing for? Nobody showed me.';
  if (ids.includes('pain-assess')) return 'It’s really starting to hurt again.';
  if (ids.includes('swallow-screen')) return '(coughs) Water keeps going down wrong.';
  if (ids.includes('neuro-check')) return 'My hand feels funny. Clumsy.';
  return pick(['Is everything okay? You look worried.', 'How much longer will I be here?', 'Can I have something to drink?']);
}

export function familyFallback(sc, snap, message) {
  const f = sc.family; const m = message.toLowerCase();
  const first = sc.patient.name.split(' ')[0];
  if (/how (is|are) (you|he|she)|okay|alright|worried/.test(m)) return `Honestly? I’m scared. ${first} hasn’t looked like this before. What do you think is going on?`;
  if (/history|usual|normal|baseline|before/.test(m)) return `Normally ${first} is nothing like this. This started today. Is that important?`;
  if (/help|do|can i/.test(m)) return 'Just tell me what to do. I’ll do anything — I just don’t want to be in the way.';
  if (/medic|pill|allerg/.test(m)) return `Everything should be in the chart… ${sc.patient.allergies?.[0] ? `and please remember the ${sc.patient.allergies[0].split(' (')[0]} allergy.` : 'I think that’s everything.'}`;
  if (/thank|explain|understand/.test(m)) return 'Thank you for explaining. That helps more than you know.';
  return ['Is that normal?', 'Should I call the rest of the family?', 'Can you tell me what that means, in plain words?', 'I’m staying right here, if that’s okay.'][Math.floor(Math.random() * 4)];
}

const compName = (id) => COMPETENCIES.find(c => c.id === id)?.name || id;

export function feedbackFallback(sc, result) {
  const met = result.items.filter(i => i.status === 'met');
  const late = result.items.filter(i => i.status === 'late' || i.status === 'out-of-order');
  const missed = result.items.filter(i => i.status === 'missed').sort((a, b) => Number(b.critical) - Number(a.critical));
  const weak = Object.entries(result.competencies).filter(([, v]) => v.pct != null && v.pct < 70).sort((a, b) => a[1].pct - b[1].pct);
  const cj = ['cj-recognize', 'cj-analyze', 'cj-prioritize', 'cj-generate', 'cj-act', 'cj-evaluate'];
  const lines = [];
  lines.push('### Overall impression');
  lines.push(`You scored **${result.score}%** and ${result.passed ? '**met** the passing standard' : '**did not yet meet** the passing standard'} (${result.passingScore}% with no missed critical actions or critical safety events). The patient ended in the state **“${result.finalStateName}”** after ${fmt(result.stats.durationSec)} of scenario time.`);
  if (result.stats.deteriorated) lines.push('The patient deteriorated during the scenario — review the timeline to find the window where earlier recognition or action would have changed the trajectory.');
  lines.push('', '### What went well');
  if (met.length) met.slice(0, 6).forEach(i => lines.push(`- ${i.label}${i.t != null ? ` at ${fmt(i.t)}` : ''}${i.critical ? ' — a critical action' : ''}.`));
  else lines.push('- You engaged with the scenario. Focus next time on completing the core safety and assessment steps.');
  lines.push('', '### Opportunities for growth');
  if (result.harmful.length) result.harmful.forEach(h => lines.push(`- **Safety event:** ${h.label} at ${fmt(h.t)}. ${h.rationale}`));
  missed.slice(0, 6).forEach(i => lines.push(`- ${i.critical ? '**Missed critical action:** ' : 'Missed: '}${i.label}.${i.rationale ? ' ' + i.rationale : ''}`));
  late.forEach(i => lines.push(`- ${i.label}: ${i.note || 'timing/order could improve'}.${i.rationale ? ' ' + i.rationale : ''}`));
  result.rightsIssues.forEach(r => lines.push(`- Medication rights not fully verified for ${r.label} (missing: ${r.missing.join(', ')}).`));
  if (!result.harmful.length && !missed.length && !late.length) lines.push('- Keep refining the speed and sequence of your priority actions.');
  lines.push('', '### Clinical judgment analysis');
  cj.forEach(id => { const c = result.competencies[id]; lines.push(`- **${compName(id)}:** ${c?.pct != null ? `${c.pct}% — ${band(c.pct)}` : 'not assessed in this scenario'}`); });
  lines.push('', '### Your next steps');
  if (weak.length) weak.slice(0, 3).forEach(([id]) => lines.push(`- **${compName(id)}:** ${COMPETENCIES.find(c => c.id === id)?.remediation}`));
  else lines.push('- Attempt a higher-difficulty scenario to stretch your clinical judgment.');
  lines.push(`- Re-run “${sc.title}” and aim to complete every critical action within its target window.`);
  return lines.join('\n');
}

export function remediationFallback(student, profile, attempts) {
  const rows = COMPETENCIES.map(c => ({ c, p: profile[c.id] })).filter(x => x.p);
  const gaps = rows.filter(x => x.p.pct < 70).sort((a, b) => a.p.pct - b.p.pct).slice(0, 3);
  const failed = attempts.filter(a => a.result && !a.result.passed);
  const harmful = attempts.flatMap(a => (a.result?.harmful || []).map(h => `${h.label} (${a.scenarioTitle})`));
  const L = [];
  L.push('### Summary of performance patterns');
  L.push(`${student.name} has completed ${attempts.length} scenario attempt(s); ${failed.length} did not meet the passing standard. ${harmful.length ? `Safety events recorded: ${harmful.join('; ')}.` : 'No harmful actions recorded.'}`);
  L.push('', '### Priority gaps');
  if (!gaps.length) L.push('- No competency below 70%. Focus on efficiency and advancing scenario difficulty.');
  gaps.forEach(({ c, p }) => L.push(`- **${c.name}** (${c.code}) — average ${p.pct}% across ${p.n} attempt(s); trend ${p.trend.join(' → ')}.`));
  L.push('', '### Remediation activities');
  gaps.forEach(({ c }) => L.push(`- **${c.name}:** ${c.remediation} *Verify mastery:* ≥ 85% on this competency in a repeat simulation.`));
  L.push('', '### Suggested re-simulation plan');
  const retry = failed.at(-1);
  L.push(retry ? `- Repeat “${retry.scenarioTitle}” within 7 days after completing the activities above, then progress to a new scenario of equal difficulty.` : '- Assign a new scenario at the next difficulty level.');
  L.push('', '### Talking points for the coaching conversation');
  L.push('- Ask the student to walk through their first 3 minutes: what cues did they notice and what did they think they meant?');
  L.push('- Reinforce one specific strength before discussing gaps.');
  L.push('- Agree on one measurable goal for the next attempt.');
  return L.join('\n');
}
