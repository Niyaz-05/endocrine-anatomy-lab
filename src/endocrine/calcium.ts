/**
 * Blood calcium: parathyroid hormone, vitamin D (calcitriol) and calcitonin (pure, steady state).
 *
 * - The parathyroid glands sense ionised calcium through the calcium-sensing receptor and release
 *   PTH along a steep inverse sigmoid around a set point of about 1.1–1.2 mmol/L (Brown 1983).
 * - PTH releases calcium from bone, makes the kidney keep calcium (and lose phosphate), and makes
 *   the kidney's 1-α-hydroxylase turn vitamin D into calcitriol, which raises calcium absorption in
 *   the gut. The thyroid's C cells release calcitonin when calcium is high; in adults it matters
 *   little (OpenStax A&P 2e §17.5 and §6.7; Guyton & Hall 14e ch. 80).
 * - Normal: ionised calcium 1.1–1.3 mmol/L, total 2.2–2.6 mmol/L, PTH about 1.6–6.9 pmol/L,
 *   calcitriol about 50–150 pmol/L, 25-OH vitamin D above 50 nmol/L.
 * The fluxes are a teaching model scaled to a typical adult (about 1,000 mg of calcium eaten a day,
 * about 200 mg absorbed and 200 mg lost in the urine at balance).
 */

export interface CalciumInput {
  /** Calcium eaten, mg a day. */
  dietMg: number;
  /** Vitamin D status: 1 normal, about 0.2 in deficiency. */
  vitaminD: number;
  /** Parathyroid function: 'normal', an adenoma (primary hyperparathyroidism) or 'hypo' (glands lost). */
  parathyroid: 'normal' | 'adenoma' | 'hypo';
}
export const CALCIUM_NORMAL: CalciumInput = { dietMg: 1000, vitaminD: 1, parathyroid: 'normal' };

export const REF_CA = { ionised: [1.1, 1.3], total: [2.2, 2.6], pth: [1.6, 6.9], calcitriol: [50, 150] } as const;

/** PTH (pmol/L) at an ionised calcium (mmol/L). */
export function pthAt(ionised: number, gland: CalciumInput['parathyroid'] = 'normal'): number {
  const setPoint = gland === 'adenoma' ? 1.36 : 1.12;
  const max = gland === 'hypo' ? 1.3 : gland === 'adenoma' ? 40 : 25;
  return 0.4 + (max - 0.4) / (1 + (ionised / setPoint) ** 30);
}

export interface CalciumState {
  ionised: number; total: number; pth: number; calcitriol: number; calcitonin: number;
  /** Net daily fluxes, mg/day: into the blood from the gut and bone, out in the urine. */
  gut: number; bone: number; urine: number;
}

const PTH0 = 3.3, CALC0 = 90;
function fluxes(ionised: number, input: CalciumInput) {
  const pth = pthAt(ionised, input.parathyroid);
  const calcitriol = CALC0 * Math.min(3, (pth / PTH0) ** 0.6) * input.vitaminD;
  const gut = input.dietMg * (0.03 + 0.19 * Math.min(2.5, calcitriol / CALC0));
  const bone = 45 * (pth / PTH0 - 1) * (pth < PTH0 ? 0.6 : 1); // net release (resorption − formation)
  const urine = 220 * (ionised / 1.2) ** 5 * Math.max(0.35, (pth / PTH0) ** -0.25);
  return { pth, calcitriol, gut, bone: Math.max(-150, Math.min(900, bone)), urine };
}

/** The steady state: the ionised calcium at which what enters the blood equals what leaves. */
export function calciumSteady(input: CalciumInput): CalciumState {
  let lo = 0.6, hi = 2.0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2, f = fluxes(mid, input);
    if (f.gut + f.bone - f.urine > 0) lo = mid; else hi = mid;
  }
  const ionised = (lo + hi) / 2, f = fluxes(ionised, input);
  return { ionised, total: ionised * 2, pth: f.pth, calcitriol: f.calcitriol, calcitonin: Math.max(0, (ionised - 1.22) * 10) + 0.2, gut: f.gut, bone: f.bone, urine: f.urine };
}

export const CALCIUM_SCENARIOS = [
  { id: 'normal', label: 'Normal', input: CALCIUM_NORMAL, text: 'PTH and vitamin D keep the blood calcium within a narrow range, about 2.2–2.6 mmol/L.' },
  { id: 'low-diet', label: 'Little calcium in the diet', input: { ...CALCIUM_NORMAL, dietMg: 300 }, text: 'Less calcium is absorbed, so PTH rises: more calcitriol takes in a larger share from the gut and more is taken from bone. Calcium stays near normal, at the bones’ expense.' },
  { id: 'vitamin-d-deficiency', label: 'Vitamin D deficiency', input: { ...CALCIUM_NORMAL, vitaminD: 0.2 }, text: 'Without vitamin D the gut absorbs little calcium; PTH rises (secondary hyperparathyroidism) and calcium falls to the low end. In children this causes rickets, in adults osteomalacia.' },
  { id: 'adenoma', label: 'Parathyroid adenoma', input: { ...CALCIUM_NORMAL, parathyroid: 'adenoma' }, text: 'A benign tumour of one gland makes PTH at a higher set point: calcium is high with a PTH that is high or high-normal (primary hyperparathyroidism): “stones, bones, groans and moans”.' },
  { id: 'hypo', label: 'Glands lost in surgery', input: { ...CALCIUM_NORMAL, parathyroid: 'hypo' }, text: 'If the parathyroids are removed or damaged in thyroid surgery, PTH falls and so does calcium: tingling and muscle cramps (tetany) follow. Treated with calcium and active vitamin D.' },
] as const;
export type CalciumScenarioId = (typeof CALCIUM_SCENARIOS)[number]['id'];
export const calciumScenario = (id: CalciumScenarioId) => CALCIUM_SCENARIOS.find((s) => s.id === id)!;
