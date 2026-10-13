import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { gownTexture, blanketTexture } from './materials.js';

// Procedural virtual patient that lies in a bed group. Physiology drives visible signs:
// respiratory rate/effort (chest rise, mouth breathing), skin colour (cyanosis, pallor, flushing),
// diaphoresis (specular sheen), level of consciousness (eyelids), and distress (restlessness).
const lerpColor = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t)));

export function blanketGeometry(L = 1.25, W = 0.98, build = 'average', lift = 0) {
  const geo = new THREE.PlaneGeometry(W, L, 48, 72);
  const pos = geo.attributes.position;
  const legW = build === 'heavy' ? 0.1 : 0.075;
  const hip = build === 'heavy' ? 0.2 : build === 'slim' ? 0.13 : 0.16;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i); // y: +L/2 = head end, -L/2 = feet
    const s = (L / 2 - y) / L; // 0 at waist → 1 at feet
    const g = (m, w) => Math.exp(-((x - m) ** 2) / (2 * w * w));
    let h = 0.03 + lift * (0.6 + 0.4 * Math.max(0, 1 - Math.abs(x) / 0.4));
    const legH = (hip * (1 - s) + 0.1 * s);
    h += Math.max(g(-0.1, legW + 0.02 * (1 - s)), g(0.1, legW + 0.02 * (1 - s))) * legH;
    h += Math.exp(-((s - 0.0) ** 2) / 0.02) * 0.06 * g(0, 0.25); // abdomen/hip mound
    h += Math.exp(-((s - 0.93) ** 2) / 0.002) * (0.1 + lift) * Math.max(g(-0.1, 0.06), g(0.1, 0.06)); // toes up
    const edge = Math.max(0, Math.abs(x) - 0.4) / 0.09; // drape over the sides
    h -= Math.min(1, edge) ** 2 * 0.22;
    h += (Math.sin(x * 40 + y * 9) * 0.004 + Math.sin(y * 23) * 0.003) * (1 - edge); // fabric wrinkles
    pos.setZ(i, h);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildPatient(appearance = {}) {
  const a = { skinTone: '#d7a98a', hair: '#3a2a20', hairStyle: 'short', build: 'average', gown: '#8fb3c9', ...appearance };
  const skin = new THREE.MeshPhysicalMaterial({ color: a.skinTone, roughness: 0.55, metalness: 0, sheen: 0.4, sheenColor: new THREE.Color('#ffd9c7'), clearcoat: 0, clearcoatRoughness: 0.3 });
  const lipMat = new THREE.MeshStandardMaterial({ color: '#b5605a', roughness: 0.4 });
  const gown = new THREE.MeshStandardMaterial({ map: gownTexture(a.gown), roughness: 0.9 });
  const hairMat = new THREE.MeshStandardMaterial({ color: a.hair, roughness: 0.75 });
  const scleraMat = new THREE.MeshStandardMaterial({ color: '#f4f1ec', roughness: 0.2 });
  const irisMat = new THREE.MeshStandardMaterial({ color: '#4b3a2a', roughness: 0.15 });
  const widths = { slim: 0.9, average: 1, heavy: 1.2 };
  const bw = widths[a.build] || 1;

  const upper = new THREE.Group(); // attaches to bed head pivot
  const lower = new THREE.Group(); // attaches to bed frame
  const y0 = 0.1;

  // pillow
  const pillow = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.12, 0.38, 4, 0.06), new THREE.MeshStandardMaterial({ color: '#f5f7f8', roughness: 0.95 }));
  pillow.position.set(0, y0 + 0.05, -0.74); upper.add(pillow);

  // chest / torso
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.3, 8, 20), gown);
  chest.rotation.x = Math.PI / 2; chest.scale.set(1.3 * bw, 1, 0.72 * bw); chest.position.set(0, y0 + 0.11, -0.33);
  chest.userData.region = 'chest';
  upper.add(chest);
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), gown);
  abdomen.scale.set(1.15 * bw, 0.62 * bw, 1.1); abdomen.position.set(0, y0 + 0.08, -0.05);
  abdomen.userData.region = 'abdomen';
  upper.add(abdomen);

  // neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.1, 16), skin);
  neck.rotation.x = Math.PI / 2; neck.position.set(0, y0 + 0.12, -0.585); upper.add(neck);
  const head = new THREE.Group(); head.position.set(0, y0 + 0.16, -0.72); head.rotation.z = -0.22; upper.add(head);
  const R = 0.105;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 24), skin); skull.scale.set(0.92, 1, 1.12); skull.userData.region = 'head'; head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(R * 0.72, 24, 16), skin); jaw.scale.set(1.05, 0.85, 1); jaw.position.set(0, R * 0.25, R * 0.45); jaw.userData.region = 'head'; head.add(jaw);
  // eyes
  const lids = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(s * 0.034, R * 0.8, R * 0.22);
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 16, 12), scleraMat); eye.add(sclera);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0068, 12, 10), irisMat); iris.position.y = 0.0075; eye.add(iris);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0134, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), skin);
    lid.position.y = 0.001; eye.add(lid); lids.push(lid);
    const brow = new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.006, 0.009, 2, 0.003), hairMat); brow.position.set(0, 0.01, -0.019); brow.rotation.z = s * 0.08; eye.add(brow);
    head.add(eye);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), skin); ear.scale.set(0.35, 0.8, 1); ear.position.set(s * R * 0.93, 0, R * 0.12); head.add(ear);
  }
  // nose: bridge, tip and alae
  const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.03, 4, 10), skin); bridge.rotation.x = Math.PI / 2 - 0.5; bridge.position.set(0, R * 0.98, R * 0.42); head.add(bridge);
  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 14, 10), skin); noseTip.scale.set(1, 0.9, 1); noseTip.position.set(0, R * 1.02, R * 0.6); head.add(noseTip);
  for (const s2 of [-1, 1]) { const ala = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 8), skin); ala.position.set(s2 * 0.011, R * 0.95, R * 0.6); head.add(ala); }
  // cheeks & chin give the face volume
  for (const s2 of [-1, 1]) { const ck = new THREE.Mesh(new THREE.SphereGeometry(R * 0.28, 16, 12), skin); ck.scale.set(1, 0.6, 1); ck.position.set(s2 * 0.042, R * 0.56, R * 0.45); ck.userData.region = 'head'; head.add(ck); }
  const chin = new THREE.Mesh(new THREE.SphereGeometry(R * 0.3, 16, 12), skin); chin.scale.set(1.15, 0.8, 1); chin.position.set(0, R * 0.55, R * 1.02); head.add(chin);
  // lips
  const mouth = new THREE.Group(); mouth.position.set(0, R * 0.8, R * 0.86); head.add(mouth);
  const upperLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.028, 4, 10), lipMat); upperLip.rotation.z = Math.PI / 2; upperLip.position.set(0, 0.002, -0.003); mouth.add(upperLip);
  const lowerLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.024, 4, 10), lipMat); lowerLip.rotation.z = Math.PI / 2; lowerLip.position.set(0, -0.001, 0.006); mouth.add(lowerLip);
  const mouthInner = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), new THREE.MeshStandardMaterial({ color: '#3a1614' })); mouthInner.scale.set(1.3, 0.1, 0.35); mouthInner.position.set(0, 0.001, 0.0015); mouth.add(mouthInner);
  // gown collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 24), gown); collar.position.set(0, y0 + 0.14, -0.56); collar.scale.set(1.2, 1, 1); upper.add(collar);
  // hair
  if (a.hairStyle !== 'bald') {
    const hg = new THREE.SphereGeometry(R * 1.07, 32, 24);
    const p = hg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const face = y > R * 0.15 && z > -R * 0.35; // keep face and front clear
      const hairline = y > -R * 0.2 && z > R * 0.55;
      if (face || hairline) p.setXYZ(i, x * 0.8, y * 0.8, z * 0.8);
    }
    hg.computeVertexNormals();
    const hair = new THREE.Mesh(hg, hairMat); hair.scale.set(0.93, 1, 1.12); head.add(hair);
    if (a.hairStyle === 'long') {
      const flow = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.03, 0.2, 3, 0.012), hairMat); flow.position.set(0, -R * 0.95, -R * 0.4); head.add(flow);
      for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.12, 4, 8), hairMat); side.rotation.x = Math.PI / 2; side.position.set(s * R * 0.9, -R * 0.2, R * 0.25); head.add(side); }
    }
    if (a.hairStyle === 'bun') { const bun = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), hairMat); bun.position.set(0, -R * 0.4, -R * 1.15); head.add(bun); }
  }
  // oxygen devices
  const tubeMat = new THREE.MeshStandardMaterial({ color: '#cfe9f2', roughness: 0.3, transparent: true, opacity: 0.85 });
  const nc = new THREE.Group();
  const ncCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-R, 0, R * 0.2), new THREE.Vector3(-R * 0.55, R * 0.95, R * 0.55), new THREE.Vector3(0, R * 1.08, R * 0.62), new THREE.Vector3(R * 0.55, R * 0.95, R * 0.55), new THREE.Vector3(R, 0, R * 0.2)]);
  nc.add(new THREE.Mesh(new THREE.TubeGeometry(ncCurve, 30, 0.003, 6), tubeMat)); nc.visible = false; head.add(nc);
  const nrb = new THREE.Group();
  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#e7f5ec', roughness: 0.2, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  mask.scale.set(1, 0.9, 1.2); mask.position.set(0, R * 0.95, R * 0.7); nrb.add(mask);
  const reservoir = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshPhysicalMaterial({ color: '#dff3e6', roughness: 0.25, transparent: true, opacity: 0.55 }));
  reservoir.scale.set(1, 0.8, 1.3); reservoir.position.set(0, R * 0.9, R * 1.65); nrb.add(reservoir);
  nrb.visible = false; head.add(nrb);

  // arms (upper in gown sleeve, forearm skin) resting at sides
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.25 * bw, y0 + 0.08, -0.47);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.04 * bw, 0.2, 6, 12), gown); up.rotation.x = Math.PI / 2; up.position.z = 0.12; up.userData.region = 'arm'; arm.add(up);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.03 * bw, 0.21, 6, 12), skin); fore.rotation.x = Math.PI / 2; fore.position.set(s * 0.01, 0.0, 0.38); fore.userData.region = 'arm'; arm.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), skin); hand.scale.set(0.75, 0.4, 1.15); hand.position.set(s * 0.015, -0.005, 0.56); hand.userData.region = 'arm'; arm.add(hand);
    if (s === 1) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.006, 6, 16), new THREE.MeshStandardMaterial({ color: '#ffffff' })); band.position.set(0.01, 0, 0.47); arm.add(band); }
    arm.rotation.y = -s * 0.04;
    upper.add(arm); arms.push(arm);
  }

  // blanket over legs (lower body in bed frame)
  const blanket = new THREE.Mesh(blanketGeometry(1.2, 0.98, a.build), new THREE.MeshStandardMaterial({ map: blanketTexture(), roughness: 0.95, side: THREE.DoubleSide }));
  blanket.rotation.x = -Math.PI / 2; blanket.position.set(0, 0.66, 0.43); blanket.userData.region = 'legs';
  blanket.castShadow = true; blanket.receiveShadow = true;
  lower.add(blanket);

  for (const g of [upper, lower]) g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.region = o.userData.region || (g === lower ? 'legs' : o.userData.region); } });

  const base = { skin: new THREE.Color(a.skinTone), lips: new THREE.Color('#b5605a') };
  let blinkT = 0, nextBlink = 2 + Math.random() * 3, restless = 0;

  return {
    upper, lower,
    setO2(device) { nc.visible = device === 'nc'; nrb.visible = device === 'nrb'; },
    update(t, dt, v = {}, cues = '') {
      const rr = Math.max(4, v.rr || 14);
      const effort = rr > 30 ? 2.1 : rr > 24 ? 1.6 : rr < 10 ? 0.6 : 1;
      const phase = Math.sin((t * rr / 60) * Math.PI * 2);
      const breath = Math.max(0, phase);
      chest.scale.z = 0.72 * bw * (1 + 0.07 * effort * breath);
      chest.scale.x = 1.3 * bw * (1 + 0.02 * effort * breath);
      abdomen.scale.y = 0.62 * bw * (1 + 0.1 * breath * (effort > 1.5 ? 0.4 : 1));
      if (reservoir.parent && nrb.visible) reservoir.scale.y = 0.8 * (1 - 0.25 * breath);
      // mouth breathing when distressed
      mouthInner.scale.y = effort > 1.5 ? 0.6 + breath * 0.5 : 0.1;
      lowerLip.position.z = effort > 1.5 ? 0.008 + breath * 0.006 : 0.006;
      // level of consciousness → eyelids
      const loc = (v.loc || '').toLowerCase();
      let open = 1;
      if (/unrespons|pain only/.test(loc)) open = 0; else if (/lethargic/.test(loc)) open = 0.25; else if (/drowsy/.test(loc)) open = 0.5;
      blinkT += dt;
      let blink = 0;
      if (blinkT > nextBlink) { const k = (blinkT - nextBlink) / 0.15; blink = k < 1 ? Math.sin(k * Math.PI) : 0; if (k >= 1) { blinkT = 0; nextBlink = 2 + Math.random() * 4; } }
      const closed = 1 - open * (1 - blink);
      for (const lid of lids) { lid.scale.set(1, 1, 1); lid.rotation.x = -(1 - closed) * 2.1; }
      // skin: cyanosis (SpO2), pallor (hypotension), flushing (fever), diaphoresis
      const spo2 = v.spo2 ?? 98, sbp = v.sbp ?? 120, temp = v.temp ?? 37;
      let c = base.skin.clone();
      const pallor = sbp < 95 ? (95 - sbp) / 35 : 0;
      c = c.lerp(new THREE.Color('#d9d3cc'), pallor * 0.45);
      if (temp > 38.2) c = c.lerp(new THREE.Color('#e8826c'), Math.min(0.28, (temp - 38.2) * 0.22));
      const cyan = spo2 < 92 ? (92 - spo2) / 14 : 0;
      c = c.lerp(new THREE.Color('#8894b5'), Math.min(0.55, cyan * 0.55));
      skin.color.copy(c);
      lipMat.color.copy(lerpColor(base.lips, '#5b5f8f', cyan * 1.1));
      const diaphoretic = /diaphor|clammy|sweat|moist/i.test(cues) || /diaphor|clammy/i.test(v.skin || '');
      skin.clearcoat = diaphoretic ? 0.9 : 0; skin.roughness = diaphoretic ? 0.32 : 0.55;
      // restlessness / anxiety
      const agitated = /anxious|agitat|restless|confus/.test(loc) || effort > 1.5;
      restless += dt;
      head.rotation.z = -0.22 + (agitated ? Math.sin(restless * 0.9) * 0.08 : Math.sin(restless * 0.2) * 0.02) + (open < 0.5 ? 0.12 : 0);
      head.rotation.x = effort > 1.5 ? -0.08 * breath : 0;
      arms.forEach((arm, i) => { arm.rotation.x = agitated ? Math.sin(restless * 1.3 + i) * 0.04 : 0; });
    },
    regions: ['head', 'chest', 'abdomen', 'arm', 'legs'],
  };
}
