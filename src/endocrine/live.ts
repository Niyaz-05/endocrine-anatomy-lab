/**
 * What the simulations show at this moment (pure): the axis, blood-sugar, stress and calcium
 * results for the state in effect, which glands glow and how strongly, the thyroid's size, and the
 * hormone flows the 3D view draws (route segments, colour, strength).
 */
import type { SimulationDefinition } from '../contract/schema';
import type { LabState } from '../app/state';
import { effectiveCalcium, effectiveHormone, effectiveMode, effectiveScenario, effectiveStress, effectiveSugar } from '../app/state';
import { HPA_NORMAL, HPG_NORMAL, HPT_NORMAL, hpaCourse, hpgCourse, hptCourse, scenarioById, type HpaParams, type HptParams } from './axes';
import { simulateDay, type Sample } from './glucose';
import { cortisolClock, fightOrFlight, melatonin } from './stress';
import { calciumSteady, calciumScenario } from './calcium';
import { atlasById } from './atlas';
import { disorderById } from './disorders';

export const HORMONE_COLOUR: Record<string, string> = {
  releasing: '#b07af0', tsh: '#5ac8e8', t4: '#d84a8a', acth: '#5ad8a8', cortisol: '#e8902a', gnrh: '#b07af0', lh: '#6aa0ff', fsh: '#8ac0ff', oestradiol: '#ff7ab8',
  insulin: '#f2c230', glucagon: '#4a9aff', adrenaline: '#ff6a3a', melatonin: '#7a7aff', pth: '#40d8c0', calcitriol: '#f0e070', calcitonin: '#c0a0ff', atlas: '#ffd24a',
};

export interface Flow { id: string; label: string; colour: string; paths: string[][]; level: number }
export interface Live {
  activity: Record<string, number>;
  thyroidScale: number;
  flows: Flow[];
}

const memo = new Map<string, unknown>();
function cached<T>(key: string, f: () => T): T {
  if (!memo.has(key)) { if (memo.size > 60) memo.clear(); memo.set(key, f()); }
  return memo.get(key) as T;
}

/** HPT parameters for a scenario, with the learner's levothyroxine dose. */
export function hptParams(id: string, levothyroxine: number): HptParams {
  const sc = scenarioById(id as never) as { hpt?: HptParams } | undefined;
  const p = sc?.hpt ?? HPT_NORMAL;
  return id === 'levothyroxine' ? { ...p, levothyroxine } : p;
}
export function hpaParams(id: string, prednisolone: number): HpaParams {
  const sc = scenarioById(id as never) as { hpa?: HpaParams } | undefined;
  const p = sc?.hpa ?? HPA_NORMAL;
  return id === 'prednisolone' ? { ...p, prednisolone } : p;
}
export const hptSeries = (id: string, dose: number) => cached(`hpt:${id}:${dose}`, () => hptCourse(HPT_NORMAL, hptParams(id, dose), 90));
export const hpaSeries = (id: string, dose: number) => cached(`hpa:${id}:${dose}`, () => hpaCourse(hpaParams(id, dose), 48));
export const hpgSeries = (id: string) => cached(`hpg:${id}`, () => hpgCourse((scenarioById(id as never) as { hpg?: typeof HPG_NORMAL }).hpg ?? HPG_NORMAL, 24));
export const daySeries = (key: string, f: () => Sample[]) => cached(`day:${key}`, f);

export function sugarSeries(s: LabState['sugar']): Sample[] {
  const day = { diabetes: s.diabetes, meals: s.meals, exercise: s.exercise ? { atMin: 17 * 60, durationMin: 45 } : null, insulinUnits: s.diabetes === 'type1' ? s.insulinUnits : 0, basalUnits: s.diabetes === 'type1' ? 16 : 0 };
  return daySeries(JSON.stringify(day), () => simulateDay(day));
}
export const sampleAt = (series: Sample[], min: number) => series[Math.max(0, Math.min(series.length - 1, Math.round(min / 5)))]!;

const THYROID = ['thyroid-lobe-left', 'thyroid-lobe-right', 'thyroid-isthmus'];
const PANCREAS = ['pancreas-head', 'pancreas-neck', 'pancreas-body', 'pancreas-tail'];
const PARATHYROIDS = ['parathyroid-superior-left', 'parathyroid-inferior-left', 'parathyroid-superior-right', 'parathyroid-inferior-right'];
const set = (a: Record<string, number>, ids: string[], v: number) => ids.forEach((id) => { a[id] = Math.max(a[id] ?? 0, v); });
const lvl = (x: number) => Math.max(0, Math.min(2.5, x));

/** The view of the moment. */
export function live(def: SimulationDefinition, state: LabState): Live {
  const mode = effectiveMode(def, state);
  const activity: Record<string, number> = {};
  const flows: Flow[] = [];
  let thyroidScale = 1;
  const axisMode = mode === 'axes' || (mode === 'disorders' && !!disorderById(state.disorder ?? '')?.shows.axis);
  const sugarMode = mode === 'sugar' || (mode === 'disorders' && !!disorderById(state.disorder ?? '')?.shows.diabetes);
  const calciumMode = mode === 'calcium' || (mode === 'disorders' && !!disorderById(state.disorder ?? '')?.shows.calcium);

  if (axisMode) {
    const { axis, id } = effectiveScenario(def, state);
    const t = state.mode === 'tour' ? 1 : state.axisT;
    if (axis === 'hpt') {
      const s = hptSeries(id, state.doses.levothyroxine);
      const now = s[Math.round(t * (s.length - 1))]!;
      const tsh = lvl(Math.log10(Math.max(now.tsh, 0.01) / 1.5) / 1.2 + 1);
      set(activity, ['pituitary-anterior'], tsh);
      set(activity, ['hypothalamus'], lvl(0.6 + 0.4 * tsh));
      set(activity, THYROID, lvl(now.ft4 / 16));
      thyroidScale = Math.max(0.0, now.size);
      flows.push({ id: 'trh', label: 'TRH', colour: HORMONE_COLOUR.releasing!, paths: [['portal-hypophyseal']], level: lvl(0.6 + 0.4 * tsh) });
      flows.push({ id: 'tsh', label: 'TSH', colour: HORMONE_COLOUR.tsh!, paths: [['pituitary-to-heart', 'heart', 'to-thyroid-left'], ['pituitary-to-heart', 'heart', 'to-thyroid-right']], level: tsh });
      flows.push({ id: 't4', label: 'T4 and T3', colour: HORMONE_COLOUR.t4!, paths: [['thyroid-to-heart', 'heart', 'to-pituitary'], ['thyroid-to-heart', 'heart', 'to-hypothalamus']], level: lvl(now.ft4 / 16) });
    } else if (axis === 'hpa') {
      const s = hpaSeries(id, state.doses.prednisolone);
      const now = s[Math.round(t * (s.length - 1))]!;
      const acth = lvl(now.acth / 30), cort = lvl(now.cortisol / 350);
      set(activity, ['pituitary-anterior'], acth);
      set(activity, ['hypothalamus'], lvl(0.5 + 0.5 * acth));
      set(activity, ['adrenal-cortex-left', 'adrenal-cortex-right'], cort);
      flows.push({ id: 'crh', label: 'CRH', colour: HORMONE_COLOUR.releasing!, paths: [['portal-hypophyseal']], level: lvl(0.5 + 0.5 * acth) });
      flows.push({ id: 'acth', label: 'ACTH', colour: HORMONE_COLOUR.acth!, paths: [['pituitary-to-heart', 'heart', 'to-adrenal-left'], ['pituitary-to-heart', 'heart', 'to-adrenal-right']], level: acth });
      flows.push({ id: 'cortisol', label: 'Cortisol', colour: HORMONE_COLOUR.cortisol!, paths: [['adrenal-right-to-heart', 'heart', 'to-pituitary'], ['adrenal-left-to-heart', 'heart', 'to-hypothalamus']], level: cort });
    } else {
      const s = hpgSeries(id);
      const now = s[Math.round(t * (s.length - 1))]!;
      set(activity, ['hypothalamus'], lvl(now.gnrh));
      set(activity, ['pituitary-anterior'], lvl(now.lh / 5));
      set(activity, ['ovary-left', 'ovary-right'], lvl(now.oestradiol / 300));
      flows.push({ id: 'gnrh', label: 'GnRH', colour: HORMONE_COLOUR.gnrh!, paths: [['portal-hypophyseal']], level: lvl(0.3 + now.gnrh) });
      flows.push({ id: 'lh', label: 'LH and FSH', colour: HORMONE_COLOUR.lh!, paths: [['pituitary-to-heart', 'heart', 'to-ovary-left'], ['pituitary-to-heart', 'heart', 'to-ovary-right']], level: lvl(now.lh / 5) });
      flows.push({ id: 'oestradiol', label: 'Oestradiol', colour: HORMONE_COLOUR.oestradiol!, paths: [['ovary-left-to-heart', 'heart', 'to-pituitary'], ['ovary-right-to-heart', 'heart', 'to-hypothalamus']], level: lvl(now.oestradiol / 300) });
    }
  }

  if (sugarMode) {
    const sugar = effectiveSugar(def, state);
    const sugarNow = { ...sugar, diabetes: mode === 'disorders' ? disorderById(state.disorder ?? '')?.shows.diabetes ?? sugar.diabetes : sugar.diabetes };
    const now = sampleAt(sugarSeries(sugarNow), sugar.clockMin);
    const ins = lvl(now.insulin / 20), glu = lvl(now.glucagon / 90);
    set(activity, PANCREAS, Math.max(ins, glu * 0.8));
    flows.push({ id: 'insulin', label: 'Insulin', colour: HORMONE_COLOUR.insulin!, paths: [['pancreas-to-liver'], ['pancreas-to-heart', 'heart', 'to-kidney-left']], level: ins });
    flows.push({ id: 'glucagon', label: 'Glucagon', colour: HORMONE_COLOUR.glucagon!, paths: [['pancreas-to-liver']], level: glu });
  }

  if (mode === 'stress') {
    const st = effectiveStress(def, state);
    const mel = melatonin(st.clockH, { bedtimeH: st.bedtimeH, wakeH: (st.bedtimeH + 8) % 24, lightLux: st.lightLux });
    const cortClock = cortisolClock(st.clockH, (st.bedtimeH + 8) % 24);
    let adr = 30, cort = cortClock;
    if (st.fightAt !== null) {
      const f = fightOrFlight(5, cortClock);
      const p = f[Math.min(f.length - 1, Math.max(0, Math.round(st.fightAt * 2)))]!;
      adr = p.adrenaline; cort = p.cortisol;
    }
    set(activity, ['adrenal-medulla-left', 'adrenal-medulla-right'], lvl((adr - 30) / 140));
    set(activity, ['adrenal-cortex-left', 'adrenal-cortex-right'], lvl(cort / 400));
    set(activity, ['pineal-gland'], lvl(mel / 40));
    set(activity, ['hypothalamus'], lvl(0.4 + cort / 800));
    flows.push({ id: 'adrenaline', label: 'Adrenaline', colour: HORMONE_COLOUR.adrenaline!, paths: [['adrenal-left-to-heart', 'heart', 'to-liver'], ['adrenal-right-to-heart', 'heart', 'to-kidney-right']], level: lvl((adr - 30) / 140) });
    flows.push({ id: 'cortisol', label: 'Cortisol', colour: HORMONE_COLOUR.cortisol!, paths: [['adrenal-right-to-heart', 'heart', 'to-liver'], ['adrenal-left-to-heart', 'heart', 'to-hypothalamus']], level: lvl(cort / 400) });
    flows.push({ id: 'melatonin', label: 'Melatonin', colour: HORMONE_COLOUR.melatonin!, paths: [['pineal-to-heart', 'heart', 'to-hypothalamus']], level: lvl(mel / 40) });
  }

  if (calciumMode) {
    const c = effectiveCalcium(def, state);
    const sc = calciumScenario(mode === 'disorders' ? disorderById(state.disorder ?? '')?.shows.calcium ?? c.scenario : c.scenario);
    const r = calciumSteady({ dietMg: mode === 'disorders' ? sc.input.dietMg : c.dietMg, vitaminD: mode === 'disorders' ? sc.input.vitaminD : c.vitaminD, parathyroid: sc.input.parathyroid });
    set(activity, PARATHYROIDS, lvl(r.pth / 3.3));
    set(activity, ['kidney-left', 'kidney-right'], lvl(r.calcitriol / 90) * 0.6);
    set(activity, THYROID, lvl(r.calcitonin) * 0.5);
    flows.push({ id: 'pth', label: 'PTH', colour: HORMONE_COLOUR.pth!, paths: [['parathyroids-to-heart', 'heart', 'to-bone'], ['parathyroids-to-heart', 'heart', 'to-kidney-left'], ['parathyroids-to-heart', 'heart', 'to-kidney-right']], level: lvl(r.pth / 3.3) });
    flows.push({ id: 'calcitriol', label: 'Calcitriol', colour: HORMONE_COLOUR.calcitriol!, paths: [['kidney-left-to-heart', 'heart', 'to-gut']], level: lvl(r.calcitriol / 90) });
    flows.push({ id: 'calcitonin', label: 'Calcitonin', colour: HORMONE_COLOUR.calcitonin!, paths: [['thyroid-to-heart', 'heart', 'to-bone']], level: lvl(r.calcitonin * 0.8) });
  }

  if (mode === 'atlas') {
    const h = atlasById(effectiveHormone(def, state) ?? '');
    if (h) {
      if (h.gland) set(activity, [h.gland], 1.4);
      set(activity, h.targetIds, 0.7);
      if (h.paths.length) flows.push({ id: h.id, label: h.name, colour: HORMONE_COLOUR.atlas!, paths: h.paths, level: 1.2 });
    }
  }

  return { activity, thyroidScale, flows };
}
