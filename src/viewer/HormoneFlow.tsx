import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { routePath, vec } from '../endocrine/anchors';
import type { Flow } from '../endocrine/live';

function curveOf(points: readonly (readonly number[])[]) {
  return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...vec(p))), false, 'centripetal');
}

interface Track { curve: THREE.CatmullRomCurve3; length: number; count: number; offset: number; colour: string; level: number }

/** How many particles a metre of route carries at full strength. */
const DENSITY = 70;

/**
 * Hormone particles streaming along their routes at a steady speed. A route's strength (the
 * hormone's level) sets how many of its particles show and how large they are, so a rising level
 * reads as a thicker stream. Drawn over the tissue, like the vessels in a textbook diagram.
 */
export function HormoneFlow({ flows, playing, reducedMotion }: { flows: Flow[]; playing: boolean; reducedMotion: boolean }) {
  // Rebuild the tracks only when the routes change, not when the levels do.
  const key = flows.map((f) => `${f.id}:${f.paths.map((p) => p.join('+')).join('|')}`).join(';');
  const tracks = useMemo(() => {
    let offset = 0;
    const out: (Track & { flow: string })[] = [];
    for (const f of flows) for (const path of f.paths) {
      const curve = curveOf(routePath(path));
      const length = curve.getLength();
      const count = Math.max(6, Math.round(length * DENSITY));
      out.push({ curve, length, count, offset, colour: f.colour, level: f.level, flow: f.id });
      offset += count;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const levels = useRef<Record<string, number>>({});
  levels.current = Object.fromEntries(flows.map((f) => [f.id, f.level]));
  const total = tracks.reduce((n, t) => n + t.count, 0);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const travelled = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.0016, 8, 6), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, depthTest: false, transparent: true, opacity: 0.95 }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const p = useMemo(() => new THREE.Vector3(), []);

  function place(distance: number) {
    const m = mesh.current;
    if (!m) return;
    for (const t of tracks) {
      const level = levels.current[t.flow] ?? 0;
      // Share of particles shown: none at zero, all from 1.5 times normal.
      const shown = Math.round(t.count * Math.min(1, level / 1.5));
      const size = 0.6 + 0.35 * Math.min(level, 2);
      const shift = distance / t.length;
      for (let i = 0; i < t.count; i++) {
        const u = (((i / t.count + shift) % 1) + 1) % 1;
        t.curve.getPointAt(u, p);
        tmp.position.copy(p);
        // Spread the shown particles evenly along the track.
        const visible = shown > 0 && Math.floor(((i + 1) * shown) / t.count) !== Math.floor((i * shown) / t.count);
        tmp.scale.setScalar(visible ? size : 0);
        tmp.updateMatrix();
        m.setMatrixAt(t.offset + i, tmp.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;
  }

  useEffect(() => {
    const m = mesh.current;
    if (m) {
      const c = new THREE.Color();
      for (const t of tracks) for (let i = 0; i < t.count; i++) m.setColorAt(t.offset + i, c.set(t.colour));
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    place(travelled.current);
    invalidate();
  });

  useFrame((_, dt) => {
    if (!playing || reducedMotion) return;
    travelled.current += 0.06 * Math.min(dt, 0.25);
    place(travelled.current);
  });

  if (!total) return null;
  return <instancedMesh key={`${key}-${total}`} ref={mesh} args={[geometry, material, total]} frustumCulled={false} renderOrder={6} />;
}
