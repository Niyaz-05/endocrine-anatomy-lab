import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { CloseUp } from '../contract/schema';
import { centroidOf, closeUpFrame, segments, vec } from '../endocrine/anchors';
import { cellHormone, type CellHormoneId } from '../endocrine/receptors';
import { HORMONE_COLOUR } from '../endocrine/live';

/**
 * Close-ups built in code. The pituitary's is at real size, around the real gland (its portal veins
 * and the axons of hypothalamic neurons); the others are magnified scenes, drawn where their gland
 * is while the body is hidden: thyroid follicles, an islet of Langerhans, the zones of the adrenal,
 * and a target cell. Layouts are deterministic (seeded) and illustrative, at textbook proportions.
 */

const V = (p: readonly number[]) => new THREE.Vector3(...vec(p));
function rng(seed: number) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const curve = (pts: THREE.Vector3[]) => new THREE.CatmullRomCurve3(pts, false, 'centripetal');

function Label({ at, children, kind = '' }: { at: THREE.Vector3 | [number, number, number]; children: ReactNode; kind?: string }) {
  return <Html position={at} center zIndexRange={[3, 0]} className={`closeup-label ${kind}`} pointerEvents="none">{children}</Html>;
}

function Tube({ points, radius, colour, opacity = 1, emissive = 0.15, renderOrder = 3 }: { points: THREE.Vector3[]; radius: number; colour: string; opacity?: number; emissive?: number; renderOrder?: number }) {
  const g = useMemo(() => new THREE.TubeGeometry(curve(points), Math.max(16, points.length * 8), radius, 8, false), [points, radius]);
  useEffect(() => () => g.dispose(), [g]);
  return (
    <mesh geometry={g} renderOrder={renderOrder} raycast={() => null}>
      <meshStandardMaterial color={colour} roughness={0.4} emissive={colour} emissiveIntensity={emissive} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} />
    </mesh>
  );
}

/** Particles running along curves; `share` of them shown (0 … 1). */
function Particles({ curves, colour, radius, speed, share, playing, perCurve = 14 }: { curves: THREE.CatmullRomCurve3[]; colour: string; radius: number; speed: number; share: number; playing: boolean; perCurve?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const t = useRef(0);
  const geo = useMemo(() => new THREE.SphereGeometry(radius, 8, 6), [radius]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: colour, toneMapped: false, depthTest: false, transparent: true, opacity: 0.95 }), [colour]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    if (playing) t.current += dt * speed;
    let i = 0;
    const shown = Math.round(perCurve * Math.max(0, Math.min(1, share)));
    for (const c of curves) for (let k = 0; k < perCurve; k++, i++) {
      const u = (((k / perCurve + t.current) % 1) + 1) % 1;
      c.getPointAt(u, p);
      tmp.position.copy(p);
      tmp.scale.setScalar(k < shown ? 1 : 0);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geo, mat, Math.max(1, curves.length * perCurve)]} frustumCulled={false} renderOrder={7} />;
}

/** Instanced cells (spheres or flattened boxes) with their own colours. */
function Cells({ items, geometry, roughness = 0.5, opacity = 1 }: { items: { p: THREE.Vector3; s: number; c: string; q?: THREE.Quaternion }[]; geometry: THREE.BufferGeometry; roughness?: number; opacity?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }), [roughness, opacity]);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const tmp = new THREE.Object3D(), c = new THREE.Color();
    items.forEach((it, i) => {
      tmp.position.copy(it.p); tmp.scale.setScalar(it.s); tmp.quaternion.copy(it.q ?? new THREE.Quaternion()); tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix); m.setColorAt(i, c.set(it.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items]);
  return <instancedMesh ref={mesh} args={[geometry, mat, Math.max(1, items.length)]} raycast={() => null} />;
}

const fib = (n: number, i: number) => {
  const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), th = i * Math.PI * (3 - Math.sqrt(5));
  return new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
};

// ── The pituitary, at real size ───────────────────────────────────────────
function PituitaryScene({ playing, levels }: { playing: boolean; levels: Record<string, number> }) {
  const parts = useMemo(() => {
    const portal = segments['portal-hypophyseal']!.map(V), axon = segments['hypothalamus-to-posterior']!.map(V);
    const hyp = V(centroidOf('hypothalamus')), ant = V(centroidOf('pituitary-anterior')), post = V(centroidOf('pituitary-posterior'));
    const top = portal[Math.min(1, portal.length - 1)]!;
    const side = new THREE.Vector3(1, 0, 0), front = new THREE.Vector3(0, 0, 1);
    // Magnocellular neurons (paraventricular and supraoptic nuclei) send axons down the stalk.
    const axons = [-1.6, -0.8, 0, 0.8, 1.6].map((o, k) => {
      const start = hyp.clone().addScaledVector(side, o * 1e-3).add(new THREE.Vector3(0, 1.8e-3 + (k % 2) * 0.8e-3, -0.6e-3));
      const pts = [start, ...axon.slice(1, -1).map((p, i) => p.clone().addScaledVector(side, o * 0.25e-3 * (1 - i / axon.length)).addScaledVector(front, -0.5e-3)), post.clone().addScaledVector(side, o * 0.5e-3)];
      return pts;
    });
    // Parvocellular neurons end on the primary capillary plexus at the median eminence; portal veins
    // carry their hormones down the front of the stalk to the secondary plexus in the anterior lobe.
    const veins = [-0.7, 0, 0.7].map((o) => [top.clone().addScaledVector(side, o * 1e-3).addScaledVector(front, 0.9e-3), ...portal.slice(2, -1).map((p) => p.clone().addScaledVector(side, o * 0.6e-3).addScaledVector(front, 1e-3)), ant.clone().addScaledVector(side, o * 1.4e-3)]);
    const ring = (c: THREE.Vector3, r: number, n = 18) => Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * Math.PI * 2; return c.clone().add(new THREE.Vector3(Math.cos(a) * r, Math.sin(a * 3) * r * 0.25, Math.sin(a) * r)); });
    const primary = ring(top.clone().addScaledVector(front, 0.6e-3), 1.3e-3);
    const secondary = [ring(ant.clone().add(new THREE.Vector3(0, 0.8e-3, 0)), 2e-3), ring(ant.clone().add(new THREE.Vector3(0, -1e-3, 0)), 1.6e-3)];
    const ica = V(centroidOf('internal-carotid-artery-left'));
    const artery = [ica.clone().lerp(top, 0.15), ica.clone().lerp(top, 0.6).add(new THREE.Vector3(0, 2e-3, 0)), top.clone().addScaledVector(front, 0.6e-3).addScaledVector(side, 1.3e-3)];
    const out = [ant.clone(), ant.clone().add(new THREE.Vector3(-4e-3, -2e-3, -1e-3)), ant.clone().add(new THREE.Vector3(-9e-3, -5e-3, -3e-3))];
    const parvo = [-0.9, 0, 0.9].map((o) => top.clone().addScaledVector(side, o * 1e-3).add(new THREE.Vector3(0, 2.2e-3, 0.6e-3)));
    return { axons, veins, primary, secondary, artery, out, parvo, hyp, ant, post, top };
  }, []);
  const ax = useMemo(() => parts.axons.map(curve), [parts]);
  const pv = useMemo(() => parts.veins.map(curve), [parts]);
  const outC = useMemo(() => [curve(parts.out)], [parts]);
  return (
    <group>
      {parts.axons.map((a, i) => <Tube key={`a${i}`} points={a} radius={0.11e-3} colour="#7ab8ff" emissive={0.3} />)}
      {parts.axons.map((a, i) => <mesh key={`n${i}`} position={a[0]!} raycast={() => null}><sphereGeometry args={[0.45e-3, 14, 10]} /><meshStandardMaterial color="#9ad0ff" emissive="#4a80c0" emissiveIntensity={0.4} /></mesh>)}
      {parts.parvo.map((p, i) => <mesh key={`p${i}`} position={p} raycast={() => null}><sphereGeometry args={[0.35e-3, 12, 8]} /><meshStandardMaterial color="#c090f0" emissive="#7040c0" emissiveIntensity={0.4} /></mesh>)}
      <Tube points={parts.primary} radius={0.12e-3} colour="#c0306a" />
      {parts.veins.map((v, i) => <Tube key={`v${i}`} points={v} radius={0.16e-3} colour="#9a3ac0" />)}
      {parts.secondary.map((r, i) => <Tube key={`s${i}`} points={r} radius={0.12e-3} colour="#c0306a" />)}
      <Tube points={parts.artery} radius={0.2e-3} colour="#d0303a" />
      <Particles curves={pv} colour={HORMONE_COLOUR.releasing!} radius={0.22e-3} speed={0.25} share={Math.min(1, (levels.hypothalamus ?? 1) / 1.2)} playing={playing} />
      <Particles curves={ax} colour="#7ad8ff" radius={0.2e-3} speed={0.18} share={0.7} playing={playing} perCurve={8} />
      <Particles curves={outC} colour={HORMONE_COLOUR.tsh!} radius={0.3e-3} speed={0.2} share={Math.min(1, (levels['pituitary-anterior'] ?? 1) / 1.2)} playing={playing} perCurve={12} />
      <Label at={parts.hyp.clone().add(new THREE.Vector3(0, 4.5e-3, 0))}>Hypothalamic neurons</Label>
      <Label at={parts.top.clone().add(new THREE.Vector3(5e-3, 0.5e-3, 1e-3))}>Median eminence: primary capillary plexus</Label>
      <Label at={parts.veins[2]![Math.floor(parts.veins[2]!.length / 2)]!.clone().add(new THREE.Vector3(6e-3, 0, 1e-3))}>Hypophyseal portal veins</Label>
      <Label at={parts.ant.clone().add(new THREE.Vector3(0, -5e-3, 3e-3))}>Anterior lobe: TSH, ACTH, FSH, LH, GH, prolactin</Label>
      <Label at={parts.post.clone().add(new THREE.Vector3(5e-3, -3.5e-3, -2e-3))}>Posterior lobe: ADH, oxytocin (from the axons)</Label>
      <Label at={parts.artery[1]!.clone().add(new THREE.Vector3(-3e-3, 1.5e-3, 0))}>Superior hypophyseal artery</Label>
    </group>
  );
}

// ── Thyroid follicles (magnified) ─────────────────────────────────────────
function FollicleScene({ playing, drive, labels }: { playing: boolean; drive: number; labels: boolean }) {
  const data = useMemo(() => {
    const r = rng(11);
    const follicles: { c: THREE.Vector3; R: number }[] = [];
    const tries = [[0, 0], [-6.5, 2], [6.5, 1.5], [-3, -6], [3.8, -6.2], [-6.8, -4.5], [7, -5], [-1, 6.8], [-7.5, 7], [6, 7.5]] as const;
    for (const [x, y] of tries) follicles.push({ c: new THREE.Vector3(x + (r() - 0.5), y + (r() - 0.5), (r() - 0.5) * 1.5), R: 2.4 + r() * 1.1 });
    const cells: { p: THREE.Vector3; s: number; c: string; q: THREE.Quaternion }[] = [];
    const up = new THREE.Vector3(0, 0, 1);
    for (const f of follicles) {
      const n = Math.round((4 * Math.PI * f.R * f.R) / 0.36);
      for (let i = 0; i < n; i++) {
        const d = fib(n, i);
        // Cut open like a tissue section: only the back half of each wall, so the colloid shows.
        if (d.z > 0.15) continue;
        cells.push({ p: f.c.clone().addScaledVector(d, f.R - 0.22), s: 0.5, c: r() < 0.08 ? '#a84a70' : '#c8708e', q: new THREE.Quaternion().setFromUnitVectors(up, d) });
      }
    }
    const cCells = [[-3.2, 2.8, 1.2], [3.2, 3.6, 0.9], [0.2, -3.6, 1.4], [-5.2, -1.2, 1], [5.6, -2, 1.2], [-3.5, 6.6, 0.9]].map(([x, y, z]) => ({ p: new THREE.Vector3(x, y, z), s: 0.55, c: '#ece4f4' }));
    const caps = [
      [[-11, 4.2, 0.8], [-3.4, 3, 1.6], [3, 4, 1.4], [11, 3.6, 0.6]],
      [[-11, -2, 1], [-4.6, -2.2, 1.8], [0.4, -2.8, 1.8], [5, -1.4, 1.6], [11, -2.5, 0.8]],
      [[-9, -9, 0.6], [-0.5, -9, 1.2], [9, -9.5, 0.6]],
    ].map((c) => c.map((p) => new THREE.Vector3(...(p as [number, number, number]))));
    // Iodide in from the capillaries to the follicle walls; T4/T3 out from the follicles to the capillaries.
    const nearestCap = (p: THREE.Vector3) => { let best = caps[0]![0]!, bd = Infinity; for (const c of caps) for (const q of c) { const d = q.distanceTo(p); if (d < bd) { bd = d; best = q; } } return best; };
    const iodide = follicles.slice(0, 7).map((f) => { const q = nearestCap(f.c); return curve([q.clone(), q.clone().lerp(f.c, 0.5).add(new THREE.Vector3(0, 0, 1)), f.c.clone().add(q.clone().sub(f.c).normalize().multiplyScalar(f.R * 0.6))]); });
    const hormone = follicles.slice(0, 7).map((f) => { const q = nearestCap(f.c); return curve([f.c.clone(), f.c.clone().add(q.clone().sub(f.c).normalize().multiplyScalar(f.R)).add(new THREE.Vector3(0, 0, 0.8)), q.clone().add(new THREE.Vector3(0.6, 0.3, 0.4))]); });
    return { follicles, cells, cCells, caps, iodide, hormone };
  }, []);
  const box = useMemo(() => new THREE.BoxGeometry(0.9, 0.9, 0.55), []);
  const ball = useMemo(() => new THREE.SphereGeometry(1, 12, 8), []);
  useEffect(() => () => { box.dispose(); ball.dispose(); }, [box, ball]);
  const f0 = data.follicles[0]!;
  return (
    <group>
      {data.follicles.map((f, i) => (
        <mesh key={i} position={f.c} raycast={() => null}>
          <sphereGeometry args={[f.R - 0.5, 28, 20]} />
          <meshPhysicalMaterial color="#e8b860" roughness={0.15} clearcoat={0.8} transparent opacity={0.88} emissive="#6a4410" emissiveIntensity={0.1 + 0.15 * Math.min(drive, 2)} />
        </mesh>
      ))}
      <Cells items={data.cells} geometry={box} />
      <Cells items={data.cCells} geometry={ball} roughness={0.4} />
      {data.caps.map((c, i) => <Tube key={i} points={c} radius={0.28} colour="#b8303a" />)}
      <Particles curves={data.iodide} colour="#a070ff" radius={0.18} speed={0.25} share={0.4 + 0.3 * Math.min(drive, 2)} playing={playing} perCurve={6} />
      <Particles curves={data.hormone} colour={HORMONE_COLOUR.t4!} radius={0.22} speed={0.2} share={Math.min(1, drive / 1.4)} playing={playing} perCurve={6} />
      {labels && <>
        <Label at={f0.c.clone().add(new THREE.Vector3(0, 0, f0.R))}>Colloid (thyroglobulin store)</Label>
        <Label at={f0.c.clone().add(new THREE.Vector3(0, -f0.R - 0.6, 1.2))}>Follicular cells: make T4 and T3</Label>
        <Label at={data.cCells[0]!.p.clone().add(new THREE.Vector3(0, 0.9, 0.8))}>C cell: calcitonin</Label>
        <Label at={data.caps[1]![0]!.clone().add(new THREE.Vector3(2, -0.8, 0.6))}>Capillary</Label>
        <Label at={new THREE.Vector3(-8, 9.5, 1)} kind="is-zone">One follicle, a hollow ball of cells</Label>
      </>}
    </group>
  );
}

// ── An islet of Langerhans (magnified) ────────────────────────────────────
function IsletScene({ playing, insulin, glucagon, labels }: { playing: boolean; insulin: number; glucagon: number; labels: boolean }) {
  const data = useMemo(() => {
    const r = rng(5);
    const R = 6.2;
    const cells: { p: THREE.Vector3; s: number; c: string }[] = [];
    const placed: THREE.Vector3[] = [];
    let guard = 0;
    while (placed.length < 300 && guard++ < 20000) {
      const p = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, (r() * 2 - 1) * 0.75).multiplyScalar(R);
      if (p.length() > R || placed.some((q) => q.distanceTo(p) < 1.05)) continue;
      placed.push(p);
      const edge = p.length() / R;
      const kind = r() < 0.07 ? 'delta' : edge > 0.72 && r() < 0.55 ? 'alpha' : 'beta';
      // A section through the islet: the cells in front of the cut are left out.
      if (p.z > 1.2) continue;
      cells.push({ p, s: 0.52, c: kind === 'beta' ? '#f2c230' : kind === 'alpha' ? '#4a9aff' : '#40c878' });
    }
    const acinar: { p: THREE.Vector3; s: number; c: string }[] = [];
    for (let i = 0; i < 260; i++) {
      const d = fib(260, i), rr = R + 1.2 + r() * 3.2;
      const p = d.multiplyScalar(rr);
      if (p.z > 0) continue; // keep the front open
      acinar.push({ p, s: 0.85, c: r() < 0.5 ? '#e6d2c0' : '#dcc4b0' });
    }
    const caps = [
      [[-12, 2, 0], [-4, 1, 1.5], [0, -1, 2], [4, 1.6, 1], [12, 3, -1]],
      [[-10, -7, 1], [-2, -3, 2.5], [3, -4.5, 2], [11, -8, 0]],
      [[-3, 12, 0], [-1.5, 4, 2], [1, -2, 1.5]],
    ].map((c) => c.map((p) => new THREE.Vector3(...(p as [number, number, number]))));
    const toCap = (p: THREE.Vector3) => { let best = caps[0]![0]!, bd = Infinity; for (const c of caps) for (const q of c) { const d = q.distanceTo(p); if (d < bd) { bd = d; best = q; } } return best; };
    const beta = cells.filter((c) => c.c === '#f2c230').slice(0, 14), alpha = cells.filter((c) => c.c === '#4a9aff').slice(0, 10);
    const lineFrom = (p: THREE.Vector3) => { const q = toCap(p); return curve([p.clone(), p.clone().lerp(q, 0.5).add(new THREE.Vector3(0, 0, 0.8)), q.clone(), q.clone().add(new THREE.Vector3(3, 0.5, 0))]); };
    return { cells, acinar, caps, ins: beta.map((c) => lineFrom(c.p)), glu: alpha.map((c) => lineFrom(c.p)), R };
  }, []);
  const ball = useMemo(() => new THREE.SphereGeometry(1, 12, 8), []);
  useEffect(() => () => ball.dispose(), [ball]);
  return (
    <group>
      <Cells items={data.cells} geometry={ball} roughness={0.45} />
      <Cells items={data.acinar} geometry={ball} roughness={0.6} opacity={0.4} />
      {data.caps.map((c, i) => <Tube key={i} points={c} radius={0.32} colour="#b8303a" />)}
      <Particles curves={data.ins} colour={HORMONE_COLOUR.insulin!} radius={0.2} speed={0.3} share={Math.min(1, insulin / 1.2)} playing={playing} perCurve={5} />
      <Particles curves={data.glu} colour={HORMONE_COLOUR.glucagon!} radius={0.2} speed={0.3} share={Math.min(1, glucagon / 1.2)} playing={playing} perCurve={5} />
      {labels && <>
        <Label at={[0.5, 0.5, 5.2]}>Beta cells: insulin (about 60 %)</Label>
        <Label at={[-6.4, -2.4, 3.2]}>Alpha cells: glucagon</Label>
        <Label at={[5.5, -4.6, 3]}>Delta cells: somatostatin</Label>
        <Label at={[8.5, 7.5, -1]}>Acinar cells: digestive enzymes</Label>
        <Label at={[-10, 3.4, 1]}>Capillary</Label>
      </>}
    </group>
  );
}

// ── The adrenal's zones (magnified wedge) ─────────────────────────────────
const ZONES = [
  { id: 'medulla', r0: 0, r1: 3.4, colour: '#7a3a2e', label: 'Medulla: chromaffin cells make adrenaline and noradrenaline', hormone: 'adrenaline' },
  { id: 'reticularis', r0: 3.4, r1: 4.6, colour: '#b8642a', label: 'Zona reticularis: androgens (DHEA)', hormone: 'cortisol' },
  { id: 'fasciculata', r0: 4.6, r1: 8.6, colour: '#efc860', label: 'Zona fasciculata: cortisol', hormone: 'cortisol' },
  { id: 'glomerulosa', r0: 8.6, r1: 9.7, colour: '#e09a3a', label: 'Zona glomerulosa: aldosterone', hormone: 'cortisol' },
  { id: 'capsule', r0: 9.7, r1: 10.1, colour: '#ece0d0', label: 'Capsule', hormone: '' },
] as const;
function AdrenalScene({ playing, cortex, medulla, labels }: { playing: boolean; cortex: number; medulla: number; labels: boolean }) {
  const half = THREE.MathUtils.degToRad(38), y0 = -6, depth = 2;
  const geoms = useMemo(() => ZONES.map((z) => {
    const s = new THREE.Shape();
    const a0 = Math.PI / 2 - half, a1 = Math.PI / 2 + half;
    if (z.r0 === 0) s.moveTo(0, 0); else s.absarc(0, 0, z.r0, a0, a1, false);
    s.absarc(0, 0, z.r1, a1, a0, true);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 40 });
    g.translate(0, y0, -depth);
    return g;
  }), [half]);
  useEffect(() => () => geoms.forEach((g) => g.dispose()), [geoms]);
  const cells = useMemo(() => {
    const r = rng(3), out: { p: THREE.Vector3; s: number; c: string }[] = [];
    const at = (rad: number, ang: number) => new THREE.Vector3(Math.cos(Math.PI / 2 + ang) * rad, y0 + Math.sin(Math.PI / 2 + ang) * rad, 0.15);
    // Glomerulosa: arched clusters; fasciculata: straight radial cords; reticularis: a network; medulla: clumps.
    for (let a = -half + 0.05; a < half; a += 0.07) for (let k = 0; k < 3; k++) out.push({ p: at(8.8 + k * 0.32 + 0.1 * Math.sin(a * 40), a + 0.02 * k), s: 0.17, c: '#b8701e' });
    for (let a = -half + 0.04; a < half; a += 0.045) for (let rad = 4.8; rad < 8.5; rad += 0.38) out.push({ p: at(rad, a + 0.004 * Math.sin(rad * 3)), s: 0.16, c: '#f6dc90' });
    for (let i = 0; i < 160; i++) out.push({ p: at(3.5 + r() * 1.05, (r() * 2 - 1) * half), s: 0.15, c: '#8a4418' });
    for (let i = 0; i < 160; i++) { const rad = 0.6 + r() * 2.7; out.push({ p: at(rad, (r() * 2 - 1) * half * 0.95), s: 0.18, c: r() < 0.8 ? '#a85a48' : '#6a2a20' }); }
    return out;
  }, [half]);
  const ball = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  useEffect(() => () => ball.dispose(), [ball]);
  const vein = useMemo(() => [new THREE.Vector3(-4, y0 + 0.8, -0.6), new THREE.Vector3(0, y0 + 1.1, -0.6), new THREE.Vector3(4, y0 + 0.8, -0.6)], []);
  const flows = useMemo(() => {
    const line = (rad: number, ang: number) => curve([new THREE.Vector3(Math.cos(Math.PI / 2 + ang) * rad, y0 + Math.sin(Math.PI / 2 + ang) * rad, 0.5), new THREE.Vector3(Math.cos(Math.PI / 2 + ang) * 2, y0 + Math.sin(Math.PI / 2 + ang) * 2, 0.4), new THREE.Vector3(0, y0 + 1.1, 0.3)]);
    return { cortex: [-0.5, -0.2, 0.15, 0.45].map((a) => line(8.8, a)), medulla: [-0.4, 0, 0.35].map((a) => line(3, a)) };
  }, []);
  return (
    <group>
      {geoms.map((g, i) => (
        <mesh key={ZONES[i]!.id} geometry={g} raycast={() => null}>
          <meshStandardMaterial color={ZONES[i]!.colour} roughness={0.55} emissive={ZONES[i]!.colour} emissiveIntensity={ZONES[i]!.id === 'medulla' ? 0.1 + 0.25 * Math.min(medulla, 2) : ZONES[i]!.id === 'fasciculata' ? 0.08 + 0.15 * Math.min(cortex, 2) : 0.06} />
        </mesh>
      ))}
      <Cells items={cells} geometry={ball} roughness={0.5} />
      <Tube points={vein} radius={0.45} colour="#4a3a90" />
      <Particles curves={flows.cortex} colour={HORMONE_COLOUR.cortisol!} radius={0.16} speed={0.22} share={Math.min(1, cortex / 1.2)} playing={playing} perCurve={8} />
      <Particles curves={flows.medulla} colour={HORMONE_COLOUR.adrenaline!} radius={0.18} speed={0.35} share={Math.min(1, 0.2 + medulla / 1.2)} playing={playing} perCurve={8} />
      {labels && ZONES.map((z, i) => <Label key={z.id} at={[Math.cos(Math.PI / 2 - half) * ((z.r0 + z.r1) / 2) + 0.6, y0 + Math.sin(Math.PI / 2 - half) * ((z.r0 + z.r1) / 2) + (i === 4 ? 0.6 : 0), 0.4]} kind="is-side">{z.label}</Label>)}
      {labels && <Label at={[0, y0 + 0.2, 0.8]}>Central vein</Label>}
    </group>
  );
}

// ── A target cell (magnified) ─────────────────────────────────────────────
function CellScene({ hormone, step, playing, labels }: { hormone: CellHormoneId; step: number; playing: boolean; labels: boolean }) {
  const h = cellHormone(hormone);
  const shows = h.steps.slice(0, step + 1).map((s) => s.show);
  const now = h.steps[step]!.show;
  const surface = h.kind === 'surface';
  const R = 9, nucleus = new THREE.Vector3(2, -1.5, -1), receptorAt = new THREE.Vector3(-6.4, 6.3, 1.2).normalize().multiplyScalar(R);
  const inward = receptorAt.clone().normalize().negate();
  const cytoReceptor = new THREE.Vector3(-2.6, 1.6, 1.4);
  const t = useRef(0);
  const hormoneRef = useRef<THREE.Mesh>(null);
  const messengers = useRef<THREE.InstancedMesh>(null);
  const cargo = useRef<THREE.Group>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const dna = useMemo(() => {
    const a: THREE.Vector3[] = [], b: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) { const u = i / 60, ang = u * Math.PI * 8; a.push(new THREE.Vector3(-2 + 4 * u, Math.cos(ang) * 0.45, Math.sin(ang) * 0.45).add(nucleus)); b.push(new THREE.Vector3(-2 + 4 * u, Math.cos(ang + Math.PI) * 0.45, Math.sin(ang + Math.PI) * 0.45).add(nucleus)); }
    return [a, b];
  }, []);
  const mrnaPath = useMemo(() => curve([nucleus.clone().add(new THREE.Vector3(-1, 1.2, 1.5)), nucleus.clone().add(new THREE.Vector3(-3.4, 3, 2)), new THREE.Vector3(-4.2, -2.4, 3.2), new THREE.Vector3(-5.2, -3.4, 2.4)]), []);
  const ribosome = new THREE.Vector3(-5.2, -3.4, 2.4);
  const glut = useMemo(() => [0, 1, 2].map((k) => { const d = new THREE.Vector3(-0.2 + k * 0.35, 1, 0.5 + k * 0.1).normalize(); return { at: d.multiplyScalar(R), from: d.clone().multiplyScalar(R * 0.45) }; }), []);
  useFrame((_, dt) => {
    if (playing) t.current = (t.current + dt / 3.2) % 1;
    const k = t.current;
    const m = hormoneRef.current;
    if (m) {
      // The hormone's own path for the current step.
      const outside = receptorAt.clone().multiplyScalar(1.7), onReceptor = receptorAt.clone().multiplyScalar(1.06);
      if (now === 'arrive') m.position.lerpVectors(outside, onReceptor, Math.min(1, k * 1.3));
      else if (surface) m.position.copy(onReceptor);
      else if (now === 'enter') m.position.lerpVectors(onReceptor, receptorAt.clone().multiplyScalar(0.8), k);
      else if (now === 'receptor') m.position.lerpVectors(receptorAt.clone().multiplyScalar(0.8), cytoReceptor, Math.min(1, k * 1.4));
      else m.position.lerpVectors(cytoReceptor, nucleus.clone().add(new THREE.Vector3(-0.4, 0.6, 0.8)), now === 'nucleus' ? Math.min(1, k * 1.4) : 1);
    }
    const ms = messengers.current;
    if (ms) {
      for (let i = 0; i < 24; i++) {
        const on = surface && shows.includes('messenger') && hormone !== 'insulin';
        const phase = (i / 24 + k) % 1;
        const dir = inward.clone().add(new THREE.Vector3(Math.sin(i * 2.4) * 0.6, Math.cos(i * 1.7) * 0.6, Math.sin(i) * 0.3)).normalize();
        tmp.position.copy(receptorAt).addScaledVector(inward, 0.8).addScaledVector(dir, phase * 6);
        // In the effect step glucose leaves (adrenaline, glucagon) or enters through GLUT4 (insulin).
        if (shows.includes('effect')) {
          const g = glut[i % 3]!;
          if (hormone === 'insulin' && i >= 12) tmp.position.lerpVectors(g.at.clone().multiplyScalar(1.5), g.at.clone().multiplyScalar(0.6), phase);
          if (hormone !== 'insulin' && i >= 12) tmp.position.lerpVectors(new THREE.Vector3(3, 3, 3).multiplyScalar(0.4), new THREE.Vector3(5, 6, 6).normalize().multiplyScalar(R * 1.5), phase);
        }
        const visible = (on && i < 12) || (shows.includes('effect') && i >= 12);
        tmp.scale.setScalar(visible ? (i >= 12 ? 0.32 : 0.22) : 0);
        tmp.updateMatrix();
        ms.setMatrixAt(i, tmp.matrix);
        ms.setColorAt(i, new THREE.Color(i >= 12 ? '#f4f4f4' : '#40e8c0'));
      }
      ms.instanceMatrix.needsUpdate = true;
      if (ms.instanceColor) ms.instanceColor.needsUpdate = true;
    }
    const c = cargo.current;
    if (c) c.position.copy(mrnaPath.getPointAt(now === 'mrna' ? k : shows.includes('mrna') ? 1 : 0));
  });
  const ball = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  useEffect(() => () => ball.dispose(), [ball]);
  const mito = [[3.5, 4.5, -2, 0.4], [5.5, -3, 1, -0.6], [-1, -6, -1, 1.2], [-5, 1, -3, 0.2]] as const;
  const kinaseOn = shows.includes('kinase');
  const bound = !shows.every((s) => s === 'arrive');
  return (
    <group>
      <mesh raycast={() => null} renderOrder={1}>
        <sphereGeometry args={[R, 48, 32]} />
        <meshPhysicalMaterial color="#f0d8d0" roughness={0.3} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={nucleus} raycast={() => null}>
        <sphereGeometry args={[3.4, 40, 28]} />
        <meshPhysicalMaterial color="#9a78c8" roughness={0.3} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {dna.map((s, i) => <Tube key={i} points={s} radius={0.12} colour={shows.includes('nucleus') || shows.includes('mrna') ? '#ffe070' : '#d0c0f0'} emissive={shows.includes('nucleus') ? 0.5 : 0.15} />)}
      {mito.map(([x, y, z, a], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, 0, a]} raycast={() => null}>
          <capsuleGeometry args={[0.6, 1.8, 6, 12]} />
          <meshStandardMaterial color="#d87a5a" roughness={0.5} />
        </mesh>
      ))}
      {/* The receptor: on the membrane (surface hormones) or in the cytoplasm (steroids and T3). */}
      <mesh position={surface ? receptorAt : cytoReceptor} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), surface ? receptorAt.clone().normalize() : new THREE.Vector3(0, 1, 0))} raycast={() => null}>
        <cylinderGeometry args={[0.45, 0.6, surface ? 2.2 : 1.1, 14]} />
        <meshStandardMaterial color={bound ? '#ffd24a' : '#8ad0a0'} emissive={bound ? '#a07010' : '#000000'} emissiveIntensity={0.5} />
      </mesh>
      <mesh ref={hormoneRef} raycast={() => null} renderOrder={8}>
        <sphereGeometry args={[0.55, 16, 12]} />
        <meshBasicMaterial color={h.colour} toneMapped={false} />
      </mesh>
      {surface && [0, 1, 2].map((i) => (
        <mesh key={i} position={receptorAt.clone().addScaledVector(inward, 2.2 + i * 1.3).add(new THREE.Vector3(i * 0.8 - 0.8, -0.6 * i, 0.4))} raycast={() => null}>
          <sphereGeometry args={[0.6, 14, 10]} />
          <meshStandardMaterial color={kinaseOn ? '#ff9a3a' : '#a08870'} emissive={kinaseOn ? '#ff7a1a' : '#000000'} emissiveIntensity={0.5} />
        </mesh>
      ))}
      {hormone === 'insulin' && glut.map((g, i) => (
        <mesh key={i} position={shows.includes('messenger') ? g.at : g.from} raycast={() => null}>
          <sphereGeometry args={[0.55, 12, 8]} />
          <meshStandardMaterial color="#6ad0ff" emissive="#2a80c0" emissiveIntensity={0.4} />
        </mesh>
      ))}
      <instancedMesh ref={messengers} args={[ball, undefined, 24]} frustumCulled={false} renderOrder={7}>
        <meshBasicMaterial toneMapped={false} depthTest={false} transparent />
      </instancedMesh>
      {!surface && shows.includes('mrna') && (
        <group ref={cargo}>
          <mesh raycast={() => null}><torusKnotGeometry args={[0.5, 0.12, 40, 6, 2, 5]} /><meshBasicMaterial color="#ff8ad0" toneMapped={false} /></mesh>
        </group>
      )}
      {!surface && shows.includes('protein') && (
        <group position={ribosome}>
          <mesh position={[0, 0.35, 0]} raycast={() => null}><sphereGeometry args={[0.7, 14, 10]} /><meshStandardMaterial color="#7a9ad0" /></mesh>
          <mesh position={[0, -0.45, 0]} raycast={() => null}><sphereGeometry args={[0.5, 14, 10]} /><meshStandardMaterial color="#5a7ab0" /></mesh>
          {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[0.8 + i * 0.42, 0.8 + Math.sin(i) * 0.3, 0.2]} raycast={() => null}><sphereGeometry args={[0.2, 8, 6]} /><meshStandardMaterial color="#f0a040" /></mesh>)}
        </group>
      )}
      {labels && <>
        <Label at={receptorAt.clone().multiplyScalar(1.28)}>{h.receptor}</Label>
        <Label at={new THREE.Vector3(R * 0.72, -R * 0.75, 0)}>Cell membrane</Label>
        <Label at={nucleus.clone().add(new THREE.Vector3(0, -3.9, 1))}>Nucleus (DNA)</Label>
        <Label at={new THREE.Vector3(R * 0.9, R * 1.05, 0)} kind="is-zone">{h.cell}</Label>
      </>}
    </group>
  );
}

export function CloseUps({ which, playing, reducedMotion, labels, levels, cell }: { which: CloseUp; playing: boolean; reducedMotion: boolean; labels: boolean; levels: Record<string, number>; cell: { hormone: CellHormoneId; step: number } }) {
  const frame = closeUpFrame(which);
  const run = playing && !reducedMotion;
  if (which === 'pituitary') return <PituitaryScene playing={run} levels={levels} />;
  // Magnified scenes are built in local units (about ±10) and scaled to the frame.
  const s = frame.radius / 10;
  return (
    <group position={frame.centre} scale={s}>
      {which === 'follicle' && <FollicleScene playing={run} drive={levels['thyroid-lobe-left'] ?? 1} labels={labels} />}
      {which === 'islet' && <IsletScene playing={run} insulin={levels.insulin ?? 0.8} glucagon={levels.glucagon ?? 0.6} labels={labels} />}
      {which === 'adrenal' && <AdrenalScene playing={run} cortex={levels['adrenal-cortex-left'] ?? 1} medulla={levels['adrenal-medulla-left'] ?? 0.3} labels={labels} />}
      {which === 'cell' && <CellScene hormone={cell.hormone} step={cell.step} playing={run} labels={labels} />}
    </group>
  );
}
