import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { M, skylineTexture, curtainTexture, whiteboardTexture, screenTexture, artTexture, muralTexture, photoTexture } from './materials.js';

// Procedural, reasonably detailed clinical equipment. Every builder returns a Group with its origin on the floor
// (or on the wall surface for wall-mounted items, facing +Z).
const box = (w, h, d, mat, r = 0.02) => new THREE.Mesh(r ? new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, mat, seg = 20) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const shadow = (g) => { g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };

function caster(r = 0.05) {
  const g = new THREE.Group();
  const w = cyl(r, r, 0.035, M.rubber()); w.rotation.z = Math.PI / 2; w.position.y = r;
  const fork = box(0.02, 0.07, 0.04, M.darkMetal(), 0); fork.position.y = r + 0.04;
  g.add(w, fork); return g;
}

export const WALL_MOUNTED = new Set(['headwall', 'window', 'clock', 'whiteboard', 'tv', 'sanitizer', 'sharps', 'door', 'artwork', 'mural', 'gaitbelt', 'phone']);

const builders = {
  bed(p) {
    const g = new THREE.Group();
    const frameMat = M.metal(), shellMat = M.plastic(p.color || '#d9dee3');
    const L = 2.1, W = 0.95, top = 0.62;
    for (const [x, z] of [[-0.4, -0.95], [0.4, -0.95], [-0.4, 0.95], [0.4, 0.95]]) g.add(at(caster(), x, 0, z));
    g.add(at(box(0.8, 0.08, 1.9, frameMat, 0.01), 0, 0.14, 0));
    g.add(at(box(0.5, 0.28, 1.2, M.darkMetal(), 0.03), 0, 0.3, 0)); // lift column shroud
    g.add(at(box(W, 0.07, 1.25, shellMat, 0.02), 0, top - 0.1, 0.4)); // foot deck
    const mattressMat = M.fabric('#6f8fa3');
    g.add(at(box(W - 0.05, 0.14, 1.2, mattressMat, 0.05), 0, top - 0.03, 0.42)); // foot mattress
    // head section pivots (HOB)
    const pivot = new THREE.Group(); pivot.position.set(0, top - 0.06, -0.2);
    const head = new THREE.Group();
    head.add(at(box(W, 0.07, 0.85, shellMat, 0.02), 0, -0.04, -0.42));
    head.add(at(box(W - 0.05, 0.14, 0.85, mattressMat, 0.05), 0, 0.03, -0.43));
    pivot.add(head);
    pivot.rotation.x = THREE.MathUtils.degToRad(p.hob ?? 30);
    g.add(pivot);
    g.userData.headPivot = pivot;
    g.userData.mattressTop = top + 0.04;
    // head & foot boards
    const hb = box(W + 0.04, 0.55, 0.06, M.plastic('#c4ccd2'), 0.03); hb.position.set(0, top + 0.12, -1.07); g.add(hb);
    const fb = box(W + 0.04, 0.42, 0.06, M.plastic('#c4ccd2'), 0.03); fb.position.set(0, top + 0.04, 1.07); g.add(fb);
    const panel = box(0.4, 0.14, 0.02, M.plastic('#2f3a40'), 0.01); panel.position.set(0, top + 0.16, 1.105); g.add(panel);
    g.userData.blanketColor = p.blanket || null;
    if (p.trapeze) {
      const arm = box(0.05, 0.05, 1.2, frameMat, 0.01); arm.position.set(0.3, top + 1.35, -0.45); g.add(arm);
      g.add(at(cyl(0.025, 0.025, 1.6, frameMat), 0.3, top + 0.55, -1.05));
      g.add(at(box(0.05, 0.05, 0.7, frameMat, 0.01), 0.3, top + 1.35, -0.75));
      const tri = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.015, 8, 3), M.plastic('#c9ced3')); tri.position.set(0, top + 0.95, -0.1); g.add(tri);
      g.add(at(cyl(0.006, 0.006, 0.35, M.darkMetal()), 0, top + 1.17, -0.1));
      const strap = box(0.03, 0.4, 0.01, M.fabric('#333'), 0); strap.position.set(0.15, top + 1.15, -0.1); strap.rotation.z = 0.5; g.add(strap);
    }
    if (p.abduction) { const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.5), M.fabric('#3d5a9e')); wedge.position.set(0, top + 0.16, 0.45); g.add(wedge); }
    if (p.scd) { for (const s of [-1, 1]) { const sl = box(0.18, 0.06, 0.4, M.plastic('#e4e8ec'), 0.03); sl.position.set(s * 0.28, top + 0.08, 0.95); sl.rotation.y = s * 0.3; g.add(sl); } }
    if (p.foley) { const bag = box(0.16, 0.24, 0.03, new THREE.MeshPhysicalMaterial({ color: '#f1e5a8', roughness: 0.3, transparent: true, opacity: 0.8 }), 0.02); bag.position.set(W / 2 + 0.06, top - 0.3, 0.3); g.add(bag); const hook = cyl(0.004, 0.004, 0.12, M.metal()); hook.position.set(W / 2 + 0.06, top - 0.14, 0.3); g.add(hook); g.userData.foley = bag; }
    if (p.rails !== false) {
      for (const s of [-1, 1]) {
        const rail = box(0.03, 0.26, 0.75, M.plastic('#e7ebee'), 0.012); rail.position.set(s * (W / 2 + 0.03), top + 0.16, -0.55); g.add(rail);
        const rail2 = box(0.03, 0.22, 0.6, M.plastic('#e7ebee'), 0.012); rail2.position.set(s * (W / 2 + 0.03), top + 0.12, 0.55); g.add(rail2);
        const grip = box(0.035, 0.05, 0.3, M.plastic('#9ab1bf'), 0.01); grip.position.set(s * (W / 2 + 0.03), top + 0.22, -0.55); g.add(grip);
      }
    }
    return shadow(g);
  },
  stretcher(p) {
    const g = builders.bed({ ...p, color: '#e3e6e9', rails: true });
    g.scale.set(0.85, 1.02, 0.95);
    return g;
  },
  monitor() {
    const g = new THREE.Group();
    // wall/pole arm: vertical pole with monitor at eye level
    g.add(at(cyl(0.025, 0.025, 1.45, M.metal()), 0, 0.73, 0));
    g.add(at(cyl(0.2, 0.22, 0.04, M.darkMetal()), 0, 0.02, 0));
    const body = box(0.44, 0.34, 0.12, M.plastic('#e4e8eb'), 0.03); body.position.set(0, 1.62, 0.02); g.add(body);
    const bezel = box(0.4, 0.28, 0.01, M.plastic('#15191c'), 0.01); bezel.position.set(0, 1.63, 0.08); g.add(bezel);
    const screenGeo = new THREE.PlaneGeometry(0.37, 0.24);
    const screen = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
    screen.position.set(0, 1.635, 0.087); g.add(screen);
    g.userData.screen = screen;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.008), M.emissive('#39e27d')); led.position.set(0.18, 1.49, 0.08); g.add(led);
    g.rotation.y = 0.35;
    return shadow(g);
  },
  ivpole(p) {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leg = box(0.3, 0.025, 0.03, M.metal(), 0.008); leg.position.set(Math.cos(a) * 0.15, 0.07, Math.sin(a) * 0.15); leg.rotation.y = -a; g.add(leg);
      g.add(at(caster(0.03), Math.cos(a) * 0.29, 0, Math.sin(a) * 0.29));
    }
    g.add(at(cyl(0.013, 0.016, 1.95, M.metal()), 0, 1.03, 0));
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.008, 8, 24), M.metal()); hook.position.y = 2.0; hook.rotation.x = Math.PI / 2; g.add(hook);
    const bags = Math.max(1, Math.min(3, p.bags || 1));
    for (let i = 0; i < bags; i++) {
      const a = (i / bags) * Math.PI * 2;
      const bag = box(0.13, 0.22, 0.035, new THREE.MeshPhysicalMaterial({ color: '#eaf6fb', roughness: 0.15, transparent: true, opacity: 0.85 }), 0.03);
      bag.position.set(Math.cos(a) * 0.08, 1.85, Math.sin(a) * 0.08); g.add(bag);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.06), M.plastic('#ffffff')); label.position.set(bag.position.x, 1.86, bag.position.z + 0.019); g.add(label);
      const chamber = cyl(0.012, 0.012, 0.06, M.glass()); chamber.position.set(bag.position.x, 1.7, bag.position.z); g.add(chamber);
      if (i === 0) { const drop = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 5), M.plastic('#bfe6f5')); drop.position.set(bag.position.x, 1.72, bag.position.z); drop.userData.ph = Math.random(); g.add(drop); g.userData.drip = drop; }
    }
    const pump = box(0.16, 0.22, 0.12, M.plastic('#f1f3f4'), 0.02); pump.position.set(0, 1.25, 0.07); g.add(pump);
    const pscreen = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), M.emissive('#5fd0ff')); pscreen.position.set(0, 1.3, 0.131); g.add(pscreen);
    const kp = box(0.1, 0.05, 0.005, M.plastic('#2b3a44'), 0); kp.position.set(0, 1.2, 0.131); g.add(kp);
    // tubing toward bed
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.67, 0), new THREE.Vector3(0.0, 1.25, 0.13), new THREE.Vector3(-0.1, 0.9, 0.2), new THREE.Vector3(-0.45, 0.78, 0.35)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.004, 6), M.glass()));
    return shadow(g);
  },
  vent() {
    const g = new THREE.Group();
    g.add(at(box(0.5, 0.08, 0.5, M.darkMetal(), 0.02), 0, 0.12, 0));
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.add(at(caster(0.04), x, 0, z));
    g.add(at(cyl(0.03, 0.03, 0.7, M.metal()), 0, 0.5, 0));
    g.add(at(box(0.42, 0.36, 0.3, M.plastic('#e9ecef'), 0.04), 0, 0.98, 0));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), new THREE.MeshBasicMaterial({ map: screenTexture('vent'), toneMapped: false }));
    scr.position.set(0, 1.4, 0.06); scr.rotation.x = -0.2; g.add(scr);
    g.add(at(box(0.38, 0.28, 0.06, M.plastic('#d8dde0'), 0.02), 0, 1.4, 0.02));
    const circuit = new THREE.CatmullRomCurve3([new THREE.Vector3(0.15, 0.95, 0.15), new THREE.Vector3(0.1, 1.1, 0.5), new THREE.Vector3(-0.3, 1.0, 0.8), new THREE.Vector3(-0.8, 0.85, 0.7)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(circuit, 40, 0.018, 8), M.plastic('#9fd3e6')));
    return shadow(g);
  },
  o2tank() {
    const g = new THREE.Group();
    g.add(at(cyl(0.1, 0.1, 0.9, M.plastic('#2f7d4a')), 0, 0.5, 0));
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.plastic('#2f7d4a')); top.position.y = 0.95; g.add(top);
    g.add(at(cyl(0.03, 0.03, 0.1, M.metal()), 0, 1.07, 0));
    g.add(at(cyl(0.035, 0.035, 0.03, M.plastic('#f2f2f2')), 0.05, 1.07, 0));
    g.add(at(box(0.26, 0.05, 0.26, M.darkMetal(), 0.01), 0, 0.03, 0));
    return shadow(g);
  },
  headwall() {
    const g = new THREE.Group();
    g.add(at(box(2.2, 0.32, 0.08, M.plastic('#d7dde1'), 0.02), 0, 1.45, 0.04));
    g.add(at(box(2.2, 0.03, 0.09, M.plastic('#9aa7ae'), 0.01), 0, 1.3, 0.045));
    const flow = (x, c) => {
      const f = new THREE.Group();
      f.add(at(cyl(0.03, 0.03, 0.12, M.glass()), 0, 0, 0));
      f.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.008), M.plastic('#e8e8e8')), 0, -0.01, 0));
      f.add(at(box(0.07, 0.04, 0.05, M.plastic(c), 0.01), 0, 0.09, -0.01));
      f.position.set(x, 1.47, 0.12); g.add(f);
    };
    flow(-0.7, '#2f9a55'); flow(-0.45, '#2f9a55'); flow(0.55, '#cfd6da');
    const canister = cyl(0.06, 0.06, 0.18, M.glass()); canister.position.set(0.75, 1.1, 0.14); g.add(canister);
    g.add(at(box(0.14, 0.06, 0.05, M.plastic('#e3e3e3'), 0.01), 0.75, 1.23, 0.12));
    for (let i = 0; i < 4; i++) g.add(at(box(0.07, 0.05, 0.02, M.plastic('#f6f6f2'), 0.005), -0.1 + i * 0.09, 1.52, 0.09));
    const light = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.1), M.emissive('#fff3dc')); light.position.set(0, 1.87, 0.06); g.add(light);
    g.add(at(box(2.1, 0.12, 0.14, M.plastic('#d7dde1'), 0.03), 0, 1.93, 0.07));
    return shadow(g);
  },
  crashcart() {
    const g = new THREE.Group();
    const red = M.plastic('#c62d2d');
    g.add(at(box(0.72, 0.95, 0.52, red, 0.03), 0, 0.57, 0));
    for (let i = 0; i < 5; i++) {
      g.add(at(box(0.66, 0.012, 0.01, M.darkMetal(), 0), 0, 0.2 + i * 0.17, 0.262));
      g.add(at(box(0.2, 0.025, 0.02, M.plastic('#eeeeee'), 0.008), 0, 0.28 + i * 0.17, 0.27));
    }
    g.add(at(box(0.76, 0.04, 0.56, M.plastic('#e0e0e0'), 0.02), 0, 1.06, 0));
    const defib = box(0.34, 0.2, 0.26, M.plastic('#f2c230'), 0.03); defib.position.set(-0.12, 1.19, 0); g.add(defib);
    const ds = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.09), M.emissive('#39e27d')); ds.position.set(-0.12, 1.22, 0.131); g.add(ds);
    const bvm = cyl(0.06, 0.06, 0.24, M.plastic('#69a8d9')); bvm.rotation.z = Math.PI / 2; bvm.position.set(0.2, 1.12, 0); g.add(bvm);
    for (const [x, z] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) g.add(at(caster(0.05), x, 0, z));
    const seal = box(0.04, 0.03, 0.01, M.plastic('#ffd000'), 0); seal.position.set(0.28, 0.95, 0.265); g.add(seal);
    return shadow(g);
  },
  medcart() {
    const g = new THREE.Group();
    g.add(at(box(0.68, 0.9, 0.48, M.plastic('#4f7fa3'), 0.03), 0, 0.55, 0));
    for (let i = 0; i < 6; i++) g.add(at(box(0.6, 0.12, 0.012, M.plastic(i % 2 ? '#e8eef2' : '#d7e3ec'), 0.01), 0, 0.22 + i * 0.13, 0.245));
    g.add(at(box(0.72, 0.04, 0.52, M.plastic('#e2e6e8'), 0.02), 0, 1.02, 0));
    const lap = box(0.32, 0.02, 0.22, M.plastic('#222'), 0.01); lap.position.set(0, 1.05, 0); g.add(lap);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.19), new THREE.MeshBasicMaterial({ map: screenTexture('ehr'), toneMapped: false }));
    scr.position.set(0, 1.16, -0.1); scr.rotation.x = -0.25; g.add(scr);
    for (const [x, z] of [[-0.28, -0.18], [0.28, -0.18], [-0.28, 0.18], [0.28, 0.18]]) g.add(at(caster(0.05), x, 0, z));
    return shadow(g);
  },
  wow() {
    const g = new THREE.Group();
    g.add(at(box(0.5, 0.05, 0.5, M.darkMetal(), 0.02), 0, 0.1, 0));
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.add(at(caster(0.04), x, 0, z));
    g.add(at(cyl(0.035, 0.035, 0.85, M.metal()), 0, 0.55, 0));
    g.add(at(box(0.5, 0.03, 0.36, M.plastic('#f0f2f3'), 0.01), 0, 0.98, 0.04));
    g.add(at(box(0.4, 0.015, 0.14, M.plastic('#2a2d30'), 0.005), 0, 1.0, 0.1));
    const mon = box(0.44, 0.28, 0.03, M.plastic('#1e2124'), 0.01); mon.position.set(0, 1.25, -0.08); g.add(mon);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.41, 0.25), new THREE.MeshBasicMaterial({ map: screenTexture('ehr'), toneMapped: false }));
    scr.position.set(0, 1.25, -0.064); g.add(scr);
    const scanner = box(0.05, 0.12, 0.04, M.plastic('#333'), 0.01); scanner.position.set(0.24, 1.04, 0.1); scanner.rotation.z = 0.4; g.add(scanner);
    return shadow(g);
  },
  overbed() {
    const g = new THREE.Group();
    g.add(at(box(0.15, 0.04, 0.45, M.darkMetal(), 0.01), -0.38, 0.06, 0));
    g.add(at(caster(0.03), -0.38, 0, -0.18)); g.add(at(caster(0.03), -0.38, 0, 0.18));
    g.add(at(cyl(0.025, 0.025, 0.8, M.metal()), -0.38, 0.47, 0));
    g.add(at(box(0.9, 0.03, 0.42, M.plastic('#d8cbb3'), 0.012), 0, 0.88, 0));
    const cup = cyl(0.035, 0.03, 0.1, M.plastic('#ffffff')); cup.position.set(0.2, 0.95, 0.05); g.add(cup);
    const straw = cyl(0.004, 0.004, 0.12, M.plastic('#f25a5a')); straw.position.set(0.21, 1.0, 0.05); straw.rotation.z = 0.2; g.add(straw);
    const tray = box(0.3, 0.02, 0.22, M.plastic('#c8b3a0'), 0.01); tray.position.set(-0.15, 0.905, 0); g.add(tray);
    return shadow(g);
  },
  chair(p) {
    const g = new THREE.Group();
    const fab = M.fabric(p.color || '#4f6d7a');
    g.add(at(box(0.55, 0.14, 0.55, fab, 0.05), 0, 0.45, 0));
    g.add(at(box(0.55, 0.6, 0.12, fab, 0.05), 0, 0.8, -0.24));
    for (const s of [-1, 1]) g.add(at(box(0.08, 0.2, 0.5, M.plastic('#8a6d4f'), 0.02), s * 0.3, 0.6, 0));
    for (const [x, z] of [[-0.24, -0.22], [0.24, -0.22], [-0.24, 0.22], [0.24, 0.22]]) g.add(at(cyl(0.02, 0.02, 0.4, M.plastic('#8a6d4f')), x, 0.2, z));
    return shadow(g);
  },
  wheelchair() {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 10, 32), M.rubber()); w.rotation.y = Math.PI / 2; w.position.set(s * 0.3, 0.3, 0.05); g.add(w);
      const hr = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.008, 6, 32), M.metal()); hr.rotation.y = Math.PI / 2; hr.position.set(s * 0.33, 0.3, 0.05); g.add(hr);
      g.add(at(caster(0.05), s * 0.22, 0, 0.4));
      g.add(at(box(0.03, 0.6, 0.03, M.metal(), 0.01), s * 0.24, 0.65, -0.18));
    }
    g.add(at(box(0.46, 0.05, 0.42, M.fabric('#262a2e'), 0.02), 0, 0.5, 0.08));
    g.add(at(box(0.46, 0.4, 0.03, M.fabric('#262a2e'), 0.02), 0, 0.75, -0.17));
    g.add(at(box(0.3, 0.02, 0.12, M.darkMetal(), 0.005), 0, 0.12, 0.45));
    return shadow(g);
  },
  sink() {
    const g = new THREE.Group();
    g.add(at(box(0.6, 0.8, 0.45, M.plastic('#cfc8bb'), 0.02), 0, 0.4, 0));
    g.add(at(box(0.62, 0.05, 0.47, M.plastic('#f4f4f2'), 0.02), 0, 0.83, 0));
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.1, 24, 1, true), M.plastic('#ffffff')); basin.position.set(0, 0.81, 0.02); g.add(basin);
    const faucet = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 16, Math.PI), M.metal()); faucet.position.set(0, 0.9, -0.14); g.add(faucet);
    g.add(at(box(0.28, 0.3, 0.1, M.plastic('#ececec'), 0.02), 0, 1.35, -0.18)); // towel dispenser
    g.add(at(box(0.12, 0.2, 0.08, M.plastic('#dfe9ef'), 0.02), 0.25, 1.1, -0.18)); // soap
    return shadow(g);
  },
  sanitizer() {
    const g = new THREE.Group();
    g.add(at(box(0.13, 0.25, 0.1, M.plastic('#f3f5f6'), 0.02), 0, 1.2, 0.05));
    g.add(at(box(0.09, 0.08, 0.02, M.plastic('#1f7ab8'), 0.01), 0, 1.25, 0.1));
    g.add(at(box(0.05, 0.03, 0.05, M.plastic('#c7c7c7'), 0.01), 0, 1.06, 0.07));
    return shadow(g);
  },
  hamper() {
    const g = new THREE.Group();
    g.add(at(cyl(0.2, 0.2, 0.02, M.metal()), 0, 0.85, 0));
    const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.62, 24), M.fabric('#ffd54a')); bag.position.y = 0.55; g.add(bag);
    g.add(at(cyl(0.015, 0.015, 0.8, M.metal()), 0, 0.4, 0));
    g.add(at(cyl(0.2, 0.2, 0.02, M.darkMetal()), 0, 0.03, 0));
    return shadow(g);
  },
  sharps() {
    const g = new THREE.Group();
    g.add(at(box(0.28, 0.32, 0.15, M.plastic('#d33b3b'), 0.02), 0, 1.25, 0.08));
    g.add(at(box(0.26, 0.05, 0.16, M.plastic('#f0f0f0'), 0.02), 0, 1.43, 0.08));
    const sym = new THREE.Mesh(new THREE.CircleGeometry(0.04, 20), M.plastic('#111')); sym.position.set(0, 1.23, 0.158); g.add(sym);
    return shadow(g);
  },
  cabinet() {
    const g = new THREE.Group();
    g.add(at(box(1.0, 1.9, 0.45, M.plastic('#e4e7e9'), 0.02), 0, 0.95, 0));
    for (let i = 0; i < 2; i++) g.add(at(box(0.47, 1.8, 0.01, M.glass(), 0), -0.245 + i * 0.49, 0.95, 0.228));
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) g.add(at(box(0.18, 0.12, 0.3, M.plastic(['#69a8d9', '#f2c230', '#8fd18a', '#e57a7a'][(r + c) % 4]), 0.01), -0.33 + c * 0.22, 0.35 + r * 0.42, 0));
    return shadow(g);
  },
  curtain(p) {
    const g = new THREE.Group();
    g.add(at(box(2.4, 0.03, 0.03, M.metal(), 0.01), 0, 2.45, 0));
    const geo = new THREE.PlaneGeometry(2.3, 1.95, 60, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 18) * 0.035);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: curtainTexture(p.color || '#7fa7a3'), side: THREE.DoubleSide, roughness: 0.9 });
    const c = new THREE.Mesh(geo, mat); c.position.set(0, 1.4, 0); g.add(c);
    return shadow(g);
  },
  whiteboard(p) {
    const g = new THREE.Group();
    g.add(at(box(1.24, 0.72, 0.03, M.metal(), 0.01), 0, 1.5, 0.015));
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.66), new THREE.MeshStandardMaterial({ map: whiteboardTexture(p.patientName), roughness: 0.3 }));
    b.position.set(0, 1.5, 0.032); g.add(b);
    return g;
  },
  clock() {
    const g = new THREE.Group();
    const face = cyl(0.17, 0.17, 0.04, M.plastic('#ffffff'), 32); face.rotation.x = Math.PI / 2; face.position.set(0, 2.1, 0.02); g.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.015, 8, 32), M.plastic('#2a2d30')); rim.position.set(0, 2.1, 0.04); g.add(rim);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.add(at(box(0.008, 0.025, 0.004, M.plastic('#111'), 0), Math.sin(a) * 0.14, 2.1 + Math.cos(a) * 0.14, 0.043)); }
    const hh = box(0.012, 0.08, 0.004, M.plastic('#111'), 0); hh.geometry.translate(0, 0.04, 0); hh.position.set(0, 2.1, 0.046); g.add(hh);
    const mh = box(0.008, 0.12, 0.004, M.plastic('#111'), 0); mh.geometry.translate(0, 0.06, 0); mh.position.set(0, 2.1, 0.048); g.add(mh);
    g.userData.hands = [hh, mh];
    return g;
  },
  window() {
    const g = new THREE.Group();
    g.add(at(box(1.66, 1.26, 0.1, M.plastic('#e9ecee'), 0.01), 0, 1.55, 0.02));
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1), new THREE.MeshBasicMaterial({ map: skylineTexture(), toneMapped: false }));
    sky.position.set(0, 1.55, 0.075); g.add(sky); g.userData.sky = sky;
    g.add(at(box(0.04, 1.1, 0.03, M.plastic('#e9ecee'), 0), 0, 1.55, 0.09));
    g.add(at(box(1.8, 0.05, 0.22, M.plastic('#dcd5c7'), 0.01), 0, 0.93, 0.1));
    for (let i = 0; i < 10; i++) g.add(at(box(1.5, 0.018, 0.03, M.plastic('#f4f1ea'), 0), 0, 2.05 - i * 0.05, 0.1)); // blinds (raised)
    return g;
  },
  tv() {
    const g = new THREE.Group();
    g.add(at(box(1.0, 0.58, 0.05, M.plastic('#15181b'), 0.01), 0, 1.95, 0.08));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.53), new THREE.MeshStandardMaterial({ color: '#0e1a24', roughness: 0.2, metalness: 0.2 })); s.position.set(0, 1.95, 0.106); g.add(s);
    g.add(at(box(0.2, 0.2, 0.08, M.darkMetal(), 0), 0, 1.95, 0.02));
    return g;
  },
  plant() {
    const g = new THREE.Group();
    g.add(at(cyl(0.16, 0.12, 0.3, M.plastic('#b88a5e')), 0, 0.15, 0));
    const leafMat = new THREE.MeshStandardMaterial({ color: '#3f7d4a', roughness: 0.7, side: THREE.DoubleSide });
    for (let i = 0; i < 14; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), leafMat); leaf.scale.set(0.35, 1.2, 0.08);
      const a = (i / 14) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.08, 0.5 + (i % 3) * 0.08, Math.sin(a) * 0.08); leaf.rotation.set(Math.cos(a) * 0.6, a, Math.sin(a) * 0.6); g.add(leaf);
    }
    return shadow(g);
  },
  bassinet() {
    const g = new THREE.Group();
    g.add(at(box(0.5, 0.05, 0.75, M.darkMetal(), 0.02), 0, 0.08, 0));
    for (const [x, z] of [[-0.2, -0.3], [0.2, -0.3], [-0.2, 0.3], [0.2, 0.3]]) g.add(at(caster(0.035), x, 0, z));
    g.add(at(cyl(0.025, 0.025, 0.6, M.metal()), 0, 0.4, 0));
    const tub = box(0.46, 0.25, 0.72, new THREE.MeshPhysicalMaterial({ color: '#eef6fb', roughness: 0.1, transparent: true, opacity: 0.55 }), 0.05); tub.position.y = 0.82; g.add(tub);
    g.add(at(box(0.4, 0.05, 0.66, M.fabric('#f6f2ee'), 0.02), 0, 0.72, 0));
    const baby = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.18, 6, 12), M.fabric('#f4c7d3')); baby.rotation.x = Math.PI / 2; baby.position.set(0, 0.79, 0.05); g.add(baby);
    const bh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), M.fabric('#e9b99b')); bh.position.set(0, 0.8, -0.15); g.add(bh);
    return shadow(g);
  },

  recliner(p) {
    const g = new THREE.Group(); const fab = M.fabric(p.color || '#5b6d7c'), frame = M.plastic('#3a3d40');
    g.add(at(box(0.78, 0.16, 0.7, fab, 0.06), 0, 0.42, 0.05));
    g.add(at(box(0.78, 0.72, 0.16, fab, 0.06), 0, 0.84, -0.3));
    for (const s of [-1, 1]) g.add(at(box(0.12, 0.3, 0.72, fab, 0.05), s * 0.34, 0.58, 0.02));
    g.add(at(box(0.7, 0.08, 0.4, fab, 0.04), 0, 0.3, 0.5));
    g.add(at(box(0.7, 0.26, 0.6, frame, 0.03), 0, 0.17, -0.05));
    return shadow(g);
  },
  nightstand(p) {
    const g = new THREE.Group(); const wood = M.plastic('#8a6a4c');
    g.add(at(box(0.5, 0.7, 0.45, wood, 0.015), 0, 0.35, 0));
    g.add(at(box(0.42, 0.02, 0.01, M.plastic('#d8c8aa'), 0), 0, 0.55, 0.23)); g.add(at(box(0.42, 0.02, 0.01, M.plastic('#d8c8aa'), 0), 0, 0.3, 0.23));
    if (p.personal !== false) {
      const frame = box(0.16, 0.13, 0.015, M.plastic('#3b2f24'), 0); frame.position.set(-0.12, 0.78, -0.08); frame.rotation.y = 0.4; g.add(frame);
      const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.1), new THREE.MeshStandardMaterial({ map: photoTexture() })); ph.position.set(-0.12, 0.78, -0.071); ph.rotation.y = 0.4; g.add(ph);
      g.add(at(cyl(0.03, 0.03, 0.09, M.plastic('#ffffff')), 0.1, 0.75, 0.05));
      const lamp = cyl(0.08, 0.05, 0.1, M.fabric('#efe3c6')); lamp.position.set(0.14, 0.98, -0.1); g.add(lamp); g.add(at(cyl(0.01, 0.01, 0.2, M.metal()), 0.14, 0.82, -0.1));
      g.add(at(box(0.1, 0.03, 0.14, M.plastic('#6a3a2a'), 0.005), -0.05, 0.72, 0.1)); // book
      const beads = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.006, 6, 20), M.plastic('#5a3b7a')); beads.rotation.x = Math.PI / 2; beads.position.set(0.05, 0.715, 0.14); g.add(beads);
    }
    return shadow(g);
  },
  walker() {
    const g = new THREE.Group(); const m = M.metal();
    for (const [x, z] of [[-0.28, -0.2], [0.28, -0.2]]) { g.add(at(cyl(0.012, 0.012, 0.85, m), x, 0.45, z)); g.add(at(caster(0.04), x, 0, z)); }
    for (const [x, z] of [[-0.28, 0.25], [0.28, 0.25]]) { g.add(at(cyl(0.012, 0.012, 0.85, m), x, 0.45, z)); g.add(at(cyl(0.02, 0.02, 0.02, M.rubber()), x, 0.01, z)); }
    for (const s of [-1, 1]) { const top = box(0.03, 0.03, 0.5, m, 0.01); top.position.set(s * 0.28, 0.87, 0.02); g.add(top); const grip = box(0.04, 0.04, 0.22, M.rubber(), 0.015); grip.position.set(s * 0.28, 0.89, 0.1); g.add(grip); }
    g.add(at(box(0.56, 0.03, 0.03, m, 0.01), 0, 0.87, -0.2)); g.add(at(box(0.56, 0.03, 0.03, m, 0.01), 0, 0.45, -0.2));
    return shadow(g);
  },
  commode() {
    const g = new THREE.Group(); const m = M.metal();
    for (const [x, z] of [[-0.24, -0.22], [0.24, -0.22], [-0.24, 0.22], [0.24, 0.22]]) g.add(at(cyl(0.012, 0.012, 0.5, m), x, 0.25, z));
    g.add(at(box(0.52, 0.05, 0.48, M.plastic('#f2f2f0'), 0.03), 0, 0.5, 0));
    const seat = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 10, 28), M.plastic('#f2f2f0')); seat.rotation.x = Math.PI / 2; seat.position.y = 0.54; g.add(seat);
    g.add(at(cyl(0.15, 0.13, 0.14, M.plastic('#9fb5c4')), 0, 0.42, 0));
    g.add(at(box(0.52, 0.3, 0.05, M.plastic('#f2f2f0'), 0.03), 0, 0.7, -0.22));
    for (const s of [-1, 1]) g.add(at(box(0.04, 0.03, 0.4, M.plastic('#f2f2f0'), 0.01), s * 0.26, 0.72, 0));
    return shadow(g);
  },
  gaitbelt() {
    const g = new THREE.Group();
    g.add(at(box(0.04, 0.06, 0.05, M.metal(), 0.01), 0, 1.4, 0.03));
    const belt = box(0.06, 0.5, 0.02, M.fabric('#2d5f9e'), 0.01); belt.position.set(0, 1.12, 0.05); g.add(belt);
    g.add(at(box(0.07, 0.05, 0.03, M.metal(), 0.005), 0, 0.88, 0.05));
    return g;
  },
  scdpump() {
    const g = new THREE.Group();
    g.add(at(box(0.3, 0.2, 0.24, M.plastic('#e9ecef'), 0.03), 0, 0.1, 0));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.07), M.emissive('#5fd0ff')); scr.position.set(-0.04, 0.14, 0.121); g.add(scr);
    g.add(at(box(0.05, 0.05, 0.01, M.plastic('#2f9a55'), 0.005), 0.09, 0.12, 0.121));
    const hose = new THREE.CatmullRomCurve3([new THREE.Vector3(0.1, 0.12, -0.1), new THREE.Vector3(0.2, 0.3, -0.3), new THREE.Vector3(0.1, 0.5, -0.5)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(hose, 20, 0.008, 6), M.plastic('#cfd6da')));
    return shadow(g);
  },
  door() {
    const g = new THREE.Group();
    g.add(at(box(1.16, 2.2, 0.12, M.plastic('#cfc9bc'), 0.01), 0, 1.1, 0.0));
    const leaf = box(1.0, 2.1, 0.05, M.plastic('#9c7b5c'), 0.01); leaf.position.set(0, 1.05, 0.04); g.add(leaf);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.6), M.glass()); win.position.set(-0.2, 1.5, 0.07); g.add(win);
    g.add(at(box(0.12, 0.03, 0.04, M.metal(), 0.01), 0.36, 1.0, 0.09));
    g.add(at(box(0.3, 0.1, 0.01, M.plastic('#ffffff'), 0), 0.2, 1.75, 0.07)); // room number plate
    return g;
  },
  artwork(p) {
    const g = new THREE.Group();
    g.add(at(box(0.86, 0.66, 0.03, M.plastic('#3b2f24'), 0.005), 0, 1.55, 0.015));
    const a = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshStandardMaterial({ map: artTexture(p.style || 'landscape'), roughness: 0.7 })); a.position.set(0, 1.55, 0.032); g.add(a);
    return g;
  },
  mural() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: muralTexture(), roughness: 0.95 })); m.position.set(0, 1.5, 0.012); g.add(m);
    return g;
  },
  toys() {
    const g = new THREE.Group();
    g.add(at(box(0.5, 0.3, 0.38, M.plastic('#f4b942'), 0.03), 0, 0.15, 0));
    const bear = new THREE.Group(); bear.position.set(-0.1, 0.42, 0.02);
    const fur = M.fabric('#b98556'); bear.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), fur), 0, 0, 0)); bear.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), fur), 0, 0.13, 0.02));
    for (const s of [-1, 1]) bear.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), fur), s * 0.05, 0.19, 0.0));
    g.add(bear);
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), M.plastic('#e63946')), 0.15, 0.38, 0.05));
    g.add(at(box(0.12, 0.12, 0.12, M.plastic('#457b9d'), 0.01), 0.12, 0.36, -0.1));
    return shadow(g);
  },
  cot(p) {
    const g = new THREE.Group(); const fab = M.fabric(p.color || '#6d6f82');
    g.add(at(box(0.8, 0.18, 1.9, fab, 0.06), 0, 0.36, 0)); g.add(at(box(0.76, 0.22, 0.5, fab, 0.06), 0, 0.5, -0.9));
    g.add(at(box(0.74, 0.2, 1.8, M.plastic('#3a3d40'), 0.03), 0, 0.17, 0));
    const pillow = box(0.5, 0.1, 0.3, M.fabric('#f1f1ec'), 0.05); pillow.position.set(0, 0.5, -0.6); g.add(pillow);
    const blanket = box(0.78, 0.05, 1.0, M.fabric('#9fb6c6'), 0.02); blanket.position.set(0, 0.47, 0.35); g.add(blanket);
    return shadow(g);
  },
  flowers() {
    const g = new THREE.Group();
    g.add(at(cyl(0.07, 0.05, 0.22, M.glass()), 0, 0.11, 0));
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const stem = cyl(0.004, 0.004, 0.25, M.plastic('#4e8a3e')); stem.position.set(Math.cos(a) * 0.03, 0.3, Math.sin(a) * 0.03); stem.rotation.z = Math.cos(a) * 0.3; stem.rotation.x = Math.sin(a) * 0.3; g.add(stem); const fl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), M.plastic(['#e76f8a', '#f6c453', '#ffffff', '#c77dff'][i % 4])); fl.position.set(Math.cos(a) * 0.09, 0.43, Math.sin(a) * 0.09); g.add(fl); }
    const card = box(0.1, 0.12, 0.005, M.plastic('#fff6e8'), 0); card.position.set(0.14, 0.06, 0.02); card.rotation.x = -0.4; g.add(card);
    return shadow(g);
  },
  phone() {
    const g = new THREE.Group();
    g.add(at(box(0.2, 0.08, 0.16, M.plastic('#e9ecef'), 0.02), 0, 1.0, 0.09));
    g.add(at(box(0.05, 0.03, 0.14, M.plastic('#2f3a40'), 0.01), -0.06, 1.055, 0.09));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g.add(at(box(0.02, 0.01, 0.02, M.plastic('#c7ccd1'), 0.003), 0.02 + c * 0.03, 1.045, 0.05 + r * 0.03));
    return g;
  },
  isocart() {
    const g = new THREE.Group();
    g.add(at(box(0.58, 0.9, 0.42, M.plastic('#f3d35b'), 0.03), 0, 0.5, 0));
    for (let i = 0; i < 3; i++) g.add(at(box(0.5, 0.18, 0.01, M.plastic('#f8e7a0'), 0.01), 0, 0.3 + i * 0.25, 0.215));
    g.add(at(box(0.6, 0.04, 0.46, M.plastic('#e0e0e0'), 0.02), 0, 0.97, 0));
    g.add(at(box(0.22, 0.22, 0.1, M.plastic('#9fc9e8'), 0.02), -0.12, 1.1, 0)); g.add(at(box(0.14, 0.18, 0.1, M.plastic('#f5f5f5'), 0.02), 0.14, 1.08, 0));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), M.plastic('#d33b3b')); sign.position.set(0, 0.75, 0.222); g.add(sign);
    for (const [x, z] of [[-0.24, -0.16], [0.24, -0.16], [-0.24, 0.16], [0.24, 0.16]]) g.add(at(caster(0.045), x, 0, z));
    return shadow(g);
  },
};

export function buildEquipment(type, props = {}) {
  const b = builders[type];
  const g = b ? b(props) : new THREE.Group();
  g.userData.type = type;
  return g;
}
