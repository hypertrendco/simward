import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { gownTexture, blanketTexture } from './materials.js';
import { blanketGeometry } from './patient.js';

// Realistic patient avatars from the Microsoft Rocketbox library (MIT license):
// photo-textured, fully rigged (Biped skeleton) with ARKit facial blendshapes + visemes.
// We pose them supine in the bed, dress them in a skinned hospital-gown shell, and drive
// face, breathing, skin colour and lip-sync from the simulation's physiology.
export const AVATAR_BASE = (typeof window !== 'undefined' && window.__SIMWARD_ASSETS__) || 'avatars/';
export const AVATARS = [
  { id: 'Male_Adult_03', sex: 'M', label: 'Older man · light skin · gray, balding' },
  { id: 'Male_Adult_05', sex: 'M', label: 'Older man · light skin · gray beard' },
  { id: 'Male_Adult_13', sex: 'M', label: 'Middle-aged man · light skin · balding' },
  { id: 'Male_Adult_12', sex: 'M', label: 'Middle-aged man · Black · short hair' },
  { id: 'Male_Adult_04', sex: 'M', label: 'Young man · Black · curly hair' },
  { id: 'Male_Adult_10', sex: 'M', label: 'Adult man · East Asian' },
  { id: 'Male_Adult_15', sex: 'M', label: 'Adult man · South Asian · beard, kufi' },
  { id: 'Female_Adult_02', sex: 'F', label: 'Older woman · light skin' },
  { id: 'Female_Adult_09', sex: 'F', label: 'Middle-aged woman · light skin' },
  { id: 'Female_Adult_06', sex: 'F', label: 'Middle-aged woman · hijab' },
  { id: 'Female_Adult_14', sex: 'F', label: 'Adult woman · brown hair' },
  { id: 'Female_Adult_11', sex: 'F', label: 'Adult woman · olive skin · dark hair' },
  { id: 'Female_Adult_05', sex: 'F', label: 'Adult woman · dark hair' },
  { id: 'Female_Adult_03', sex: 'F', label: 'Young woman · East Asian · long hair' },
  { id: 'Male_Adult_13', sex: 'M', label: 'Middle-aged man · light skin · balding' },
  { id: 'Male_Adult_14', sex: 'M', label: 'Middle-aged man · ruddy, light skin' },
  { id: 'Male_Adult_09', sex: 'M', label: 'Older man · East Asian' },
  { id: 'Male_Adult_18', sex: 'M', label: 'Young man · Black · hoodie' },
  { id: 'Male_Adult_19', sex: 'M', label: 'Middle-aged man · Arab · thobe & ghutra' },
  { id: 'Male_Adult_20', sex: 'M', label: 'Young man · light skin · short hair' },
  { id: 'Male_Adult_21', sex: 'M', label: 'Young man · Arab · ghutra' },
  { id: 'Female_Adult_13', sex: 'F', label: 'Middle-aged woman · short blonde hair' },
  { id: 'Female_Adult_15', sex: 'F', label: 'Adult woman · long brown hair' },
  { id: 'Female_Adult_17', sex: 'F', label: 'Young woman · light skin · fair hair' },
  { id: 'Male_Child_01', sex: 'M', age: 'child', label: 'School-age boy · light skin · brown hair' },
  { id: 'Male_Child_02', sex: 'M', age: 'child', label: 'School-age boy · Black' },
  { id: 'Female_Child_01', sex: 'F', age: 'child', label: 'School-age girl · Black' },
  { id: 'Female_Child_02', sex: 'F', age: 'child', label: 'School-age girl · hijab' },
];
// Clinicians (used for the student's nurse avatar / profile picture)
export const NURSE_AVATARS = [
  { id: 'Medical_Female_01', sex: 'F', label: 'Nurse · white scrubs' },
  { id: 'Medical_Female_02', sex: 'F', label: 'Nurse · white coat' },
  { id: 'Medical_Male_04', sex: 'M', label: 'Nurse · green scrubs' },
  { id: 'Medical_Male_05', sex: 'M', label: 'Nurse · blue scrubs' },
  { id: 'Medical_Male_03', sex: 'M', label: 'Nurse · white coat, stethoscope' },
  { id: 'Medical_Female_03', sex: 'F', label: 'EMT · blue uniform' },
];
export const ALL_AVATARS = [...AVATARS, ...NURSE_AVATARS];
export const avatarThumb = (id) => `${AVATAR_BASE}${id}.jpg`;

const cache = new Map();
function loadGLB(id) {
  if (!cache.has(id)) cache.set(id, new Promise((res, rej) => {
    if (typeof window !== 'undefined' && window.__SIMWARD_AVATAR_B64__) {
      // artifact hosting serves only web media types, so the GLB ships base64-encoded as text
      fetch(`${AVATAR_BASE}${id}.glb.txt`).then(r => { if (!r.ok) throw new Error(`Avatar ${id} not found`); return r.text(); }).then(t => {
        const bin = atob(t.trim()); const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        new GLTFLoader().parse(buf.buffer, '', res, rej);
      }).catch(rej);
    } else new GLTFLoader().load(`${AVATAR_BASE}${id}.glb`, res, undefined, rej);
  }));
  return cache.get(id);
}

const norm = (n) => n.replace(/[\s_]/g, '').toLowerCase();
const TORSO = ['bip01pelvis', 'bip01spine', 'bip01spine1', 'bip01spine2', 'bip01lclavicle', 'bip01rclavicle', 'bip01lupperarm', 'bip01rupperarm', 'bip01lthigh', 'bip01rthigh'];
const FOREARM = ['bip01lforearm', 'bip01rforearm'];
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();
function rotateWorld(bone, axis, angle) {
  // rotate bone around a world-space axis while keeping its local parenting
  bone.parent.getWorldQuaternion(_pq);
  _q.setFromAxisAngle(axis, angle);
  const local = _pq.clone().invert().multiply(_q).multiply(_pq);
  bone.quaternion.premultiply(local);
  bone.updateMatrixWorld(true);
}

// Build a skinned shell over selected body regions (gown / skin sleeve) so street clothes never show
function buildShell(src, boneNames, material, offset, minVerts = 1) {
  const g = src.geometry;
  const bones = src.skeleton.bones.map(b => norm(b.name));
  const allow = new Set(bones.map((n, i) => (boneNames.includes(n) ? i : -1)).filter(i => i >= 0));
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index;
  const dominant = (v) => { let best = 0, bi = 0; for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > best) { best = w; bi = si.getComponent(v, k); } } return bi; };
  const blockIdx = new Set(bones.map((n, i) => (/neck|head/.test(n) ? i : -1)).filter(i => i >= 0));
  const neckWeight = (v) => { let w = 0; for (let k = 0; k < 4; k++) if (blockIdx.has(si.getComponent(v, k))) w += sw.getComponent(v, k); return w; };
  const keep = [];
  for (let t = 0; t < idx.count; t += 3) {
    if (minVerts > 1 && (neckWeight(idx.getX(t)) > 0.2 || neckWeight(idx.getX(t + 1)) > 0.2 || neckWeight(idx.getX(t + 2)) > 0.2)) continue;
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    const n = (allow.has(dominant(a)) ? 1 : 0) + (allow.has(dominant(b)) ? 1 : 0) + (allow.has(dominant(c)) ? 1 : 0);
    if (n >= minVerts) keep.push(a, b, c); // include seam triangles so no street clothing shows at joints
  }
  const ng = new THREE.BufferGeometry();
  const pos = g.attributes.position.clone(), nrm = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + nrm.getX(i) * offset, pos.getY(i) + nrm.getY(i) * offset, pos.getZ(i) + nrm.getZ(i) * offset);
  ng.setAttribute('position', pos); ng.setAttribute('normal', nrm.clone());
  if (g.attributes.uv) ng.setAttribute('uv', g.attributes.uv.clone());
  ng.setAttribute('skinIndex', si.clone()); ng.setAttribute('skinWeight', sw.clone());
  ng.setIndex(keep);
  const m = new THREE.SkinnedMesh(ng, material);
  m.bind(src.skeleton, src.bindMatrix);
  m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
  return m;
}

function averageSkin(mat) {
  try {
    const img = mat.map?.image; if (!img) return new THREE.Color('#c99a7c');
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const ctx = c.getContext('2d'); ctx.drawImage(img, img.width * 0.35, img.height * 0.35, img.width * 0.3, img.height * 0.3, 0, 0, 32, 32);
    const d = ctx.getImageData(0, 0, 32, 32).data; let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4; return new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
  } catch { return new THREE.Color('#c99a7c'); }
}


const VISEMES = ['AA_VI_00_Sil', 'AA_VI_01_PP', 'AA_VI_02_FF', 'AA_VI_03_TH', 'AA_VI_04_DD', 'AA_VI_05_KK', 'AA_VI_06_CH', 'AA_VI_07_SS', 'AA_VI_08_nn', 'AA_VI_09_RR', 'AA_VI_10_aa', 'AA_VI_11_E', 'AA_VI_12_I', 'AA_VI_13_O', 'AA_VI_14_U'];
const visemeFor = (ch) => (/[pbm]/.test(ch) ? 1 : /[fv]/.test(ch) ? 2 : /[t]h?/.test(ch) ? 4 : /[kgq]/.test(ch) ? 5 : /[jc]/.test(ch) ? 6 : /[sz]/.test(ch) ? 7 : /[nl]/.test(ch) ? 8 : /r/.test(ch) ? 9 : /a/.test(ch) ? 10 : /e/.test(ch) ? 11 : /[iy]/.test(ch) ? 12 : /o/.test(ch) ? 13 : /[uw]/.test(ch) ? 14 : 0);

// Shared facial animation: blinking, eyelids by level of consciousness, pain/anxiety expression, viseme lip-sync.
function faceDriver(faceMeshes) {
  const morph = (name, v) => { for (const m of faceMeshes) { const k = Object.keys(m.morphTargetDictionary).find(x => x.includes(name)); if (k != null) m.morphTargetInfluences[m.morphTargetDictionary[k]] = v; } };
  let speech = null, blinkT = 0, nextBlink = 2.5, smileT = 0;
  return {
    morph,
    speak(text, durSec) { speech = { text: String(text).toLowerCase().replace(/[^a-z ]/g, ''), start: performance.now(), dur: Math.max(0.6, durSec) * 1000 }; },
    stop() { speech = null; },
    get speaking() { return !!speech; },
    tick(dt, { open = 1, pain = 0, anxious = false, effort = 1, breath = 0, mood = 0, droop = null } = {}) {
      blinkT += dt; let blink = 0;
      if (blinkT > nextBlink) { const k = (blinkT - nextBlink) / 0.16; blink = k < 1 ? Math.sin(k * Math.PI) : 0; if (k >= 1) { blinkT = 0; nextBlink = 2 + Math.random() * 4; } }
      const closed = 1 - open * (1 - blink);
      morph('EyeBlinkLeft', closed); morph('EyeBlinkRight', closed);
      const pf = pain >= 4 ? (pain - 3) / 7 : 0;
      morph('BrowDownLeft', pf * 0.7); morph('BrowDownRight', pf * 0.7); morph('BrowInnerUp', Math.min(1, pf * 0.5 + (anxious ? 0.45 : 0)));
      morph('EyeSquintLeft', pf * 0.6); morph('EyeSquintRight', pf * 0.6);
      morph('MouthFrownLeft', pf * 0.5 + (mood < 0 ? -mood * 0.3 : 0)); morph('MouthFrownRight', pf * 0.5 + (mood < 0 ? -mood * 0.3 : 0)); morph('NoseSneerLeft', pf * 0.3); morph('NoseSneerRight', pf * 0.3);
      smileT += dt; const sm = mood > 0 ? mood * (0.25 + 0.1 * Math.sin(smileT * 0.4)) : 0;
      morph('MouthSmileLeft', sm); morph('MouthSmileRight', sm);
      morph('EyeWideLeft', anxious ? 0.35 : 0); morph('EyeWideRight', anxious ? 0.35 : 0);
      if (droop) { const S = droop === 'right' ? 'Right' : 'Left'; morph(`MouthFrown${S}`, 0.9); morph(`MouthLowerDown${S}`, 0.6); morph(`EyeSquint${S}`, 0.35); morph(`BrowDown${S}`, 0.25); morph(`CheekSquint${S}`, 0); }
      let jaw = effort > 1.5 ? 0.12 + breath * 0.28 : 0;
      for (const vz of VISEMES) morph(vz, 0);
      if (speech) {
        const e = (performance.now() - speech.start) / speech.dur;
        if (e >= 1) speech = null;
        else { const i = Math.floor(e * speech.text.length); const ch = speech.text[i] || ' '; const vi = ch === ' ' ? 0 : visemeFor(ch); morph(VISEMES[vi], 0.85); jaw = Math.max(jaw, vi >= 10 ? 0.18 : 0.06); }
      }
      morph('JawOpen', jaw);
      morph('MouthStretchLeft', effort > 1.5 ? 0.25 * breath : 0); morph('MouthStretchRight', effort > 1.5 ? 0.25 * breath : 0);
    },
  };
}

function prepModel(avatarId, gltf) {
  const model = SkeletonUtils.clone(gltf.scene);
  const bones = {}; model.traverse(o => { if (o.isBone) bones[norm(o.name)] = o; });
  const meshes = []; model.traverse(o => { if (o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; meshes.push(o); } });
  const faceMeshes = meshes.filter(m => m.morphTargetDictionary && Object.keys(m.morphTargetDictionary).length);
  const skinMats = [];
  for (const m of meshes) { m.material = m.material.clone(); m.material.metalness = 0; m.material.roughness = 0.62; if (m.material.map) m.material.map.anisotropy = 4; if (!/opacity/i.test(m.material.name)) skinMats.push(m.material); }
  const body = meshes.find(m => /body/i.test(m.material.name)) || meshes[0];
  const head = meshes.find(m => /head/i.test(m.material.name));
  return { model, bones, meshes, faceMeshes, skinMats, body, head, B: (n) => bones[norm(n)] };
}

// Seated family member / visitor: sits in a chair, looks toward the bed, talks and reacts.
export async function buildSeatedAvatar(appearance, { seatHeight = 0.45 } = {}) {
  const gltf = await loadGLB(appearance.avatarId);
  const { model, bones, meshes, faceMeshes, B } = prepModel(appearance.avatarId, gltf);
  model.updateMatrixWorld(true);
  const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
  for (const s of ['L', 'R']) {
    const th = B(`Bip01 ${s} Thigh`), cf = B(`Bip01 ${s} Calf`), ft = B(`Bip01 ${s} Foot`);
    if (th) rotateWorld(th, X, -Math.PI / 2 + 0.1);
    if (cf) rotateWorld(cf, X, Math.PI / 2 - 0.25);
    if (ft) rotateWorld(ft, X, 0.1);
    const ua = B(`Bip01 ${s} UpperArm`), fa = B(`Bip01 ${s} Forearm`);
    if (ua) { rotateWorld(ua, Z, s === 'L' ? -1.25 : 1.25); rotateWorld(ua, X, -0.25); }
    if (fa) rotateWorld(fa, X, -1.1);
  }
  const sp = B('Bip01 Spine'); if (sp) rotateWorld(sp, X, 0.08);
  const rest = {}; for (const [k, b] of Object.entries(bones)) rest[k] = b.quaternion.clone();
  const holder = new THREE.Group(); holder.add(model); holder.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(model);
  const pelvis = B('Bip01 Pelvis'); const pw = new THREE.Vector3(); pelvis.getWorldPosition(pw);
  // feet on the floor, pelvis on the seat, pelvis centred on the seat
  model.position.set(-pw.x, Math.max(0, seatHeight + 0.08 - pw.y), -pw.z + 0.05);
  for (const m of meshes) m.userData.region = /head|opacity/i.test(m.material.name) ? 'family-head' : 'family';
  const face = faceDriver(faceMeshes);
  const neck = B('Bip01 Neck'), headBone = B('Bip01 Head');
  let t = 0, mood = 0, anxious = false;
  return {
    group: holder, headAnchor: headBone, face,
    speak(text, dur) { face.speak(text, dur); }, stopSpeaking() { face.stop(); },
    setMood(m, anx = false) { mood = m; anxious = anx; },
    lookAt(target) { this._target = target; },
    update(dt) {
      t += dt;
      face.tick(dt, { open: 1, pain: 0, anxious, mood, effort: 1, breath: 0 });
      for (const k of ['bip01neck', 'bip01head']) if (bones[k]) bones[k].quaternion.copy(rest[k]);
      if (neck) rotateWorld(neck, new THREE.Vector3(0, 1, 0), (this._lookYaw || 0) + Math.sin(t * 0.3) * 0.05 + (face.speaking ? Math.sin(t * 2.2) * 0.04 : 0));
      if (headBone) rotateWorld(headBone, new THREE.Vector3(1, 0, 0), face.speaking ? Math.sin(t * 3) * 0.03 : 0);
      const spine = B('Bip01 Spine1'); if (spine) { spine.quaternion.copy(rest[norm(spine.name)]); rotateWorld(spine, new THREE.Vector3(1, 0, 0), -0.01 * Math.sin(t * 1.2)); }
    },
  };
}

// Returns a controller compatible with the procedural patient: { upper, lower, update, setO2, speak, setHob }
export async function buildAvatarPatient(appearance, bedTop = 0.66, { blanketColor = null } = {}) {
  const gltf = await loadGLB(appearance.avatarId);
  const { model, bones, meshes, faceMeshes, skinMats, body, head, B } = prepModel(appearance.avatarId, gltf);
  const baseColor = new THREE.Color(1, 1, 1);
  const isChild = /Child/.test(appearance.avatarId);

  // ---- pose (standing frame: up = +Y, facing +Z, character left = +X) ----
  model.updateMatrixWorld(true);
  const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
  if (B('Bip01 L UpperArm')) rotateWorld(B('Bip01 L UpperArm'), Z, -0.95);
  if (B('Bip01 R UpperArm')) rotateWorld(B('Bip01 R UpperArm'), Z, 0.95);
  if (B('Bip01 L UpperArm')) rotateWorld(B('Bip01 L UpperArm'), X, 0.12);
  if (B('Bip01 R UpperArm')) rotateWorld(B('Bip01 R UpperArm'), X, 0.12);
  if (B('Bip01 L Forearm')) rotateWorld(B('Bip01 L Forearm'), X, 0.55);
  if (B('Bip01 R Forearm')) rotateWorld(B('Bip01 R Forearm'), X, 0.55);
  for (const s of ['L', 'R']) { const hnd = B(`Bip01 ${s} Hand`); if (hnd) rotateWorld(hnd, Y, s === 'L' ? 0.5 : -0.5); }
  for (const s of ['L', 'R']) { const f = B(`Bip01 ${s} Foot`); if (f) rotateWorld(f, X, 0.35); }
  const rest = {}, hobRest = {}; for (const [k, b] of Object.entries(bones)) rest[k] = b.quaternion.clone();

  // ---- flatten standing collars / hoods so the hospital gown has a natural neckline ----
  (function trimCollar(mesh) {
    const bi = mesh.skeleton.bones.findIndex(b => norm(b.name) === 'bip01neck');
    if (bi < 0) return;
    const np = new THREE.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[bi].clone().invert());
    mesh.geometry = mesh.geometry.clone();
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const r = Math.hypot(x - np.x, z - np.z);
      if (y > np.y - 0.015 && y < np.y + 0.25 && r > 0.068) pos.setY(i, np.y - 0.015);
    }
    pos.needsUpdate = true; mesh.geometry.computeBoundingSphere();
  })(body);

  // ---- gown + forearm skin shells ----
  const gownTex = () => { const t = gownTexture(appearance.gown || '#8fb3c9').clone(); t.repeat.set(14, 14); t.needsUpdate = true; return t; };
  const gownMat = new THREE.MeshStandardMaterial({ map: gownTex(), roughness: 0.92 });
  const skinTone = averageSkin(head?.material || body.material);
  const sleeveMat = new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.6 });
  const gown = buildShell(body, TORSO, gownMat, 0.014, 2);
  const sleeves = buildShell(body, FOREARM, sleeveMat, 0.006);
  body.parent.add(gown, sleeves);
  skinMats.push(sleeveMat);

  // ---- lay supine in the bed ----
  const holder = new THREE.Group();
  model.rotation.x = -Math.PI / 2;
  holder.add(model);
  holder.updateMatrixWorld(true);
  const hinge = B('Bip01 Spine') || B('Bip01 Pelvis');
  const pw = new THREE.Vector3(); hinge.getWorldPosition(pw);
  const bb = new THREE.Box3().setFromObject(body);
  // lumbar spine sits on the bed's hinge (z = -0.2) so the torso rises with the head section
  model.position.set(-pw.x, bedTop - bb.min.y + 0.005, -0.2 - pw.z);
  holder.updateMatrixWorld(true);

  // blanket over the legs (bed-frame coordinates, waist → feet)
  const blanket = new THREE.Mesh(blanketGeometry(isChild ? 1.05 : 1.32, 1.0, isChild ? 'slim' : 'heavy', isChild ? 0.04 : 0.07), new THREE.MeshStandardMaterial({ map: blanketTexture(), color: blanketColor || '#ffffff', roughness: 0.95, side: THREE.DoubleSide }));
  blanket.rotation.x = -Math.PI / 2; blanket.position.set(0, bedTop, isChild ? 0.25 : 0.4); blanket.castShadow = true; blanket.receiveShadow = true;
  blanket.userData.region = 'legs';
  holder.add(blanket);
  // regions for click-to-assess
  gown.userData.region = 'chest'; sleeves.userData.region = 'arm';
  for (const m of meshes) m.userData.region = /head|opacity/i.test(m.material.name) ? 'head' : 'chest';

  const face = faceDriver(faceMeshes);
  const morph = face.morph;

  // ---- O2 devices (simple tubing/mask attached to the head bone) ----
  const headBone = B('Bip01 Head');
  const tubeMat = new THREE.MeshStandardMaterial({ color: '#d5eef6', roughness: 0.3, transparent: true, opacity: 0.85 });
  const hb = new THREE.Box3().setFromObject(head || body);
  const o2 = new THREE.Group(); headBone.add(o2);
  const toLocal = (v) => headBone.worldToLocal(v.clone());
  const hc = new THREE.Vector3(); headBone.getWorldPosition(hc);
  const nc = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.003, 6, 32), tubeMat);
  const nrb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e5f4ea', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  // place in world (face up = +Y after lying), then convert to head-bone space
  const faceY = hb.max.y;
  const ncWorld = new THREE.Vector3(hc.x, faceY - 0.035, hc.z + 0.07);
  nc.position.copy(toLocal(ncWorld)); nc.visible = false; o2.add(nc);
  nrb.position.copy(toLocal(new THREE.Vector3(hc.x, faceY - 0.01, hc.z + 0.085))); nrb.visible = false; o2.add(nrb);
  nc.quaternion.copy(headBone.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(new THREE.Quaternion().setFromAxisAngle(X, Math.PI / 2));
  nrb.quaternion.copy(nc.quaternion);

  let restless = 0, hob = 30;
  const NECK_FLEX = 0.36, HEAD_FLEX = 0.24;
  const spine = B('Bip01 Spine'), spine1 = B('Bip01 Spine1'), neck = B('Bip01 Neck');

  function applyHob() {
    for (const [k, q] of Object.entries(rest)) bones[k].quaternion.copy(q);
    model.updateMatrixWorld(true);
    // torso rises with the head of the bed (hip flexion at the bed hinge)
    const lateral = new THREE.Vector3(1, 0, 0);
    const a = THREE.MathUtils.degToRad(hob);
    if (spine) rotateWorld(spine, lateral, a * 0.8);
    if (spine1) rotateWorld(spine1, lateral, a * 0.2);
    if (neck) rotateWorld(neck, lateral, NECK_FLEX - a * 0.2);
    if (B('Bip01 Head')) rotateWorld(B('Bip01 Head'), lateral, HEAD_FLEX - a * 0.1);
    for (const [k, b] of Object.entries(bones)) hobRest[k] = b.quaternion.clone();
  }
  applyHob();

  const upper = new THREE.Group();
  const pillow = new THREE.Mesh(new RoundedBoxGeometry(0.64, 0.11, 0.4, 4, 0.05), new THREE.MeshStandardMaterial({ color: '#f5f7f8', roughness: 0.95 }));
  pillow.position.set(0, 0.14, -0.78); pillow.castShadow = true; pillow.receiveShadow = true; upper.add(pillow);
  return {
    upper, // pillow rides on the head section; the avatar itself hangs off the bed frame
    lower: holder,
    isAvatar: true,
    headAnchor: headBone,
    setHob(deg) { hob = deg; applyHob(); },
    setO2(dev) { nc.visible = dev === 'nc'; nrb.visible = dev === 'nrb'; },
    setGown(color) { appearance.gown = color; gownMat.map = gownTex(); gownMat.needsUpdate = true; },
    speak(text, durSec) { face.speak(text, durSec); },
    stopSpeaking() { face.stop(); },
    get speaking() { return face.speaking; },
    update(t, dt, v = {}, cues = '') {
      const rr = Math.max(4, v.rr || 14);
      const effort = rr > 30 ? 2.1 : rr > 24 ? 1.6 : rr < 10 ? 0.6 : 1;
      const phase = Math.sin((t * rr / 60) * Math.PI * 2);
      const breath = Math.max(0, phase);
      // chest rise & shoulder lift from the skeleton (gown shell follows)
      if (spine1) { spine1.quaternion.copy(hobRest[norm(spine1.name)]); rotateWorld(spine1, new THREE.Vector3(1, 0, 0), -0.02 * effort * breath); spine1.scale.setScalar(1 + 0.012 * effort * breath); }
      for (const s of ['L', 'R']) { const cl = B(`Bip01 ${s} Clavicle`); if (cl) { cl.quaternion.copy(hobRest[norm(cl.name)]); if (effort > 1.5) rotateWorld(cl, new THREE.Vector3(0, 0, 1), (s === 'L' ? 1 : -1) * 0.04 * breath); } }
      // level of consciousness, expression and lip-sync
      const loc = (v.loc || '').toLowerCase();
      let open = 1;
      if (/unrespons|pain only/.test(loc)) open = 0; else if (/lethargic/.test(loc)) open = 0.3; else if (/drowsy|listless/.test(loc)) open = 0.55;
      const droop = /right (facial )?droop|droop.*right|right.*droop/i.test(cues) ? 'right' : /left (facial )?droop|droop.*left/i.test(cues) ? 'left' : null;
      face.tick(dt, { open, pain: Math.max(0, Math.min(10, v.pain ?? 0)), anxious: /anxious|agitat|fear|fright/.test(loc), effort, breath, mood: /calm|comfort/.test(loc) ? 0.3 : 0, droop });
      // restlessness: small head movements
      restless += dt;
      const agitated = /anxious|agitat|restless|confus/.test(loc) || effort > 1.5;
      if (neck) { neck.quaternion.copy(hobRest[norm(neck.name)]); rotateWorld(neck, new THREE.Vector3(0, 1, 0), (agitated ? Math.sin(restless * 0.8) * 0.12 : Math.sin(restless * 0.2) * 0.03) + (open < 0.5 ? 0.25 : 0.15)); }
      // skin: cyanosis, pallor, flushing, diaphoresis — tint the photo textures
      const spo2 = v.spo2 ?? 98, sbp = v.sbp ?? 120, temp = v.temp ?? 37;
      const c = baseColor.clone();
      const pallor = sbp < 95 ? Math.min(1, (95 - sbp) / 35) : 0;
      c.lerp(new THREE.Color(0.93, 0.93, 0.95), pallor * 0.6);
      if (temp > 38.2) c.lerp(new THREE.Color(1, 0.88, 0.86), Math.min(0.35, (temp - 38.2) * 0.3));
      const cyan = spo2 < 92 ? Math.min(1, (92 - spo2) / 14) : 0;
      c.lerp(new THREE.Color(0.72, 0.8, 1.0), cyan * 0.75);
      const diaphoretic = /diaphor|clammy|sweat|moist/i.test(cues);
      for (const m of skinMats) { if (m === sleeveMat) m.color.copy(skinTone).multiply(c); else m.color.copy(c); m.roughness = diaphoretic ? 0.42 : 0.62; }
    },
  };
}
