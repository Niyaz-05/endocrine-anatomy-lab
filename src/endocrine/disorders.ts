/**
 * Endocrine disorders and a reader for the usual blood tests (pure). Educational only: real
 * diagnosis needs a clinician, repeat tests and the whole picture.
 *
 * Reference ranges and cut-offs: thyroid (ATA / Endocrine Society: TSH 0.4–4.0 mIU/L, free T4
 * 12–22 pmol/L); cortisol (Endocrine Society: a 9 am cortisol under about 100 nmol/L suggests adrenal
 * insufficiency and needs a short Synacthen test; after 1 mg dexamethasone overnight cortisol should
 * fall under 50 nmol/L); glucose (ADA Standards of Care); calcium (total 2.2–2.6 mmol/L; PTH about
 * 1.6–6.9 pmol/L).
 */
import type { ScenarioId } from './axes';
import type { Diabetes } from './glucose';
import type { CalciumScenarioId } from './calcium';
import { fastingCategory, hba1cCategory, twoHourCategory, type GlucoseCategory } from './glucose';

export type ThyroidPattern = 'normal' | 'primary-hypo' | 'subclinical-hypo' | 'hyper' | 'subclinical-hyper' | 'central' | 'inappropriate-tsh';
export function readThyroid(tsh: number, ft4: number): { pattern: ThyroidPattern; text: string } {
  const tLow = tsh < 0.4, tHigh = tsh > 4.0, fLow = ft4 < 12, fHigh = ft4 > 22;
  if (tHigh && fLow) return { pattern: 'primary-hypo', text: 'High TSH with low free T4: the thyroid itself is failing (primary hypothyroidism), most often Hashimoto’s thyroiditis.' };
  if (tHigh && !fHigh) return { pattern: 'subclinical-hypo', text: 'High TSH with a normal free T4: the pituitary is pushing a struggling thyroid (subclinical hypothyroidism). Usually rechecked in a few months.' };
  if (tLow && fHigh) return { pattern: 'hyper', text: 'Suppressed TSH with high free T4: the thyroid is overactive (hyperthyroidism), most often Graves’ disease.' };
  if (tLow && !fLow) return { pattern: 'subclinical-hyper', text: 'Low TSH with a normal free T4: mild (subclinical) hyperthyroidism, or too high a levothyroxine dose.' };
  if (!tHigh && fLow) return { pattern: 'central', text: 'Low free T4 without a high TSH: the pituitary (or hypothalamus) is not making enough TSH (central hypothyroidism).' };
  if (!tLow && fHigh) return { pattern: 'inappropriate-tsh', text: 'High free T4 with a TSH that is not suppressed: unusual (a TSH-making tumour, thyroid hormone resistance, or a test problem).' };
  return { pattern: 'normal', text: 'TSH and free T4 are both in range.' };
}

export type CortisolPattern = 'low' | 'indeterminate' | 'normal' | 'not-suppressed' | 'suppressed';
export function readCortisol(morning: number, afterDex: number | null): { pattern: CortisolPattern; text: string }[] {
  const out: { pattern: CortisolPattern; text: string }[] = [];
  if (morning < 100) out.push({ pattern: 'low', text: 'A 9 am cortisol under about 100 nmol/L suggests adrenal insufficiency (as in Addison’s disease); a short Synacthen (ACTH) test is the next step.' });
  else if (morning < 450) out.push({ pattern: 'indeterminate', text: 'A 9 am cortisol of 100–450 nmol/L neither proves nor rules out adrenal insufficiency.' });
  else out.push({ pattern: 'normal', text: 'A 9 am cortisol above about 450 nmol/L makes adrenal insufficiency unlikely.' });
  if (afterDex !== null) out.push(afterDex < 50
    ? { pattern: 'suppressed', text: 'After 1 mg of dexamethasone overnight cortisol fell under 50 nmol/L: normal feedback, which argues against Cushing’s syndrome.' }
    : { pattern: 'not-suppressed', text: 'Cortisol did not fall under 50 nmol/L after dexamethasone: the feedback is not working, as in Cushing’s syndrome. More tests find the cause.' });
  return out;
}

export function readGlucose(fasting: number | null, twoHour: number | null, hba1c: number | null): { category: GlucoseCategory; parts: { test: string; category: GlucoseCategory }[]; text: string } {
  const parts: { test: string; category: GlucoseCategory }[] = [];
  if (fasting !== null) parts.push({ test: 'Fasting glucose', category: fastingCategory(fasting) });
  if (twoHour !== null) parts.push({ test: '2-hour glucose (OGTT)', category: twoHourCategory(twoHour) });
  if (hba1c !== null) parts.push({ test: 'HbA1c', category: hba1cCategory(hba1c) });
  const rank = { normal: 0, prediabetes: 1, diabetes: 2 } as const;
  const category = parts.reduce<GlucoseCategory>((c, p) => (rank[p.category] > rank[c] ? p.category : c), 'normal');
  const text = category === 'diabetes' ? 'In the diabetes range. Without clear symptoms the result is confirmed by a second test.'
    : category === 'prediabetes' ? 'Above normal but below the diabetes range (prediabetes): a higher risk of type 2 diabetes, often lowered by activity and weight loss.'
    : 'In the normal range.';
  return { category, parts, text };
}

export type CalciumPattern = 'normal' | 'primary-hyperpara' | 'non-pth-high' | 'secondary-hyperpara' | 'hypopara';
export function readCalcium(total: number, pth: number): { pattern: CalciumPattern; text: string } {
  const high = total > 2.6, low = total < 2.2, pthHigh = pth > 6.9, pthLow = pth < 1.6;
  if (high && !pthLow) return { pattern: 'primary-hyperpara', text: 'High calcium with a PTH that is high or not suppressed: the parathyroids are overactive (primary hyperparathyroidism, usually one benign adenoma).' };
  if (high) return { pattern: 'non-pth-high', text: 'High calcium with a suppressed PTH: the calcium comes from elsewhere (for example cancer in bone or too much vitamin D); the parathyroids are rightly switched off.' };
  if (low && pthHigh) return { pattern: 'secondary-hyperpara', text: 'Low calcium with a high PTH: the parathyroids are responding to something else, most often vitamin D deficiency or kidney disease (secondary hyperparathyroidism).' };
  if (low) return { pattern: 'hypopara', text: 'Low calcium with a low or normal PTH: the parathyroids are not responding (hypoparathyroidism), for example after thyroid surgery.' };
  if (pthHigh) return { pattern: 'secondary-hyperpara', text: 'Normal calcium with a high PTH: PTH is working hard to hold calcium up, often because of low vitamin D.' };
  return { pattern: 'normal', text: 'Calcium and PTH are both in range.' };
}

export interface Disorder {
  id: string;
  label: string;
  glands: string[];
  cause: string;
  signs: string;
  treatment: string;
  /** What the lab sets to show it. */
  shows: { axis?: ScenarioId; diabetes?: Diabetes; calcium?: CalciumScenarioId };
}

export const DISORDERS: Disorder[] = [
  { id: 'hashimoto', label: 'Hypothyroidism (Hashimoto’s)', glands: ['thyroid-lobe-left', 'thyroid-lobe-right', 'thyroid-isthmus'], cause: 'The immune system slowly destroys the thyroid. Across the world, iodine deficiency is the other main cause.', signs: 'Tiredness, feeling cold, weight gain, dry skin, constipation, slow heart rate, low mood; sometimes a goitre.', treatment: 'Levothyroxine (synthetic T4) every day, adjusted by the TSH.', shows: { axis: 'hashimoto' } },
  { id: 'graves', label: 'Hyperthyroidism (Graves’)', glands: ['thyroid-lobe-left', 'thyroid-lobe-right', 'thyroid-isthmus'], cause: 'Antibodies switch on the TSH receptor, so the thyroid grows and overworks.', signs: 'Weight loss, heat intolerance, a fast or irregular heartbeat, tremor, anxiety; a smooth goitre; in Graves’, bulging eyes.', treatment: 'Antithyroid tablets (carbimazole), radioactive iodine or surgery; beta-blockers ease the symptoms.', shows: { axis: 'graves' } },
  { id: 'iodine', label: 'Iodine-deficiency goitre', glands: ['thyroid-lobe-left', 'thyroid-lobe-right', 'thyroid-isthmus'], cause: 'Too little iodine in the diet to make enough thyroid hormone; TSH makes the gland grow.', signs: 'A swelling in the neck; hypothyroidism; in pregnancy, harm to the baby’s brain development.', treatment: 'Iodised salt prevents it.', shows: { axis: 'iodine' } },
  { id: 'addison', label: 'Addison’s disease', glands: ['adrenal-cortex-left', 'adrenal-cortex-right'], cause: 'The adrenal cortex is destroyed, usually by the immune system: too little cortisol and aldosterone.', signs: 'Tiredness, weight loss, low blood pressure and dizziness, craving salt, darker skin (from the high ACTH). An adrenal crisis is an emergency.', treatment: 'Hydrocortisone and fludrocortisone for life; extra in illness.', shows: { axis: 'addison' } },
  { id: 'cushing', label: 'Cushing’s syndrome', glands: ['pituitary-anterior', 'adrenal-cortex-left', 'adrenal-cortex-right'], cause: 'Too much cortisol: most often from steroid medicines, otherwise from an ACTH-making pituitary tumour (Cushing’s disease) or an adrenal tumour.', signs: 'Weight gain on the trunk and face, thin skin and purple stretch marks, weak muscles, high blood pressure and glucose, thin bones.', treatment: 'Remove the cause: surgery on the tumour, or reduce steroid medicines slowly.', shows: { axis: 'cushing-disease' } },
  { id: 'type1', label: 'Type 1 diabetes', glands: ['pancreas-head', 'pancreas-neck', 'pancreas-body', 'pancreas-tail'], cause: 'The immune system destroys the beta cells, so no insulin is made. Usually starts in childhood or young adulthood.', signs: 'Thirst, passing a lot of urine, weight loss, tiredness; without insulin, ketoacidosis.', treatment: 'Insulin every day (injections or a pump), matched to food and activity; glucose monitoring.', shows: { diabetes: 'type1' } },
  { id: 'type2', label: 'Type 2 diabetes', glands: ['pancreas-head', 'pancreas-neck', 'pancreas-body', 'pancreas-tail'], cause: 'The body’s cells respond poorly to insulin (insulin resistance) and the beta cells cannot keep up. Linked to weight, inactivity and family history.', signs: 'Often none at first; thirst, frequent urination, tiredness; over years, damage to eyes, kidneys, nerves and arteries.', treatment: 'Activity and weight loss, then metformin and other medicines; sometimes insulin.', shows: { diabetes: 'type2' } },
  { id: 'hyperpara', label: 'Primary hyperparathyroidism', glands: ['parathyroid-superior-left', 'parathyroid-inferior-left', 'parathyroid-superior-right', 'parathyroid-inferior-right'], cause: 'Usually one benign parathyroid adenoma making too much PTH.', signs: 'Often found on a blood test; kidney stones, thin bones, tummy pain, low mood (“stones, bones, groans and moans”).', treatment: 'Surgery to remove the overactive gland.', shows: { calcium: 'adenoma' } },
  { id: 'hypopara', label: 'Hypoparathyroidism', glands: ['parathyroid-superior-left', 'parathyroid-inferior-left', 'parathyroid-superior-right', 'parathyroid-inferior-right'], cause: 'Most often the parathyroids are removed or damaged during thyroid surgery.', signs: 'Tingling round the mouth and in the fingers, muscle cramps and spasms (tetany).', treatment: 'Calcium and active vitamin D (calcitriol).', shows: { calcium: 'hypo' } },
  { id: 'vitamin-d', label: 'Vitamin D deficiency', glands: ['parathyroid-superior-left', 'parathyroid-inferior-left', 'parathyroid-superior-right', 'parathyroid-inferior-right', 'kidney-left', 'kidney-right'], cause: 'Little sunlight on the skin and little in the diet; also kidney disease (which stops vitamin D being activated).', signs: 'Bone pain and weak muscles; rickets in children, osteomalacia in adults.', treatment: 'Vitamin D supplements; calcium if the diet is short.', shows: { calcium: 'vitamin-d-deficiency' } },
  { id: 'pituitary-failure', label: 'Pituitary failure', glands: ['pituitary-anterior'], cause: 'A pituitary tumour pressing on the gland, surgery, radiotherapy, or bleeding into it.', signs: 'Depends on the hormones lost: tiredness (TSH, ACTH), missed periods (LH, FSH), poor growth in children (GH).', treatment: 'Replace the missing hormones (levothyroxine, hydrocortisone, sex hormones).', shows: { axis: 'pituitary-failure' } },
];
export const disorderById = (id: string) => DISORDERS.find((d) => d.id === id);
