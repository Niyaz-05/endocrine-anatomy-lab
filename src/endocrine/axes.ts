/**
 * The three hypothalamus → pituitary → gland axes as small feedback models (pure).
 *
 * Each axis is a chain of first-order compartments: every hormone moves towards the level its
 * drivers ask for at a rate set by its half-life, and the gland hormone feeds back on the
 * hypothalamus and pituitary. The steady states sit in the adult reference ranges below. These are
 * teaching models built from textbook numbers, not fitted to patients.
 *
 * - HPT: TSH 0.4–4.0 mIU/L and free T4 12–22 pmol/L (ATA / Endocrine Society ranges); log TSH falls
 *   roughly linearly as free T4 rises (about tenfold per 8 pmol/L here). Half-lives: TSH about 1 h,
 *   T4 about 7 days, T3 about 1 day (Guyton & Hall 14e ch. 77).
 * - HPA: morning cortisol about 140–690 nmol/L; ACTH half-life about 10 min, cortisol about 70 min;
 *   the drive follows the body clock (see stress.ts). Prednisolone 5 mg ≈ 20 mg hydrocortisone, about
 *   a day's cortisol (BNF).
 * - HPG (female, follicular phase): GnRH pulses every 60–90 min drive LH and FSH; oestradiol and
 *   inhibin feed back. The mid-cycle surge (positive feedback) is left to the reproductive lab.
 */
import { cortisolClock } from './stress';

export type AxisId = 'hpt' | 'hpa' | 'hpg';

export const REF = {
  tsh: [0.4, 4.0], ft4: [12, 22], ft3: [3.1, 6.8],
  acth: [7, 63], cortisol8am: [140, 690],
  lh: [2, 10], fsh: [3, 10], oestradiol: [100, 600],
} as const;

export interface HptParams {
  /** Thyroid capacity (1 normal; 0 removed; Hashimoto and iodine deficiency lower it). */
  thyroid: number;
  /** Pituitary capacity (1 normal; low in pituitary failure). */
  pituitary: number;
  /** TSH-receptor antibodies (Graves): drive the gland without TSH, 0 … 1. */
  tsi: number;
  /** Levothyroxine, µg a day (about 100 µg replaces a whole gland in a 60 kg adult). */
  levothyroxine: number;
}
export const HPT_NORMAL: HptParams = { thyroid: 1, pituitary: 1, tsi: 0, levothyroxine: 0 };

const TSH0 = 1.5, FT4_0 = 16, FT3_0 = 5;
/** TSH the pituitary aims for at a free T4 (pmol/L): tenfold change per 8.3 pmol/L. */
export const tshSetPoint = (ft4: number, pituitary = 1) => pituitary * TSH0 * 10 ** (-0.12 * (ft4 - FT4_0));
/** Gland output relative to normal at a TSH (saturating: at most 3× normal). */
const drive = (tsh: number) => (tsh / (3 + tsh)) / (TSH0 / (3 + TSH0));
/** Free T4 the thyroid and the tablets aim for at a TSH. */
export function ft4Target(tsh: number, p: HptParams): number {
  return FT4_0 * (p.thyroid * (drive(tsh) + 6 * p.tsi)) + FT4_0 * (p.levothyroxine / 100);
}

export interface HptState { tsh: number; ft4: number; ft3: number; size: number }
/** Thyroid size relative to normal: long-standing TSH stimulation makes a goitre; Graves too. */
export const goitre = (tsh: number, p: HptParams) => {
  if (p.thyroid === 0) return 0;
  // TSH above normal makes the gland grow; a suppressed TSH lets it shrink a little; the antibodies of
  // Graves' disease make it grow by themselves (a smooth, diffuse goitre).
  const k = Math.log2(Math.max(tsh, 0.05) / TSH0);
  return Math.min(2.2, Math.max(0.7, 1 + (k > 0 ? 0.25 * k : 0.06 * k) + 1.5 * p.tsi));
};

/** The steady state (solved by iterating the two set points). */
export function hptSteady(p: HptParams): HptState {
  let ft4 = FT4_0, tsh = TSH0;
  for (let i = 0; i < 400; i++) {
    tsh = tshSetPoint(ft4, p.pituitary);
    ft4 = ft4 + 0.2 * (ft4Target(tsh, p) - ft4);
  }
  return { tsh, ft4, ft3: ft4 * (FT3_0 / FT4_0) * (1 + 0.4 * p.tsi), size: goitre(tsh, p) };
}

/** Days 0…`days` (hourly steps, daily samples) after changing from `from` to `to`. */
export function hptCourse(from: HptParams, to: HptParams, days = 60): (HptState & { day: number })[] {
  const s = hptSteady(from);
  let { tsh, ft4 } = s;
  // A removed gland is gone at once; otherwise its size changes over months.
  let size = to.thyroid === 0 ? 0 : s.size;
  const kT4 = Math.LN2 / (7 * 24), kTsh = Math.LN2 / 1, kSize = Math.LN2 / (30 * 24);
  const out = [{ day: 0, tsh, ft4, ft3: s.ft3, size }];
  for (let h = 1; h <= days * 24; h++) {
    tsh += (tshSetPoint(ft4, to.pituitary) - tsh) * (1 - Math.exp(-kTsh));
    ft4 += (ft4Target(tsh, to) - ft4) * (1 - Math.exp(-kT4));
    size += (goitre(tsh, to) - size) * (1 - Math.exp(-kSize));
    if (h % 24 === 0) out.push({ day: h / 24, tsh, ft4, ft3: ft4 * (FT3_0 / FT4_0) * (1 + 0.4 * to.tsi), size });
  }
  return out;
}

export interface HpaParams {
  /** Adrenal cortex capacity (1 normal; low in Addison's disease). */
  adrenal: number;
  pituitary: number;
  /** Prednisolone, mg a day. */
  prednisolone: number;
  /** An ACTH-making pituitary tumour (Cushing's disease): ACTH made regardless of cortisol, 0 … 1. */
  pituitaryTumour: number;
  /** A cortisol-making adrenal tumour: cortisol made regardless of ACTH, 0 … 1. */
  adrenalTumour: number;
}
export const HPA_NORMAL: HpaParams = { adrenal: 1, pituitary: 1, prednisolone: 0, pituitaryTumour: 0, adrenalTumour: 0 };
const ACTH0 = 20, CORT0 = 300;

/** Cortisol (nmol/L) and ACTH (pg/mL) over 72 h from midnight, every 6 minutes. */
export function hpaCourse(p: HpaParams, hours = 72, wakeH = 7): { h: number; acth: number; cortisol: number }[] {
  const dt = 0.1; // hours
  const kA = Math.LN2 / (10 / 60), kC = Math.LN2 / (70 / 60);
  // The glucocorticoid in the tablets counts towards the feedback (5 mg prednisolone ≈ 300 nmol/L).
  const steroid = (p.prednisolone / 5) * 1.4 * CORT0;
  let acth = ACTH0, cortisol = CORT0;
  const out: { h: number; acth: number; cortisol: number }[] = [];
  // Settle for two days first.
  for (let t = -48; t <= hours; t += dt) {
    const clock = cortisolClock(((t % 24) + 24) % 24, wakeH) / CORT0; // about 0.2 … 1.7
    const fb = Math.max(0.05, (cortisol + steroid) / CORT0);
    const target = p.pituitary * ACTH0 * clock ** 2 * fb ** -1.6 * (1 - p.pituitaryTumour) + p.pituitaryTumour * 90;
    acth += (target - acth) * (1 - Math.exp(-kA * dt));
    const ct = CORT0 * p.adrenal * (1 - p.adrenalTumour) * (Math.max(acth, 0.1) / ACTH0) ** 0.6 + p.adrenalTumour * 900 * p.adrenal;
    cortisol += (ct - cortisol) * (1 - Math.exp(-kC * dt));
    if (t >= 0 && Math.abs((t * 10) % 1) < 1e-6) out.push({ h: Math.round(t * 10) / 10, acth, cortisol });
  }
  return out;
}

export interface HpgParams {
  /** Ovarian capacity (1 normal; 0 after the menopause). */
  ovary: number;
  /** Combined pill: oestrogen and progestogen from tablets, 0 or 1. */
  pill: number;
  /** A long-acting GnRH agonist (given continuously, it switches the pituitary off). */
  gnrhAgonist: number;
}
export const HPG_NORMAL: HpgParams = { ovary: 1, pill: 0, gnrhAgonist: 0 };

/** LH, FSH (IU/L), oestradiol (pmol/L) and GnRH pulses over `hours` (6-minute steps). */
export function hpgCourse(p: HpgParams, hours = 24): { h: number; gnrh: number; lh: number; fsh: number; oestradiol: number }[] {
  const dt = 0.1, period = 1.5; // a GnRH pulse every 90 minutes
  const kLH = Math.LN2 / 0.5, kFSH = Math.LN2 / 3, kE = Math.LN2 / 4;
  let lh = 5, fsh = 6, e2 = 300;
  const out: { h: number; gnrh: number; lh: number; fsh: number; oestradiol: number }[] = [];
  for (let t = -72; t <= hours; t += dt) {
    const phase = (((t % period) + period) % period) / period;
    const pulse = phase < 0.08 ? 1 : 0;
    // Continuous GnRH (agonist) desensitises the receptors after a short flare.
    const sensitivity = p.gnrhAgonist ? Math.max(0.08, Math.exp(-Math.max(0, t + 72) / 30)) : 1;
    const fb = Math.max(0.2, (e2 * p.ovary + p.pill * 600) / 300) ** -1.1 * (p.pill ? 0.35 : 1);
    const lhT = 5 * sensitivity * fb * (p.gnrhAgonist ? 1 : 0.4 + 1.5 * pulse);
    const fshT = 6 * sensitivity * fb * (p.ovary < 0.5 ? 1.6 : 1); // little inhibin after the menopause
    lh += (lhT - lh) * (1 - Math.exp(-kLH * dt));
    fsh += (fshT - fsh) * (1 - Math.exp(-kFSH * dt));
    const eT = 300 * p.ovary * Math.min(2, (fsh / 6) ** 0.8);
    e2 += (eT - e2) * (1 - Math.exp(-kE * dt));
    if (t >= 0 && Math.abs((t * 10) % 1) < 1e-6) out.push({ h: Math.round(t * 10) / 10, gnrh: pulse * (p.gnrhAgonist ? 0 : 1) + (p.gnrhAgonist ? 0.6 : 0), lh, fsh, oestradiol: e2 * p.ovary });
  }
  return out;
}

/** The axis scenarios offered in the Axes view. */
export const SCENARIOS = [
  { id: 'normal', axis: 'hpt', label: 'Normal', text: 'TSH and free T4 hold each other steady: if T4 falls, TSH rises and the thyroid makes more.', hpt: HPT_NORMAL },
  { id: 'thyroidectomy', axis: 'hpt', label: 'Thyroid removed', text: 'With no thyroid, T4 falls over weeks (its half-life is about 7 days) and TSH climbs high.', hpt: { ...HPT_NORMAL, thyroid: 0 } },
  { id: 'levothyroxine', axis: 'hpt', label: 'Removed + tablets', text: 'Levothyroxine (synthetic T4) replaces the gland; the dose is adjusted until TSH is back in range.', hpt: { ...HPT_NORMAL, thyroid: 0, levothyroxine: 100 } },
  { id: 'iodine', axis: 'hpt', label: 'Iodine deficiency', text: 'Without iodine the gland cannot make enough T4; TSH rises and makes the gland grow (a goitre).', hpt: { ...HPT_NORMAL, thyroid: 0.35 } },
  { id: 'hashimoto', axis: 'hpt', label: 'Hashimoto’s', text: 'Autoimmune damage destroys the gland slowly: free T4 low, TSH high (primary hypothyroidism).', hpt: { ...HPT_NORMAL, thyroid: 0.2 } },
  { id: 'graves', axis: 'hpt', label: 'Graves’ disease', text: 'Antibodies switch on the TSH receptor: the gland grows and makes too much T4, and TSH is suppressed.', hpt: { ...HPT_NORMAL, tsi: 0.35 } },
  { id: 'pituitary-failure', axis: 'hpt', label: 'Pituitary failure', text: 'Too little TSH: free T4 low with a low or normal TSH (central hypothyroidism).', hpt: { ...HPT_NORMAL, pituitary: 0.08 } },
  { id: 'hpa-normal', axis: 'hpa', label: 'Normal', text: 'ACTH and cortisol follow the body clock, highest soon after waking and lowest around midnight.', hpa: HPA_NORMAL },
  { id: 'prednisolone', axis: 'hpa', label: 'Prednisolone', text: 'A steroid tablet feeds back like cortisol: ACTH falls and the adrenal glands make less of their own.', hpa: { ...HPA_NORMAL, prednisolone: 10 } },
  { id: 'addison', axis: 'hpa', label: 'Addison’s disease', text: 'The adrenal cortex is destroyed: cortisol is low and ACTH very high (which darkens the skin).', hpa: { ...HPA_NORMAL, adrenal: 0.08 } },
  { id: 'cushing-disease', axis: 'hpa', label: 'Cushing’s (pituitary)', text: 'A pituitary tumour makes ACTH regardless of cortisol: both are high and the daily rhythm is lost.', hpa: { ...HPA_NORMAL, pituitaryTumour: 0.8 } },
  { id: 'cushing-adrenal', axis: 'hpa', label: 'Cushing’s (adrenal)', text: 'An adrenal tumour makes cortisol by itself: cortisol is high and ACTH switched off.', hpa: { ...HPA_NORMAL, adrenalTumour: 0.6 } },
  { id: 'hpg-normal', axis: 'hpg', label: 'Normal', text: 'GnRH comes in pulses about every 90 minutes; each pulse releases LH. Oestradiol feeds back.', hpg: HPG_NORMAL },
  { id: 'menopause', axis: 'hpg', label: 'Menopause', text: 'The ovaries stop making oestradiol and inhibin, so nothing holds FSH and LH down: they rise high.', hpg: { ...HPG_NORMAL, ovary: 0 } },
  { id: 'pill', axis: 'hpg', label: 'Combined pill', text: 'Oestrogen and progestogen in the pill feed back, keeping LH and FSH low so no egg ripens.', hpg: { ...HPG_NORMAL, pill: 1 } },
  { id: 'gnrh-agonist', axis: 'hpg', label: 'GnRH agonist', text: 'GnRH given all the time (not in pulses) first releases LH, then switches the pituitary off.', hpg: { ...HPG_NORMAL, gnrhAgonist: 1 } },
] as const;
export type ScenarioId = (typeof SCENARIOS)[number]['id'];
export const scenarioById = (id: ScenarioId) => SCENARIOS.find((s) => s.id === id)!;
export const AXIS_LABEL: Record<AxisId, string> = { hpt: 'Thyroid (HPT)', hpa: 'Stress (HPA)', hpg: 'Ovary (HPG)' };
