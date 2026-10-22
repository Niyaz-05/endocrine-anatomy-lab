import { describe, expect, it } from 'vitest';
import { HPA_NORMAL, HPG_NORMAL, HPT_NORMAL, REF, SCENARIOS, hpaCourse, hpgCourse, hptCourse, hptSteady, scenarioById } from '../../src/endocrine/axes';
import { NORMAL_DAY, dayStats, fastingCategory, hba1cCategory, hba1cFromMean, ifcc, meanFromHba1c, ogtt, simulateDay, toMmol, twoHourCategory } from '../../src/endocrine/glucose';
import { cortisolClock, fightOrFlight, melatonin, suppression } from '../../src/endocrine/stress';
import { CALCIUM_SCENARIOS, REF_CA, calciumScenario, calciumSteady, pthAt } from '../../src/endocrine/calcium';
import { DISORDERS, readCalcium, readCortisol, readGlucose, readThyroid } from '../../src/endocrine/disorders';
import { CELL_HORMONES } from '../../src/endocrine/receptors';
import { ATLAS, searchAtlas } from '../../src/endocrine/atlas';
import { endocrineDefinition as def } from '../../src/endocrine/definition';

const inRange = (v: number, [lo, hi]: readonly [number, number]) => v >= lo && v <= hi;
const hpt = (id: string) => hptSteady((scenarioById(id as never) as { hpt: typeof HPT_NORMAL }).hpt);
const hpa = (id: string) => hpaCourse((scenarioById(id as never) as { hpa: typeof HPA_NORMAL }).hpa);
const at = <T extends { h: number }>(c: T[], h: number): T => c.find((x) => Math.abs(x.h - h) < 0.05)!;

describe('thyroid axis (HPT)', () => {
  it('rests in the reference ranges', () => {
    const s = hptSteady(HPT_NORMAL);
    expect(inRange(s.tsh, REF.tsh)).toBe(true);
    expect(inRange(s.ft4, REF.ft4)).toBe(true);
  });
  it('raises TSH when the thyroid is removed, and levothyroxine brings it back', () => {
    expect(hpt('thyroidectomy').tsh).toBeGreaterThan(50);
    const t = hpt('levothyroxine');
    expect(inRange(t.tsh, REF.tsh)).toBe(true);
    expect(hptSteady({ ...HPT_NORMAL, thyroid: 0, levothyroxine: 50 }).tsh).toBeGreaterThan(4);
  });
  it('gives the classic patterns', () => {
    const g = hpt('graves'); expect(g.tsh).toBeLessThan(0.1); expect(g.ft4).toBeGreaterThan(22); expect(g.size).toBeGreaterThan(1);
    const h = hpt('hashimoto'); expect(h.tsh).toBeGreaterThan(4); expect(h.ft4).toBeLessThan(12);
    const c = hpt('pituitary-failure'); expect(c.tsh).toBeLessThan(4); expect(c.ft4).toBeLessThan(12);
    expect(hpt('iodine').size).toBeGreaterThan(1.25);
  });
  it('lets T4 fall over weeks (half-life about a week)', () => {
    const c = hptCourse(HPT_NORMAL, { ...HPT_NORMAL, thyroid: 0 }, 30);
    expect(c[7]!.ft4).toBeGreaterThan(5); expect(c[7]!.ft4).toBeLessThan(11);
    expect(c[30]!.ft4).toBeLessThan(2);
  });
});

describe('stress axis (HPA) and the body clock', () => {
  it('peaks cortisol after waking and drops it at midnight', () => {
    const c = hpaCourse(HPA_NORMAL);
    expect(inRange(at(c, 33).cortisol, REF.cortisol8am)).toBe(true);
    expect(at(c, 48).cortisol).toBeLessThan(at(c, 33).cortisol / 2);
    expect(cortisolClock(7.5)).toBeGreaterThan(cortisolClock(12));
    expect(cortisolClock(0)).toBeLessThan(140);
  });
  it('suppresses ACTH with prednisolone and in adrenal Cushing’s; raises it in Addison’s', () => {
    expect(at(hpa('prednisolone'), 33).acth).toBeLessThan(at(hpaCourse(HPA_NORMAL), 33).acth / 2);
    const a = at(hpa('addison'), 33); expect(a.cortisol).toBeLessThan(140); expect(a.acth).toBeGreaterThan(100);
    const cd = hpa('cushing-disease'); expect(at(cd, 48).cortisol).toBeGreaterThan(400); expect(at(cd, 33).acth).toBeGreaterThan(REF.acth[1]);
    expect(at(hpa('cushing-adrenal'), 33).acth).toBeLessThan(REF.acth[0] * 4);
  });
  it('makes melatonin at night, peaking in the early hours, and light holds it back', () => {
    const m = (h: number, lux = 5) => melatonin(h, { bedtimeH: 23, wakeH: 7, lightLux: lux });
    expect(m(14)).toBeLessThan(5);
    expect(m(3)).toBeGreaterThan(50);
    expect(m(3)).toBeGreaterThan(m(23));
    expect(m(22, 300)).toBeLessThan(m(22, 5) / 2);
    expect(suppression(100)).toBeCloseTo(0.5, 5);
  });
  it('raises adrenaline in seconds and cortisol later, then lets adrenaline fall within minutes', () => {
    const f = fightOrFlight(5);
    const p = (min: number) => f.find((x) => Math.abs(x.min - min) < 0.01)!;
    expect(p(3).adrenaline).toBeGreaterThan(300);
    expect(p(3).heartRate).toBeGreaterThan(110);
    expect(p(20).adrenaline).toBeLessThan(60);
    expect(p(20).cortisol).toBeGreaterThan(p(3).cortisol);
  });
});

describe('ovary axis (HPG)', () => {
  it('rests in the follicular ranges with LH pulses', () => {
    const c = hpgCourse(HPG_NORMAL);
    const mean = (k: 'lh' | 'fsh' | 'oestradiol') => c.reduce((n, x) => n + x[k], 0) / c.length;
    expect(inRange(mean('lh'), REF.lh)).toBe(true);
    expect(inRange(mean('fsh'), REF.fsh)).toBe(true);
    expect(Math.max(...c.map((x) => x.lh))).toBeGreaterThan(Math.min(...c.map((x) => x.lh)) * 1.4);
  });
  it('raises FSH after the menopause and lowers LH and FSH on the pill', () => {
    const mean = (id: string, k: 'lh' | 'fsh') => { const c = hpgCourse((scenarioById(id as never) as { hpg: typeof HPG_NORMAL }).hpg); return c.reduce((n, x) => n + x[k], 0) / c.length; };
    expect(mean('menopause', 'fsh')).toBeGreaterThan(30);
    expect(mean('pill', 'lh')).toBeLessThan(2);
    expect(mean('gnrh-agonist', 'lh')).toBeLessThan(2);
  });
  it('has scenarios for every axis', () => {
    for (const a of ['hpt', 'hpa', 'hpg']) expect(SCENARIOS.filter((s) => s.axis === a).length).toBeGreaterThan(2);
  });
});

describe('blood sugar', () => {
  it('keeps a healthy adult near 90 fasting and under 140 two hours after 75 g', () => {
    const o = ogtt('none');
    expect(o.fasting).toBeGreaterThan(80); expect(o.fasting).toBeLessThan(100);
    expect(o.twoHour).toBeLessThan(140);
    expect(Math.max(...o.curve.map((x) => x.glucose))).toBeGreaterThan(130);
    expect(fastingCategory(o.fasting)).toBe('normal');
  });
  it('puts type 2 diabetes over the ADA cut-offs', () => {
    const o = ogtt('type2');
    expect(o.fasting).toBeGreaterThanOrEqual(126);
    expect(o.twoHour).toBeGreaterThanOrEqual(200);
    expect(hba1cCategory(dayStats(simulateDay({ ...NORMAL_DAY, diabetes: 'type2' })).hba1c)).toBe('diabetes');
  });
  it('climbs without insulin in type 1, and insulin brings it down', () => {
    const none = dayStats(simulateDay({ ...NORMAL_DAY, diabetes: 'type1' }));
    const treated = dayStats(simulateDay({ ...NORMAL_DAY, diabetes: 'type1', insulinUnits: 6, basalUnits: 16 }));
    expect(none.mean).toBeGreaterThan(220);
    expect(treated.mean).toBeLessThan(none.mean - 80);
  });
  it('releases insulin after meals and glucagon when glucose is low (exercise)', () => {
    const d = simulateDay(NORMAL_DAY);
    const pre = d.find((x) => x.min === 7 * 60)!, post = d.find((x) => x.min === 8 * 60)!;
    expect(post.insulin).toBeGreaterThan(pre.insulin * 2);
    const ex = simulateDay({ ...NORMAL_DAY, exercise: { atMin: 17 * 60, durationMin: 45 } });
    expect(ex.find((x) => x.min === 17 * 60 + 40)!.glucagon).toBeGreaterThan(d.find((x) => x.min === 17 * 60 + 40)!.glucagon);
  });
  it('converts units and HbA1c (ADAG)', () => {
    expect(toMmol(180)).toBeCloseTo(10, 1);
    expect(meanFromHba1c(7)).toBeCloseTo(154.2, 1);
    expect(hba1cFromMean(meanFromHba1c(6.5))).toBeCloseTo(6.5, 6);
    expect(ifcc(6.5)).toBeCloseTo(47.5, 0);
    expect(twoHourCategory(150)).toBe('prediabetes');
  });
});

describe('calcium', () => {
  it('rests in the normal ranges, at balance', () => {
    const c = calciumSteady(calciumScenario('normal').input);
    expect(inRange(c.total, REF_CA.total)).toBe(true);
    expect(inRange(c.pth, REF_CA.pth)).toBe(true);
    expect(Math.abs(c.gut + c.bone - c.urine)).toBeLessThan(1);
  });
  it('responds to low calcium with more PTH and calcitriol', () => {
    expect(pthAt(1.05)).toBeGreaterThan(pthAt(1.2) * 2);
    const low = calciumSteady(calciumScenario('low-diet').input), n = calciumSteady(calciumScenario('normal').input);
    expect(low.pth).toBeGreaterThan(n.pth); expect(low.calcitriol).toBeGreaterThan(n.calcitriol); expect(low.bone).toBeGreaterThan(0);
  });
  it('gives the scenario patterns', () => {
    const r = Object.fromEntries(CALCIUM_SCENARIOS.map((s) => [s.id, calciumSteady(s.input)]));
    expect(r.adenoma!.total).toBeGreaterThan(2.6); expect(r.adenoma!.pth).toBeGreaterThan(REF_CA.pth[1]);
    expect(r.hypo!.total).toBeLessThan(2.2); expect(r.hypo!.pth).toBeLessThan(REF_CA.pth[0]);
    expect(r['vitamin-d-deficiency']!.pth).toBeGreaterThan(REF_CA.pth[1]); expect(r['vitamin-d-deficiency']!.calcitriol).toBeLessThan(REF_CA.calcitriol[0]);
  });
});

describe('test reader', () => {
  it.each([
    [10, 7, 'primary-hypo'], [7, 15, 'subclinical-hypo'], [0.02, 40, 'hyper'], [0.2, 18, 'subclinical-hyper'], [1, 8, 'central'], [2, 30, 'inappropriate-tsh'], [1.5, 16, 'normal'],
  ] as const)('reads TSH %s with free T4 %s as %s', (tsh, ft4, p) => expect(readThyroid(tsh, ft4).pattern).toBe(p));
  it('reads cortisol and the dexamethasone test', () => {
    expect(readCortisol(60, null)[0]!.pattern).toBe('low');
    expect(readCortisol(300, 30).map((x) => x.pattern)).toEqual(['indeterminate', 'suppressed']);
    expect(readCortisol(500, 200)[1]!.pattern).toBe('not-suppressed');
  });
  it('reads glucose by the worst of the tests', () => {
    expect(readGlucose(95, null, 5.4).category).toBe('normal');
    expect(readGlucose(110, null, null).category).toBe('prediabetes');
    expect(readGlucose(95, 210, 5.5).category).toBe('diabetes');
  });
  it('reads calcium with PTH', () => {
    expect(readCalcium(2.8, 9).pattern).toBe('primary-hyperpara');
    expect(readCalcium(2.9, 0.5).pattern).toBe('non-pth-high');
    expect(readCalcium(2.05, 12).pattern).toBe('secondary-hyperpara');
    expect(readCalcium(1.9, 1).pattern).toBe('hypopara');
    expect(readCalcium(2.4, 3).pattern).toBe('normal');
  });
  it('links every disorder to real glands and a model', () => {
    const ids = new Set(def.structures.map((s) => s.id));
    for (const d of DISORDERS) {
      expect(d.glands.every((g) => ids.has(g)), d.id).toBe(true);
      expect(Object.keys(d.shows).length, d.id).toBe(1);
    }
  });
});

describe('hormones at the cell and the atlas', () => {
  it('orders the steps: binding before the messenger, the nucleus before new proteins', () => {
    for (const h of CELL_HORMONES) {
      const order = h.steps.map((s) => s.show);
      expect(order[0]).toBe('arrive');
      if (h.kind === 'surface') { expect(order.indexOf('bind')).toBeLessThan(order.indexOf('effect')); expect(order).not.toContain('nucleus'); }
      else { expect(order.indexOf('enter')).toBeLessThan(order.indexOf('mrna')); expect(order.indexOf('mrna')).toBeLessThan(order.indexOf('protein')); }
    }
  });
  it('has complete atlas entries whose glands and targets exist', () => {
    const ids = new Set(def.structures.map((s) => s.id));
    expect(ATLAS.length).toBeGreaterThanOrEqual(35);
    expect(new Set(ATLAS.map((h) => h.id)).size).toBe(ATLAS.length);
    for (const h of ATLAS) {
      for (const k of ['name', 'glandLabel', 'trigger', 'targets', 'effect', 'halfLife'] as const) expect(h[k].length, `${h.id}.${k}`).toBeGreaterThan(1);
      if (h.gland) expect(ids.has(h.gland), h.id).toBe(true);
      for (const t of h.targetIds) expect(ids.has(t), `${h.id} → ${t}`).toBe(true);
      // Steroids and thyroid hormones are lipid-soluble; peptides water-soluble.
      if (h.chemistry === 'steroid') expect(h.soluble).toBe('lipid');
      if (h.chemistry === 'peptide') expect(h.soluble).toBe('water');
    }
  });
  it('lists every hormone a gland makes in the atlas, and finds hormones by name or gland', () => {
    const atlas = new Set(ATLAS.map((h) => h.id));
    for (const s of def.structures) for (const h of s.hormones ?? []) expect(atlas.has(h), `${s.id}: ${h}`).toBe(true);
    expect(searchAtlas('vasopressin').map((h) => h.id)).toEqual(['adh']);
    expect(searchAtlas('kidney').length).toBeGreaterThan(3);
  });
});
