#!/usr/bin/env node
/**
 * Build public/models/endocrine.glb: the hormone glands of the HRA united-female body (hypothalamus,
 * pineal, thymus, pancreas, ovaries) with BodyParts3D placed onto it (pituitary, adrenal glands, skull,
 * ribs, pelvis, neck vessels), and the modelled parts no open scanned model has (thyroid, parathyroids,
 * pituitary stalk, adrenal medulla).
 *
 *   node tools/extract-endocrine.mjs <Female Atlas models dir> <Human Atlas models dir>
 *
 *   <Female Atlas dir>   repo3-female-atlas/public/models: HRA united-female v1.5, +0.794760942 m in y
 *                        (reversed here).
 *   <Human Atlas dir>    repo4-human-atlas/public/models: BodyParts3D 4.0 (metres, Y-up,
 *                        +x = patient's left).
 *
 * Per mesh: weld, simplify the large HRA meshes with meshoptimizer within a relative error bound,
 * merge into one node per structure, recompute smooth normals. BodyParts3D parts are placed by
 * similarity transforms fitted on landmarks the two bodies share (see the registration block of
 * structures.source.json). Also measures the glands, checks the body layout, and traces the hormone
 * routes through the real vessels.
 * Writes public/models/endocrine.glb, src/endocrine/generated/geometry.json and provenance.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [femaleDir, humanDir] = process.argv.slice(2);
if (!femaleDir || !humanDir) {
  console.error('Usage: node tools/extract-endocrine.mjs <female-atlas public/models dir> <human-atlas public/models dir>');
  process.exit(2);
}
await MeshoptSimplifier.ready;

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const spec = JSON.parse(fs.readFileSync(path.join(root, 'src/endocrine/source/structures.source.json'), 'utf8'));
const SHIFT = spec.unitedYShift;
const MAX_ERROR = 0.004;
const V = (a) => new THREE.Vector3(...a);

// ── Sources ────────────────────────────────────────────────────────────────
function atlasReader(dir) {
  const bytes = fs.readFileSync(path.join(dir, 'atlas.json'));
  const atlas = JSON.parse(bytes.toString('utf8'));
  const cache = new Map(), hashes = {};
  const chunk = (i) => {
    if (!cache.has(i)) {
      const file = path.join(dir, atlas.chunks[i].url.split('/').pop());
      const buf = fs.readFileSync(file);
      cache.set(i, buf);
      hashes[path.basename(file)] = sha256(buf);
    }
    return cache.get(i);
  };
  const read = (part) => {
    const b = chunk(part.chunk);
    return {
      positions: new Float32Array(b.buffer.slice(b.byteOffset + part.positions, b.byteOffset + part.positions + part.vertexCount * 12)),
      indices: new Uint32Array(b.buffer.slice(b.byteOffset + part.indices, b.byteOffset + part.indices + part.indexCount * 4)),
    };
  };
  return { bytes, atlas, byId: new Map(atlas.parts.map((p) => [p.id, p])), read, hashes };
}
const female = atlasReader(femaleDir);
const human = atlasReader(humanDir);
function readUnited(id) {
  const part = female.byId.get(id);
  if (!part) throw new Error(`united body: part "${id}" missing`);
  const raw = female.read(part);
  for (let i = 1; i < raw.positions.length; i += 3) raw.positions[i] -= SHIFT;
  return raw;
}
function readBp3d(id) {
  const part = human.byId.get(id);
  if (!part) throw new Error(`BodyParts3D: part "${id}" missing`);
  return { ...human.read(part), part };
}

// ── Mesh clean-up ───────────────────────────────────────────────────────────
function weld(positions, indices) {
  const map = new Map(), remap = new Uint32Array(positions.length / 3), out = [];
  for (let i = 0; i < positions.length / 3; i++) {
    const key = `${Math.round(positions[i * 3] * 1e6)},${Math.round(positions[i * 3 + 1] * 1e6)},${Math.round(positions[i * 3 + 2] * 1e6)}`;
    let k = map.get(key);
    if (k === undefined) { k = out.length / 3; map.set(key, k); out.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]); }
    remap[i] = k;
  }
  const idx = [];
  for (let t = 0; t < indices.length; t += 3) {
    const a = remap[indices[t]], b = remap[indices[t + 1]], c = remap[indices[t + 2]];
    if (a !== b && b !== c && a !== c) idx.push(a, b, c);
  }
  return { positions: Float32Array.from(out), indices: Uint32Array.from(idx) };
}
function smoothNormals(positions, indices) {
  const n = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
    const e1 = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]];
    const e2 = [positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]];
    const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const v of [a, b, c]) { n[v] += f[0]; n[v + 1] += f[1]; n[v + 2] += f[2]; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const len = Math.hypot(n[i], n[i + 1], n[i + 2]);
    if (len > 0) { n[i] /= len; n[i + 1] /= len; n[i + 2] /= len; } else { n[i + 1] = 1; }
  }
  return n;
}
function simplify(positions, indices, ratio = 0.5, maxErr = MAX_ERROR) {
  const tris = indices.length / 3;
  if (tris <= 6000 && ratio >= 0.5) return { positions, indices, error: 0 };
  const target = Math.floor((indices.length * ratio) / 3) * 3;
  const [simplified, error] = MeshoptSimplifier.simplify(indices, positions, 3, target, maxErr);
  const used = new Map(), pos = [];
  const idx = new Uint32Array(simplified.length);
  for (let i = 0; i < simplified.length; i++) {
    const v = simplified[i];
    let k = used.get(v);
    if (k === undefined) { k = pos.length / 3; used.set(v, k); pos.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]); }
    idx[i] = k;
  }
  return { positions: Float32Array.from(pos), indices: idx, error };
}
function mergePieces(pieces) {
  const vCount = pieces.reduce((n, p) => n + p.positions.length / 3, 0);
  const positions = new Float32Array(vCount * 3), indices = new Uint32Array(pieces.reduce((n, p) => n + p.indices.length, 0));
  let vo = 0, io = 0;
  for (const p of pieces) {
    positions.set(p.positions, vo * 3);
    for (let k = 0; k < p.indices.length; k++) indices[io + k] = p.indices[k] + vo;
    vo += p.positions.length / 3; io += p.indices.length;
  }
  return { positions, indices };
}
/** Midpoint subdivision: every triangle becomes four (for the coarse BodyParts3D parts). */
function subdivide(positions, indices) {
  const pos = Array.from(positions), idx = [];
  const mids = new Map();
  const mid = (a, b) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    let m = mids.get(key);
    if (m === undefined) {
      m = pos.length / 3;
      pos.push((pos[a * 3] + pos[b * 3]) / 2, (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2, (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2);
      mids.set(key, m);
    }
    return m;
  };
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    idx.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(idx) };
}
/** Taubin smoothing (shrink-free): alternating Laplacian steps. */
function taubin(positions, indices, iterations) {
  const n = positions.length / 3, nb = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b);
  }
  for (let it = 0; it < iterations * 2; it++) {
    const f = it % 2 === 0 ? 0.5 : -0.53;
    const next = Float32Array.from(positions);
    for (let v = 0; v < n; v++) {
      if (!nb[v].size) continue;
      for (let a = 0; a < 3; a++) {
        let avg = 0;
        for (const u of nb[v]) avg += positions[u * 3 + a];
        avg /= nb[v].size;
        next[v * 3 + a] = positions[v * 3 + a] + f * (avg - positions[v * 3 + a]);
      }
    }
    positions.set(next);
  }
}
const bboxOf = (pos) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], pos[i + a]); hi[a] = Math.max(hi[a], pos[i + a]); }
  return [lo, hi];
};
function centroid(pos) {
  const c = [0, 0, 0], n = pos.length / 3;
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) c[a] += pos[i + a] / n;
  return c;
}
const ray = new THREE.Ray();
function bvhOf(m) {
  if (!m.bvh) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    m.bvh = new MeshBVH(g);
  }
  return m.bvh;
}
const DIRS = [new THREE.Vector3(1, 0.0013, 0.0007).normalize(), new THREE.Vector3(0.0011, 1, 0.0017).normalize(), new THREE.Vector3(0.0009, 0.0015, 1).normalize()];
function insideMesh(bvh, p) {
  let odd = 0;
  for (const d of DIRS) {
    ray.origin.set(p[0], p[1], p[2]); ray.direction.copy(d);
    if (bvh.raycast(ray, THREE.DoubleSide).length % 2 === 1) odd++;
  }
  return odd >= 2;
}
/** Principal axes (unit vectors, largest spread first) and extents of a point set. */
function pca(pos) {
  const c = centroid(pos), n = pos.length / 3;
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < pos.length; i += 3) {
    const d = [pos[i] - c[0], pos[i + 1] - c[1], pos[i + 2] - c[2]];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) cov[r][k] += (d[r] * d[k]) / n;
  }
  const axes = [];
  const M = cov.map((r) => r.slice());
  for (let e = 0; e < 3; e++) {
    let v = [1, 0.7, 0.4];
    for (let it = 0; it < 300; it++) {
      let w = [0, 1, 2].map((r) => M[r][0] * v[0] + M[r][1] * v[1] + M[r][2] * v[2]);
      for (const a of axes) { const d = w[0] * a[0] + w[1] * a[1] + w[2] * a[2]; w = w.map((x, q) => x - d * a[q]); }
      const len = Math.hypot(...w) || 1; v = w.map((x) => x / len);
    }
    axes.push(v);
  }
  const extents = axes.map((a) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pos.length; i += 3) { const t = (pos[i] - c[0]) * a[0] + (pos[i + 1] - c[1]) * a[1] + (pos[i + 2] - c[2]) * a[2]; lo = Math.min(lo, t); hi = Math.max(hi, t); }
    return hi - lo;
  });
  return { centre: c, axes, extents };
}

// ── Similarity fits ─────────────────────────────────────────────────────────
/** Symmetric 4x4 eigenvector of the largest eigenvalue (power iteration with shift). */
function topEigen4(N) {
  let v = [1, 0.3, 0.2, 0.1];
  const shift = Math.abs(N.flat().reduce((a, b) => a + Math.abs(b), 0));
  for (let it = 0; it < 2000; it++) {
    const w = [0, 1, 2, 3].map((r) => N[r].reduce((s, x, c) => s + x * v[c], 0) + shift * v[r]);
    const len = Math.hypot(...w);
    v = w.map((x) => x / len);
  }
  return v;
}
/** Weighted similarity (Horn's quaternion method, then the least-squares scale). */
function horn(src, dst, w, fixedScale = null) {
  const W = w.reduce((a, b) => a + b, 0);
  const ms = [0, 1, 2].map((a) => src.reduce((s, p, i) => s + w[i] * p[a], 0) / W);
  const md = [0, 1, 2].map((a) => dst.reduce((s, p, i) => s + w[i] * p[a], 0) / W);
  const S = [0, 1, 2].map((r) => [0, 1, 2].map((c) => src.reduce((s, p, i) => s + w[i] * (p[r] - ms[r]) * (dst[i][c] - md[c]), 0)));
  const [[Sxx, Sxy, Sxz], [Syx, Syy, Syz], [Szx, Szy, Szz]] = S;
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  const [qw, qx, qy, qz] = topEigen4(N);
  const quat = new THREE.Quaternion(qx, qy, qz, qw).normalize();
  const rotM = new THREE.Matrix4().makeRotationFromQuaternion(quat);
  const v = new THREE.Vector3();
  let num = 0, den = 0;
  src.forEach((p, i) => {
    v.set(p[0] - ms[0], p[1] - ms[1], p[2] - ms[2]);
    den += w[i] * v.lengthSq();
    v.applyMatrix4(rotM);
    num += w[i] * (v.x * (dst[i][0] - md[0]) + v.y * (dst[i][1] - md[1]) + v.z * (dst[i][2] - md[2]));
  });
  const scale = fixedScale ?? num / den;
  const place = (x, y, z) => {
    v.set(x - ms[0], y - ms[1], z - ms[2]).applyMatrix4(rotM).multiplyScalar(scale);
    return [v.x + md[0], v.y + md[1], v.z + md[2]];
  };
  return { place, scale, quat };
}
const unitedRef = (refs) => mergePieces(refs.map(readUnited));
function fitSimilarity(name, f) {
  const reg = f.pairs.map(([bp, refs]) => {
    const src = centroid(readBp3d(bp).positions);
    const dst = centroid(unitedRef(refs).positions);
    if (Math.abs(src[0]) > 0.01 && Math.sign(src[0]) !== Math.sign(dst[0])) throw new Error(`registration ${name}: ${bp} lies on opposite sides`);
    return { bp, name: human.byId.get(bp).name, src, dst };
  });
  let fit = horn(reg.map((r) => r.src), reg.map((r) => r.dst), reg.map(() => 1));
  let surfaceRmsMm = null;
  if (f.icp) {
    // Iterative closest point: the BodyParts3D kidney surface onto the HRA kidney capsule. The scale
    // is fixed by the two kidneys' sizes (free-scale ICP shrinks); the start aligns the principal
    // axes. The vessel centroids are reported but not used: the two bodies' vessels differ.
    const src = readBp3d(f.icp.bp3d).positions;
    const target = unitedRef([f.icp.united]);
    const tb = bvhOf(target);
    const ps = pca(src), pt = pca(target.positions);
    const scale = Math.cbrt((pt.extents[0] * pt.extents[1] * pt.extents[2]) / (ps.extents[0] * ps.extents[1] * ps.extents[2]));
    const pts = [];
    for (let i = 0; i < src.length; i += 3) pts.push([src[i], src[i + 1], src[i + 2]]);
    const hit = {}, q = new THREE.Vector3();
    const lm = reg.slice(1);
    const score = (fit) => {
      let s2 = 0;
      for (const p of pts) { q.set(...fit.place(...p)); tb.closestPointToPoint(q, hit); s2 += hit.distance ** 2; }
      const surf = Math.sqrt(s2 / pts.length);
      const land = Math.sqrt(lm.reduce((t, r) => t + Math.hypot(...fit.place(...r.src).map((x, k) => x - r.dst[k])) ** 2, 0) / lm.length);
      return { surf, land, total: surf };
    };
    let best = null;
    // Both bodies share one frame (y up, +x left, +z front), so each target axis takes the sign that
    // agrees with its source axis (an upside-down or front-to-back kidney is not a candidate).
    const sgn = (k) => (V(ps.axes[k]).dot(V(pt.axes[k])) >= 0 ? 1 : -1);
    for (const [sa, sb] of [[sgn(0), sgn(1)]]) {
      const ax = (p, k, sg) => V(p.axes[k]).multiplyScalar(sg);
      const A = [ax(ps, 0, 1), ax(ps, 1, 1)], B = [ax(pt, 0, sa), ax(pt, 1, sb)];
      A.push(new THREE.Vector3().crossVectors(A[0], A[1])); B.push(new THREE.Vector3().crossVectors(B[0], B[1]));
      const cs = V(ps.centre), ct = V(pt.centre);
      const s0 = A.flatMap((a) => [cs.clone().add(a.clone().multiplyScalar(0.03)), cs.clone().add(a.clone().multiplyScalar(-0.03))]).map((p) => p.toArray());
      const d0 = B.flatMap((b) => [ct.clone().add(b.clone().multiplyScalar(0.03 * scale)), ct.clone().add(b.clone().multiplyScalar(-0.03 * scale))]).map((p) => p.toArray());
      let fit = horn(s0, d0, s0.map(() => 1), scale);
      for (let it = 0; it < 30; it++) {
        const pairs = pts.map((p) => { q.set(...fit.place(...p)); tb.closestPointToPoint(q, hit); return { p, d: hit.point.toArray(), dist: hit.distance }; });
        const sorted = pairs.map((x) => x.dist).sort((x, y) => x - y);
        const cut = sorted[Math.floor(sorted.length / 2)] * 3 + 1e-4;
        const kept = pairs.filter((x) => x.dist <= cut);
        const lw = 0; // vessel centroids differ between the bodies; shape alone sets the pose
        fit = horn([...kept.map((x) => x.p), ...lm.map((r) => r.src)], [...kept.map((x) => x.d), ...lm.map((r) => r.dst)], [...kept.map(() => 1), ...lm.map(() => lw)], scale);
      }
      const sc = score(fit);
      if (!best || sc.total < best.sc.total) best = { fit, sc };
    }
    fit = best.fit;
    surfaceRmsMm = r6(best.sc.surf * 1000);
  }
  const residuals = reg.map((r) => ({ landmark: `${r.bp} ${r.name}`, mm: r6(Math.hypot(...fit.place(...r.src).map((q, a) => q - r.dst[a])) * 1000) }));
  const rms = Math.sqrt(residuals.reduce((q, r) => q + r.mm ** 2, 0) / residuals.length);
  const rotationDeg = r6((2 * Math.acos(Math.min(1, Math.abs(fit.quat.w))) * 180) / Math.PI);
  return { place: fit.place, scale: r6(fit.scale), rotationDeg, rmsResidualMm: r6(rms), surfaceRmsMm, residuals };
}
const fits = Object.fromEntries(Object.entries(spec.registration.fits).map(([name, f]) => [name, fitSimilarity(name, f)]));
for (const [name, f] of Object.entries(fits)) {
  const limit = spec.registration.fits[name].maxRmsMm;
  const value = f.surfaceRmsMm ?? f.rmsResidualMm;
  if (value > limit) throw new Error(`Registration "${name}" too poor: ${value} mm\n${JSON.stringify(f.residuals)}`);
}

// ── Centre: the middle of the glands, from the hypothalamus to the ovaries ──
const centre = (() => {
  const ids = ['Allen_hypothalamus_L', 'Allen_hypothalamus_R', 'VH_F_left_ovary', 'VH_F_right_ovary'];
  const [lo, hi] = bboxOf(unitedRef(ids).positions);
  return [0, 0, 0].map((_, a) => (a === 0 ? 0 : (lo[a] + hi[a]) / 2));
})();
const centred = (raw) => {
  const p = Float32Array.from(raw.positions);
  for (let i = 0; i < p.length; i += 3) for (let a = 0; a < 3; a++) p[i + a] -= centre[a];
  return { positions: p, indices: raw.indices };
};
/** United parts by id, centred (for landmarks inside merged structures). */
const partCache = new Map();
const part = (id) => { if (!partCache.has(id)) partCache.set(id, weld(...Object.values(centred(readUnited(id))))); return partCache.get(id); };
/** A BodyParts3D part placed by its fit; with `ownScale`, kept at its own size about its placed centre. */
const placeBp3d = (id, fit, ownScale = false) => {
  const raw = readBp3d(id);
  const pos = new Float32Array(raw.positions.length);
  for (let i = 0; i < pos.length; i += 3) {
    const p = fits[fit].place(raw.positions[i], raw.positions[i + 1], raw.positions[i + 2]);
    pos.set([p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]], i);
  }
  if (ownScale) {
    const c = centroid(pos), k = 1 / fits[fit].scale;
    for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) pos[i + a] = c[a] + (pos[i + a] - c[a]) * k;
  }
  return { ...weld(pos, raw.indices), raw };
};

// ── Build the scanned structures ───────────────────────────────────────────
let sourceTriangles = 0, maxError = 0;
const used = new Set();
const meshes = [];
const bp3dParts = {};
const smoothSmall = (w) => {
  if (w.positions.length / 3 >= 600) return w;
  const sub = subdivide(w.positions, w.indices);
  taubin(sub.positions, sub.indices, 3);
  return sub;
};
/** Boundary loops of an open mesh, closed by fans from each loop's centroid. */
function closeLoops(positions, indices) {
  const edges = new Map();
  for (let t = 0; t < indices.length; t += 3) for (const [a, b] of [[indices[t], indices[t + 1]], [indices[t + 1], indices[t + 2]], [indices[t + 2], indices[t]]]) {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`;
    const e = edges.get(k);
    if (e) e.n++; else edges.set(k, { a, b, n: 1 });
  }
  const next = new Map();
  for (const e of edges.values()) if (e.n === 1) next.set(e.b, e.a); // reversed, so caps face out
  const pos = Array.from(positions), idx = Array.from(indices);
  const seen = new Set();
  let loops = 0;
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let v = start;
    while (v !== undefined && !seen.has(v)) { seen.add(v); loop.push(v); v = next.get(v); }
    if (loop.length < 3) continue;
    const c = [0, 0, 0];
    for (const q of loop) for (let a = 0; a < 3; a++) c[a] += positions[q * 3 + a] / loop.length;
    const ci = pos.length / 3; pos.push(...c);
    for (let i = 0; i < loop.length; i++) idx.push(loop[i], loop[(i + 1) % loop.length], ci);
    loops++;
  }
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(idx), loops };
}
const splits = {};
for (const s of spec.structures) {
  if (s.generated) continue;
  if (s.bp3d) {
    const pieces = s.bp3d.map((id) => {
      const w = placeBp3d(id, s.fit, s.ownScale);
      bp3dParts[s.id] = [...(bp3dParts[s.id] ?? []), `${id} ${w.raw.part.name}`];
      sourceTriangles += w.raw.indices.length / 3;
      const hard = s.layer === 'bone' || s.layer === 'skeleton' || s.id === 'hyoid-bone';
      const piece = hard ? { positions: w.positions, indices: w.indices } : smoothSmall(w);
      if (!s.simplify) return piece;
      const sm = simplify(piece.positions, piece.indices, s.simplify, s.maxError ?? 0.01);
      maxError = Math.max(maxError, sm.error);
      return sm;
    });
    let m = mergePieces(pieces);
    if (s.split) {
      // The pituitary's two lobes: the anterior lobe (adenohypophysis) is the front ~75 % of the
      // gland, the posterior lobe (neurohypophysis) the back. Cut by a frontal plane at the volume
      // quantile, then each half is closed.
      const w = weld(m.positions, m.indices);
      const bvh = bvhOf({ ...w });
      const [lo, hi] = bboxOf(w.positions);
      const zs = [];
      const step = 0.0003;
      for (let x = lo[0]; x <= hi[0]; x += step) for (let y = lo[1]; y <= hi[1]; y += step) for (let z = lo[2]; z <= hi[2]; z += step) if (insideMesh(bvh, [x, y, z])) zs.push(z);
      zs.sort((a, b) => a - b);
      const z0 = zs[Math.floor(zs.length * 0.25)];
      const keep = [];
      for (let t = 0; t < w.indices.length; t += 3) {
        const cz = (w.positions[w.indices[t] * 3 + 2] + w.positions[w.indices[t + 1] * 3 + 2] + w.positions[w.indices[t + 2] * 3 + 2]) / 3;
        if ((cz >= z0) === (s.split === 'anterior')) keep.push(w.indices[t], w.indices[t + 1], w.indices[t + 2]);
      }
      const closed = closeLoops(w.positions, Uint32Array.from(keep));
      const remap = new Map(), pos = [];
      const out = Array.from(closed.indices, (v) => { if (!remap.has(v)) { remap.set(v, pos.length / 3); pos.push(closed.positions[v * 3], closed.positions[v * 3 + 1], closed.positions[v * 3 + 2]); } return remap.get(v); });
      m = { positions: Float32Array.from(pos), indices: Uint32Array.from(out) };
      splits[s.id] = { planeZ: r6(z0), insideSamples: zs.length, loopsClosed: closed.loops };
    }
    meshes.push({ structure: s, ...m });
    continue;
  }
  const pieces = s.united.map((id) => {
    if (used.has(id)) throw new Error(`${id} used twice`);
    used.add(id);
    const raw = centred(readUnited(id));
    for (const v of raw.positions) if (!Number.isFinite(v)) throw new Error('non-finite position');
    for (const i of raw.indices) if (i >= raw.positions.length / 3) throw new Error('index out of range');
    sourceTriangles += raw.indices.length / 3;
    const w = weld(raw.positions, raw.indices);
    if (s.smooth) return smoothSmall(w);
    const sm = simplify(w.positions, w.indices, s.simplify ?? 0.5, s.maxError ?? MAX_ERROR);
    maxError = Math.max(maxError, sm.error);
    return sm;
  });
  meshes.push({ structure: s, ...mergePieces(pieces) });
}
const byId = new Map(meshes.map((m) => [m.structure.id, m]));
const cen = (id) => V(centroid(byId.get(id).positions));

// ── Keep placed BodyParts3D soft parts out of the HRA organs ──────────────
const insidePct = (m, bvh) => { let inside = 0, n = 0; for (let i = 0; i < m.positions.length; i += 9) { n++; if (insideMesh(bvh, [m.positions[i], m.positions[i + 1], m.positions[i + 2]])) inside++; } return r6((100 * inside) / n); };
const overlap = { before: {}, after: {} };
/** Push the vertices of `m` that lie inside `bvh` out to its surface plus a gap, smoothing between passes. */
function pushOut(m, bvh, gap, passes = 6, smooth = true) {
  const res = {}, v = new THREE.Vector3();
  for (let pass = 0; pass < passes; pass++) {
    let moved = 0;
    for (let i = 0; i < m.positions.length; i += 3) {
      v.set(m.positions[i], m.positions[i + 1], m.positions[i + 2]);
      const inside = insideMesh(bvh, [v.x, v.y, v.z]);
      bvh.closestPointToPoint(v, res);
      if (!inside && res.distance >= gap) continue;
      const out = inside ? res.point.clone().sub(v).normalize() : v.clone().sub(res.point).normalize();
      v.copy(res.point).addScaledVector(out, gap);
      m.positions.set([v.x, v.y, v.z], i);
      moved++;
    }
    if (!moved) break;
    if (smooth && pass < passes - 1) taubin(m.positions, m.indices, 1);
  }
}
for (const m of meshes) {
  const targets = m.structure.mould;
  if (!targets) continue;
  const bvh = bvhOf(mergePieces(targets.map((id) => byId.get(id))));
  overlap.before[m.structure.id] = insidePct(m, bvh);
  if (overlap.before[m.structure.id] > 0) pushOut(m, bvh, 0.0006);
  overlap.after[m.structure.id] = insidePct(m, bvh);
}

// ── Helpers on placed meshes ───────────────────────────────────────────────
function nearestVertex(m, p) {
  const q = m.positions; let b = 0, bd = Infinity;
  for (let i = 0; i < q.length; i += 3) { const d = (q[i] - p.x) ** 2 + (q[i + 1] - p.y) ** 2 + (q[i + 2] - p.z) ** 2; if (d < bd) { bd = d; b = i; } }
  return V([q[b], q[b + 1], q[b + 2]]);
}
const polyLength = (pts) => pts.slice(1).reduce((s, p, i) => s + p.distanceTo(pts[i]), 0);
const arr = (pts) => pts.map((p) => p.toArray().map(r6));
function chaikin(pts, iterations = 2) {
  let out = pts;
  for (let it = 0; it < iterations; it++) {
    const next = [out[0]];
    for (let i = 0; i < out.length - 1; i++) next.push(out[i].clone().lerp(out[i + 1], 0.25), out[i].clone().lerp(out[i + 1], 0.75));
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}
function resample(pts, step) {
  const out = [pts[0].clone()];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], len = a.distanceTo(b);
    if (len === 0) continue;
    let t = step - carry;
    while (t <= len) { out.push(a.clone().lerp(b, t / len)); t += step; }
    carry = len - (t - step);
  }
  if (out[out.length - 1].distanceTo(pts[pts.length - 1]) > step * 0.2) out.push(pts[pts.length - 1].clone());
  return out;
}
/** Slab centroids of a mesh between two of its points: a vessel's centre line. */
function lineAlong(m, from, to, n = 10) {
  const pos = m.positions, ax = to.clone().sub(from), L = ax.length(); ax.normalize();
  const pts = [from];
  for (let k = 1; k < n; k++) {
    const t0 = (L * (k - 0.5)) / n, t1 = (L * (k + 0.5)) / n, acc = new THREE.Vector3(); let c = 0;
    for (let i = 0; i < pos.length; i += 3) { const p = V([pos[i], pos[i + 1], pos[i + 2]]); const t = p.clone().sub(from).dot(ax); if (t >= t0 && t < t1) { acc.add(p); c++; } }
    if (c) pts.push(acc.divideScalar(c));
  }
  pts.push(to);
  return pts;
}
/** The two ends of an elongated mesh (its extreme vertices along the main axis), the one nearer `hint` first. */
function endsOf(id, hint) {
  const m = byId.get(id), p = pca(m.positions), ax = V(p.axes[0]), c = V(p.centre);
  let lo = null, hi = null, tl = Infinity, th = -Infinity;
  for (let i = 0; i < m.positions.length; i += 3) { const q = V([m.positions[i], m.positions[i + 1], m.positions[i + 2]]); const t = q.clone().sub(c).dot(ax); if (t < tl) { tl = t; lo = q; } if (t > th) { th = t; hi = q; } }
  return hint && hi.distanceTo(hint) < lo.distanceTo(hint) ? [hi, lo] : [lo, hi];
}
/** A vessel's centre line from the end nearer `fromHint` to the other end (or to `toPoint`). */
function vessel(id, fromHint, toPoint = null, n = 10) {
  const [a, b] = endsOf(id, fromHint);
  return lineAlong(byId.get(id), a, toPoint ?? b, n);
}
const truncateNear = (pts, p) => { let k = 0, bd = Infinity; pts.forEach((q, i) => { const d = q.distanceTo(p); if (d < bd) { bd = d; k = i; } }); return pts.slice(0, k + 1); };
const nearestOn = (pts, p) => { let k = 0, bd = Infinity; pts.forEach((q, i) => { const d = q.distanceTo(p); if (d < bd) { bd = d; k = i; } }); return pts[k]; };
const lowest = (m) => { let b = 1; for (let k = 1; k < m.positions.length; k += 3) if (m.positions[k] < m.positions[b]) b = k; return V([m.positions[b - 1], m.positions[b], m.positions[b + 1]]); };
const highest = (m) => { let b = 1; for (let k = 1; k < m.positions.length; k += 3) if (m.positions[k] > m.positions[b]) b = k; return V([m.positions[b - 1], m.positions[b], m.positions[b + 1]]); };
const ellipsoid = (c, ax, radii, segs = 20, rings = 14) => {
  const pos = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const th = (i / rings) * Math.PI;
    for (let j = 0; j < segs; j++) {
      const ph = (j / segs) * Math.PI * 2;
      const p = c.clone().addScaledVector(ax[0], radii[0] * Math.sin(th) * Math.cos(ph)).addScaledVector(ax[1], radii[1] * Math.sin(th) * Math.sin(ph)).addScaledVector(ax[2], radii[2] * Math.cos(th));
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = i * segs + j, b = i * segs + ((j + 1) % segs), d = (i + 1) * segs + j, e = (i + 1) * segs + ((j + 1) % segs);
    idx.push(a, d, b, b, d, e);
  }
  return weld(Float32Array.from(pos), Uint32Array.from(idx));
};
/** A closed tube along a curve, radius r(t) (t = 0 … 1). */
function tube(pts, r, rad = 14) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const N = Math.max(8, Math.round(curve.getLength() / 0.0008));
  const frames = curve.computeFrenetFrames(N, false);
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, c = curve.getPointAt(t), R = r(t);
    for (let j = 0; j < rad; j++) { const a = (j / rad) * Math.PI * 2; const p = c.clone().addScaledVector(frames.normals[i], Math.cos(a) * R).addScaledVector(frames.binormals[i], Math.sin(a) * R); pos.push(p.x, p.y, p.z); }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < rad; j++) { const a = i * rad + j, b = i * rad + ((j + 1) % rad), c = (i + 1) * rad + j, d = (i + 1) * rad + ((j + 1) % rad); idx.push(a, c, b, b, c, d); }
  return closeLoops(Float32Array.from(pos), Uint32Array.from(idx));
}
const specOf = (id) => spec.structures.find((x) => x.id === id);
const addGenerated = (id, m) => { const s = specOf(id); const mesh = { structure: s, positions: m.positions, indices: m.indices }; meshes.push(mesh); byId.set(id, mesh); return mesh; };

// ── The airway frame: trachea centre line and radius, cricoid and thyroid cartilage ─
const trachea = byId.get('trachea'), cricoid = byId.get('cricoid-cartilage'), thyroidCart = byId.get('thyroid-cartilage');
const cricoidC = cen('cricoid-cartilage');
const yC = (() => { let y = Infinity; for (let i = 0; i < cricoid.positions.length; i += 3) if (cricoid.positions[i + 2] > cricoidC.z) y = Math.min(y, cricoid.positions[i + 1]); return y; })();
const airway = mergePieces([trachea, cricoid, thyroidCart]);
const airwayBvh = bvhOf(airway);
/** Centre and radius of the airway at a height (from the trachea and larynx vertices in a 4 mm slab). */
function airwayAt(y) {
  const pts = [];
  for (let i = 0; i < airway.positions.length; i += 3) if (Math.abs(airway.positions[i + 1] - y) < 0.002) pts.push(V([airway.positions[i], y, airway.positions[i + 2]]));
  const c = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(pts.length);
  const r = pts.reduce((s, p) => s + Math.hypot(p.x - c.x, p.z - c.z), 0) / pts.length;
  return { c, r };
}
const ringPitch = 0.004; // tracheal rings with their ligaments, about 4 mm apart

// ── Thyroid gland (modelled): two lobes and the isthmus, wrapped onto the real airway ─
// Lobes about 5 cm high, 2 cm wide and 2 cm deep; upper pole near the thyroid cartilage's oblique line,
// lower pole at the 5th–6th tracheal ring; the isthmus across rings 2–4 (Gray's Anatomy, 42nd ed.).
const thyroid = {};
{
  const top = yC + 0.028, bottom = yC - 0.022;
  for (const [side, sx] of [['left', 1], ['right', -1]]) {
    const R = 30, M = 32, pos = [], idx = [];
    for (let i = 0; i <= R; i++) {
      const t = i / R, y = top + (bottom - top) * t;
      const { c, r } = airwayAt(y);
      // A pear: pointed upper pole, rounded lower pole, widest just below the middle.
      const prof = Math.sin(Math.PI * t) ** 0.75 * (0.78 + 0.32 * t);
      const th = THREE.MathUtils.degToRad(62 - 18 * t); // lower part comes round towards the front
      const er = V([sx * Math.sin(th), 0, Math.cos(th)]), et = V([sx * Math.cos(th), 0, -Math.sin(th)]);
      const ar = 0.0095 * prof, at = 0.0098 * prof;
      const cc = c.clone().addScaledVector(er, r + ar * 0.55);
      for (let j = 0; j < M; j++) { const ph = (j / M) * Math.PI * 2; const p = cc.clone().addScaledVector(er, ar * Math.cos(ph)).addScaledVector(et, at * Math.sin(ph)); pos.push(p.x, p.y, p.z); }
    }
    for (let i = 0; i < R; i++) for (let j = 0; j < M; j++) { const a = i * M + j, b = i * M + ((j + 1) % M), d = (i + 1) * M + j, e = (i + 1) * M + ((j + 1) % M); idx.push(a, d, b, b, d, e); }
    const lobe = weld(Float32Array.from(pos), Uint32Array.from(idx));
    taubin(lobe.positions, lobe.indices, 2);
    pushOut(lobe, airwayBvh, 0.0007, 8);
    taubin(lobe.positions, lobe.indices, 2);
    pushOut(lobe, airwayBvh, 0.0007, 4, false);
    addGenerated(`thyroid-lobe-${side}`, lobe);
    thyroid[side] = { top, bottom };
  }
  // Isthmus: a band about 2 cm across, 12 mm high and 5 mm thick, over tracheal rings 2–4.
  const yMid = yC - ringPitch * 2.5;
  const { c, r } = airwayAt(yMid);
  const pts = [];
  for (let k = -6; k <= 6; k++) { const th = THREE.MathUtils.degToRad(k * 7.5); pts.push(V([c.x + Math.sin(th) * (r + 0.0035), yMid, c.z + Math.cos(th) * (r + 0.0035)])); }
  const band = tube(pts, (t) => 0.006 * Math.min(1, Math.sin(Math.PI * t) * 2.2 + 0.25), 20);
  // Flatten the tube's cross-section to 5 mm thick (radially) and 12 mm high.
  const w = weld(band.positions, band.indices);
  for (let i = 0; i < w.positions.length; i += 3) {
    const p = V([w.positions[i], w.positions[i + 1], w.positions[i + 2]]);
    const d = V([p.x - c.x, 0, p.z - c.z]); const rr = d.length(); d.normalize();
    const radial = rr - (r + 0.0035);
    const q = V([c.x, p.y, c.z]).addScaledVector(d, r + 0.0035 + radial * 0.42);
    w.positions.set([q.x, q.y, q.z], i);
  }
  pushOut(w, airwayBvh, 0.0007, 4, false);
  addGenerated('thyroid-isthmus', w);
  thyroid.isthmus = { y: yMid, ringsBelowCricoid: [2, 4] };
}
// Parathyroids (modelled): four, about 6 × 4 × 2 mm, on the back of the lobes: the superior pair at
// the level of the cricoid cartilage, the inferior pair near the lower poles.
const parathyroid = {};
for (const side of ['left', 'right']) {
  const lobe = byId.get(`thyroid-lobe-${side}`);
  for (const [pos, y] of [['superior', yC + 0.001], ['inferior', thyroid[side].bottom + 0.01]]) {
    const { c } = airwayAt(y);
    let best = null, bz = Infinity;
    for (let i = 0; i < lobe.positions.length; i += 3) {
      if (Math.abs(lobe.positions[i + 1] - y) > 0.0025) continue;
      const p = V([lobe.positions[i], lobe.positions[i + 1], lobe.positions[i + 2]]);
      if (p.z < bz) { bz = p.z; best = p; }
    }
    const out = V([best.x - c.x, 0, best.z - c.z]).normalize().add(V([0, 0, -0.6])).normalize();
    const centreP = best.clone().addScaledVector(out, 0.0016);
    const tang = new THREE.Vector3().crossVectors(V([0, 1, 0]), out).normalize();
    const g = ellipsoid(centreP, [tang, out, V([0, 1, 0])], [0.002, 0.001, 0.003], 18, 12);
    addGenerated(`parathyroid-${pos}-${side}`, g);
    parathyroid[`${pos}-${side}`] = centreP.toArray().map(r6);
  }
}

// ── Pituitary stalk (infundibulum, modelled): median eminence to the posterior lobe ─
{
  const hyp = byId.get('hypothalamus'), post = byId.get('pituitary-posterior'), ant = byId.get('pituitary-anterior');
  const pitTop = highest(mergePieces([post, ant]));
  const pc = cen('pituitary-posterior');
  const top = nearestVertex(hyp, V([0, cen('hypothalamus').y - 0.01, cen('hypothalamus').z]));
  const end = nearestVertex(post, V([pc.x, pitTop.y + 0.002, pc.z]));
  const mid = top.clone().lerp(end, 0.5).add(V([0, 0, 0.0008]));
  const stalk = tube([top.clone().add(V([0, 0.0008, 0])), mid, end.clone().add(V([0, -0.0006, 0]))], (t) => 0.0016 - 0.0004 * t, 14);
  addGenerated('infundibulum', weld(stalk.positions, stalk.indices));
}

// ── Adrenal medulla (modelled): the core of each gland, about a tenth of its volume ─
const adrenal = {};
for (const side of ['left', 'right']) {
  const cortex = byId.get(`adrenal-cortex-${side}`);
  const w = weld(cortex.positions, cortex.indices);
  const n = smoothNormals(w.positions, w.indices);
  const bvh = bvhOf(mergePieces([cortex]));
  const c = V(centroid(w.positions));
  const out = new Float32Array(w.positions.length);
  for (let i = 0; i < w.positions.length; i += 3) {
    const p = V([w.positions[i], w.positions[i + 1], w.positions[i + 2]]), nn = V([n[i], n[i + 1], n[i + 2]]);
    // Normals point out on a closed surface; cast inwards to the far wall.
    const inward = p.clone().sub(c).dot(nn) >= 0 ? nn.clone().negate() : nn.clone();
    ray.origin.copy(p).addScaledVector(inward, 1e-4); ray.direction.copy(inward);
    const hits = bvh.raycast(ray, THREE.DoubleSide).filter((h) => h.distance > 2e-4).sort((a, b) => a.distance - b.distance);
    const d = Math.min(hits[0]?.distance ?? 0, 0.006);
    const q = p.clone().addScaledVector(inward, d * 0.45);
    q.lerp(c, 0.25);
    out.set([q.x, q.y, q.z], i);
  }
  const med = { positions: out, indices: w.indices };
  taubin(med.positions, med.indices, 4);
  addGenerated(`adrenal-medulla-${side}`, med);
  adrenal[side] = {};
}
for (const m of meshes) m.normals = smoothNormals(m.positions, m.indices);

// ── Measurements ────────────────────────────────────────────────────────────
function signedVolume(m) {
  let v = 0; const p = m.positions, ix = m.indices;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
    v += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
  }
  return v;
}
/** Volume by sampling a grid inside the mesh (works for open meshes too). */
function sampledVolumeMl(ms, step = 0.0005) {
  const m = mergePieces(ms), bvh = bvhOf(m), [lo, hi] = bboxOf(m.positions);
  let n = 0;
  for (let x = lo[0]; x <= hi[0]; x += step) for (let y = lo[1]; y <= hi[1]; y += step) for (let z = lo[2]; z <= hi[2]; z += step) if (insideMesh(bvh, [x, y, z])) n++;
  return r6(n * step ** 3 * 1e6);
}
const dims = (ids) => { const p = pca(mergePieces(ids.map((id) => byId.get(id))).positions); return p.extents.map((e) => r6(e * 1000)); };
const vertebraLevels = [
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => [`C${n}`, `VH_F_cervical_vertebra_${n}`]),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => [`T${n}`, `VH_F_thoracic_vertebra_${n}`]),
  ...[1, 2, 3, 4, 5, 6].map((n) => [`L${n}`, `VH_F_lumbar_vertebra_${n}`]),
].map(([name, id]) => ({ name, y: V(centroid(part(id).positions)).y }));
const levelAt = (y) => vertebraLevels.reduce((b, v) => (Math.abs(v.y - y) < Math.abs(b.y - y) ? v : b)).name;
const measures = {
  pituitary: {
    sizeMm: dims(['pituitary-anterior', 'pituitary-posterior']),
    volumeMl: sampledVolumeMl([byId.get('pituitary-anterior'), byId.get('pituitary-posterior')], 0.00025),
    anteriorShare: null,
    stalkLengthMm: r6(polyLength([lowest(byId.get('hypothalamus')), highest(byId.get('pituitary-posterior'))]) * 1000),
  },
  pineal: { sizeMm: dims(['pineal-gland']) },
  hypothalamus: { sizeMm: dims(['hypothalamus']) },
  thyroid: {
    lobeSizeMm: { left: dims(['thyroid-lobe-left']), right: dims(['thyroid-lobe-right']) },
    lobeHeightMm: r6((thyroid.left.top - thyroid.left.bottom) * 1000),
    isthmusSizeMm: dims(['thyroid-isthmus']),
    volumeMl: sampledVolumeMl(['thyroid-lobe-left', 'thyroid-lobe-right', 'thyroid-isthmus'].map((id) => byId.get(id))),
    isthmusLevel: levelAt(thyroid.isthmus.y), isthmusRings: thyroid.isthmus.ringsBelowCricoid,
    cricoidLowerBorderLevel: levelAt(yC),
  },
  parathyroid: { sizeMm: dims(['parathyroid-superior-left']), centres: parathyroid },
  adrenal: Object.fromEntries(['left', 'right'].map((side) => {
    const vc = sampledVolumeMl([byId.get(`adrenal-cortex-${side}`)], 0.0004);
    const vm = sampledVolumeMl([byId.get(`adrenal-medulla-${side}`)], 0.0004);
    return [side, { sizeMm: dims([`adrenal-cortex-${side}`]), volumeMl: vc, medullaMl: vm, medullaShare: r6(vm / vc) }];
  })),
  pancreas: { lengthMm: dims(['pancreas-head', 'pancreas-neck', 'pancreas-body', 'pancreas-tail'])[0], level: levelAt(cen('pancreas-body').y) },
  ovary: { left: dims(['ovary-left']), right: dims(['ovary-right']) },
  thymus: { sizeMm: dims(['thymus-left', 'thymus-right']) },
  levels: { pituitary: null, thyroid: levelAt(cen('thyroid-isthmus').y), adrenalLeft: levelAt(cen('adrenal-cortex-left').y), pancreas: levelAt(cen('pancreas-body').y), ovaries: levelAt(cen('ovary-left').y) },
};
{
  const va = sampledVolumeMl([byId.get('pituitary-anterior')], 0.00025), vp = sampledVolumeMl([byId.get('pituitary-posterior')], 0.00025);
  measures.pituitary.anteriorShare = r6(va / (va + vp));
}

// ── Hormone routes: segments through the real vessels ──────────────────────
// Every venous segment ends in the right atrium; 'heart' runs from there through the lungs to the top
// of the ascending aorta; every arterial segment starts there. Off-model stretches (small veins,
// sinuses, the lungs, the ovarian vessels) are smooth curves between real points, marked in `offModel`.
const RA = V(centroid(part('VH_F_right_cardiac_atrium').positions)), RV = V(centroid(part('VH_F_right_ventricle').positions));
const LA = V(centroid(part('VH_F_left_cardiac_atrium').positions)), LV = V(centroid(part('VH_F_left_ventricle').positions));
const seg = {};
const offModel = {};
{
  const [svcTop, svcBottom] = endsOf('superior-vena-cava', V([RA.x, RA.y + 0.2, RA.z]));
  seg.svc = [...lineAlong(byId.get('superior-vena-cava'), svcTop, svcBottom, 8), RA];
  const [ivcTop, ivcBottom] = endsOf('inferior-vena-cava', V([RA.x, RA.y + 0.05, RA.z]));
  seg.ivcFull = [...lineAlong(byId.get('inferior-vena-cava'), ivcBottom, ivcTop, 24), RA];
}
const ivcFrom = (p) => { const k = seg.ivcFull.indexOf(nearestOn(seg.ivcFull, p)); return seg.ivcFull.slice(k); };
// Heart: right atrium → right ventricle → pulmonary trunk → (lungs) → pulmonary veins → left atrium → left ventricle → aorta.
const [aoBase, aoTop] = endsOf('ascending-aorta', LV);
const ascending = lineAlong(byId.get('ascending-aorta'), aoBase, aoTop, 8);
{
  const trunk = part('VH_F_pulmonary_trunk');
  const ptBase = nearestVertex(trunk, RV), ptTop = V(centroid(trunk.positions));
  const pv = cen('pulmonary-veins');
  seg.heart = [RA, RA.clone().lerp(RV, 0.5).add(V([0, -0.01, 0.01])), RV, ptBase, ptTop, ptTop.clone().lerp(pv, 0.5).add(V([0.03, 0.01, -0.01])), pv, LA, LV, ...ascending];
  offModel.heart = 'From the pulmonary trunk the blood passes through the lungs (not in the model) and returns by the pulmonary veins.';
}
// The arch, from the top of the ascending aorta to the top of the descending aorta.
const [archA, archB] = endsOf('aortic-arch', aoTop);
const arch = [aoTop, ...lineAlong(byId.get('aortic-arch'), archA, archB, 12)];
const [dTop, dBottom] = endsOf('thoracic-aorta', archB);
const thoracic = lineAlong(byId.get('thoracic-aorta'), dTop, dBottom, 14);
const [abTop, abBottom] = endsOf('abdominal-aorta', dBottom);
const abdominal = lineAlong(byId.get('abdominal-aorta'), abTop, abBottom, 22);
const descending = [...thoracic, ...abdominal];
const aortaTo = (p) => [...arch, ...truncateNear(descending, p)];
const archTo = (id) => truncateNear(arch, nearestVertex(byId.get(id), V(centroid(byId.get(id).positions)).add(V([0, -0.05, 0]))));
// To the head: left common carotid → (upper neck) → internal carotid → pituitary.
{
  const lcca = vessel('common-carotid-artery-left', arch[arch.length - 1]);
  const ica = vessel('internal-carotid-artery-left', V([0.03, -1, 0]).add(cen('internal-carotid-artery-left')));
  const pit = cen('pituitary-anterior');
  seg['to-pituitary'] = [...archTo('common-carotid-artery-left'), ...lcca, ...truncateNear(ica, pit), pit];
  offModel['to-pituitary'] = 'The common carotid artery in the upper neck and its internal carotid branch below the skull are not in the model; the pituitary is fed by the superior and inferior hypophyseal arteries from the internal carotid.';
  seg['to-hypothalamus'] = [...seg['to-pituitary'].slice(0, -1), cen('hypothalamus')];
}
// To the thyroid: subclavian → thyrocervical trunk → inferior thyroid artery → lobe.
{
  const lsa = vessel('subclavian-artery-left', arch[arch.length - 1]);
  const lita = vessel('inferior-thyroid-artery-left', lsa[lsa.length - 1]);
  seg['to-thyroid-left'] = [...archTo('subclavian-artery-left'), ...truncateNear(lsa, lita[0]), ...lita, cen('thyroid-lobe-left')];
  const bca = vessel('brachiocephalic-trunk', aoTop);
  const rsa = vessel('subclavian-artery-right', bca[bca.length - 1]);
  const rita = vessel('inferior-thyroid-artery-right', rsa[0]);
  seg['to-thyroid-right'] = [...archTo('brachiocephalic-trunk'), ...bca, ...truncateNear(rsa, rita[0]), ...rita, cen('thyroid-lobe-right')];
  const pt = (k) => V(parathyroid[k]);
  seg['to-parathyroids'] = [...seg['to-thyroid-left'].slice(0, -1), pt('inferior-left'), pt('superior-left')];
}
// To the adrenal glands, kidneys, pancreas, liver and gut from the aorta.
for (const side of ['left', 'right']) {
  const sra = vessel(`suprarenal-arteries-${side}`, V([0, cen(`suprarenal-arteries-${side}`).y, cen('abdominal-aorta').z]));
  seg[`to-adrenal-${side}`] = [...aortaTo(sra[0]), ...sra, cen(`adrenal-cortex-${side}`)];
  const ra = vessel(`renal-artery-${side}`, V([0, cen(`renal-artery-${side}`).y, cen('abdominal-aorta').z]));
  seg[`to-kidney-${side}`] = [...aortaTo(ra[0]), ...ra, cen(`kidney-${side}`)];
}
{
  const ct = vessel('celiac-trunk', V([0, cen('celiac-trunk').y, cen('abdominal-aorta').z]));
  const sa = vessel('splenic-artery', ct[ct.length - 1]);
  seg['to-pancreas'] = [...aortaTo(ct[0]), ...ct, ...truncateNear(sa, cen('pancreas-body')), cen('pancreas-body'), cen('pancreas-tail')];
  seg['to-liver'] = [...aortaTo(ct[0]), ...ct, cen('liver').clone().lerp(ct[ct.length - 1], 0.6), cen('liver')];
  offModel['to-liver'] = 'The hepatic artery is not in the model.';
  seg['to-gut'] = [...aortaTo(ct[0]), ...ct, cen('duodenum').clone().lerp(ct[ct.length - 1], 0.5), cen('duodenum')];
  offModel['to-gut'] = 'The gastroduodenal and superior mesenteric arteries are not in the model.';
  const lumbar = cen('lumbar-spine');
  seg['to-bone'] = [...aortaTo(V([0, lumbar.y + 0.03, 0])), lumbar];
  offModel['to-bone'] = 'The lumbar arteries to the vertebrae are not in the model; bone everywhere responds.';
}
// To the ovaries: the ovarian arteries leave the aorta below the renal arteries and run down on the
// psoas into the suspensory ligament (not in the model).
for (const [side, sx, X] of [['left', 1, 'L'], ['right', -1, 'R']]) {
  const ov = cen(`ovary-${side}`);
  const lig = V(centroid(part(`VH_F_suspensory_ligament_of_ovary_${X}`).positions));
  const origin = nearestOn(abdominal, V([0, cen('renal-artery-left').y - 0.025, 0]));
  const brim = V([sx * 0.045, lig.y + 0.04, lig.z + 0.01]);
  const path = chaikin([origin, origin.clone().add(V([sx * 0.02, -0.03, 0])), brim, lig, ov], 2);
  seg[`to-ovary-${side}`] = [...aortaTo(origin), ...path.slice(1)];
  offModel[`to-ovary-${side}`] = 'The ovarian artery (from the aorta, down the back wall and through the suspensory ligament of the ovary) is not in the model.';
  // Veins: the left ovarian vein drains into the left renal vein, the right into the vena cava.
  const back = path.slice().reverse().map((p) => p.clone().add(V([sx * 0.004, 0, 0.003])));
  if (side === 'left') {
    const lrv = vessel('renal-vein-left', cen('kidney-left'));
    const entry = nearestOn(lrv, V([0.03, lrv[0].y, lrv[0].z]));
    const k = lrv.indexOf(entry);
    seg[`ovary-${side}-to-heart`] = [...back.slice(0, -1), entry, ...lrv.slice(k + 1), ...ivcFrom(lrv[lrv.length - 1])];
  } else {
    const end = nearestOn(seg.ivcFull, back[back.length - 1]);
    seg[`ovary-${side}-to-heart`] = [...back.slice(0, -1), ...ivcFrom(end)];
  }
  offModel[`ovary-${side}-to-heart`] = side === 'left' ? 'The left ovarian vein (not in the model) drains into the left renal vein.' : 'The right ovarian vein (not in the model) drains into the inferior vena cava.';
}
// Back to the heart.
{
  const rijv = vessel('internal-jugular-vein-right', V([0, 1, 0]).add(cen('internal-jugular-vein-right')));
  const rbcv = vessel('brachiocephalic-vein-right', rijv[rijv.length - 1]);
  seg['jugular-to-heart'] = [...rijv, ...rbcv, ...seg.svc];
  const jTop = rijv[0];
  const viaSinus = (p, back) => chaikin([p, p.clone().add(V([-0.018, -0.004, back])), V([jTop.x - 0.006, jTop.y + 0.05, jTop.z - 0.01]), jTop], 2);
  seg['pituitary-to-heart'] = [...viaSinus(cen('pituitary-anterior'), -0.012).slice(0, -1), ...seg['jugular-to-heart']];
  offModel['pituitary-to-heart'] = 'The cavernous and petrosal sinuses and the upper internal jugular vein are not in the model.';
  seg['pineal-to-heart'] = [...viaSinus(cen('pineal-gland'), -0.03).slice(0, -1), ...seg['jugular-to-heart']];
  offModel['pineal-to-heart'] = 'The great cerebral vein, the straight and transverse sinuses and the upper internal jugular vein are not in the model.';
  seg['hypothalamus-to-heart'] = [...viaSinus(cen('hypothalamus'), -0.015).slice(0, -1), ...seg['jugular-to-heart']];
  const lbcv = vessel('brachiocephalic-vein-left', V([0.05, 0, 0]).add(cen('brachiocephalic-vein-left')));
  const lobeL = cen('thyroid-lobe-left');
  const entry = nearestOn(lbcv, lobeL);
  const k = lbcv.indexOf(entry);
  seg['thyroid-to-heart'] = [lobeL, lobeL.clone().lerp(entry, 0.5).add(V([0, 0, 0.004])), ...lbcv.slice(k), ...seg.svc];
  offModel['thyroid-to-heart'] = 'The inferior thyroid veins, which drain into the brachiocephalic veins, are not in the model.';
  seg['parathyroids-to-heart'] = [V(parathyroid['superior-left']), V(parathyroid['inferior-left']), ...seg['thyroid-to-heart'].slice(1)];
  const thy = cen('thymus-left');
  const e2 = nearestOn(lbcv, thy);
  seg['thymus-to-heart'] = [thy, ...lbcv.slice(lbcv.indexOf(e2)), ...seg.svc];
}
for (const side of ['left', 'right']) {
  const srv = vessel(`suprarenal-vein-${side}`, cen(`adrenal-cortex-${side}`));
  const start = cen(`adrenal-cortex-${side}`);
  if (side === 'left') {
    const lrv = vessel('renal-vein-left', cen('kidney-left'));
    const entry = nearestOn(lrv, srv[srv.length - 1]);
    seg['adrenal-left-to-heart'] = [start, ...srv, ...lrv.slice(lrv.indexOf(entry)), ...ivcFrom(lrv[lrv.length - 1])];
  } else {
    seg['adrenal-right-to-heart'] = [start, ...srv, ...ivcFrom(srv[srv.length - 1])];
  }
  const rv = vessel(`renal-vein-${side}`, cen(`kidney-${side}`));
  seg[`kidney-${side}-to-heart`] = [cen(`kidney-${side}`), ...rv, ...ivcFrom(rv[rv.length - 1])];
}
{
  // Pancreas, stomach and duodenum → portal vein → liver → hepatic veins → vena cava.
  const pv = vessel('hepatic-portal-vein', cen('splenic-vein'));
  const sv = vessel('splenic-vein', cen('pancreas-tail'), pv[0]);
  const hv = cen('hepatic-veins');
  const [hvLow] = endsOf('hepatic-veins', pv[pv.length - 1]);
  const liverPath = [...pv, cen('liver').clone().lerp(hv, 0.4), hvLow, hv];
  const toIvc = ivcFrom(hv);
  seg['pancreas-to-heart'] = [cen('pancreas-tail'), ...sv, ...liverPath, ...toIvc];
  seg['pancreas-to-liver'] = [cen('pancreas-tail'), ...sv, ...pv, cen('liver')];
  seg['liver-to-heart'] = [cen('liver'), hv, ...toIvc];
  seg['stomach-to-heart'] = [cen('stomach'), cen('stomach').clone().lerp(pv[0], 0.5), ...liverPath, ...toIvc];
  seg['duodenum-to-heart'] = [cen('duodenum'), cen('duodenum').clone().lerp(pv[0], 0.5), ...liverPath, ...toIvc];
  for (const k of ['pancreas-to-heart', 'stomach-to-heart', 'duodenum-to-heart']) offModel[k] = 'The blood passes through the liver’s sinusoids (not in the model) before the hepatic veins take it to the vena cava.';
  seg['heart-to-heart'] = [RA];
}
// Inside the head: the hypophyseal portal veins (hypothalamus → stalk → anterior lobe) and the axons
// of the hypothalamic neurons (→ posterior lobe).
{
  const st = byId.get('infundibulum');
  const top = highest(st), bottom = lowest(st);
  seg['portal-hypophyseal'] = [cen('hypothalamus'), top, top.clone().lerp(bottom, 0.5), bottom.clone().lerp(cen('pituitary-anterior'), 0.5), cen('pituitary-anterior')];
  seg['hypothalamus-to-posterior'] = [cen('hypothalamus'), top, bottom, cen('pituitary-posterior')];
}
delete seg.ivcFull; delete seg.svc; delete seg['heart-to-heart'];
const routes = { segments: Object.fromEntries(Object.entries(seg).map(([k, pts]) => [k, arr(resample(chaikin(pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 1e-5), 1), 0.002))])), offModel };
const routeLengthsMm = Object.fromEntries(Object.entries(routes.segments).map(([k, p]) => [k, r6(polyLength(p.map((q) => V(q))) * 1000)]));

// ── Geometry facts ──────────────────────────────────────────────────────────
const geometry = {};
const sideErrors = [];
for (const m of meshes) {
  const s = m.structure;
  const [lo, hi] = bboxOf(m.positions);
  const c = centroid(m.positions);
  const bodyX = c[0] + centre[0];
  if (s.sideCheck !== false) {
    if (s.side === 'right' && !(bodyX < 0)) sideErrors.push(`${s.id} claims right but body x = ${bodyX.toFixed(4)}`);
    if (s.side === 'left' && !(bodyX > 0)) sideErrors.push(`${s.id} claims left but body x = ${bodyX.toFixed(4)}`);
  }
  let nearest = 0, nearestD = Infinity;
  for (let i = 0; i < m.positions.length; i += 3) {
    const d = Math.hypot(m.positions[i] - c[0], m.positions[i + 1] - c[1], m.positions[i + 2] - c[2]);
    if (d < nearestD) { nearestD = d; nearest = i; }
  }
  geometry[s.id] = {
    layer: s.layer, side: s.side,
    bounds: [lo.map(r6), hi.map(r6)],
    centroid: c.map(r6),
    surfaceAnchor: [m.positions[nearest], m.positions[nearest + 1], m.positions[nearest + 2]].map(r6),
    vertexCount: m.positions.length / 3,
    triangleCount: m.indices.length / 3,
  };
}
if (sideErrors.length) throw new Error(`Side checks failed:\n${sideErrors.join('\n')}`);
geometry.$routes = routes;
geometry.$measures = measures;
const g = (id) => geometry[id];
const C = (id) => g(id).centroid;
const checks = {
  pituitaryBelowHypothalamus: C('pituitary-anterior')[1] < C('hypothalamus')[1] && C('pituitary-posterior')[1] < C('hypothalamus')[1],
  pituitaryInSella: C('pituitary-anterior')[1] > C('sphenoid-bone')[1] && Math.abs(C('pituitary-anterior')[0]) < 0.006,
  anteriorLobeInFront: C('pituitary-anterior')[2] > C('pituitary-posterior')[2],
  pinealBehindThalamus: C('pineal-gland')[2] < (C('thalamus-left')[2] + C('thalamus-right')[2]) / 2,
  thyroidInFrontOfTrachea: C('thyroid-isthmus')[2] > airwayAt(C('thyroid-isthmus')[1]).c.z,
  thyroidLobesBesideTrachea: (() => { const x = airwayAt(C('thyroid-isthmus')[1]).c.x; return C('thyroid-lobe-left')[0] > x + 0.008 && C('thyroid-lobe-right')[0] < x - 0.008; })(),
  thyroidBelowCricoidAboveSternum: C('thyroid-isthmus')[1] < yC && C('thyroid-isthmus')[1] > g('sternum').bounds[1][1],
  // The larynx of this body lies about 9 mm right of the midline, so the parathyroids sides are checked against the airway.
  parathyroidSides: ['superior', 'inferior'].every((p) => C(`parathyroid-${p}-left`)[0] > airwayAt(C(`parathyroid-${p}-left`)[1]).c.x && C(`parathyroid-${p}-right`)[0] < airwayAt(C(`parathyroid-${p}-right`)[1]).c.x),
  parathyroidsBehindThyroid: ['left', 'right'].every((s) => ['superior', 'inferior'].every((p) => C(`parathyroid-${p}-${s}`)[2] < C(`thyroid-lobe-${s}`)[2])),
  thymusBehindSternum: C('thymus-left')[2] < C('sternum')[2] && C('thymus-left')[1] < C('thyroid-isthmus')[1],
  adrenalsAboveKidneys: C('adrenal-cortex-left')[1] > C('kidney-left')[1] && C('adrenal-cortex-right')[1] > C('kidney-right')[1],
  medullaInsideCortex: ['left', 'right'].every((s) => measures.adrenal[s].medullaShare > 0.04 && measures.adrenal[s].medullaShare < 0.25),
  pancreasHeadInDuodenalCurve: (() => { const d = centroid(part('VH_F_duodenum_descending').positions); return d[0] < C('pancreas-head')[0] && C('pancreas-head')[0] < C('pancreas-tail')[0]; })(),
  ovariesInPelvis: C('ovary-left')[1] < vertebraLevels.find((v) => v.name === 'L6').y && C('ovary-right')[1] < vertebraLevels.find((v) => v.name === 'L6').y,
  routesEndInTheHeart: Object.entries(routes.segments).filter(([k]) => k.endsWith('-to-heart')).every(([, p]) => V(p[p.length - 1]).distanceTo(RA) < 0.003),
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
if (failed.length) throw new Error(`Orientation checks failed: ${failed.join(', ')}\n${JSON.stringify(measures)}`);

// ── Write ───────────────────────────────────────────────────────────────────
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('endocrine');
for (const m of meshes) {
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(m.positions).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(m.normals).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(m.positions.length / 3 < 65536 ? Uint16Array.from(m.indices) : m.indices).setBuffer(buffer));
  const s = m.structure;
  scene.addChild(doc.createNode(s.id).setMesh(doc.createMesh(s.id).addPrimitive(prim)).setExtras({
    layer: s.layer,
    source: s.generated ? 'modelled' : s.bp3d ? 'bodyparts3d' : 'hra-united-female',
    nodes: [...(s.united ?? []), ...(s.bp3d ?? [])],
  }));
}
doc.getRoot().getAsset().generator = 'endocrine-anatomy-lab tools/extract-endocrine.mjs';
doc.getRoot().getAsset().copyright = 'HuBMAP HRA 3D reference organs (Browne, Schlehlein et al.), CC BY 4.0; BodyParts3D (DBCLS), CC BY 4.0; thyroid, parathyroids, pituitary stalk and adrenal medulla modelled';
const outGlb = path.join(root, 'public/models/endocrine.glb');
fs.mkdirSync(path.dirname(outGlb), { recursive: true });
const glb = await new NodeIO().writeBinary(doc);
fs.writeFileSync(outGlb, glb);

const commit = (dir) => { try { return execFileSync('git', ['-C', path.resolve(dir, '../..'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; } };
const genDir = path.join(root, 'src/endocrine/generated');
fs.mkdirSync(genDir, { recursive: true });
fs.writeFileSync(path.join(genDir, 'geometry.json'), JSON.stringify({ units: 'metres', axes: { x: "patient's left", y: 'superior', z: 'anterior' }, structures: geometry }, null, 1) + '\n');
const triangles = meshes.reduce((n, m) => n + m.indices.length / 3, 0);
fs.writeFileSync(path.join(genDir, 'provenance.json'), JSON.stringify({
  output: { file: 'public/models/endocrine.glb', bytes: glb.byteLength, sha256: sha256(glb), triangles, sourceTriangles },
  sources: {
    united: {
      name: '3D Reference Organ Set for Female v1.5 (HuBMAP HRA united female), as converted by Female Atlas',
      creators: 'Kristen Browne, Heidi Schlehlein', doi: 'https://doi.org/10.48539/HBM352.BTSQ.586', license: 'CC-BY-4.0',
      intermediate: 'github.com/Niyaz-05/female-atlas, commit ' + commit(femaleDir),
      atlasJsonSha256: sha256(female.bytes), chunkSha256: female.hashes,
      transformReversed: `y - ${SHIFT} m`,
    },
    bodyparts3d: {
      name: 'BodyParts3D 4.0 (Database Center for Life Science), via the Human Atlas build', license: 'CC-BY-4.0',
      intermediate: 'github.com/Niyaz-05/human-atlas, commit ' + commit(humanDir),
      atlasJsonSha256: sha256(human.bytes), chunkSha256: human.hashes,
      parts: bp3dParts,
      registration: { method: 'similarity (rotation, uniform scale, shift): Horn quaternion method on landmark centroids; kidney fits refined by ICP onto the HRA kidney capsule', fits: Object.fromEntries(Object.entries(fits).map(([k, f]) => [k, { usedFor: spec.structures.filter((x) => x.bp3d && x.fit === k).map((x) => x.id), scale: f.scale, rotationDeg: f.rotationDeg, rmsResidualMm: f.rmsResidualMm, surfaceRmsMm: f.surfaceRmsMm, residuals: f.residuals }])) },
      verticesInsideTargetsPct: overlap,
      pituitarySplit: splits,
    },
    modelled: {
      'thyroid-lobe-left/right, thyroid-isthmus': 'Generated: no open scanned thyroid exists (BodyParts3D 3.0 and 4.0 and the 81 HRA reference organs have none). Lobes about 50 mm high and 20 mm wide and deep, from the level of the thyroid cartilage to the 5th–6th tracheal ring; the isthmus over tracheal rings 2–4; both pushed onto the HRA trachea and larynx so they wrap the real airway (Gray’s Anatomy, 42nd ed.).',
      'parathyroid-*': 'Generated ellipsoids, 6 × 4 × 2 mm, on the back of each lobe: superior at the cricoid, inferior near the lower pole.',
      infundibulum: 'Generated tube, about 3 mm wide, from the base of the HRA hypothalamus to the top of the placed pituitary.',
      'adrenal-medulla-*': 'Generated inner surface of the placed BodyParts3D adrenal gland (each vertex moved 45 % of the way to the opposite wall, then towards the centre), about a tenth of the gland.',
      'pituitary-anterior/posterior': 'The BodyParts3D pituitary cut by a frontal plane so the front 75 % of its volume is the anterior lobe.',
    },
  },
  changesHere: `Selected and merged the source meshes in src/endocrine/source/structures.source.json; welded coincident vertices; simplified the large HRA meshes with meshoptimizer within the relative error bounds given there (largest error used: ${(maxError * 100).toFixed(3)} %); subdivided and smoothed the small parts; recomputed smooth normals; placed the BodyParts3D parts onto the HRA body; pushed the adrenal glands and stomach out of the organs they overlapped; split the pituitary; generated the thyroid, parathyroids, pituitary stalk and adrenal medulla; traced the hormone routes; translated so the middle of the glands is the origin.`,
  centreOffsetMetres: centre.map(r6),
  measures,
  orientationChecks: checks,
  routeLengthsMm,
  structures: spec.structures.map((s) => ({ id: s.id, united: s.united, bp3d: s.bp3d, generated: s.generated })),
}, null, 1) + '\n');

console.log(JSON.stringify({ structures: meshes.length, sourceTriangles, triangles, bytes: glb.byteLength, maxErrorPct: r6(maxError * 100), registration: Object.fromEntries(Object.entries(fits).map(([k, f]) => [k, { scale: f.scale, rotationDeg: f.rotationDeg, rmsMm: f.rmsResidualMm, surfaceRmsMm: f.surfaceRmsMm }])), overlap, splits, measures, routeLengthsMm, checks }, null, 1));
