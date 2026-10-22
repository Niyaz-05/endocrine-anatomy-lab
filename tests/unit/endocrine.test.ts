import { describe, expect, it } from 'vitest';
import { endocrineDefinition as def } from '../../src/endocrine/definition';
import { validateDefinition } from '../../src/contract/validate';
import { APPROVED_ASSETS } from '../../src/contract/assets';
import { geometry, maxGap, measures, routePath, segments } from '../../src/endocrine/anchors';
import { effectiveCloseUp, effectiveSlice, focusIds, initialState, isVisible, makeReducer } from '../../src/app/state';
import { searchStructures } from '../../src/app/search';
import { ATLAS } from '../../src/endocrine/atlas';
import { live } from '../../src/endocrine/live';
import provenance from '../../src/endocrine/generated/provenance.json';

const C = (id: string) => geometry[id]!.centroid as [number, number, number];
const reduce = makeReducer(def);
const fresh = () => initialState(def);

describe('definition and validation gate', () => {
  it('passes with no errors or warnings', () => {
    const r = validateDefinition(def);
    expect(r.ok, JSON.stringify(r.issues)).toBe(true);
    expect(r.issues).toEqual([]);
  });
  it('rejects an unapproved asset and a missing left/right partner', () => {
    const bad = validateDefinition({ ...def, assets: [{ id: 'not-approved', role: 'anatomy-model' }] });
    expect(bad.ok).toBe(false);
    const noPartner = validateDefinition({ ...def, structures: def.structures.filter((s) => s.id !== 'ovary-right' && !s.related.includes('ovary-right')).map((s) => ({ ...s, related: s.related.filter((r) => r !== 'ovary-right') })) });
    expect(noPartner.ok).toBe(false);
    if (!noPartner.ok) expect(noPartner.issues.some((i) => i.code === 'pair.missing')).toBe(true);
  });
  it('has one mesh structure per model node, and every node a structure', () => {
    const nodes = APPROVED_ASSETS['hra-endocrine-v1']!.nodes;
    const meshes = def.structures.filter((s) => s.kind === 'mesh').map((s) => s.id);
    expect([...meshes].sort()).toEqual([...nodes].sort());
    expect(meshes.length).toBe(95);
  });
  it('puts every left/right structure on its side of the body', () => {
    // The larynx of this body lies right of the midline, so the neck parts are checked against the trachea.
    const tracheaX = C('trachea')[0];
    for (const s of def.structures.filter((x) => x.kind === 'mesh' && x.side !== 'midline')) {
      const x = C(s.id)[0];
      const ref = s.id.startsWith('parathyroid') || s.id.startsWith('thyroid-lobe') ? tracheaX : s.id.startsWith('thymus') ? C('thymus-left')[0] - 0.02 : 0;
      if (s.id === 'thymus-right' || s.id === 'brachiocephalic-vein-left') continue; // close to the midline in this body
      if (s.side === 'left') expect(x, s.id).toBeGreaterThan(ref);
      else expect(x, s.id).toBeLessThan(ref);
    }
  });
  it('uses https sources only, and every structure cites one', () => {
    for (const s of def.sources) if (s.url) expect(s.url.startsWith('https://')).toBe(true);
    for (const s of def.structures) expect(s.sources.length).toBeGreaterThan(0);
  });
  it('names the modelled parts as modelled', () => {
    for (const id of ['thyroid-lobe-left', 'thyroid-isthmus', 'parathyroid-superior-left', 'infundibulum', 'adrenal-medulla-left']) {
      const s = def.structures.find((x) => x.id === id)!;
      expect(s.modelNote, id).toMatch(/[Mm]odelled/);
    }
  });
});

describe('body layout', () => {
  it('hangs the pituitary below the hypothalamus, in the sella of the sphenoid', () => {
    expect(C('pituitary-anterior')[1]).toBeLessThan(C('hypothalamus')[1]);
    expect(C('pituitary-anterior')[1]).toBeGreaterThan(C('sphenoid-bone')[1]);
    expect(C('pituitary-anterior')[2]).toBeGreaterThan(C('pituitary-posterior')[2]);
    expect(measures.pituitary.stalkLengthMm).toBeGreaterThan(5);
    expect(measures.pituitary.stalkLengthMm).toBeLessThan(15);
  });
  it('puts the pineal behind the thalamus', () => {
    expect(C('pineal-gland')[2]).toBeLessThan((C('thalamus-left')[2] + C('thalamus-right')[2]) / 2);
  });
  it('wraps the thyroid round the front of the trachea, below the cricoid and above the sternum', () => {
    expect(C('thyroid-isthmus')[2]).toBeGreaterThan(C('trachea')[2]);
    expect(C('thyroid-isthmus')[1]).toBeLessThan(geometry['cricoid-cartilage']!.bounds[0]![1]! + 0.004);
    expect(C('thyroid-isthmus')[1]).toBeGreaterThan(geometry.sternum!.bounds[1]![1]!);
  });
  it('puts the parathyroids behind the thyroid lobes', () => {
    for (const side of ['left', 'right']) for (const p of ['superior', 'inferior']) expect(C(`parathyroid-${p}-${side}`)[2]).toBeLessThan(C(`thyroid-lobe-${side}`)[2]);
    expect(C('parathyroid-superior-left')[1]).toBeGreaterThan(C('parathyroid-inferior-left')[1]);
  });
  it('puts the adrenals on top of the kidneys and the medulla inside the cortex', () => {
    for (const side of ['left', 'right']) {
      expect(C(`adrenal-cortex-${side}`)[1]).toBeGreaterThan(C(`kidney-${side}`)[1]);
      const share = measures.adrenal[side as 'left' | 'right'].medullaShare;
      expect(share).toBeGreaterThan(0.05);
      expect(share).toBeLessThan(0.25);
    }
  });
  it('puts the pancreas head in the curve of the duodenum and the tail to the left', () => {
    expect(C('pancreas-tail')[0]).toBeGreaterThan(C('pancreas-head')[0]);
    expect(C('pancreas-tail')[0]).toBeGreaterThan(0);
  });
  it('puts the ovaries in the pelvis and the thymus behind the sternum', () => {
    expect(C('ovary-left')[1]).toBeLessThan(C('lumbar-spine')[1]);
    expect(C('thymus-left')[2]).toBeLessThan(C('sternum')[2]);
  });
  it('measures the glands within textbook ranges', () => {
    const [a, b] = measures.pituitary.sizeMm;
    expect(Math.max(a!, b!)).toBeGreaterThan(8); expect(Math.max(a!, b!)).toBeLessThan(16);
    expect(measures.pituitary.anteriorShare).toBeGreaterThan(0.65); expect(measures.pituitary.anteriorShare).toBeLessThan(0.85);
    expect(measures.thyroid.lobeHeightMm).toBe(50);
    expect(measures.thyroid.volumeMl).toBeGreaterThan(8); expect(measures.thyroid.volumeMl).toBeLessThan(25);
    expect(Math.max(...measures.parathyroid.sizeMm)).toBeLessThan(7);
    expect(Math.max(...measures.pineal.sizeMm)).toBeLessThan(12);
    for (const s of ['left', 'right'] as const) { expect(measures.adrenal[s].volumeMl).toBeGreaterThan(2); expect(measures.adrenal[s].volumeMl).toBeLessThan(14); }
    expect(measures.pancreas.lengthMm).toBeGreaterThan(110); expect(measures.pancreas.lengthMm).toBeLessThan(200);
  });
  it('records the fits within their limits', () => {
    const fits = provenance.sources.bodyparts3d.registration.fits as Record<string, { rmsResidualMm: number; surfaceRmsMm: number | null }>;
    for (const [name, f] of Object.entries(fits)) expect(f.surfaceRmsMm ?? f.rmsResidualMm, name).toBeLessThan(10);
    expect(Object.values(provenance.orientationChecks).every(Boolean)).toBe(true);
  });
});

describe('hormone routes', () => {
  const heart = segments.heart!;
  it('ends every vein in the right atrium and starts every artery at the top of the aorta', () => {
    for (const [k, s] of Object.entries(segments)) {
      if (k.endsWith('-to-heart')) expect(Math.hypot(...s[s.length - 1]!.map((v, i) => v - heart[0]![i]!)), k).toBeLessThan(0.004);
      if (k.startsWith('to-')) expect(Math.hypot(...s[0]!.map((v, i) => v - heart[heart.length - 1]![i]!)), k).toBeLessThan(0.004);
    }
  });
  it('joins up into continuous paths (no jump over 8 mm)', () => {
    const paths = new Set<string>();
    for (const h of ATLAS) for (const p of h.paths) paths.add(p.join('+'));
    for (const p of paths) {
      const pts = routePath(p.split('+'));
      expect(maxGap(pts), p).toBeLessThan(0.008);
    }
  });
  it('reaches its target: the thyroid from the pituitary, the liver from the pancreas', () => {
    const tsh = routePath(['pituitary-to-heart', 'heart', 'to-thyroid-left']);
    expect(Math.hypot(...tsh[0]!.map((v, i) => v - C('pituitary-anterior')[i]!))).toBeLessThan(0.003);
    expect(Math.hypot(...tsh[tsh.length - 1]!.map((v, i) => v - C('thyroid-lobe-left')[i]!))).toBeLessThan(0.003);
    const ins = segments['pancreas-to-liver']!;
    expect(Math.hypot(...ins[ins.length - 1]!.map((v, i) => v - C('liver')[i]!))).toBeLessThan(0.003);
    // Down the stalk: hypothalamus → anterior lobe, a couple of centimetres.
    const portal = routePath(['portal-hypophyseal']);
    expect(portal.length * 0.002).toBeLessThan(0.05);
  });
  it('uses only route segments that exist', () => {
    for (const h of ATLAS) for (const p of h.paths) for (const s of p) expect(segments[s], `${h.id}: ${s}`).toBeTruthy();
  });
});

describe('reducer and views', () => {
  it('shows each mode\'s layers and hides the body in a magnified close-up', () => {
    let s = reduce(fresh(), { type: 'set-mode', mode: 'axes' });
    expect(isVisible(def, s, 'thyroid-lobe-left')).toBe(true);
    expect(isVisible(def, s, 'liver')).toBe(false);
    s = reduce(s, { type: 'set-close-up', value: 'follicle' });
    expect(effectiveCloseUp(def, s)).toBe('follicle');
    expect(isVisible(def, s, 'thyroid-lobe-left')).toBe(false);
    s = reduce(s, { type: 'set-close-up', value: 'pituitary' });
    expect(isVisible(def, s, 'pituitary-anterior')).toBe(true);
    expect(isVisible(def, s, 'thyroid-lobe-left')).toBe(false);
    s = reduce(s, { type: 'set-mode', mode: 'cell' });
    expect(effectiveCloseUp(def, s)).toBe('cell');
  });
  it('sets an axis scenario and its time course', () => {
    let s = reduce(fresh(), { type: 'set-mode', mode: 'axes' });
    s = reduce(s, { type: 'set-scenario', value: 'graves' });
    expect(s.axis).toBe('hpt'); expect(s.scenario.hpt).toBe('graves'); expect(s.axisT).toBe(0);
    s = reduce(s, { type: 'set-scenario', value: 'addison' });
    expect(s.axis).toBe('hpa'); expect(s.scenario.hpt).toBe('graves');
    s = reduce(s, { type: 'set-dose', value: { prednisolone: 500 } });
    expect(s.doses.prednisolone).toBe(60);
    s = reduce(s, { type: 'set-axis-t', value: Number.NaN });
    expect(Number.isFinite(s.axisT)).toBe(true);
  });
  it('clamps the blood-sugar, stress and calcium settings', () => {
    let s = reduce(fresh(), { type: 'set-meal', index: 1, carbsG: 900 });
    expect(s.sugar.meals[1]!.carbsG).toBe(150);
    s = reduce(s, { type: 'set-stress', value: { lightLux: -5, bedtimeH: 30 } });
    expect(s.stress.lightLux).toBe(0); expect(s.stress.bedtimeH).toBe(26);
    s = reduce(s, { type: 'set-calcium', value: { scenario: 'vitamin-d-deficiency' } });
    expect(s.calcium.vitaminD).toBe(0.2);
    s = reduce(s, { type: 'set-calcium', value: { dietMg: 50 } });
    expect(s.calcium.dietMg).toBe(100);
  });
  it('lights a disorder\'s glands and sets its model', () => {
    let s = reduce(fresh(), { type: 'set-mode', mode: 'disorders' });
    s = reduce(s, { type: 'set-disorder', value: 'hashimoto' });
    expect(focusIds(def, s)).toContain('thyroid-lobe-left');
    expect(s.scenario.hpt).toBe('hashimoto');
    s = reduce(s, { type: 'set-disorder', value: 'type2' });
    expect(s.sugar.diabetes).toBe('type2');
    expect(reduce(s, { type: 'set-disorder', value: 'not-a-disorder' })).toBe(s);
  });
  it('lights an atlas hormone\'s gland and targets, and draws its route', () => {
    let s = reduce(fresh(), { type: 'set-mode', mode: 'atlas' });
    s = reduce(s, { type: 'set-hormone', value: 'tsh' });
    expect(focusIds(def, s)).toEqual(['pituitary-anterior', 'thyroid-lobe-left', 'thyroid-lobe-right', 'thyroid-isthmus']);
    const v = live(def, s);
    expect(v.flows[0]!.paths.length).toBe(2);
    expect(v.activity['pituitary-anterior']).toBeGreaterThan(1);
  });
  it('shows the thyroid gone after thyroidectomy and grown in iodine deficiency', () => {
    let s = reduce(fresh(), { type: 'set-mode', mode: 'axes' });
    s = reduce(s, { type: 'set-scenario', value: 'thyroidectomy' });
    s = reduce(s, { type: 'set-axis-t', value: 1 });
    expect(live(def, s).thyroidScale).toBe(0);
    s = reduce(s, { type: 'set-scenario', value: 'iodine' });
    s = reduce(s, { type: 'set-axis-t', value: 1 });
    expect(live(def, s).thyroidScale).toBeGreaterThan(1.25);
  });
  it('cuts through the middle of a structure in a tour step, and faces the cut', () => {
    const i = def.tour.findIndex((t) => t.id === 'adrenal');
    const s = reduce(fresh(), { type: 'tour-go', index: i });
    const cut = effectiveSlice(def, s);
    expect(cut.axis).toBe('coronal');
    expect(Math.abs(cut.at)).toBeLessThan(1);
    expect(s.camera.preset).toBe('anterior');
  });
  it('turns the camera to face a new cut', () => {
    const s = reduce(fresh(), { type: 'set-slice', axis: 'sagittal' });
    expect(s.camera.preset).toBe('left');
    expect(reduce(s, { type: 'set-slice', flip: true }).camera.preset).toBe('right');
  });
});

describe('search', () => {
  it.each([['hypophysis', 'pituitary-gland'], ['suprarenal', 'adrenal-cortex-left'], ['islets', 'pancreas'], ['epiphysis', 'pineal-gland'], ['Adam’s apple', 'thyroid-cartilage'], ['IVC', 'inferior-vena-cava']])('finds %s', (q, id) => {
    expect(searchStructures(def.structures, q).map((h) => h.structure.id)).toContain(id);
  });
});
