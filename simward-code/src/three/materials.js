import * as THREE from 'three';

// Procedural textures (no external assets) so the scene works in the self-contained artifact build too.
const cache = new Map();
function canvasTex(key, w, h, draw, repeat = [1, 1]) {
  const k = `${key}|${repeat}`;
  if (cache.has(k)) return cache.get(k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  cache.set(k, t);
  return t;
}
function rand(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

export function floorTexture(color) {
  return canvasTex(`floor${color}`, 512, 512, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    const r = rand(7);
    for (let i = 0; i < 5000; i++) { // vinyl speckle
      g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + r() * 0.06})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; // tile seams
    for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * w / 2, 0); g.lineTo(i * w / 2, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 2); g.lineTo(w, i * h / 2); g.stroke(); }
  }, [7, 6]);
}
export function wallTexture(color, accent) {
  return canvasTex(`wall${color}${accent}`, 256, 512, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    const r = rand(3);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.035})`; g.fillRect(r() * w, r() * h, 2, 2); }
    // chair rail + lower wainscot in accent colour
    g.fillStyle = accent; g.globalAlpha = 0.85; g.fillRect(0, h * 0.62, w, h * 0.38); g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, h * 0.615, w, h * 0.012);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h * 0.965, w, h * 0.035);
  }, [4, 1]);
}
export function gownTexture(color) {
  return canvasTex(`gown${color}`, 128, 128, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const cx = x * 16 + (y % 2) * 8 + 4, cy = y * 16 + 4;
      g.beginPath(); g.moveTo(cx, cy - 2.5); g.lineTo(cx + 2.5, cy); g.lineTo(cx, cy + 2.5); g.lineTo(cx - 2.5, cy); g.closePath(); g.fill();
    }
  }, [4, 4]);
}
export function blanketTexture() {
  return canvasTex('blanket', 256, 256, (g, w, h) => {
    g.fillStyle = '#f2f4f5'; g.fillRect(0, 0, w, h);
    const r = rand(11);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.04})`; g.fillRect(r() * w, r() * h, 1, 3); }
    g.fillStyle = '#9fb6c6'; g.fillRect(0, h * 0.08, w, 6); g.fillRect(0, h * 0.08 + 10, w, 2);
  }, [1, 1]);
}
export function curtainTexture(color) {
  return canvasTex(`curtain${color}`, 256, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, 'rgba(0,0,0,0.18)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.18)'); g.fillStyle = gr; g.fillRect(x, 0, 16, h); }
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(0, 0, w, 18);
    g.fillStyle = 'rgba(255,255,255,0.25)'; for (let x = 4; x < w; x += 12) g.fillRect(x, 3, 5, 10);
  }, [3, 1]);
}
export function whiteboardTexture(name) {
  return canvasTex(`wb${name}`, 512, 256, (g, w, h) => {
    g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1f5f8b'; g.font = 'bold 30px sans-serif'; g.fillText('Welcome! Today is:', 20, 44);
    g.fillStyle = '#333'; g.font = '24px sans-serif';
    g.fillText(`Your nurse: ________`, 20, 96);
    g.fillText(`Patient: ${name || ''}`, 20, 136);
    g.fillText('Fall risk:  ☐ Low  ☐ High', 20, 176);
    g.fillStyle = '#b3261e'; g.fillText('Pain goal: ____ / 10', 20, 216);
  });
}
export function artTexture(style = 'landscape') {
  return canvasTex(`art${style}`, 512, 384, (g, w, h) => {
    const r = rand(style.length * 17);
    if (style === 'floral') {
      g.fillStyle = '#f6efe4'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) { const x = r() * w, y = r() * h, s = 14 + r() * 26; g.fillStyle = ['#d98fa8', '#e7b1c1', '#f2cf7a', '#9fb8c9'][i % 4]; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + Math.cos(k * 1.26) * s * 0.6, y + Math.sin(k * 1.26) * s * 0.6, s * 0.45, s * 0.3, k * 1.26, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#f3e38a'; g.beginPath(); g.arc(x, y, s * 0.25, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#6b8f5a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y + 60); g.stroke(); }
    } else if (style === 'family') {
      g.fillStyle = '#e9e2d3'; g.fillRect(0, 0, w, h); g.fillStyle = '#2b2b2b'; g.fillRect(28, 24, w - 56, h - 48); g.fillStyle = '#d7c9b1'; g.fillRect(40, 36, w - 80, h - 72);
      const sky = g.createLinearGradient(0, 36, 0, h - 36); sky.addColorStop(0, '#bcd3e6'); sky.addColorStop(1, '#e8dcc0'); g.fillStyle = sky; g.fillRect(40, 36, w - 80, h - 72);
      g.fillStyle = '#5c4a3a'; for (let i = 0; i < 4; i++) { const x = 120 + i * 80, hh = 110 + (i % 2) * 40; g.beginPath(); g.arc(x, h - 120 - hh, 22, 0, Math.PI * 2); g.fill(); g.fillRect(x - 28, h - 100 - hh, 56, hh); }
    } else if (style === 'abstract') {
      g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9; i++) { g.fillStyle = ['#2f6f73', '#d9822b', '#e9c46a', '#264653'][i % 4]; g.globalAlpha = 0.85; g.beginPath(); g.arc(r() * w, r() * h, 30 + r() * 70, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1;
    } else {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#8fbce0'); sky.addColorStop(0.55, '#e8d9b8'); sky.addColorStop(0.56, '#6f8f5a'); sky.addColorStop(1, '#3f5f3a'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = '#5a7a9a'; g.beginPath(); g.moveTo(0, h * 0.56); for (let x = 0; x <= w; x += 40) g.lineTo(x, h * 0.42 + Math.sin(x / 70) * 30 + r() * 10); g.lineTo(w, h * 0.56); g.fill();
      g.fillStyle = '#f7e9a0'; g.beginPath(); g.arc(w * 0.78, h * 0.2, 28, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2f5a3b'; for (let i = 0; i < 12; i++) { const x = r() * w, y = h * 0.6 + r() * h * 0.35; g.beginPath(); g.moveTo(x, y - 40); g.lineTo(x + 16, y); g.lineTo(x - 16, y); g.fill(); }
    }
    g.strokeStyle = '#3b2f24'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
  });
}
export function skylineTexture() {
  return canvasTex('skyline', 512, 384, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#9cc6ea'); sky.addColorStop(0.7, '#d8e8f3'); sky.addColorStop(1, '#e8eef0'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const r = rand(5);
    g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 6; i++) { const x = r() * w, y = 30 + r() * 120; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + k * 22, y + (k % 2) * 8, 18 + r() * 8, 0, Math.PI * 2); g.fill(); } }
    for (let i = 0; i < 14; i++) { const bw = 30 + r() * 50, bh = 60 + r() * 160, x = i * 38 - 10; g.fillStyle = `hsl(210, 12%, ${48 + r() * 18}%)`; g.fillRect(x, h - 120 - bh, bw, bh + 120); g.fillStyle = 'rgba(255,240,200,0.6)'; for (let yy = h - 110 - bh; yy < h - 130; yy += 14) for (let xx = x + 5; xx < x + bw - 6; xx += 10) if (r() < 0.5) g.fillRect(xx, yy, 5, 7); }
    g.fillStyle = '#5f8b57'; for (let i = 0; i < 9; i++) { const x = r() * w; g.beginPath(); g.arc(x, h - 95, 26 + r() * 14, 0, Math.PI * 2); g.fill(); g.fillStyle = '#4a6a3f'; g.fillRect(x - 3, h - 95, 6, 40); g.fillStyle = '#5f8b57'; }
    g.fillStyle = '#9aa39a'; g.fillRect(0, h - 70, w, 70); g.fillStyle = '#c9ced0'; g.fillRect(0, h - 70, w, 6);
  });
}
export function muralTexture() {
  return canvasTex('mural', 1024, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#bfe3f7'); sky.addColorStop(1, '#eaf6e0'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd95c'; g.beginPath(); g.arc(880, 90, 60, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; for (const [x, y] of [[180, 110], [420, 70], [640, 130]]) { for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + k * 34, y + (k % 2) * 10, 30, 0, Math.PI * 2); g.fill(); } }
    g.fillStyle = '#9fd27a'; g.beginPath(); g.moveTo(0, h); g.quadraticCurveTo(250, 300, 520, 400); g.quadraticCurveTo(800, 480, w, 380); g.lineTo(w, h); g.fill();
    const animal = (x, y, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, 60, 40, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x + 55, y - 30, 28, 0, Math.PI * 2); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.arc(x + 64, y - 34, 4, 0, Math.PI * 2); g.fill(); g.fillStyle = c; for (let k = 0; k < 4; k++) g.fillRect(x - 45 + k * 28, y + 25, 14, 40); };
    animal(240, 400, '#f29e4c'); animal(560, 440, '#8ecae6'); animal(820, 410, '#c77dff');
    g.fillStyle = '#3a6ea5'; g.font = 'bold 54px sans-serif'; g.fillText('You are brave!', 60, 240);
  });
}
export function photoTexture() {
  return canvasTex('photo', 128, 96, (g, w, h) => { g.fillStyle = '#f3efe6'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8b89a'; g.fillRect(8, 8, w - 16, h - 16); g.fillStyle = '#6a5240'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(30 + i * 34, 40, 9, 0, Math.PI * 2); g.fill(); g.fillRect(20 + i * 34, 50, 20, 30); } });
}
export function screenTexture(kind) {
  return canvasTex(`scr${kind}`, 256, 160, (g, w, h) => {
    g.fillStyle = kind === 'ehr' ? '#eef3f6' : '#0b1418'; g.fillRect(0, 0, w, h);
    if (kind === 'ehr') {
      g.fillStyle = '#1f5f8b'; g.fillRect(0, 0, w, 22);
      g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.fillText('EHR · Patient Summary', 8, 15);
      g.fillStyle = '#9aa9b2'; for (let i = 0; i < 7; i++) g.fillRect(10, 34 + i * 17, 120 + (i * 37) % 100, 7);
    } else {
      g.strokeStyle = '#35c9ff'; g.lineWidth = 2; g.beginPath();
      for (let x = 0; x < w; x += 4) g.lineTo(x, h / 2 + Math.sin(x / 10) * 20);
      g.stroke();
      g.fillStyle = '#39e27d'; g.font = 'bold 26px monospace'; g.fillText('VT 450', 12, 38);
    }
  });
}

// Shared PBR materials
export const M = {
  metal: () => new THREE.MeshStandardMaterial({ color: '#c9cfd4', metalness: 0.85, roughness: 0.28 }),
  darkMetal: () => new THREE.MeshStandardMaterial({ color: '#3b4247', metalness: 0.7, roughness: 0.4 }),
  plastic: (c = '#eef0f1') => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.02 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: '#1d2023', roughness: 0.9 }),
  fabric: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0 }),
  glass: () => new THREE.MeshPhysicalMaterial({ color: '#dfeff5', roughness: 0.05, transparent: true, opacity: 0.45 }),
  emissive: (c) => new THREE.MeshStandardMaterial({ color: '#000', emissive: c, emissiveIntensity: 1.2 }),
};
