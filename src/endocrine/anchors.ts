import geometryJson from './generated/geometry.json';
import type { CloseUp, Mode, SimulationDefinition } from '../contract/schema';
import { MODE_LAYERS } from '../app/modes';

export type Vec3 = [number, number, number];
type Side = 'left' | 'right';

interface G { centroid: number[]; bounds: number[][]; surfaceAnchor?: number[]; side: string; layer: string }
export interface Measures {
  pituitary: { sizeMm: number[]; volumeMl: number; anteriorShare: number; stalkLengthMm: number };
  pineal: { sizeMm: number[] };
  hypothalamus: { sizeMm: number[] };
  thyroid: { lobeSizeMm: Record<Side, number[]>; lobeHeightMm: number; isthmusSizeMm: number[]; volumeMl: number; isthmusLevel: string; isthmusRings: number[]; cricoidLowerBorderLevel: string };
  parathyroid: { sizeMm: number[]; centres: Record<string, number[]> };
  adrenal: Record<Side, { sizeMm: number[]; volumeMl: number; medullaMl: number; medullaShare: number }>;
  pancreas: { lengthMm: number; level: string };
  ovary: Record<Side, number[]>;
  thymus: { sizeMm: number[] };
  levels: Record<string, string | null>;
}

const raw = geometryJson.structures as unknown as Record<string, unknown>;
export const geometry = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('$'))) as Record<string, G>;
const R = raw.$routes as { segments: Record<string, number[][]>; offModel: Record<string, string> };
export const segments = R.segments;
export const offModelNotes = R.offModel;
export const measures = raw.$measures as Measures;

export const vec = (p: readonly number[]): Vec3 => [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

/** One continuous path from a list of route segments (each starts where the last ended). */
export function routePath(names: readonly string[]): number[][] {
  const out: number[][] = [];
  for (const n of names) {
    const s = segments[n];
    if (!s) throw new Error(`unknown route segment "${n}"`);
    const start = out.length && dist(out[out.length - 1]!, s[0]!) < 1e-4 ? 1 : 0;
    out.push(...s.slice(start));
  }
  return out;
}
/** The largest jump between consecutive points of a path, in metres. */
export const maxGap = (pts: readonly (readonly number[])[]) => pts.slice(1).reduce((m, p, i) => Math.max(m, dist(p, pts[i]!)), 0);

/** A point to hang a label on: on the structure's surface, or the middle of a group. */
export function anchorOf(def: SimulationDefinition, id: string): Vec3 | null {
  const g = geometry[id];
  if (g) return vec(g.surfaceAnchor ?? g.centroid);
  const s = def.structures.find((x) => x.id === id);
  if (s?.kind === 'group' && s.members) {
    const pts = s.members.map((m) => anchorOf(def, m)).filter((p): p is Vec3 => p !== null);
    if (!pts.length) return null;
    return [0, 1, 2].map((a) => pts.reduce((n, p) => n + p[a]!, 0) / pts.length) as Vec3;
  }
  return null;
}
export const centroidOf = (id: string): Vec3 => vec(geometry[id]!.centroid);

/** Axis-aligned bounds of a set of structures (groups expand to their members). */
export function boundsOfIds(def: SimulationDefinition, ids: readonly string[]): [Vec3, Vec3] | null {
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  const visit = (id: string) => {
    const g = geometry[id];
    if (g) {
      for (let a = 0; a < 3; a++) {
        lo[a] = Math.min(lo[a]!, g.bounds[0]![a]!);
        hi[a] = Math.max(hi[a]!, g.bounds[1]![a]!);
      }
      return;
    }
    def.structures.find((x) => x.id === id)?.members?.forEach(visit);
  };
  ids.forEach(visit);
  return Number.isFinite(lo[0]) ? [lo, hi] : null;
}

export const GLANDS = ['hypothalamus', 'pituitary-anterior', 'pituitary-posterior', 'pineal-gland', 'thyroid-lobe-left', 'thyroid-lobe-right', 'thymus-left', 'thymus-right', 'adrenal-cortex-left', 'adrenal-cortex-right', 'pancreas-head', 'pancreas-tail', 'ovary-left', 'ovary-right'];

/** The parts each mode frames by default. */
const HOME: Partial<Record<Mode, readonly string[]>> = {
  explore: [...GLANDS, 'cerebrum-left', 'cerebrum-right'],
  axes: [...GLANDS, 'cerebrum-left', 'cerebrum-right'],
  sugar: ['pancreas-head', 'pancreas-tail', 'liver', 'duodenum', 'stomach', 'heart-ventricles'],
  stress: ['hypothalamus', 'pineal-gland', 'adrenal-cortex-left', 'adrenal-cortex-right', 'heart-atria', 'kidney-left', 'kidney-right'],
  calcium: ['parathyroid-superior-left', 'thyroid-lobe-left', 'thyroid-lobe-right', 'kidney-left', 'kidney-right', 'duodenum', 'lumbar-spine'],
  disorders: [...GLANDS, 'cerebrum-left', 'cerebrum-right'],
  atlas: [...GLANDS, 'cerebrum-left', 'cerebrum-right'],
};

/** Bounds of the default view for a mode. */
export function homeBounds(def: SimulationDefinition, mode: Mode = 'explore'): [Vec3, Vec3] {
  const ids = HOME[mode] ?? HOME.explore!;
  return boundsOfIds(def, ids) ?? [[-0.15, -0.45, -0.1], [0.15, 0.45, 0.1]];
}

/** Bounds of everything shown in a mode (used to place the cut). */
export function modeBounds(def: SimulationDefinition, mode: Mode): [Vec3, Vec3] {
  const layers = mode === 'explore' || mode === 'tour' ? null : MODE_LAYERS[mode];
  const ids = def.structures.filter((s) => s.kind === 'mesh' && (layers ? layers.includes(s.layer) : !['neighbours', 'skeleton'].includes(s.layer))).map((s) => s.id);
  return boundsOfIds(def, ids) ?? homeBounds(def, mode);
}

/** Slice position (−1 … 1 across `bounds` on an axis) for a world coordinate. */
export function sliceAt(bounds: [Vec3, Vec3], axis: 0 | 1 | 2, world: number): number {
  const mid = (bounds[0][axis] + bounds[1][axis]) / 2, half = (bounds[1][axis] - bounds[0][axis]) / 2;
  return half > 0 ? Math.max(-1, Math.min(1, (world - mid) / half)) : 0;
}
/** The world coordinate of a slice position. */
export function sliceWorld(bounds: [Vec3, Vec3], axis: 0 | 1 | 2, at: number): number {
  const mid = (bounds[0][axis] + bounds[1][axis]) / 2, half = (bounds[1][axis] - bounds[0][axis]) / 2;
  return mid + at * half;
}

/**
 * Where each close-up sits and how large it is (radius, metres). The pituitary close-up is at real
 * size around the real gland; the others are magnified scenes drawn where their gland is.
 */
export function closeUpFrame(id: CloseUp): { centre: Vec3; radius: number; magnified: number } {
  const mid = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  switch (id) {
    case 'pituitary': return { centre: mid(centroidOf('hypothalamus'), centroidOf('pituitary-anterior')), radius: 0.016, magnified: 1 };
    case 'follicle': return { centre: centroidOf('thyroid-lobe-left'), radius: 0.013, magnified: 60 };
    case 'islet': return { centre: centroidOf('pancreas-tail'), radius: 0.013, magnified: 80 };
    case 'adrenal': return { centre: centroidOf('adrenal-cortex-left'), radius: 0.016, magnified: 12 };
    case 'cell': return { centre: centroidOf('liver'), radius: 0.024, magnified: 1000 };
  }
}
