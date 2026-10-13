// Equipment catalog for the drag-and-drop 3D environment builder.
// footprint: [w, d] meters (used for placement bounds & selection box)
export const EQUIPMENT = [
  { type: 'bed', name: 'Hospital bed', cat: 'Furniture', footprint: [1.05, 2.2], props: { hob: 30, rails: true, color: '#d9dee3' } },
  { type: 'stretcher', name: 'ED stretcher', cat: 'Furniture', footprint: [0.8, 2.0], props: { hob: 30 } },
  { type: 'monitor', name: 'Bedside monitor', cat: 'Monitoring', footprint: [0.45, 0.45], props: {} },
  { type: 'ivpole', name: 'IV pole + infusion pump', cat: 'Monitoring', footprint: [0.5, 0.5], props: { bags: 1 } },
  { type: 'vent', name: 'Ventilator', cat: 'Monitoring', footprint: [0.6, 0.6], props: {} },
  { type: 'o2tank', name: 'O₂ cylinder', cat: 'Respiratory', footprint: [0.3, 0.3], props: {} },
  { type: 'headwall', name: 'Headwall (O₂ / suction)', cat: 'Respiratory', footprint: [2.2, 0.15], props: {} },
  { type: 'crashcart', name: 'Crash cart', cat: 'Emergency', footprint: [0.75, 0.55], props: {} },
  { type: 'medcart', name: 'Medication cart', cat: 'Emergency', footprint: [0.7, 0.5], props: {} },
  { type: 'wow', name: 'Workstation on wheels', cat: 'Informatics', footprint: [0.55, 0.55], props: {} },
  { type: 'overbed', name: 'Overbed table', cat: 'Furniture', footprint: [0.9, 0.45], props: {} },
  { type: 'chair', name: 'Visitor chair', cat: 'Furniture', footprint: [0.6, 0.6], props: { color: '#4f6d7a' } },
  { type: 'wheelchair', name: 'Wheelchair', cat: 'Furniture', footprint: [0.65, 0.9], props: {} },
  { type: 'sink', name: 'Hand-wash sink', cat: 'Infection control', footprint: [0.6, 0.45], props: {} },
  { type: 'sanitizer', name: 'Sanitizer station', cat: 'Infection control', footprint: [0.2, 0.15], props: {} },
  { type: 'hamper', name: 'Linen hamper', cat: 'Infection control', footprint: [0.5, 0.5], props: {} },
  { type: 'sharps', name: 'Sharps container', cat: 'Infection control', footprint: [0.3, 0.2], props: {} },
  { type: 'cabinet', name: 'Supply cabinet', cat: 'Furniture', footprint: [1.0, 0.45], props: {} },
  { type: 'curtain', name: 'Privacy curtain', cat: 'Furniture', footprint: [2.4, 0.1], props: { color: '#7fa7a3' } },
  { type: 'whiteboard', name: 'Patient whiteboard', cat: 'Wall', footprint: [1.2, 0.05], props: {} },
  { type: 'clock', name: 'Wall clock', cat: 'Wall', footprint: [0.35, 0.05], props: {} },
  { type: 'window', name: 'Window', cat: 'Wall', footprint: [1.6, 0.1], props: {} },
  { type: 'tv', name: 'Wall TV', cat: 'Wall', footprint: [1.0, 0.08], props: {} },
  { type: 'plant', name: 'Plant', cat: 'Decor', footprint: [0.4, 0.4], props: {} },
  { type: 'bassinet', name: 'Bassinet', cat: 'Furniture', footprint: [0.55, 0.85], props: {} },
  { type: 'recliner', name: 'Family recliner', cat: 'Furniture', footprint: [0.85, 0.95], props: { color: '#5b6d7c' } },
  { type: 'nightstand', name: 'Nightstand / bedside cabinet', cat: 'Furniture', footprint: [0.5, 0.45], props: { personal: true } },
  { type: 'walker', name: 'Front-wheeled walker', cat: 'Mobility', footprint: [0.6, 0.5], props: {} },
  { type: 'commode', name: 'Bedside commode', cat: 'Mobility', footprint: [0.55, 0.55], props: {} },
  { type: 'gaitbelt', name: 'Gait belt (on hook)', cat: 'Mobility', footprint: [0.2, 0.1], props: {} },
  { type: 'scdpump', name: 'SCD pump', cat: 'Monitoring', footprint: [0.3, 0.25], props: {} },
  { type: 'door', name: 'Room door', cat: 'Wall', footprint: [1.1, 0.1], props: {} },
  { type: 'artwork', name: 'Wall art', cat: 'Wall', footprint: [0.8, 0.05], props: { style: 'landscape' } },
  { type: 'mural', name: 'Pediatric wall mural', cat: 'Wall', footprint: [2.4, 0.05], props: {} },
  { type: 'toys', name: 'Toy bin & stuffed animals', cat: 'Decor', footprint: [0.5, 0.4], props: {} },
  { type: 'cot', name: 'Parent sleep chair / cot', cat: 'Furniture', footprint: [0.8, 1.9], props: { color: '#6d6f82' } },
  { type: 'flowers', name: 'Flowers & cards', cat: 'Decor', footprint: [0.3, 0.3], props: {} },
  { type: 'phone', name: 'Bedside phone', cat: 'Informatics', footprint: [0.2, 0.2], props: {} },
  { type: 'isocart', name: 'Isolation cart (PPE)', cat: 'Infection control', footprint: [0.6, 0.45], props: {} },
];
export const EQUIP_MAP = Object.fromEntries(EQUIPMENT.map(e => [e.type, e]));

let n = 0;
const it = (type, x, z, rot = 0, props = {}) => ({ uid: `seed${++n}`, type, x, z, rot, props: { ...(EQUIP_MAP[type]?.props || {}), ...props } });

// Room presets — room is 7m (x) × 6m (z); back wall at z=-3, left wall at x=-3.5
export const ROOM_PRESETS = {
  medsurg: {
    label: 'Med-Surg patient room', wallColor: '#e6e1d6', floorColor: '#b9ab94', accentColor: '#5f8f8b', lighting: 'day',
    items: () => [
      it('headwall', 0, -2.9), it('bed', 0, -1.7), it('monitor', -0.95, -2.55), it('ivpole', 0.85, -2.25),
      it('overbed', 1.2, -1.2, Math.PI / 2), it('chair', 2.3, -1.6, -Math.PI / 2), it('window', 2.2, -2.95), it('clock', -1.9, -2.95),
      it('whiteboard', -3.45, -0.4, Math.PI / 2), it('sink', -3.1, 1.6, Math.PI / 2), it('sanitizer', -3.45, 0.9, Math.PI / 2),
      it('wow', -1.7, 0.4, 0.4), it('curtain', -1.9, -1.5, Math.PI / 2), it('hamper', 2.9, 1.9), it('sharps', -1.6, -2.93), it('tv', 2.2, 2.9, Math.PI), it('door', -1.6, 2.95, Math.PI), it('phone', 1.1, -2.2), it('artwork', 2.0, -2.95, 0, { style: 'landscape' }),
    ],
  },
  icu: {
    label: 'ICU bay', wallColor: '#dde4e6', floorColor: '#9aa7ab', accentColor: '#3b6f8f', lighting: 'day',
    items: () => [
      it('headwall', 0, -2.9), it('bed', 0, -1.7), it('monitor', -0.95, -2.55), it('ivpole', 0.9, -2.3, 0, { bags: 3 }), it('ivpole', -1.3, -1.6, 0, { bags: 2 }),
      it('vent', 1.5, -2.3), it('wow', 2.2, -0.2, -0.6), it('crashcart', -2.6, 1.6, Math.PI / 2), it('sink', -3.1, -0.6, Math.PI / 2), it('sanitizer', -3.45, 0.4, Math.PI / 2),
      it('sharps', -1.6, -2.93), it('clock', 1.6, -2.95), it('cabinet', 2.8, 1.5, -Math.PI / 2), it('curtain', -2.1, -1.2, Math.PI / 2),
    ],
  },
  ed: {
    label: 'Emergency department bay', wallColor: '#e2e6ea', floorColor: '#a7a39a', accentColor: '#a3473f', lighting: 'bright',
    items: () => [
      it('headwall', 0, -2.9), it('stretcher', 0, -1.6), it('monitor', -0.9, -2.55), it('ivpole', 0.8, -2.2), it('o2tank', 1.3, -2.6),
      it('crashcart', 2.4, -1.2, -Math.PI / 2), it('wow', -1.9, 0.2, 0.5), it('curtain', -1.6, -0.9, Math.PI / 2),
      it('sanitizer', 1.6, -2.93), it('sharps', -1.6, -2.93), it('cabinet', 2.8, 1.6, -Math.PI / 2),
    ],
  },
  peds: {
    label: 'Pediatric room', wallColor: '#eef1e4', floorColor: '#c3cfb2', accentColor: '#e0a24a', lighting: 'day',
    items: () => [
      it('headwall', 0, -2.9), it('bed', 0, -1.7, 0, { rails: true, color: '#d9dee3', blanket: '#f2c0a8' }), it('monitor', -0.95, -2.55), it('ivpole', 0.85, -2.25),
      it('recliner', 1.7, -1.1, -Math.PI / 2, { color: '#5b8f7a' }), it('cot', 2.9, 0.6, 0, { color: '#6d6f82' }), it('mural', -3.45, -0.6, Math.PI / 2), it('toys', 2.4, -2.5),
      it('window', 2.2, -2.95), it('tv', -3.45, 1.6, Math.PI / 2), it('sanitizer', -1.7, -2.93), it('sink', -3.1, 2.3, Math.PI / 2), it('isocart', -2.6, 2.6, Math.PI),
      it('whiteboard', 1.0, -2.95), it('door', -1.6, 2.95, Math.PI), it('phone', 1.1, -2.2), it('sharps', -1.6, -2.93),
    ],
  },
  ob: {
    label: 'Postpartum / mother-baby room', wallColor: '#efe6e2', floorColor: '#c4ad99', accentColor: '#a3697f', lighting: 'dim',
    items: () => [
      it('headwall', 0, -2.9), it('bed', 0, -1.7, 0, { blanket: '#f4e6ea' }), it('monitor', -0.95, -2.55), it('ivpole', 0.85, -2.25, 0, { bags: 1 }), it('bassinet', 1.7, -0.9, -0.3),
      it('recliner', 2.5, -2.0, -Math.PI / 2, { color: '#7d5a68' }), it('window', -2.0, -2.95), it('artwork', 2.0, -2.95, 0, { style: 'floral' }), it('flowers', 1.2, -1.2),
      it('sanitizer', -3.45, 0.9, Math.PI / 2), it('cabinet', 2.8, 1.5, -Math.PI / 2), it('whiteboard', -3.45, -0.6, Math.PI / 2), it('door', -1.6, 2.95, Math.PI), it('overbed', 1.2, -0.3, Math.PI / 2), it('phone', -1.1, -2.2),
    ],
  },
  ltc: {
    label: 'Long-term care resident room', wallColor: '#ebe4d2', floorColor: '#9f8468', accentColor: '#8c6a4a', lighting: 'dim',
    items: () => [
      it('bed', -0.4, -1.7, 0, { hob: 30, rails: true, color: '#cfc7b8', blanket: '#b89a7c', quilt: true }), it('nightstand', 0.5, -2.55, 0, { personal: true }), it('recliner', 1.9, -1.6, -Math.PI / 2, { color: '#6a4f3f' }),
      it('walker', 1.3, 0.3, 0.4), it('commode', -1.9, -0.9, Math.PI / 2), it('window', 2.2, -2.95), it('artwork', -1.6, -2.95, 0, { style: 'family' }), it('artwork', -3.45, -0.5, Math.PI / 2, { style: 'landscape' }),
      it('tv', 2.9, 2.9, Math.PI), it('clock', 1.0, -2.95), it('flowers', 0.6, -2.4), it('sanitizer', -3.45, 1.2, Math.PI / 2), it('door', -1.6, 2.95, Math.PI), it('cabinet', 2.8, 1.5, -Math.PI / 2), it('phone', 0.3, -2.4),
    ],
  },
  ortho: {
    label: 'Orthopedic / post-surgical room', wallColor: '#e4e6e3', floorColor: '#aeb4ae', accentColor: '#4f7a8c', lighting: 'day',
    items: () => [
      it('headwall', 0, -2.9), it('bed', 0, -1.7, 0, { trapeze: true, abduction: true, scd: true }), it('monitor', -0.95, -2.55), it('ivpole', 0.85, -2.25), it('scdpump', 0.7, -0.5),
      it('walker', 1.9, 0.6, 0.5), it('overbed', 1.2, -1.2, Math.PI / 2), it('chair', 2.3, -1.6, -Math.PI / 2), it('window', 2.2, -2.95), it('clock', -1.9, -2.95),
      it('whiteboard', -3.45, -0.4, Math.PI / 2), it('sink', -3.1, 1.6, Math.PI / 2), it('sanitizer', -3.45, 0.9, Math.PI / 2), it('wow', -1.7, 0.4, 0.4), it('gaitbelt', -3.45, 0.2, Math.PI / 2),
      it('hamper', 2.9, 1.9), it('sharps', -1.6, -2.93), it('door', -1.6, 2.95, Math.PI), it('phone', 1.1, -2.2), it('commode', 2.6, 0.9, -Math.PI / 2),
    ],
  },
  telemetry: {
    label: 'Telemetry / step-down room', wallColor: '#e3e7ec', floorColor: '#a8adb3', accentColor: '#3f6e8f', lighting: 'bright',
    items: () => [
      it('headwall', 0, -2.9), it('bed', 0, -1.7), it('monitor', -0.95, -2.55), it('ivpole', 0.85, -2.25, 0, { bags: 2 }), it('overbed', 1.2, -1.2, Math.PI / 2),
      it('chair', 2.3, -1.6, -Math.PI / 2), it('window', 2.2, -2.95), it('clock', -1.9, -2.95), it('whiteboard', -3.45, -0.4, Math.PI / 2), it('sink', -3.1, 1.6, Math.PI / 2),
      it('sanitizer', -3.45, 0.9, Math.PI / 2), it('wow', -1.7, 0.4, 0.4), it('crashcart', -2.6, 2.2, Math.PI / 2), it('sharps', -1.6, -2.93), it('door', -1.6, 2.95, Math.PI), it('phone', 1.1, -2.2), it('tv', 2.2, 2.9, Math.PI),
    ],
  },
  home: {
    label: 'Home health — living room', wallColor: '#e9dcc4', floorColor: '#8b6a4c', accentColor: '#6b7f3a', lighting: 'dim',
    items: () => [
      it('bed', -0.6, -1.7, 0, { hob: 20, rails: false, color: '#c8b79c' }), it('chair', 1.6, -0.8, -Math.PI / 3, { color: '#7a5a3c' }), it('plant', 2.9, -2.6),
      it('window', 1.6, -2.95), it('tv', -3.45, 0.2, Math.PI / 2), it('o2tank', 0.6, -2.6), it('wheelchair', 2.3, 1.2, -0.8),
    ],
  },
};

export function presetEnvironment(key = 'medsurg') {
  const p = ROOM_PRESETS[key] || ROOM_PRESETS.medsurg;
  return { preset: key, wallColor: p.wallColor, floorColor: p.floorColor, accentColor: p.accentColor, lighting: p.lighting, items: p.items() };
}
