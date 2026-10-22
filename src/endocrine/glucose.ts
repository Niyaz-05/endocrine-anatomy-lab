/**
 * Blood glucose over a day: insulin and glucagon (pure).
 *
 * The glucose and insulin-action equations are Bergman's minimal model (Bergman et al. 1979, 1981):
 *   dG/dt = −(Sg + X)·G + Sg·Gb·H + Ra/V − exercise
 *   dX/dt = −p2·X + p2·Si·(I − Ib)
 * with Sg the glucose effectiveness, Si the insulin sensitivity and X the insulin action. Here the
 * beta cells release insulin in proportion to glucose above its fasting level (with a first phase
 * on rising glucose), the alpha cells release glucagon when glucose is low, and glucagon raises the
 * liver's glucose output (H). Meals pass from the stomach to the gut to the blood. Parameters are
 * typical published adult values, tuned so a healthy adult stays at about 90 mg/dL fasting and is
 * back under 140 mg/dL two hours after a meal. Teaching model: not for dosing.
 *
 * Diagnostic cut-offs: ADA Standards of Care (fasting ≥ 126 mg/dL, 2-hour OGTT ≥ 200 mg/dL, HbA1c
 * ≥ 6.5 % for diabetes; 100–125, 140–199 and 5.7–6.4 % for prediabetes). HbA1c from the average
 * glucose by the ADAG relation, eAG (mg/dL) = 28.7 × A1c − 46.7 (Nathan et al. 2008).
 */

export type Diabetes = 'none' | 'type1' | 'type2';
export const MGDL_PER_MMOLL = 18.016;
export const toMmol = (mgdl: number) => mgdl / MGDL_PER_MMOLL;

export interface Meal { atMin: number; carbsG: number }
export interface Day {
  diabetes: Diabetes;
  meals: readonly Meal[];
  /** Exercise start (minutes after midnight) and length, or null. */
  exercise: { atMin: number; durationMin: number } | null;
  /** Rapid-acting insulin injected with each meal (type 1), units. */
  insulinUnits: number;
  /** A night-time background (basal) insulin dose (type 1), units a day. */
  basalUnits: number;
}

export const DEFAULT_MEALS: Meal[] = [{ atMin: 7.5 * 60, carbsG: 60 }, { atMin: 12.5 * 60, carbsG: 75 }, { atMin: 19 * 60, carbsG: 80 }];
export const NORMAL_DAY: Day = { diabetes: 'none', meals: DEFAULT_MEALS, exercise: null, insulinUnits: 0, basalUnits: 0 };

const P = {
  Gb: 90, Ib: 8, Gnb: 75,
  Sg: 0.022, p2: 0.025, Si: 1e-3,
  V: 120, // glucose space, dL (about 1.7 dL/kg × 70 kg)
  kEmpty: 0.022, ka: 0.03, absorbed: 0.75, // stomach emptying and gut absorption (/min); share reaching the blood
  kI: 0.12, gamma: 0.65, first: 3.5, // insulin clearance (/min), second-phase and first-phase secretion
  kGn: 0.08,
};

export interface Sample { min: number; glucose: number; insulin: number; glucagon: number; gut: number }

/** One day at 1-minute steps (after settling overnight), sampled every 5 minutes. */
export function simulateDay(day: Day): Sample[] {
  const t1 = day.diabetes === 'type1', t2 = day.diabetes === 'type2';
  const Si = P.Si * (t2 ? 0.3 : 1);
  const gamma = P.gamma * (t1 ? 0 : t2 ? 0.45 : 1);
  const first = P.first * (t1 ? 0 : t2 ? 0.1 : 1);
  // In type 2 the liver also makes more glucose (insulin resistance there too).
  const liver = t2 ? 1.95 : 1;
  const basalSecretion = t1 ? 0 : 1;
  let G = t1 ? 160 : t2 ? 130 : P.Gb, X = 0, I = t1 ? 0 : P.Ib, Gn = P.Gnb, stomach = 0, gut = 0, depot = 0, basal = 0;
  const out: Sample[] = [];
  let lastG = G;
  for (let m = -24 * 60; m < 24 * 60; m++) {
    const min = ((m % 1440) + 1440) % 1440;
    const settling = m < 0;
    if (!settling && min % 5 === 0) out.push({ min, glucose: G, insulin: I, glucagon: Gn, gut: (stomach + gut) / 1000 });
    // Food (the settling day before repeats the same meals).
    for (const meal of day.meals) if (Math.round(meal.atMin) === min) stomach += meal.carbsG * 1000; // mg
    if (t1) {
      for (const meal of day.meals) if (Math.round(meal.atMin) === min) depot += day.insulinUnits * 1e6; // µU
      if (min === 22 * 60) basal += day.basalUnits * 1e6;
    }
    const emptied = P.kEmpty * stomach; stomach -= emptied; gut += emptied;
    const Ra = P.ka * gut * P.absorbed; gut -= P.ka * gut;
    // Injected insulin: absorbed from under the skin (rapid: about 1 h; basal: spread over the day).
    const fromDepot = depot * (1 / 55); depot -= fromDepot;
    const fromBasal = basal * (1 / 600); basal -= fromBasal;
    const exercising = !!day.exercise && min >= day.exercise.atMin && min < day.exercise.atMin + day.exercise.durationMin;
    // Beta cells: basal, second phase above fasting glucose, first phase on rising glucose.
    const rising = Math.max(0, G - lastG);
    const secretion = basalSecretion * P.kI * P.Ib * (exercising ? 0.6 : 1) + gamma * P.kI * Math.max(0, G - P.Gb) * 0.12 + first * rising * 0.4;
    lastG = G;
    // Alpha cells: glucagon up when glucose and insulin are low, and during exercise.
    const GnTarget = Math.min(300, Math.max(20, P.Gnb * (P.Gb / Math.max(G, 30)) ** 2.2 * (I > 20 ? 0.75 : 1) * (exercising ? 1.6 : 1)));
    Gn += (GnTarget - Gn) * P.kGn;
    // Injected insulin spreads through about 12 L of extracellular fluid.
    I += secretion - P.kI * I + (fromDepot + fromBasal) / 12000;
    I = Math.max(0, I);
    X += -P.p2 * X + P.p2 * Si * (I - P.Ib);
    // Glucagon raises the liver’s output; insulin holds it back (without insulin it runs unchecked).
    const H = liver * (1 + 0.45 * (Gn / P.Gnb - 1)) * (1 + 1.4 * Math.max(0, 1 - I / P.Ib));
    const uptake = exercising ? 0.004 * G : 0;
    G += -(P.Sg + X) * G + P.Sg * P.Gb * H + Ra / P.V - uptake;
    G = Math.max(30, G);
  }
  return out;
}

/** A 75 g oral glucose tolerance test after an overnight fast: glucose at 0 and 120 minutes. */
export function ogtt(diabetes: Diabetes): { fasting: number; twoHour: number; curve: Sample[] } {
  const curve = simulateDay({ diabetes, meals: [{ atMin: 8 * 60, carbsG: 75 }], exercise: null, insulinUnits: 0, basalUnits: diabetes === 'type1' ? 16 : 0 });
  const at = (min: number) => curve.find((s) => s.min === min)!.glucose;
  return { fasting: at(8 * 60), twoHour: at(10 * 60), curve };
}

/** HbA1c (%) for an average glucose (mg/dL), from the ADAG relation. */
export const hba1cFromMean = (eag: number) => (eag + 46.7) / 28.7;
export const meanFromHba1c = (a1c: number) => 28.7 * a1c - 46.7;
/** HbA1c in mmol/mol (IFCC) from % (NGSP). */
export const ifcc = (a1c: number) => (a1c - 2.15) * 10.929;

export function dayStats(s: Sample[]) {
  const mean = s.reduce((n, x) => n + x.glucose, 0) / s.length;
  return { mean, min: Math.min(...s.map((x) => x.glucose)), max: Math.max(...s.map((x) => x.glucose)), hba1c: hba1cFromMean(mean), timeInRange: s.filter((x) => x.glucose >= 70 && x.glucose <= 180).length / s.length };
}

export type GlucoseCategory = 'normal' | 'prediabetes' | 'diabetes';
export const fastingCategory = (g: number): GlucoseCategory => (g >= 126 ? 'diabetes' : g >= 100 ? 'prediabetes' : 'normal');
export const twoHourCategory = (g: number): GlucoseCategory => (g >= 200 ? 'diabetes' : g >= 140 ? 'prediabetes' : 'normal');
export const hba1cCategory = (a: number): GlucoseCategory => (a >= 6.5 ? 'diabetes' : a >= 5.7 ? 'prediabetes' : 'normal');
