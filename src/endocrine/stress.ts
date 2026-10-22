/**
 * Stress and the body clock (pure).
 *
 * - Fight or flight: the sympathetic nerves make the adrenal medulla release adrenaline within
 *   seconds; its half-life in blood is about 2 minutes, so it falls quickly once the stress ends.
 *   It raises the heart rate, blood pressure and blood glucose (glycogen breakdown in the liver).
 *   The slower HPA response raises cortisol over 15–30 minutes (Guyton & Hall 14e ch. 61 and 78).
 * - The daily cortisol curve: lowest around midnight, rising in the early morning, with a further
 *   rise of about 50 % in the 30–45 minutes after waking (the cortisol awakening response) and a
 *   slow fall through the day (Pruessner et al. 1997; Endocrine Society).
 * - Melatonin: made by the pineal gland in the dark. It starts rising about 2 hours before the usual
 *   bedtime (dim-light melatonin onset), peaks around 2–4 am and is low by day. Light at night
 *   suppresses it: about half at roughly 100 lux of room light (Zeitzer et al. 2000; Gooley et al.
 *   2011).
 */

/** Cortisol, nmol/L, at clock hour `h` (0–24) for someone waking at `wakeH`. */
export function cortisolClock(h: number, wakeH = 7): number {
  const since = (((h - wakeH) % 24) + 24) % 24; // hours since waking
  // Falls slowly through the waking day to its lowest about 17 hours after waking (around midnight),
  // then rises from the early hours towards waking.
  const base = 60 + 420 * Math.exp(-since / 6.5) + 300 * Math.exp(-(((24 - since) / 2.4) ** 2));
  // The awakening response: an extra rise peaking 30–45 minutes after waking.
  const car = 180 * Math.exp(-(((since - 0.6) / 0.45) ** 2));
  return Math.max(30, base + car);
}

export interface MelatoninInput { bedtimeH: number; wakeH: number; lightLux: number }
/** Melatonin, pg/mL, at clock hour `h`; light at night (lux) suppresses it. */
export function melatonin(h: number, m: MelatoninInput): number {
  const onset = m.bedtimeH - 2; // dim-light melatonin onset
  const since = (((h - onset) % 24) + 24) % 24;
  const night = ((((m.wakeH - onset) % 24) + 24) % 24) + 0.8; // hours from onset to the morning fall
  let level = 3;
  if (since < night) {
    const rise = 1 - Math.exp(-since / 1.3);
    const fall = since > night - 1.6 ? Math.exp(-(since - (night - 1.6)) / 0.6) : 1;
    // Highest about 5–6 hours after onset: 2–4 am for a 23:00 bedtime.
    const peakShape = 0.7 + 0.3 * Math.exp(-(((since - 5.5) / 2.5) ** 2));
    level = 3 + 75 * rise * fall * peakShape;
  }
  // Light only matters while melatonin is up (and is the natural light by day).
  const awakeLight = isAsleep(h, m) ? 0 : m.lightLux;
  return 3 + (level - 3) * (1 - suppression(awakeLight));
}
/** Share of melatonin removed by light of `lux` (half at about 100 lux). */
export const suppression = (lux: number) => lux / (lux + 100);
export function isAsleep(h: number, m: Pick<MelatoninInput, 'bedtimeH' | 'wakeH'>): boolean {
  const since = (((h - m.bedtimeH) % 24) + 24) % 24;
  const length = (((m.wakeH - m.bedtimeH) % 24) + 24) % 24;
  return since < length;
}

export interface StressPoint { min: number; adrenaline: number; heartRate: number; systolic: number; glucose: number; cortisol: number }
/** Minutes 0…60 after a stress that lasts `durationMin`, starting at minute 2. */
export function fightOrFlight(durationMin: number, startCortisol = 350): StressPoint[] {
  const out: StressPoint[] = [];
  const k = Math.LN2 / 2; // adrenaline half-life about 2 minutes
  let adr = 30, glu = 90, cort = startCortisol, acthDrive = 0;
  for (let s = 0; s <= 60 * 60; s += 5) {
    const min = s / 60;
    const on = min >= 2 && min < 2 + durationMin;
    const target = on ? 450 : 30; // pg/mL
    adr += (target - adr) * (1 - Math.exp(-(on ? 2.5 : k) * (5 / 60)));
    // Glucose follows adrenaline over minutes (liver glycogen), then insulin brings it back.
    glu += ((90 + 0.09 * (adr - 30)) - glu) * (1 - Math.exp(-(5 / 60) / 4));
    // ACTH, then cortisol, over 15–30 minutes.
    acthDrive += ((on ? 1 : 0) - acthDrive) * (1 - Math.exp(-(5 / 60) / (on ? 3 : 10)));
    cort += (startCortisol * (1 + 0.9 * acthDrive) - cort) * (1 - Math.exp(-(5 / 60) / 12));
    if (s % 30 === 0) out.push({ min, adrenaline: adr, heartRate: Math.min(180, 70 + 0.16 * (adr - 30)), systolic: Math.min(190, 118 + 0.09 * (adr - 30)), glucose: glu, cortisol: cort });
  }
  return out;
}
