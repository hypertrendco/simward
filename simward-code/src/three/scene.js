import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildEquipment, WALL_MOUNTED } from './equipment.js';
import { buildPatient } from './patient.js';
import { buildAvatarPatient, buildSeatedAvatar } from './avatar.js';
import { EQUIP_MAP as EQ } from '../data/equipment.js';
import { floorTexture, wallTexture } from './materials.js';
import { drawMonitor } from '../sim/monitorDraw.js';
import { EQUIP_MAP } from '../data/equipment.js';

const ROOM = { w: 7, d: 6, h: 3.1 };
const LIGHTING = {
  day: { hemi: ['#f4f7ff', '#8b7f6c', 0.75], sun: ['#fff1dc', 2.2], fill: 0.5, exposure: 1.05, sky: '#bcdcf0' },
  bright: { hemi: ['#ffffff', '#9aa0a6', 1.0], sun: ['#ffffff', 1.8], fill: 0.9, exposure: 1.15, sky: '#d6e6ef' },
  dim: { hemi: ['#ffe9cf', '#6a5a48', 0.75], sun: ['#ffd9b0', 1.3], fill: 0.6, exposure: 1.08, sky: '#f0b58a' },
  night: { hemi: ['#8fa6d6', '#1c2230', 0.25], sun: ['#9fb4ff', 0.35], fill: 0.2, exposure: 0.9, sky: '#1b2740' },
};

export function createClinicalScene(container, opts = {}) {
  const { editable = false, onSelect, onChange, onPick, onReady } = opts;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a2226');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 60);
  camera.position.set(-0.9, 2.5, 4.6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.8, -1.2);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 0.4; controls.maxDistance = 9;

  // lights
  const hemi = new THREE.HemisphereLight('#fff', '#888', 0.7); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff', 2); sun.position.set(3.5, 5, -1); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -5; sun.shadow.camera.right = 5; sun.shadow.camera.top = 5; sun.shadow.camera.bottom = -5; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const fill = new THREE.PointLight('#fff4e6', 0.6, 12, 1.5); fill.position.set(0, 2.5, 0.5); scene.add(fill);
  const over = new THREE.SpotLight('#fff8ee', 6, 6, 0.7, 0.6, 1.2); over.position.set(0, 2.6, -1.4); over.target.position.set(0, 0.6, -1.7); scene.add(over, over.target);

  // room shell
  const room = new THREE.Group(); scene.add(room);
  const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.02 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = 'floor'; room.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const mkWall = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, ROOM.h), wallMat); m.position.set(x, ROOM.h / 2, z); m.rotation.y = ry; m.receiveShadow = true; room.add(m); return m; };
  mkWall(ROOM.w, 0, -ROOM.d / 2, 0);
  mkWall(ROOM.d, -ROOM.w / 2, 0, Math.PI / 2);
  const rightWall = mkWall(ROOM.d, ROOM.w / 2, 0, -Math.PI / 2);
  const base = new THREE.MeshStandardMaterial({ color: '#6b6b66', roughness: 0.6 });
  for (const [w, x, z, ry] of [[ROOM.w, 0, -ROOM.d / 2 + 0.01, 0], [ROOM.d, -ROOM.w / 2 + 0.01, 0, Math.PI / 2], [ROOM.d, ROOM.w / 2 - 0.01, 0, -Math.PI / 2]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.02), base); b.position.set(x, 0.05, z); b.rotation.y = ry; room.add(b);
  }
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), new THREE.MeshStandardMaterial({ color: '#eef0ee', roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.y = ROOM.h; room.add(ceiling);
  // ceiling light panels (visible from low camera angles)
  for (const [x, z] of [[0, -1.5], [0, 1]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ color: '#fffdf6' })); p.rotation.x = Math.PI / 2; p.position.set(x, ROOM.h - 0.005, z); room.add(p); }

  // selection helper
  const selBox = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color('#ffb020')); selBox.visible = false; scene.add(selBox);
  const grid = new THREE.GridHelper(7, 28, '#5a8f8b', '#3b4f55'); grid.position.y = 0.002; grid.material.opacity = 0.25; grid.material.transparent = true; grid.visible = editable; scene.add(grid);

  const itemsGroup = new THREE.Group(); scene.add(itemsGroup);
  const objs = new Map(); // uid → Object3D
  let items = [];
  let patient = null, patientAppearance = null, bedObj = null;
  let monitorCanvas = document.createElement('canvas'); monitorCanvas.width = 512; monitorCanvas.height = 330;
  const monitorTex = new THREE.CanvasTexture(monitorCanvas); monitorTex.colorSpace = THREE.SRGBColorSpace;
  let monitorObj = null, clockObj = null;
  let vitals = null, cues = '', monitorConnected = false, selected = null;

  function placeObject(o, it) {
    const wall = WALL_MOUNTED.has(it.type);
    o.position.set(it.x, 0, it.z);
    o.rotation.y = it.rot || 0;
    if (wall) {
      // snap to nearest wall
      const dBack = Math.abs(it.z + ROOM.d / 2), dLeft = Math.abs(it.x + ROOM.w / 2), dRight = Math.abs(it.x - ROOM.w / 2);
      const m = Math.min(dBack, dLeft, dRight);
      if (m === dBack) { o.position.z = -ROOM.d / 2 + 0.01; o.rotation.y = 0; }
      else if (m === dLeft) { o.position.x = -ROOM.w / 2 + 0.01; o.rotation.y = Math.PI / 2; }
      else { o.position.x = ROOM.w / 2 - 0.01; o.rotation.y = -Math.PI / 2; }
    }
  }

  let attachSeq = 0;
  function attachPatient() {
    const seq = ++attachSeq;
    if (patient) { patient.upper.parent?.remove(patient.upper); patient.lower.parent?.remove(patient.lower); patient = null; }
    bedObj = [...objs.values()].find(o => o.userData.type === 'bed' || o.userData.type === 'stretcher') || null;
    if (!bedObj || !patientAppearance) return;
    const bed = bedObj;
    const mount = (p) => {
      if (seq !== attachSeq || bed !== bedObj) return;
      patient = p;
      bed.userData.headPivot.add(p.upper);
      bed.add(p.lower);
      p.setO2(currentO2);
      p.setHob?.(THREE.MathUtils.radToDeg(bed.userData.headPivot.rotation.x));
      api.onPatientReady?.(p);
      if (lastPreset === 'face' || lastPreset === 'bedside') flyTo(lastPreset);
    };
    if (patientAppearance.avatarId) {
      buildAvatarPatient(patientAppearance, bed.userData.mattressTop || 0.66, { blanketColor: bed.userData.blanketColor }).then((p) => { try { mount(p); } catch (e) { p.lower.parent?.remove(p.lower); throw e; } }).catch((e) => { console.warn('Avatar failed to load, using fallback', e); mount(buildPatient(patientAppearance)); });
    } else mount(buildPatient(patientAppearance));
  }

  // ---- family member / visitor seated near the bed ----
  let family = null, familyDef = null, familySeq = 0;
  function attachFamily() {
    const seq = ++familySeq;
    if (family) { family.group.parent?.remove(family.group); family = null; }
    if (!familyDef?.avatarId) return;
    const seat = [...objs.values()].find(o => o.userData.type === 'recliner') || [...objs.values()].find(o => o.userData.type === 'chair') || [...objs.values()].find(o => o.userData.type === 'cot');
    if (!seat) return;
    const seatH = seat.userData.type === 'recliner' ? 0.5 : seat.userData.type === 'cot' ? 0.45 : 0.52;
    buildSeatedAvatar(familyDef, { seatHeight: seatH }).then((f) => {
      if (seq !== familySeq) return;
      family = f;
      f.group.position.copy(seat.position); f.group.rotation.y = seat.rotation.y;
      // seated avatar faces +Z of the chair; turn the head toward the bed
      const bedPos = bedObj ? bedObj.position : new THREE.Vector3(0, 0, -1.7);
      const dir = new THREE.Vector3().subVectors(bedPos, seat.position); const ang = Math.atan2(dir.x, dir.z) - seat.rotation.y;
      f._lookYaw = Math.max(-0.9, Math.min(0.9, ang));
      scene.add(f.group);
      api.onFamilyReady?.(f);
    }).catch((e) => console.warn('Family avatar failed', e));
  }

  function rebuild(newItems) {
    items = newItems || [];
    const keep = new Set(items.map(i => i.uid));
    for (const [uid, o] of objs) if (!keep.has(uid)) { itemsGroup.remove(o); objs.delete(uid); }
    for (const it of items) {
      let o = objs.get(it.uid);
      const sig = JSON.stringify([it.type, it.props]);
      if (!o || o.userData.sig !== sig) {
        if (o) itemsGroup.remove(o);
        o = buildEquipment(it.type, { ...it.props, patientName: patientAppearance?.name });
        o.userData.uid = it.uid; o.userData.sig = sig;
        itemsGroup.add(o); objs.set(it.uid, o);
      }
      placeObject(o, it);
    }
    monitorObj = [...objs.values()].find(o => o.userData.type === 'monitor') || null;
    if (monitorObj) monitorObj.userData.screen.material = new THREE.MeshBasicMaterial({ map: monitorTex, toneMapped: false });
    clockObj = [...objs.values()].find(o => o.userData.type === 'clock') || null;
    attachPatient();
    attachFamily();
    if (selected && !objs.has(selected)) select(null); else if (selected) select(selected);
  }

  function setRoom(env = {}) {
    floorMat.map = floorTexture(env.floorColor || '#b9ab94'); floorMat.needsUpdate = true;
    wallMat.map = wallTexture(env.wallColor || '#e6e1d6', env.accentColor || '#5f8f8b'); wallMat.needsUpdate = true;
    const L = LIGHTING[env.lighting] || LIGHTING.day;
    hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
    sun.color.set(L.sun[0]); sun.intensity = L.sun[1];
    fill.intensity = L.fill; renderer.toneMappingExposure = L.exposure;
    for (const o of objs.values()) if (o.userData.sky) o.userData.sky.material.color.set(L.sky);
    rebuild(env.items || []);
  }

  let currentO2 = null;
  const api = {
    setEnvironment(env) { setRoom(env); },
    setItems(list) { rebuild(list); },
    setPatient(appearance) { patientAppearance = appearance ? { ...appearance } : null; attachPatient(); },
    setFamily(def) { familyDef = def ? { ...def } : null; attachFamily(); },
    get family() { return family; },
    onFamilyReady: null,
    setHover(fn) { onHover = fn; },
    setVitals(v, c = '', connected = false) { vitals = v; cues = c || ''; monitorConnected = connected; },
    setHob(deg) { if (bedObj?.userData.headPivot) bedObj.userData.headPivot.rotation.x = THREE.MathUtils.degToRad(deg); patient?.setHob?.(deg); },
    get patient() { return patient; },
    onPatientReady: null,
    setO2(dev) { currentO2 = dev; patient?.setO2(dev); },
    select(uid) { select(uid); },
    setCamera(preset) { flyTo(preset); },
    resize,
    screenshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); pmrem.dispose(); container.removeChild(renderer.domElement); },
    get items() { return items; },
    _debug: () => ({ frames, degraded, cam: camera.position.toArray(), fly: fly && fly.t, bed: !!bedObj, t, to: fly?.to?.[0]?.toArray?.() }),
  };

  function select(uid) {
    selected = uid;
    const o = uid && objs.get(uid);
    if (o) { selBox.box.setFromObject(o); selBox.visible = true; } else selBox.visible = false;
  }

  // camera presets
  let fly = null, lastPreset = null;
  function flyTo(preset) {
    lastPreset = preset;
    const b = bedObj ? bedObj.position.clone() : new THREE.Vector3(0, 0, -1.7);
    const rot = bedObj ? bedObj.rotation.y : 0;
    const local = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).add(b);
    const P = {
      room: [new THREE.Vector3(-0.9, 2.5, 4.6), new THREE.Vector3(0, 0.8, -1.2)],
      bedside: [local(1.35, 1.6, 0.9), local(0, 0.85, -0.3)],
      face: patient?.headAnchor ? (() => { const hp = new THREE.Vector3(); patient.headAnchor.getWorldPosition(hp); const off = new THREE.Vector3(0.32, 0.3, 0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot); return [hp.clone().add(off), hp.clone().add(new THREE.Vector3(0, 0.02, 0))]; })() : [local(0.55, 1.35, -0.25), local(0, 0.95, -0.85)],
      monitor: monitorObj ? [monitorObj.position.clone().add(new THREE.Vector3(0.9, 1.5, 1.4)), monitorObj.position.clone().add(new THREE.Vector3(0, 1.6, 0))] : null,
      top: [new THREE.Vector3(0.01, 8.5, 0.6), new THREE.Vector3(0, 0, 0)],
      family: family ? (() => { const hp = new THREE.Vector3(); family.headAnchor.getWorldPosition(hp); const dir = new THREE.Vector3().subVectors(b, hp).setY(0).normalize(); return [hp.clone().add(dir.multiplyScalar(1.3)).add(new THREE.Vector3(0, 0.15, 0)), hp.clone()]; })() : null,
    }[preset];
    if (!P) return;
    fly = { from: [camera.position.clone(), controls.target.clone()], to: P, t: 0 };
  }

  // resize
  function resize() {
    const w = container.clientWidth || 800, h = container.clientHeight || 500;
    renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  // picking & dragging
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const setNdc = (e) => { const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
  const floorPoint = (e) => { setNdc(e); const p = new THREE.Vector3(); return ray.ray.intersectPlane(floorPlane, p) ? p : null; };
  const findUid = (o) => { while (o && !o.userData.uid) o = o.parent; return o?.userData.uid; };
  const findRegion = (o) => { while (o && !o.userData.region) o = o.parent; return o?.userData.region; };
  const clampRoom = (x, z, t) => { const fp = EQUIP_MAP[t]?.footprint || [0.5, 0.5]; const m = Math.max(fp[0], fp[1]) / 2; return [Math.max(-ROOM.w / 2 + m * 0.5, Math.min(ROOM.w / 2 - m * 0.5, x)), Math.max(-ROOM.d / 2 + m * 0.5, Math.min(ROOM.d / 2 - m * 0.3, z))]; };
  let drag = null, downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY };
    if (!editable) return;
    setNdc(e);
    const hit = ray.intersectObjects([...objs.values()], true)[0];
    const uid = hit && findUid(hit.object);
    if (uid) {
      select(uid); onSelect?.(uid);
      const it = items.find(i => i.uid === uid); const p = floorPoint(e);
      if (it && p) { drag = { uid, dx: it.x - p.x, dz: it.z - p.z }; controls.enabled = false; renderer.domElement.setPointerCapture(e.pointerId); }
    }
  });
  let onHover = null, hovered = null, hoverAcc = 0;
  const REGION_LABEL = { head: 'Head & face', chest: 'Chest', abdomen: 'Abdomen', arm: 'Arm', legs: 'Legs', family: 'Family member', 'family-head': 'Family member' };
  function setHovered(obj, label, e) {
    if (hovered === obj) { if (obj) onHover?.({ label, x: e.clientX, y: e.clientY }); return; }
    if (hovered) hovered.traverse(o => { if (o.isMesh && o.userData._em) { o.material.emissive?.copy(o.userData._em); delete o.userData._em; } });
    hovered = obj;
    if (obj) obj.traverse(o => { if (o.isMesh && o.material?.emissive && !o.userData._em) { o.userData._em = o.material.emissive.clone(); o.material.emissive.setRGB(0.12, 0.22, 0.2); } });
    onHover?.(obj ? { label, x: e.clientX, y: e.clientY } : null);
  }
  renderer.domElement.addEventListener('pointerleave', (e) => setHovered(null, '', e));
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!drag) {
      if (!editable && onPick) {
        if (performance.now() - hoverAcc < 60) return; hoverAcc = performance.now();
        setNdc(e);
        const targets = [...(patient ? [patient.upper, patient.lower] : []), ...(family ? [family.group] : []), ...objs.values()];
        const hit = ray.intersectObjects(targets, true)[0];
        if (!hit) { renderer.domElement.style.cursor = 'grab'; setHovered(null, '', e); return; }
        const region = findRegion(hit.object);
        if (region) { let o = hit.object; while (o && !o.userData.region) o = o.parent; renderer.domElement.style.cursor = 'pointer'; setHovered(o, REGION_LABEL[region] || region, e); }
        else { const uid = findUid(hit.object); const o = objs.get(uid); renderer.domElement.style.cursor = o ? 'pointer' : 'grab'; setHovered(o || null, o ? (EQ[o.userData.type]?.name || o.userData.type) : '', e); }
      }
      return;
    }
    const p = floorPoint(e); if (!p) return;
    const it = items.find(i => i.uid === drag.uid); if (!it) return;
    const snap = (v) => Math.round(v / 0.05) * 0.05;
    [it.x, it.z] = clampRoom(snap(p.x + drag.dx), snap(p.z + drag.dz), it.type);
    const o = objs.get(it.uid); placeObject(o, it); select(it.uid);
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    const moved = downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4;
    if (drag) { controls.enabled = true; const d = drag; drag = null; if (moved) onChange?.(items.map(i => ({ ...i })), d.uid); return; }
    if (moved) return;
    setNdc(e);
    if (editable) {
      const hit = ray.intersectObjects([...objs.values()], true)[0];
      const uid = hit && findUid(hit.object); select(uid || null); onSelect?.(uid || null);
    } else if (onPick) {
      const targets = [...(patient ? [patient.upper, patient.lower] : []), ...(family ? [family.group] : []), ...objs.values()];
      const hit = ray.intersectObjects(targets, true)[0];
      if (!hit) return;
      const region = findRegion(hit.object);
      if (region?.startsWith('family')) onPick({ kind: 'family', x: e.clientX, y: e.clientY });
      else if (region) onPick({ kind: 'patient', region, x: e.clientX, y: e.clientY });
      else { const uid = findUid(hit.object); const o = objs.get(uid); if (o) onPick({ kind: 'equipment', type: o.userData.type, x: e.clientX, y: e.clientY }); }
    }
  });
  // HTML5 drag-and-drop from palette
  container.addEventListener('dragover', (e) => { if (editable) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  container.addEventListener('drop', (e) => {
    if (!editable) return;
    e.preventDefault();
    const type = e.dataTransfer.getData('text/simward-equipment');
    if (!type) return;
    const p = floorPoint(e) || new THREE.Vector3();
    const [x, z] = clampRoom(Math.round(p.x / 0.05) * 0.05, Math.round(p.z / 0.05) * 0.05, type);
    const it = { uid: `it-${Math.random().toString(36).slice(2, 8)}`, type, x, z, rot: 0, props: { ...(EQUIP_MAP[type]?.props || {}) } };
    const next = [...items.map(i => ({ ...i })), it];
    rebuild(next); select(it.uid); onSelect?.(it.uid); onChange?.(next, it.uid);
  });

  // render loop
  const clock = new THREE.Clock();
  let raf = 0, t = 0, monAcc = 0, frames = 0, slow = 0, degraded = false;
  function loop() {
    raf = requestAnimationFrame(loop);
    const raw = clock.getDelta();
    const dt = Math.min(0.1, raw); t += dt;
    // adaptive quality: drop shadows / pixel ratio on slow GPUs (Chromebooks, software GL)
    if (!degraded && frames++ > 2) { if (raw > 0.07) slow++; if (slow > 3) { degraded = true; renderer.setPixelRatio(1); renderer.shadowMap.enabled = false; sun.castShadow = false; scene.environment = null; resize(); } }
    if (fly) {
      fly.t = Math.min(1, fly.t + dt * 1.4);
      const k = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - (-2 * fly.t + 2) ** 2 / 2;
      camera.position.lerpVectors(fly.from[0], fly.to[0], k); controls.target.lerpVectors(fly.from[1], fly.to[1], k);
      if (fly.t >= 1) fly = null;
    }
    controls.update();
    if (patient) patient.update(t, dt, vitals || {}, cues);
    if (family) family.update(dt);
    for (const o of objs.values()) if (o.userData.drip) { const d = o.userData.drip; d.position.y = 1.72 - ((t * 1.1 + d.userData.ph) % 1) * 0.05; }
    monAcc += dt;
    if (monitorObj && monAcc > 1 / 24) { monAcc = 0; drawMonitor(monitorCanvas.getContext('2d'), monitorCanvas.width, monitorCanvas.height, vitals, t, { connected: monitorConnected }); monitorTex.needsUpdate = true; }
    if (clockObj) { const d = new Date(); const [hh, mh] = clockObj.userData.hands; hh.rotation.z = -((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2; mh.rotation.z = -d.getMinutes() / 60 * Math.PI * 2; }
    renderer.render(scene, camera);
  }
  loop();
  rightWall.visible = true;
  onReady?.(api);
  if (typeof window !== 'undefined') window.__simScene = api;
  return api;
}
