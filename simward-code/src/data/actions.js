// Nursing action catalog used by the scenario builder (expected/harmful actions) and the student sim player.
// kind: safety | assess | intervene | communicate | document
// finding: key into scenario state.findings for assessment results
// effect: default physiological nudge {vital: delta} applied over time when the action is performed
export const ACTION_CATEGORIES = [
  { id: 'safety', label: 'Safety & Prep', icon: 'shield' },
  { id: 'assess', label: 'Assess', icon: 'steth' },
  { id: 'intervene', label: 'Intervene', icon: 'hand' },
  { id: 'communicate', label: 'Communicate', icon: 'chat' },
  { id: 'document', label: 'Document', icon: 'chart' },
];

export const ACTIONS = [
  // Safety
  { say: 'Let me wash my hands first.', id: 'hand-hygiene', label: 'Perform hand hygiene', kind: 'safety', comps: ['qsen-safety'], secs: 20 },
  { say: 'Hi, I’m {nurse}, I’ll be your nurse today. How are you doing?', id: 'introduce', label: 'Introduce self & role', kind: 'safety', comps: ['qsen-pcc', 'comm'], secs: 10 },
  { say: 'Before we do anything, can you tell me your full name and date of birth? I’ll check it against your wristband.', id: 'identify', label: 'Verify patient with 2 identifiers', kind: 'safety', comps: ['qsen-safety'], secs: 15 },
  { say: 'I’m going to pull the curtain so we have some privacy.', id: 'privacy', label: 'Provide privacy (curtain/door)', kind: 'safety', comps: ['qsen-pcc'], secs: 5 },
  { say: 'I’m putting on some protective gear — it’s just a precaution for both of us.', id: 'ppe', label: 'Don appropriate PPE', kind: 'safety', comps: ['qsen-safety'], secs: 30 },
  { say: 'I see you have an allergy band — can you confirm what you’re allergic to?', id: 'allergy-check', label: 'Check allergy band & EHR allergies', kind: 'safety', comps: ['qsen-safety', 'qsen-informatics'], secs: 10 },
  { say: 'I’m lowering the bed and locking the wheels. Your call light is right here — press it any time.', id: 'bed-safety', label: 'Bed low, locked, call light in reach', kind: 'safety', comps: ['qsen-safety'], secs: 10 },
  { say: 'I’m going to set up some fall precautions. Please call before you get up — I don’t want you to fall.', id: 'fall-precautions', label: 'Initiate fall precautions', kind: 'safety', comps: ['qsen-safety'], secs: 20 },

  // Assessment
  { say: 'I’m going to take your vital signs now — blood pressure, pulse, breathing, and temperature.', id: 'vitals', label: 'Obtain full set of vital signs', kind: 'assess', comps: ['cj-recognize'], secs: 60, reveals: 'vitals' },
  { say: 'I’m going to put you on the monitor so we can keep an eye on your heart and oxygen continuously.', id: 'monitor', label: 'Apply cardiac monitor & continuous SpO₂', kind: 'assess', comps: ['cj-recognize', 'qsen-safety'], secs: 45, reveals: 'monitor' },
  { say: 'Can you tell me where you are, and what today’s date is?', id: 'loc', label: 'Assess LOC & orientation', kind: 'assess', comps: ['cj-recognize'], secs: 30, finding: 'neuro' },
  { say: 'I’m going to listen to your lungs. Take some slow, deep breaths through your mouth for me.', id: 'resp-assess', label: 'Respiratory assessment & lung sounds', kind: 'assess', comps: ['cj-recognize'], secs: 60, finding: 'resp' },
  { say: 'Now I’ll listen to your heart and check your pulses.', id: 'cardio-assess', label: 'Cardiovascular assessment & heart sounds', kind: 'assess', comps: ['cj-recognize'], secs: 60, finding: 'cardio' },
  { say: 'Let me take a look at your skin and the surgical site.', id: 'skin-assess', label: 'Inspect skin / wound / cap refill', kind: 'assess', comps: ['cj-recognize'], secs: 45, finding: 'skin' },
  { say: 'On a scale of zero to ten, where zero is no pain, what’s your pain right now? Where is it, and what does it feel like?', id: 'pain-assess', label: 'Pain assessment (OPQRST, 0–10)', kind: 'assess', comps: ['cj-recognize', 'qsen-pcc'], secs: 40, finding: 'pain' },
  { say: 'I’m going to listen to your belly and press on it gently.', id: 'gi-assess', label: 'Abdominal / GI assessment', kind: 'assess', comps: ['cj-recognize'], secs: 45, finding: 'gi' },
  { say: 'Have you been able to urinate? I’m going to check how much you’ve put out.', id: 'gu-assess', label: 'Urine output & I&O review', kind: 'assess', comps: ['cj-recognize', 'cj-analyze'], secs: 30, finding: 'gu' },
  { say: 'I need a quick finger-stick to check your blood sugar. Small pinch.', id: 'glucose', label: 'Point-of-care blood glucose', kind: 'assess', comps: ['cj-recognize'], secs: 60, reveals: 'glucose' },
  { say: 'I’m going to look at your lab results on the computer.', id: 'review-labs', label: 'Review labs & diagnostics', kind: 'assess', comps: ['cj-analyze', 'qsen-informatics'], secs: 30, reveals: 'labs' },
  { say: 'Let me review your orders and your medication record.', id: 'review-orders', label: 'Review provider orders & MAR', kind: 'assess', comps: ['qsen-informatics'], secs: 30 },
  { say: 'Let me recheck how you’re doing now.', id: 'reassess', label: 'Reassess after intervention', kind: 'assess', comps: ['cj-evaluate'], secs: 45, reveals: 'vitals' },
  { say: 'Take the deepest breath you can and blow out as hard and fast as you can into this.', id: 'peak-flow', label: 'Measure peak expiratory flow', kind: 'assess', comps: ['cj-recognize'], secs: 45, finding: 'resp' },
  { say: 'I’m going to put some stickers on your chest and do a quick tracing of your heart. Lie still for ten seconds.', id: 'ecg-12', label: 'Obtain 12-lead ECG', kind: 'assess', comps: ['cj-recognize', 'cj-analyze'], secs: 120, finding: 'cardio' },

  // Interventions
  { say: 'I’m raising the head of your bed to help you breathe easier.', id: 'hob-up', label: 'Raise head of bed (Semi/High Fowler’s)', kind: 'intervene', comps: ['cj-act'], secs: 10, effect: { spo2: 1, rr: -1 }, hob: 45 },
  { say: 'I’m putting a little oxygen in your nose. The prongs sit just inside your nostrils.', id: 'o2-nc', label: 'Apply O₂ via nasal cannula 2–4 L/min', kind: 'intervene', comps: ['cj-act'], secs: 30, effect: { spo2: 4, rr: -2, hr: -3 }, device: 'nc' },
  { say: 'I’m putting this oxygen mask on you — it’ll feel snug, but breathe normally.', id: 'o2-nrb', label: 'Apply O₂ via non-rebreather 15 L/min', kind: 'intervene', comps: ['cj-act'], secs: 30, effect: { spo2: 7, rr: -3, hr: -5 }, device: 'nrb' },
  { say: 'I’m going to start an IV in your arm. You’ll feel a pinch.', id: 'iv-access', label: 'Establish / verify IV access (18–20g)', kind: 'intervene', comps: ['cj-act'], secs: 120 },
  { say: 'I need to draw some blood for cultures from two sites before we start any antibiotics.', id: 'blood-cultures', label: 'Draw blood cultures ×2 before antibiotics', kind: 'intervene', comps: ['cj-act', 'qsen-ebp'], secs: 180 },
  { say: 'I’m drawing one more tube of blood for a lactate level.', id: 'lactate', label: 'Draw serum lactate', kind: 'intervene', comps: ['cj-act', 'qsen-ebp'], secs: 60 },
  { say: 'I’m starting the IV fluids now — they’ll run in quickly to help your blood pressure.', id: 'fluid-bolus', label: 'Start IV fluid bolus per order', kind: 'intervene', comps: ['cj-act', 'qsen-ebp'], secs: 60, effect: { sbp: 12, dbp: 6, hr: -10 } },
  { say: 'I’m going to put a cool cloth on your forehead and lighten the blankets to bring your fever down.', id: 'cool-measures', label: 'Cooling measures', kind: 'intervene', comps: ['cj-act', 'qsen-pcc'], secs: 60, effect: { temp: -0.3 } },
  { say: 'Let me help you get into a more comfortable position.', id: 'reposition', label: 'Reposition patient for comfort', kind: 'intervene', comps: ['qsen-pcc'], secs: 30, effect: { pain: -1 } },
  { say: 'Let’s use your breathing device — seal your lips, breathe in slowly, and try to keep the ball up.', id: 'incentive-spiro', label: 'Coach incentive spirometry / deep breathing', kind: 'intervene', comps: ['cj-act', 'comm'], secs: 90, effect: { spo2: 1 } },
  { say: 'I’m going to suction your mouth to clear some of that secretion. It’ll be quick.', id: 'suction', label: 'Oral / airway suction', kind: 'intervene', comps: ['cj-act'], secs: 45, effect: { spo2: 2 } },
  { say: 'Your sugar is low. Here’s some juice — drink it all for me and we’ll recheck in fifteen minutes.', id: 'oral-glucose', label: 'Give 15 g fast-acting carbohydrate (if able to swallow)', kind: 'intervene', comps: ['cj-act', 'qsen-ebp'], secs: 60, effect: { glucose: 45 } },
  { say: 'I’m going to turn you on your side to keep your airway safe.', id: 'aspiration-precautions', label: 'Aspiration precautions / side-lying', kind: 'intervene', comps: ['qsen-safety', 'cj-act'], secs: 20 },
  { say: 'I’m going to measure your urine every hour so we can see how your kidneys are doing.', id: 'foley-uo', label: 'Initiate strict I&O / hourly urine output', kind: 'intervene', comps: ['cj-act', 'cj-evaluate'], secs: 60 },
  { say: 'I’m calling the rapid response team to come help us right now. Stay with me.', id: 'rapid-response', label: 'Activate Rapid Response Team', kind: 'intervene', comps: ['qsen-team', 'cj-act'], secs: 20 },
  { say: 'Calling a code blue — starting compressions.', id: 'code-blue', label: 'Call Code Blue / begin BLS', kind: 'intervene', comps: ['qsen-team', 'cj-act'], secs: 20 },
  { say: 'I’m setting up a breathing treatment. Breathe the mist in slowly through your mouth.', id: 'nebulizer', label: 'Set up nebulizer treatment', kind: 'intervene', comps: ['cj-act'], secs: 60 },
  { say: 'I need to get your weight so we can compare it to yesterday.', id: 'daily-weight', label: 'Obtain weight / compare to dry weight', kind: 'assess', comps: ['cj-recognize', 'cj-analyze'], secs: 60 },
  { say: 'The doctor wants us to limit your fluids and salt. I’ll help you keep track.', id: 'fluid-restrict', label: 'Initiate fluid & sodium restriction', kind: 'intervene', comps: ['cj-act', 'qsen-ebp'], secs: 20 },

  // Communication
  { say: 'I’m going to call the provider about what I’m seeing. I’ll let you know what they say.', id: 'sbar-provider', label: 'Call provider using SBAR', kind: 'communicate', comps: ['qsen-team', 'cj-prioritize'], secs: 90 },
  { say: 'Let me explain what we’re going to do and why.', id: 'explain', label: 'Explain procedures to patient', kind: 'communicate', comps: ['qsen-pcc', 'comm'], secs: 20 },
  { say: 'I know this is scary. I’m right here with you, and we’re taking care of it.', id: 'reassure', label: 'Reassure / therapeutic communication', kind: 'communicate', comps: ['comm', 'qsen-pcc'], secs: 20, effect: { hr: -2, rr: -1 } },
  { say: 'Let’s go over this together, then I’ll ask you to tell it back to me so I know I explained it well.', id: 'educate', label: 'Educate patient with teach-back', kind: 'communicate', comps: ['comm', 'qsen-pcc'], secs: 90 },
  { say: 'I’m going to update your family on how you’re doing.', id: 'family-update', label: 'Update family / support person', kind: 'communicate', comps: ['qsen-pcc', 'comm'], secs: 60 },
  { say: 'I’m giving report to the next nurse now — they’ll be in to see you shortly.', id: 'handoff', label: 'Give SBAR hand-off to receiving RN', kind: 'communicate', comps: ['qsen-team'], secs: 90 },

  // LPN scope & family-centered care
  { id: 'report-rn', label: 'Report findings to the RN', kind: 'communicate', comps: ['pn-coord', 'qsen-team', 'cj-prioritize'], secs: 60, say: 'I’m going to step out for a moment to update the RN on what I found. I’ll be right back.' },
  { id: 'verify-scope', label: 'Verify order / task is within LPN scope', kind: 'safety', comps: ['pn-coord', 'qsen-safety'], secs: 15, say: 'Let me check this order with the RN before I go ahead.' },
  { id: 'reinforce-teaching', label: 'Reinforce teaching (per plan of care)', kind: 'communicate', comps: ['pn-hpm', 'comm'], secs: 90, say: 'Let’s go over what the nurse taught you earlier, so we make sure it all makes sense.' },
  { id: 'family-include', label: 'Include family in care / answer their questions', kind: 'communicate', comps: ['pn-psych', 'qsen-pcc', 'comm'], secs: 60, say: 'I want to make sure your family understands what’s going on too. What questions do you have?' },
  { id: 'cultural-prefs', label: 'Ask about cultural, spiritual or language preferences', kind: 'communicate', comps: ['pn-psych', 'qsen-pcc'], secs: 40, say: 'Is there anything about your beliefs, your culture, or your language that we should keep in mind while you’re here?' },
  { id: 'delegate-uap', label: 'Delegate vital signs / I&O to UAP', kind: 'communicate', comps: ['pn-coord'], secs: 20, say: 'I’m going to ask our aide to help keep track of your vital signs and fluids.' },
  { id: 'hygiene', label: 'Assist with hygiene / oral care', kind: 'intervene', comps: ['pn-bcc', 'qsen-pcc'], secs: 180, say: 'Let’s freshen you up a bit — I can help you wash and brush your teeth.', effect: { pain: -0.5 } },
  { id: 'turn-q2h', label: 'Turn & reposition (q2h)', kind: 'intervene', comps: ['pn-bcc', 'qsen-safety'], secs: 90, say: 'It’s time to shift your position so we protect your skin. I’ll help you roll toward me.', effect: { pain: -0.5 } },
  { id: 'ambulate', label: 'Assist to ambulate with walker / gait belt', kind: 'intervene', comps: ['pn-bcc', 'qsen-safety'], secs: 240, say: 'Let’s get you up for a short walk. I’ll put the gait belt on and we’ll go slowly.', effect: { hr: 4 } },
  { id: 'scd-apply', label: 'Apply SCDs / anti-embolism stockings', kind: 'intervene', comps: ['pn-risk', 'cj-act'], secs: 90, say: 'I’m putting these compression sleeves on your legs. They squeeze gently to help prevent blood clots.' },
  { id: 'nonpharm-comfort', label: 'Non-pharmacological comfort (ice, positioning, distraction)', kind: 'intervene', comps: ['pn-bcc', 'qsen-pcc'], secs: 60, say: 'Let’s try some things to make you more comfortable before the medication kicks in.', effect: { pain: -1 } },
  { id: 'offer-fluids', label: 'Offer oral fluids / encourage intake', kind: 'intervene', comps: ['pn-bcc'], secs: 30, say: 'Here’s some water. Small sips — I’d like you to drink a little more today.' },
  { id: 'elimination', label: 'Assist with toileting / bedpan / commode', kind: 'intervene', comps: ['pn-bcc', 'qsen-pcc'], secs: 120, say: 'Let me help you to the commode. I’ll stay right here.' },
  { id: 'swallow-screen', label: 'Bedside swallow screen (NPO until cleared)', kind: 'assess', comps: ['pn-risk', 'cj-recognize'], secs: 90, say: 'Before you eat or drink, I need to check how safely you’re swallowing. I’ll give you a small sip of water and watch.', finding: 'neuro' },
  { id: 'neuro-check', label: 'Neuro check (FAST / Cincinnati stroke scale)', kind: 'assess', comps: ['cj-recognize', 'pn-risk'], secs: 60, say: 'I’m going to check a few things — can you smile for me, hold both arms up, and tell me your full name?', finding: 'neuro' },
  { id: 'fundus-check', label: 'Fundal assessment & lochia check', kind: 'assess', comps: ['cj-recognize', 'pn-risk'], secs: 60, say: 'I need to check your uterus and your bleeding. I’ll press on your belly — tell me if it’s too uncomfortable.', finding: 'gi' },
  { id: 'fundal-massage', label: 'Fundal massage', kind: 'intervene', comps: ['cj-act', 'pn-physio'], secs: 90, say: 'Your uterus feels soft, so I’m going to massage it firmly to help it clamp down and slow the bleeding. This will be uncomfortable.', effect: { sbp: 4, hr: -4 } },
  { id: 'newborn-check', label: 'Newborn check (color, tone, temp, feeding)', kind: 'assess', comps: ['cj-recognize', 'pn-hpm'], secs: 90, say: 'While we’re here I’ll take a quick look at the baby — skin color, temperature, and how feeding is going.', finding: 'skin' },
  { id: 'breastfeeding-support', label: 'Support breastfeeding / latch', kind: 'communicate', comps: ['pn-hpm', 'comm'], secs: 120, say: 'Let’s try the football hold — I’ll help you get the baby positioned for a deeper latch.' },
  { id: 'peds-distraction', label: 'Child-friendly explanation & distraction', kind: 'communicate', comps: ['pn-psych', 'pn-hpm', 'comm'], secs: 40, say: 'Hey buddy — I’m going to listen to your chest with this. Want to hold it first? It’s a little cold!', effect: { hr: -3 } },
  { id: 'weight-based-dose', label: 'Verify weight-based dose with RN', kind: 'safety', comps: ['pn-pharm', 'qsen-safety'], secs: 30, say: 'I’m double-checking the dose against your child’s weight with the RN before I give it.' },
  { id: 'wound-care', label: 'Dressing change / wound care per order', kind: 'intervene', comps: ['pn-bcc', 'pn-safety'], secs: 240, say: 'I’m going to change your dressing now. I’ll clean the area and put on a fresh one.' },
  { id: 'pursed-lip', label: 'Coach pursed-lip & diaphragmatic breathing', kind: 'intervene', comps: ['cj-act', 'comm'], secs: 90, say: 'Breathe in through your nose for two… now out slowly through pursed lips, like you’re blowing out a candle.', effect: { rr: -2, spo2: 1 } },
  { id: 'tripod', label: 'Position in tripod / orthopneic position', kind: 'intervene', comps: ['cj-act', 'pn-bcc'], secs: 30, say: 'Let’s sit you up and lean you forward over the table — this will make breathing easier.', effect: { rr: -1, spo2: 1 }, hob: 70 },
  { id: 'ice-pack', label: 'Apply ice pack to surgical site', kind: 'intervene', comps: ['pn-bcc'], secs: 30, say: 'I’m putting an ice pack on your hip to help with the swelling and pain.', effect: { pain: -1 } },
  { id: 'hip-precautions', label: 'Reinforce hip precautions & abduction pillow', kind: 'safety', comps: ['pn-hpm', 'qsen-safety'], secs: 40, say: 'Remember: no bending past ninety degrees, no crossing your legs, and keep this pillow between your knees.' },
  { id: 'call-light', label: 'Answer call light / check on patient', kind: 'safety', comps: ['pn-safety', 'qsen-pcc'], secs: 15, say: 'I saw your light — what do you need?' },
  { id: 'pulse-ox-spot', label: 'Spot-check pulse oximetry', kind: 'assess', comps: ['cj-recognize'], secs: 20, say: 'Let me pop this on your finger to check your oxygen.', reveals: 'spo2' },
  { id: 'temp-check', label: 'Check temperature', kind: 'assess', comps: ['cj-recognize'], secs: 20, say: 'I’m going to take your temperature.', reveals: 'temp' },
  { id: 'calf-check', label: 'Check calves for DVT signs', kind: 'assess', comps: ['cj-recognize', 'pn-risk'], secs: 40, say: 'I’m going to look at your legs and press gently on your calves — tell me if either one is tender.', finding: 'skin' },

  // Documentation
  { say: 'I’m going to chart what I found.', id: 'doc-assessment', label: 'Document assessment findings', kind: 'document', comps: ['qsen-informatics'], secs: 60 },
  { say: 'I’m documenting what we did and how you responded.', id: 'doc-intervention', label: 'Document interventions & response', kind: 'document', comps: ['qsen-informatics', 'cj-evaluate'], secs: 60 },
  { say: 'I’m recording the medication I gave you.', id: 'doc-mar', label: 'Document medication on MAR', kind: 'document', comps: ['qsen-informatics', 'qsen-safety'], secs: 30 },
];

export function nurseLine(id, scenario, nurseName = 'your nurse') {
  const a = id?.startsWith('med:') ? null : ACTION_MAP[id];
  if (id?.startsWith('med:')) { const m = scenario?.meds?.find(x => `med:${x.id}` === id); return m ? `I have your ${m.name}, ${m.dose} ${m.route.toLowerCase()}, for ${m.indication.toLowerCase()}. I’ve checked your name band and your allergies.` : ''; }
  return (a?.say || `I’m going to ${a?.label?.toLowerCase() || 'do that'} now.`).replace('{nurse}', nurseName);
}

export const ACTION_MAP = Object.fromEntries(ACTIONS.map(a => [a.id, a]));

// Medication actions are generated per scenario: id = `med:<medId>`
export const medActionId = (medId) => `med:${medId}`;

export function actionLabel(id, scenario) {
  if (id?.startsWith('med:')) {
    const m = scenario?.meds?.find(x => `med:${x.id}` === id);
    return m ? `Administer ${m.name} ${m.dose} ${m.route}` : id;
  }
  return ACTION_MAP[id]?.label || id;
}
