import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { createClinicalScene } from '../three/scene.js';

// Preact wrapper around the three.js clinical scene. `apiRef` receives the scene controller.
export function Scene3D({ environment, patient, family, editable, onSelect, onChange, onPick, onHover, onReady, apiRef, className = '', camera }) {
  const el = useRef(null), api = useRef(null);
  const cbs = useRef({});
  cbs.current = { onSelect, onChange, onPick, onHover };
  useEffect(() => {
    let s;
    try {
      s = createClinicalScene(el.current, {
        editable,
        onSelect: (u) => cbs.current.onSelect?.(u),
        onChange: (items, u) => cbs.current.onChange?.(items, u),
        onPick: onPick ? (p) => cbs.current.onPick?.(p) : undefined,
      });
    } catch (e) {
      el.current.innerHTML = '<div class="webgl-fail">3D view unavailable — this browser could not start WebGL.</div>';
      return;
    }
    api.current = s; if (apiRef) apiRef.current = s;
    s.setPatient(patient ? { ...patient.appearance, name: patient.name } : null);
    s.setFamily(family || null);
    s.setHover((h) => cbs.current.onHover?.(h));
    s.setEnvironment(environment);
    onReady?.(s);
    if (camera) setTimeout(() => s.setCamera(camera), 50);
    return () => { s.dispose(); api.current = null; if (apiRef) apiRef.current = null; };
  }, []);
  useEffect(() => { api.current?.setEnvironment(environment); }, [environment]);
  useEffect(() => { api.current?.setFamily(family || null); }, [family?.avatarId]);
  useEffect(() => { api.current?.setPatient(patient ? { ...patient.appearance, name: patient.name } : null); }, [JSON.stringify(patient?.appearance), patient?.name]);
  return <div ref={el} class={`scene3d ${className}`} />;
}
