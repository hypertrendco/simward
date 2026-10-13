import { actionLabel, ACTION_MAP } from '../data/actions.js';
import { fmt } from '../sim/scoring.js';
import { ROOM_PRESETS } from '../data/equipment.js';

const vit = (v) => v ? `HR ${Math.round(v.hr)}, BP ${Math.round(v.sbp)}/${Math.round(v.dbp)}, RR ${Math.round(v.rr)}, SpO2 ${Math.round(v.spo2)}%, T ${Number(v.temp).toFixed(1)}C, pain ${Math.round(v.pain)}/10, glucose ${Math.round(v.glucose)}, LOC ${v.loc}` : '';
const sexWord = (p) => (p.sex === 'F' ? (p.age < 13 ? 'girl' : 'woman') : p.sex === 'M' ? (p.age < 13 ? 'boy' : 'man') : 'person');

// What the room looks like right now — shared by every in-scenario prompt so dialogue references the real environment
export function environmentContext(sc, snap, extra = {}) {
  const env = sc.environment || {};
  const room = ROOM_PRESETS[env.preset]?.label || 'patient room';
  const items = (env.items || []).map(i => i.type);
  const has = (t) => items.includes(t);
  const bits = [];
  bits.push(`Setting: ${room}${env.lighting === 'night' ? ', night shift, lights dimmed' : env.lighting === 'dim' ? ', soft evening lighting' : ', daytime'}.`);
  const devices = [];
  if (snap?.revealed?.monitor) devices.push('bedside monitor is on and alarming when limits are crossed'); else if (has('monitor')) devices.push('bedside monitor is present but not attached');
  if (snap?.o2 === 'nc') devices.push('nasal cannula in place'); else if (snap?.o2 === 'nrb') devices.push('non-rebreather mask on');
  if (has('ivpole')) devices.push('IV pole with pump at the bedside');
  if (has('bassinet')) devices.push('newborn in a bassinet beside the bed');
  if (has('walker')) devices.push('walker in the room'); if (has('commode')) devices.push('bedside commode');
  if (has('nightstand')) devices.push('personal items on the nightstand (photos, a book)'); if (has('toys')) devices.push('toys and a stuffed bear');
  bits.push(`In the room: ${devices.join('; ') || 'standard equipment'}. Head of bed ${Math.round(snap?.hob ?? 30)}°.`);
  if (sc.family) bits.push(`${sc.family.name} (${sc.family.relation}) is sitting in the chair by the bed.${extra.familyMood ? ` ${extra.familyMood}` : ''}`);
  if (extra.nurse) bits.push(`The nurse caring for the patient is ${extra.nurse.name}, an LPN${extra.nurse.gender === 'F' ? ' (she/her)' : extra.nurse.gender === 'M' ? ' (he/him)' : ''}.`);
  bits.push(`Scenario clock: ${fmt(snap?.clock || 0)}.`);
  return bits.join(' ');
}

function recentActions(events, n = 8) {
  return events.filter(e => e.type === 'action' || e.type === 'say').slice(-n).map(e => `[${fmt(e.t)}] ${e.type === 'say' ? `Nurse said: "${e.label}"` : `Nurse did: ${e.label}`}`).join('\n');
}

// What a real patient could naturally bring up that would lead the nurse toward an expected action —
// expressed as symptoms, worries and requests, never as nursing instructions.
export const ACTION_HINTS = {
  'pain-assess': 'the pain itself — where it is, how bad, what makes it worse', 'resp-assess': 'how the breathing feels', 'peak-flow': 'how tight the chest feels',
  'cardio-assess': 'heart racing, fluttering or pounding', 'skin-assess': 'feeling sweaty, clammy, itchy or “my skin looks funny”', 'gi-assess': 'nausea, belly discomfort, appetite, last bowel movement',
  'gu-assess': 'needing to urinate, feeling full low in the belly, or not having gone', 'foley-uo': 'the bladder/catheter', 'glucose': 'feeling shaky, sweaty, hungry, foggy', 'temp-check': 'feeling hot, cold or having chills',
  'vitals': 'feeling “off”, dizzy or lightheaded', 'pulse-ox-spot': 'feeling winded', 'loc': 'feeling foggy or sleepy', 'neuro-check': 'headache, a weak or clumsy arm/leg, blurry vision, or words coming out wrong',
  'hob-up': 'that it is hard to breathe lying flat and wanting to sit up', 'o2-nc': 'not getting enough air', 'o2-nrb': 'not getting enough air', 'reposition': 'being uncomfortable or sore from lying in one position',
  'incentive-spiro': 'the breathing gadget on the table and not being sure how to use it', 'scd-apply': 'the leg sleeves lying at the foot of the bed', 'calf-check': 'a leg or calf that feels tight, achy or warm',
  'ambulate': 'wanting to get up and move', 'offer-fluids': 'being thirsty or having a dry mouth', 'elimination': 'needing the bathroom', 'swallow-screen': 'coughing or choking on sips of water', 'aspiration-precautions': 'coughing when drinking',
  'oral-glucose': 'feeling shaky and sweaty', 'nebulizer': 'the chest feeling tight and wheezy', 'fluid-bolus': 'feeling very thirsty, dizzy when sitting up', 'cool-measures': 'feeling hot and sweaty, chills', 'ice-pack': 'swelling and throbbing',
  'hip-precautions': 'wanting to bend, cross the legs or reach for something', 'fall-precautions': 'planning to get up alone to the bathroom', 'bed-safety': 'trying to climb out of bed', 'call-light': 'not knowing how to call for help',
  'allergy-check': 'a bad reaction to a medicine in the past', 'identify': '(none)', 'introduce': 'not knowing who the nurse is', 'explain': 'confusion about what is happening', 'reassure': 'being frightened or tearful', 'educate': 'questions about what to do at home',
  'fundus-check': 'cramping and feeling a gush of bleeding', 'fundal-massage': 'feeling wet or soaked, lightheaded', 'newborn-check': 'the baby seeming sleepy or fussy', 'breastfeeding-support': 'the baby not latching, sore nipples',
  'peds-distraction': 'being scared of the nurse or the equipment', 'nonpharm-comfort': 'wanting the lights down, a cool cloth, help getting comfortable', 'pursed-lip': 'panic about breathing', 'tripod': 'wanting to lean forward over the table',
  'wound-care': 'the dressing feeling wet, itchy or loose', 'turn-q2h': 'a sore back or heel', 'daily-weight': 'swollen feet, tight rings or shoes', 'fluid-restrict': 'wanting more to drink',
  'monitor': '(none)', 'review-labs': '(none)', 'review-orders': '(none)', 'report-rn': '(none)', 'sbar-provider': '(none)', 'rapid-response': '(none)', 'family-update': 'the family asking what is going on', 'family-include': 'wanting a family member involved',
  'cultural-prefs': 'a preference about modesty, diet, prayer or who gives care', 'reinforce-teaching': 'not remembering what the other nurse explained', 'hygiene': 'feeling grimy, wanting to freshen up', 'ecg-12': 'chest pressure or a fluttering heart',
  'iv-access': '(none)', 'blood-cultures': '(none)', 'lactate': '(none)', 'suction': 'gurgling, not being able to clear the throat', 'weight-based-dose': '(none)', 'verify-scope': '(none)', 'delegate-uap': '(none)', 'handoff': '(none)', 'hand-hygiene': '(none)', 'ppe': '(none)', 'privacy': 'wanting the curtain closed',
};

// Hidden "guidance" block: what the patient can steer toward without ever coaching the nurse.
export function guidanceBlock(sc, snap, ctx = {}) {
  const pending = (ctx.pending || []).filter(x => x.hint && x.hint !== '(none)');
  const steer = pending.slice(0, 4).map(x => `- ${x.hint}`).join('\n');
  const st = sc.states.find(s => s.id === snap.stateId);
  return `SCENARIO GUIDANCE (for you only — the nurse must never hear this as advice):
The patient's full current experience, which you can draw on when asked or when it would naturally surface: neuro — ${st.findings?.neuro}; breathing — ${st.findings?.resp}; heart — ${st.findings?.cardio}; skin — ${st.findings?.skin}; pain — ${st.findings?.pain}; belly — ${st.findings?.gi}; bladder — ${st.findings?.gu}.
${steer ? `Things a patient like this would plausibly bring up that the nurse has NOT yet explored or addressed. When it fits naturally (not every turn), surface ONE of them as a symptom, worry, question or request in the patient's own words:\n${steer}` : 'The nurse has covered the main concerns; respond naturally without introducing new complaints.'}
${st.hints?.length ? `Scenario-specific things this patient might say in this state: ${st.hints.map(h => `"${h}"`).join(' ')}` : ''}
Rules for steering: describe sensations and feelings, not clinical interpretations; never name a nursing action, a medication the nurse should give, a vital-sign number or a diagnosis you would not know; never say what the nurse "should" do. If the nurse does something that helps, let it show (relief, easier breathing, calmer). If the nurse does something unsafe or frightening, react as a patient would (object, ask why, flinch). Do not repeat a complaint you already voiced in the last few turns unless asked.`;
}

const kindOf = (message) => /\?\s*$/.test(message) || /^(what|how|when|where|who|why|do you|does|did|are you|is|can you|could you|have you|any|tell me|rate)\b/i.test(message.trim()) ? 'question' : /^(i'?m going to|i'?ll|let me|i need to|i'm just|i am going|we're going|okay,? i)/i.test(message.trim()) ? 'action' : 'statement';

export function patientPrompt(sc, snap, history, message, ctx = {}) {
  const p = sc.patient;
  const st = sc.states.find(s => s.id === snap.stateId);
  const turns = history.slice(-12).map(h => `${h.role === 'student' || h.role === 'nurse' ? 'Nurse' : h.role === 'family' ? sc.family?.name?.split(' ')[0] || 'Family' : p.name.split(' ')[0]}: ${h.text}`).join('\n');
  const kind = kindOf(message);
  return `You are role-playing a simulated patient in a nursing education simulation. Stay fully in character as the patient. Never mention being an AI or a simulation. Never give nursing or medical advice and never tell the nurse what to do; respond only as this patient would, with the knowledge a patient would have.

PATIENT: ${p.name}, ${p.age}-year-old ${sexWord(p)}. Diagnosis (you may not know the medical term — use lay words): ${p.diagnosis}. Chief complaint: ${p.chiefComplaint}.
History: ${p.history} Home medicines: ${(p.homeMeds || []).join(', ') || 'none listed'}. Social: ${p.social} Allergies: ${(p.allergies || []).join('; ') || 'none'}. DOB ${p.dob}.
Personality & speech: ${p.personality}
${p.voice?.style ? `Voice/manner: ${p.voice.style}.` : ''}
${environmentContext(sc, snap, ctx)}
CURRENT CONDITION (state "${st.name}"): ${st.cues} Vitals (you feel these, you do not know the numbers): ${vit(snap.vitals)}.
Speech must reflect the condition: breathless → short phrases with "…" pauses; confused → disoriented, may misidentify people or the year; drowsy/lethargic → minimal, slurred; unresponsive → reply only "(no response)" or "(moans)"; in severe pain → clipped, distracted. A child speaks like a child of that age. ${p.age > 65 && /hearing/i.test(p.history + p.personality) ? 'Hard of hearing: occasionally mishear a question unless it was clearly addressed to you.' : ''}
${ctx.nurse?.introduced ? `The nurse introduced themself as ${ctx.nurse.name}; you may use that name.` : 'The nurse has not introduced themself yet — you do not know their name; you may ask who they are if it fits.'}
${guidanceBlock(sc, snap, ctx)}
${ctx.events?.length ? `Recent nurse actions:\n${ctx.events}` : ''}
Conversation so far:
${turns || '(none)'}
Nurse: ${message}

The nurse's last line is a ${kind}. ${kind === 'question' ? 'Answer it truthfully from the patient\'s point of view, specifically and concretely (e.g., pain is "a seven, sharp when I move" rather than "it hurts"), then optionally add one natural extra detail or worry.' : kind === 'action' ? 'The nurse is announcing something they are about to do: consent or hesitate as this patient would, cooperate or ask a quick question about it, and describe what you feel as it happens.' : 'The nurse made a statement, explanation or reassurance: acknowledge it as a real patient would — show understanding or confusion, repeat it back in your own words if it was teaching, ask a follow-up, or express how it makes you feel. Never ignore it.'}
Reply as ${p.name.split(' ')[0]} in 1–3 short sentences. Plain spoken text only; brief parentheticals only for sounds like (coughs). Do not start with "Well," or repeat the nurse's words.`;
}

// Patient's immediate reaction to a nursing action the nurse just announced/performed (one short line)
export function reactionPrompt(sc, snap, actionId, finding, nurseLineText, ctx = {}) {
  const p = sc.patient;
  const st = sc.states.find(s => s.id === snap.stateId);
  const label = actionLabel(actionId, sc);
  const def = ACTION_MAP[actionId];
  return `You are role-playing ${p.name}, a ${p.age}-year-old ${sexWord(p)} patient (${p.diagnosis}) in a nursing simulation. Stay in character; never give medical advice or mention being an AI.
Personality: ${p.personality} ${p.voice?.style ? `Manner: ${p.voice.style}.` : ''}
Condition right now: ${st.cues} Breathing — ${st.findings?.resp}; pain — ${st.findings?.pain}; mental status — ${snap.vitals?.loc}.
${environmentContext(sc, snap, ctx)}
The nurse just said: "${nurseLineText}" and is now doing: ${label}.${finding && def?.finding ? ` What the nurse will find: ${finding}.` : ''}${def?.kind === 'assess' ? ' Answer the implicit question honestly in body terms (where it hurts, how the breathing feels, whether you can wiggle your toes…).' : ''}${/^med:/.test(actionId) ? ' You may ask what the medicine is for or mention a past reaction if you have one; swallow/accept it unless the patient has a reason to refuse.' : ''}${['hob-up', 'o2-nc', 'o2-nrb', 'reposition', 'nonpharm-comfort', 'ice-pack', 'pursed-lip', 'tripod', 'nebulizer'].includes(actionId) ? ' Describe how it feels a moment later (a little easier to breathe, more comfortable, still tight…).' : ''}
Speech must match LOC: unresponsive → "(no response)"; lethargic → a word or two; confused → may not understand the request. A child reacts like a child (may be scared, want a parent, need coaxing).
Reply with ONE short spoken sentence (max 18 words), or "(nods)" / "(winces)" if speaking would be out of character. No stage directions beyond that.`;
}

// Spontaneous utterance: the patient's condition changed, or the nurse has been quiet for a while
export function spontaneousPrompt(sc, snap, reason, ctx = {}) {
  const p = sc.patient;
  const st = sc.states.find(s => s.id === snap.stateId);
  const why = reason === 'change' ? `The patient's condition has just changed to "${st.name}": ${st.cues}` : reason === 'better' ? `The patient has started to feel better: ${st.cues}` : `Nothing has happened for a while; the nurse has been quiet or busy. The patient speaks up on their own.`;
  return `You are role-playing ${p.name}, a ${p.age}-year-old ${sexWord(p)} patient (${p.diagnosis}) in a nursing simulation. Stay in character; never give medical advice or mention being an AI.
Personality: ${p.personality} ${p.voice?.style ? `Manner: ${p.voice.style}.` : ''}
${environmentContext(sc, snap, ctx)}
${why}
How it feels: breathing — ${st.findings?.resp}; pain — ${st.findings?.pain}; neuro — ${st.findings?.neuro}; skin — ${st.findings?.skin}; belly/bladder — ${st.findings?.gi} ${st.findings?.gu}. Mental status: ${snap.vitals?.loc}.
${guidanceBlock(sc, snap, ctx)}
${ctx.recentPatientLines?.length ? `Things you already said (do not repeat): ${ctx.recentPatientLines.map(l => `"${l}"`).join(' ')}` : ''}
Say ONE thing a real patient would say unprompted right now — a new or worsening sensation, a worry, a request, or (if improving) noticeable relief. Speech must match LOC (unresponsive → "(moans)" or "(no response)"). One or two short sentences, max 25 words, plain spoken text.`;
}

export function familyPrompt(sc, snap, history, message, ctx = {}) {
  const f = sc.family; const p = sc.patient;
  const st = sc.states.find(s => s.id === snap.stateId);
  const turns = history.slice(-12).map(h => `${h.role === 'student' || h.role === 'nurse' ? 'Nurse' : h.role === 'family' ? f.name.split(' ')[0] : p.name.split(' ')[0]}: ${h.text}`).join('\n');
  return `You are role-playing ${f.name}, the ${f.relation} of a patient, in a nursing education simulation. Stay fully in character. Never mention being an AI. You are not a clinician: you know the patient's history as family would, you notice how the patient looks, and you have feelings and questions. Do not give nursing advice.

FAMILY MEMBER: ${f.name}, ${f.age}-year-old ${f.sex === 'F' ? 'woman' : 'man'}, the patient's ${f.relation}. Personality: ${f.personality}
${f.voice?.style ? `Voice/manner: ${f.voice.style}.` : ''}
THE PATIENT: ${p.name}, ${p.age}, ${p.diagnosis}. What you can see right now: ${st.cues}
${environmentContext(sc, snap, ctx)}
${ctx.events?.length ? `What the nurse has done recently:\n${ctx.events}` : ''}
Conversation so far:
${turns || '(none)'}
Nurse: ${message}

Reply as ${f.name.split(' ')[0]} in 1–3 sentences, plain spoken text. If the nurse explains something well, show relief or ask a follow-up a real family member would ask.`;
}

// The nurse verbalizing an action in their own words (used when AI is available; templates otherwise)
export function nursePrompt(sc, snap, actionId, nurse, ctx = {}) {
  const p = sc.patient;
  const label = actionLabel(actionId, sc);
  return `Write what a nurse would SAY OUT LOUD to the patient while performing this action: "${label}".
Nurse: ${nurse.name}, an LPN. Patient: ${p.name}, ${p.age}-year-old ${sexWord(p)}, ${p.diagnosis}; currently ${snap.vitals?.loc || 'alert'}${sc.family ? `; ${sc.family.name} (${sc.family.relation}) is in the room` : ''}.
${p.age < 13 ? 'Use child-friendly words and a warm, playful tone appropriate for the child’s age; address the child by first name.' : p.age > 70 ? 'Address the patient respectfully (Mr./Mrs. + surname unless invited otherwise), speak clearly and simply.' : 'Address the patient by name, warm and professional.'}
Explain what you are doing and why in one or two short sentences, ask permission or for participation where appropriate, and do not add stage directions. Plain spoken text only, max 35 words.`;
}

export function directorPrompt(sc, snap, recent, ctx = {}) {
  const st = sc.states.find(s => s.id === snap.stateId);
  const outs = sc.transitions.filter(t => t.from === snap.stateId).map(t => `- ${t.to} ("${sc.states.find(s => s.id === t.to)?.name}"): ${t.label}`).join('\n');
  const acts = recent.map(e => `[${fmt(e.t)}] ${e.label}`).join('\n');
  return `You are the simulation director for a nursing education scenario, acting like an expert simulation operator. Decide how the virtual patient's physiology responds to the nurse's most recent actions. Be clinically realistic and conservative.

Scenario: ${sc.title}. Patient: ${sc.patient.name}, ${sc.patient.age}${sc.patient.sex}, ${sc.patient.diagnosis}. Learner level: ${sc.program || 'LPN'}.
${environmentContext(sc, snap, ctx)}
Current state: ${st.id} "${st.name}" — ${st.cues}. Current vitals: ${vit(snap.vitals)}.
Allowed transitions from this state (you may ONLY choose one of these ids, or null):
${outs || '(none)'}
Nurse actions so far (most recent last):
${acts}

Rules: deterministic scenario handlers already fire when their exact conditions are met; only suggest a transition when the clinical picture clearly warrants it and the rule set missed it. Nudges must be small (each between -8 and 8) and physiologically plausible for the last action (reassurance lowers HR 2–3; an inappropriate action may worsen vitals slightly; repositioning a breathless patient upright improves RR/SpO2 slightly). If the last action has no physiological effect, return an empty nudge.
Respond with only JSON: {"transitionTo": string|null, "vitalNudge": {"hr"?: number, "sbp"?: number, "dbp"?: number, "rr"?: number, "spo2"?: number, "temp"?: number, "pain"?: number}, "patientSays": string|null, "familySays": string|null, "rationale": string}
"patientSays": null unless the physiology change itself would make the patient say something new (e.g., sudden relief or sudden worsening) — the patient's direct reaction to the action is handled elsewhere. "familySays": ${sc.family ? `an optional short remark from ${sc.family.name} (${sc.family.relation}) reacting to what the nurse just did, or null` : 'always null'}.`;
}

export function debriefPrompt(sc, result, events, reflections = {}, nurse = null) {
  const timeline = events.filter(e => ['action', 'transition', 'chat', 'event', 'say'].includes(e.type)).slice(0, 140).map(e => `[${fmt(e.t)}] ${e.type === 'chat' ? `${e.role}${e.to === 'family' ? ' (to family)' : ''}: ${e.label}` : e.type === 'event' ? `EVENT (${e.kind}): ${e.label}` : e.type === 'say' ? `nurse said: ${e.label}` : e.label}`).join('\n');
  const items = result.items.map(i => `- ${i.label}: ${i.status}${i.t != null ? ` @${fmt(i.t)}` : ''}${i.critical ? ' (CRITICAL)' : ''}${i.note ? ` — ${i.note}` : ''}`).join('\n');
  const evs = (result.eventItems || []).map(e => `- [${fmt(e.t)}] ${e.kind}: "${e.text}" → ${e.responded ? `responded with ${e.responseLabel} @${fmt(e.responseT)}` : 'NO appropriate response within 3 min'} (expected: ${e.expected.join(' / ')})`).join('\n');
  const refl = Object.entries(reflections).filter(([, v]) => v?.trim()).map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n');
  return `You are an experienced nursing simulation debriefing facilitator using the PEARLS framework and the NCSBN Clinical Judgment Measurement Model. The learner is a ${sc.program === 'LPN' ? 'practical nursing (LPN/LVN) student' : 'nursing student'}${nurse?.name ? ` named ${nurse.name}` : ''}; frame feedback in terms of the LPN scope of practice (data collection, intervention within scope, reporting to the RN) where relevant. Write individualized, constructive feedback. Address the student as "you". Be specific: cite actual times and actions. Be supportive but honest about safety issues.

Scenario: ${sc.title} — ${sc.summary}
Course: ${sc.course || ''}. Objectives: ${sc.objectives.join('; ')}
Score: ${result.score}% (${result.passed ? 'PASSED' : 'NOT PASSED'}; passing ${result.passingScore}%). Final patient state: ${result.finalStateName}.
Expected actions:
${items}
Scenario events and the student's responses:
${evs || 'none'}
Harmful actions: ${result.harmful.map(h => `${h.label} @${fmt(h.t)} — ${h.rationale}`).join('; ') || 'none'}
Medication-rights omissions: ${result.rightsIssues.map(r => `${r.label} (missing ${r.missing.join(', ')})`).join('; ') || 'none'}
Competency percentages: ${Object.entries(result.competencies).map(([k, v]) => `${k} ${v.pct ?? '—'}%`).join(', ')}
Communication: ${result.stats.questionsAsked} questions to the patient, ${result.stats.familyTalk || 0} to the family.
Timeline:
${timeline}
${refl ? `Student reflections:\n${refl}` : ''}

Write in Markdown with these sections (use ### headings): Overall impression; What went well; Opportunities for growth (ordered by patient-safety impact); Communication with the patient and family; Clinical judgment analysis (one line each for Recognize cues, Analyze cues, Prioritize hypotheses, Generate solutions, Take action, Evaluate outcomes); Your next steps (3 concrete practice actions). Keep it under 500 words.`;
}

export function remediationPrompt(student, profile, attempts, competencies) {
  const comp = competencies.map(c => `${c.code} ${c.name}: ${profile[c.id]?.pct ?? 'n/a'}% (n=${profile[c.id]?.n || 0}, trend ${profile[c.id]?.trend?.join('→') || '—'})`).join('\n');
  const att = attempts.slice(-8).map(a => `- ${a.scenarioTitle}: ${a.result?.score}% ${a.result?.passed ? 'pass' : 'fail'}; missed critical: ${(a.result?.criticalMissed || []).join(', ') || 'none'}; harmful: ${(a.result?.harmful || []).map(h => h.label).join(', ') || 'none'}`).join('\n');
  return `You are a practical-nursing (LPN/LVN) program faculty coach. Write a remediation plan the INSTRUCTOR can use with this student. Be specific and practical, grounded in the NCLEX-PN test plan (client needs categories), QSEN and the NCSBN Clinical Judgment Measurement Model.

Student: ${student.name}
Competency profile:
${comp}
Recent simulation attempts:
${att || 'none'}

Markdown with ### headings: Summary of performance patterns; Priority gaps (max 3, each with evidence from attempts); Remediation activities (for each gap: activity, resource type, time estimate, how to verify mastery); Suggested re-simulation plan; Talking points for the coaching conversation. Under 400 words.`;
}

export function scenarioDraftPrompt(brief, actionIds) {
  return `Design a nursing simulation scenario as JSON for this request: "${brief}". Write it for practical nursing (LPN/LVN) students unless the request says otherwise: the LPN collects data, intervenes within scope, administers medications per policy and REPORTS to the RN (use the action id "report-rn" as an expected critical action).
Return ONLY JSON with this shape:
{"title": string, "course": "Fundamentals of Nursing"|"Medical-Surgical Nursing"|"Family-Centered Nursing", "specialty": string, "difficulty": "Beginner"|"Intermediate"|"Advanced", "summary": string, "objectives": string[4],
 "patient": {"name": string, "age": number, "sex": "M"|"F", "weightKg": number, "allergies": string[], "codeStatus": string, "diagnosis": string, "chiefComplaint": string, "history": string, "social": string, "personality": string, "voice": {"gender": "M"|"F", "age": number, "accent": "en-US"|"en-GB"|"en-IE"|"en-IN"|"es-US"|"en-US-ja"|"en-US-zh"|"en-US-so"|"en-US-ar"|"en-US-ht"|"en-US-pt", "style": string}},
 "family": null | {"name": string, "relation": string, "age": number, "sex": "M"|"F", "personality": string, "voice": {"gender": "M"|"F", "age": number, "accent": string, "style": string}},
 "handoff": {"situation": string, "background": string, "assessment": string, "recommendation": string},
 "meds": [{"id": string, "name": string, "dose": string, "route": string, "freq": string, "indication": string, "category": string, "contraindicated"?: string}],
 "labs": [{"name": string, "value": string, "unit": string, "ref": string, "flag": "H"|"L"|""}],
 "states": [{"id": "s1"|"s2"|"s3", "name": string, "cues": string, "vitals": {"hr": number, "sbp": number, "dbp": number, "rr": number, "spo2": number, "temp": number, "pain": number, "glucose": number, "loc": string, "rhythm": string}, "findings": {"neuro": string, "resp": string, "cardio": string, "skin": string, "pain": string, "gi": string, "gu": string}}],
 "transitions": [{"from": string, "to": string, "label": string, "trigger": {"type": "actions", "mode": "all"|"any", "actions": string[]} | {"type": "time", "seconds": number}}],
 "expected": [{"actions": string[], "critical": boolean, "points": number, "withinSec"?: number, "rationale": string}],
 "harmful": [{"actionId": string, "penalty": number, "critical": boolean, "rationale": string}],
 "events": [{"id": string, "trigger": {"type": "time", "seconds": number} | {"type": "state", "stateId": string}, "kind": "patient"|"family"|"phone"|"pump"|"callLight"|"environment", "text": string, "respond": string[], "points": number, "rationale": string}],
 "debrief": string[4]}
Use exactly 3 states: s1 = presenting problem, s2 = deterioration if untreated, s3 = improvement. Include 3 events (one family/phone interruption, one alarm or environmental cue, one spontaneous patient remark). Action ids MUST come from this list or be "med:<medId>" for meds you define: ${actionIds.join(', ')}.`;
}
