import type { AnatomicalStructure, SimulationDefinition } from '../contract/schema';
import { measures } from './anchors';

/**
 * The endocrine lab as data. Function statements follow OpenStax Anatomy and Physiology 2e,
 * chapter 17 ("The Endocrine System"), and Guyton & Hall; measurements in the model notes are taken
 * from this model (tools/extract-endocrine.mjs).
 */

const OS = (n: string) => `openstax-17-${n}`;
type M = Omit<AnatomicalStructure, 'kind' | 'synonyms' | 'related'> & { synonyms?: string[]; related?: string[] };
const mesh = (s: M): AnatomicalStructure => ({ ...s, kind: 'mesh', synonyms: s.synonyms ?? [], related: s.related ?? [] });
const group = (s: Omit<M, 'organ'> & { members: string[] }): AnatomicalStructure => ({ ...s, kind: 'group', synonyms: s.synonyms ?? [], related: s.related ?? [] });
const SIDES = ['left', 'right'] as const;
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const mm = (v: number) => `${Math.round(v)} mm`;
const dims = (d: readonly number[]) => d.map((x) => Math.round(x)).join(' × ') + ' mm';
const m = measures;
const BP_NOTE = 'From BodyParts3D (a different, male reference body), placed onto this body by a fit on shared landmarks.';
const MODELLED = 'Modelled: no open scanned model of this gland exists, so it is built to textbook size around the real structures of this body.';

const structures: AnatomicalStructure[] = [
  // ── Groups ────────────────────────────────────────────────────────────────
  group({
    id: 'pituitary-gland', label: 'Pituitary gland', synonyms: ['hypophysis', 'master gland', 'pituitary'], layer: 'hypothalamus-pituitary', side: 'midline',
    members: ['pituitary-anterior', 'pituitary-posterior', 'infundibulum'],
    summary: 'A pea-sized gland hanging from the base of the brain on a stalk, sitting in a saddle of bone (the sella turcica of the sphenoid).',
    function: 'Two glands in one: the anterior lobe makes six hormones under the control of the hypothalamus; the posterior lobe stores and releases two hormones made by hypothalamic neurons.',
    hormones: ['tsh', 'acth', 'fsh', 'lh', 'gh', 'prolactin', 'adh', 'oxytocin'],
    modelNote: `In this model the pituitary is ${dims(m.pituitary.sizeMm)} and holds about ${m.pituitary.volumeMl.toFixed(2)} mL (textbooks: about 1.3 × 1 × 0.6 cm, 0.5 g).`,
    related: ['hypothalamus', 'sphenoid-bone'], closeUp: 'pituitary', sources: [OS('3'), 'bodyparts3d'],
  }),
  group({
    id: 'thyroid-gland', label: 'Thyroid gland', synonyms: ['thyroid'], layer: 'thyroid', side: 'midline',
    members: ['thyroid-lobe-left', 'thyroid-lobe-right', 'thyroid-isthmus'],
    summary: 'A butterfly-shaped gland in the front of the neck: two lobes on either side of the trachea, joined by an isthmus below the larynx.',
    function: 'Its follicles store thyroglobulin and use iodine to make thyroxine (T4) and triiodothyronine (T3), which set the body’s metabolic rate; its C cells make calcitonin.',
    hormones: ['t4', 't3', 'calcitonin'],
    modelNote: `${MODELLED} About ${Math.round(m.thyroid.volumeMl)} mL in all (an adult woman’s thyroid is about 10–15 mL).`,
    related: ['parathyroid-glands', 'trachea', 'thyroid-cartilage'], closeUp: 'follicle', sources: [OS('4'), 'gray'],
  }),
  group({
    id: 'parathyroid-glands', label: 'Parathyroid glands', synonyms: ['parathyroids', 'parathyroid'], layer: 'thyroid', side: 'midline',
    members: ['parathyroid-superior-left', 'parathyroid-inferior-left', 'parathyroid-superior-right', 'parathyroid-inferior-right'],
    summary: 'Usually four tiny glands on the back of the thyroid, two on each side.',
    function: 'Release parathyroid hormone (PTH) when blood calcium falls, the main control of calcium in the blood.',
    hormones: ['pth'], modelNote: `${MODELLED} Each is ${dims(m.parathyroid.sizeMm)}. Their number and positions vary between people.`,
    related: ['thyroid-gland'], sources: [OS('5'), 'gray'],
  }),
  group({
    id: 'thymus', label: 'Thymus', synonyms: ['thymus gland'], layer: 'thymus', side: 'midline',
    members: ['thymus-left', 'thymus-right'],
    summary: 'A two-lobed organ in the upper chest, behind the sternum and in front of the heart’s great vessels.',
    function: 'Where T lymphocytes mature; its hormones (thymosins) help them. Large in children, it shrinks and fills with fat after puberty.',
    hormones: ['thymosin'], related: ['sternum', 'heart'], sources: [OS('10'), 'hra-united'],
  }),
  ...SIDES.map((side) => group({
    id: `adrenal-gland-${side}`, label: `${cap(side)} adrenal gland`, synonyms: ['suprarenal gland', 'adrenal'], layer: 'adrenal', side,
    members: [`adrenal-cortex-${side}`, `adrenal-medulla-${side}`],
    summary: side === 'left' ? 'A half-moon-shaped gland on the upper, inner edge of the left kidney.' : 'A pyramid-shaped gland on top of the right kidney.',
    function: 'Two glands in one: the outer cortex makes steroid hormones (aldosterone, cortisol, androgens); the inner medulla, part of the sympathetic nervous system, makes adrenaline and noradrenaline.',
    hormones: ['aldosterone', 'cortisol', 'dhea', 'adrenaline', 'noradrenaline'],
    modelNote: `${BP_NOTE} Here ${dims(m.adrenal[side].sizeMm)}, about ${m.adrenal[side].volumeMl.toFixed(1)} mL (a living adrenal weighs about 4–6 g).`,
    related: [`kidney-${side}`], closeUp: 'adrenal', sources: [OS('6'), 'bodyparts3d'],
  })),
  group({
    id: 'pancreas', label: 'Pancreas', synonyms: ['islets of Langerhans', 'islets', 'endocrine pancreas'], layer: 'pancreas', side: 'midline',
    members: ['pancreas-head', 'pancreas-neck', 'pancreas-body', 'pancreas-tail', 'pancreatic-duct'],
    summary: 'A long gland behind the stomach, its head in the curve of the duodenum and its tail reaching the spleen.',
    function: 'Mostly an exocrine gland making digestive juice, but about 1–2 % of it is a million islets of Langerhans: beta cells make insulin, alpha cells glucagon, delta cells somatostatin.',
    hormones: ['insulin', 'glucagon', 'somatostatin-p'],
    modelNote: `In this body the pancreas is about ${Math.round(m.pancreas.lengthMm / 10)} cm long (textbooks: 12–15 cm), level with ${m.pancreas.level}.`,
    related: ['duodenum', 'liver', 'spleen'], closeUp: 'islet', sources: [OS('9'), 'hra-united'],
  }),
  group({
    id: 'heart', label: 'Heart', synonyms: ['cardiac'], layer: 'makers', side: 'midline', members: ['heart-atria', 'heart-ventricles'],
    summary: 'The muscular pump in the middle of the chest.',
    function: 'Also an endocrine organ: when its walls are stretched by too much blood, the atria release ANP and the ventricles BNP, which make the kidneys lose salt and water. Every hormone in the blood passes through it.',
    hormones: ['anp', 'bnp'], related: ['aorta', 'kidney-left'], sources: [OS('10'), 'hra-united'],
  }),
  group({
    id: 'aorta', label: 'Aorta', synonyms: ['thoracic aorta', 'abdominal aorta'], layer: 'artery', side: 'midline',
    members: ['ascending-aorta', 'aortic-arch', 'thoracic-aorta', 'abdominal-aorta'],
    summary: 'The body’s main artery, from the left ventricle up, over the arch and down in front of the spine.',
    function: 'Carries hormones with the blood to every organ: its branches reach the thyroid, the head, the adrenals, the kidneys, the gut and the ovaries.',
    related: ['heart'], sources: ['openstax-vessels', 'hra-united'],
  }),
  group({
    id: 'brain', label: 'Brain (faded)', synonyms: ['cerebrum', 'diencephalon'], layer: 'brain', side: 'midline',
    members: ['cerebrum-left', 'cerebrum-right', 'thalamus-left', 'thalamus-right', 'third-ventricle', 'cerebellum', 'brainstem'],
    summary: 'Faded parts of the brain that show where the hypothalamus, pituitary and pineal gland sit.',
    function: 'The hypothalamus links the nervous and endocrine systems: it reads the blood and the brain’s signals and controls the pituitary.',
    related: ['hypothalamus', 'pineal-gland'], sources: ['hra-united'],
  }),
  group({
    id: 'spine', label: 'Spine', synonyms: ['vertebral column', 'backbone', 'vertebrae'], layer: 'bone', side: 'midline',
    members: ['cervical-spine', 'thoracic-spine', 'lumbar-spine', 'sacrum'],
    summary: 'The vertebral column, from the neck to the sacrum.',
    function: 'A landmark for the glands’ levels, and a store of calcium that PTH can release.',
    modelNote: 'This body (the Visible Human female) has six lumbar vertebrae, a normal variation.',
    related: ['skull'], sources: ['openstax-skeleton', 'hra-united'],
  }),
  group({
    id: 'larynx-and-trachea', label: 'Larynx and trachea', synonyms: ['airway', 'windpipe', 'voice box'], layer: 'airway', side: 'midline',
    members: ['thyroid-cartilage', 'cricoid-cartilage', 'trachea', 'hyoid-bone'],
    summary: 'The voice box and windpipe in the front of the neck.',
    function: 'The thyroid gland is wrapped round the trachea just below the larynx, and moves up with it when you swallow.',
    related: ['thyroid-gland'], sources: ['hra-united', 'gray'],
  }),

  // ── Hypothalamus, pituitary, pineal ───────────────────────────────────────
  mesh({
    id: 'hypothalamus', label: 'Hypothalamus', synonyms: ['median eminence'], layer: 'hypothalamus-pituitary', side: 'midline',
    summary: 'A small region at the base of the brain, below the thalamus, forming the floor of the third ventricle.',
    function: 'The link between the nervous and endocrine systems. Its neurons make releasing and inhibiting hormones carried to the anterior pituitary by tiny portal veins, and make ADH and oxytocin, carried down their axons to the posterior pituitary. It also controls temperature, hunger, thirst and the body clock.',
    hormones: ['trh', 'crh', 'gnrh', 'ghrh', 'somatostatin-h', 'dopamine', 'adh', 'oxytocin'],
    modelNote: `HuBMAP (Allen brain) hypothalamus, ${dims(m.hypothalamus.sizeMm)}.`,
    related: ['pituitary-gland', 'infundibulum', 'third-ventricle'], closeUp: 'pituitary', sources: [OS('3'), 'hra-united'],
  }),
  mesh({
    id: 'pituitary-anterior', label: 'Anterior pituitary', synonyms: ['adenohypophysis', 'anterior lobe'], layer: 'hypothalamus-pituitary', side: 'midline', organ: 'pituitary-gland',
    summary: 'The larger, front lobe of the pituitary, made of glandular tissue.',
    function: 'Releases TSH, ACTH, FSH, LH, growth hormone and prolactin when the hypothalamus’s releasing hormones reach it through the hypophyseal portal veins; the hormones from its target glands feed back to slow it.',
    hormones: ['tsh', 'acth', 'fsh', 'lh', 'gh', 'prolactin'],
    modelNote: `${BP_NOTE} The front ${Math.round(m.pituitary.anteriorShare * 100)} % of the gland is shown as the anterior lobe (textbooks: about 75–80 %).`,
    related: ['hypothalamus', 'pituitary-posterior'], closeUp: 'pituitary', sources: [OS('3'), 'bodyparts3d'],
  }),
  mesh({
    id: 'pituitary-posterior', label: 'Posterior pituitary', synonyms: ['neurohypophysis', 'posterior lobe'], layer: 'hypothalamus-pituitary', side: 'midline', organ: 'pituitary-gland',
    summary: 'The smaller, back lobe of the pituitary, an extension of the brain.',
    function: 'Made of the axon endings of hypothalamic neurons. It stores and releases ADH (water balance) and oxytocin (labour and milk release); it makes no hormones of its own.',
    hormones: ['adh', 'oxytocin'], modelNote: BP_NOTE,
    related: ['infundibulum', 'pituitary-anterior'], closeUp: 'pituitary', sources: [OS('3'), 'bodyparts3d'],
  }),
  mesh({
    id: 'infundibulum', label: 'Pituitary stalk (infundibulum)', synonyms: ['infundibulum', 'stalk', 'hypophyseal portal system'], layer: 'hypothalamus-pituitary', side: 'midline', organ: 'pituitary-gland',
    summary: 'The stalk joining the hypothalamus to the pituitary.',
    function: 'Carries the axons of hypothalamic neurons to the posterior lobe and the hypophyseal portal veins that take releasing hormones to the anterior lobe.',
    modelNote: `Modelled tube, about ${mm(m.pituitary.stalkLengthMm)} long, from the HuBMAP hypothalamus to the placed pituitary.`,
    related: ['hypothalamus', 'pituitary-posterior'], closeUp: 'pituitary', sources: [OS('3')],
  }),
  mesh({
    id: 'pineal-gland', label: 'Pineal gland', synonyms: ['pineal body', 'epiphysis', 'epiphysis cerebri'], layer: 'pineal', side: 'midline',
    summary: 'A tiny pine-cone-shaped gland in the middle of the brain, behind the third ventricle.',
    function: 'Makes melatonin in the dark, signalled from the eyes through the hypothalamus’s body clock (suprachiasmatic nucleus); melatonin helps set the sleep–wake rhythm.',
    hormones: ['melatonin'], modelNote: `HuBMAP pineal body, ${dims(m.pineal.sizeMm)}.`,
    related: ['hypothalamus', 'thalamus-left'], sources: [OS('7'), 'hra-united'],
  }),

  // ── Thyroid and parathyroids ──────────────────────────────────────────────
  ...SIDES.map((side) => mesh({
    id: `thyroid-lobe-${side}`, label: `${cap(side)} lobe of the thyroid`, synonyms: ['thyroid lobe', 'thyroid'], layer: 'thyroid', side, organ: 'thyroid-gland',
    summary: `One of the two lobes of the thyroid, against the ${side} side of the trachea and larynx.`,
    function: 'Its follicles trap iodide from the blood, attach it to thyroglobulin in the colloid, and release T4 and T3 when TSH stimulates them.',
    hormones: ['t4', 't3', 'calcitonin'],
    modelNote: `${MODELLED} This lobe is ${dims(m.thyroid.lobeSizeMm[side])}, wrapped onto this body’s trachea and larynx.`,
    related: ['thyroid-isthmus', `parathyroid-superior-${side}`, 'trachea'], closeUp: 'follicle', sources: [OS('4'), 'gray'],
  })),
  mesh({
    id: 'thyroid-isthmus', label: 'Isthmus of the thyroid', synonyms: ['isthmus'], layer: 'thyroid', side: 'midline', organ: 'thyroid-gland',
    summary: 'The bridge of thyroid tissue crossing the front of the trachea.',
    function: 'Joins the two lobes, usually in front of tracheal rings 2 to 4.',
    modelNote: `${MODELLED} Placed over rings ${m.thyroid.isthmusRings.join('–')}; in this body it lies level with ${m.thyroid.isthmusLevel} (the larynx of the Visible Human female sits low: its cricoid cartilage is level with ${m.thyroid.cricoidLowerBorderLevel}, often C6).`,
    related: ['thyroid-lobe-left', 'thyroid-lobe-right', 'trachea'], closeUp: 'follicle', sources: [OS('4'), 'gray'],
  }),
  ...SIDES.flatMap((side) => (['superior', 'inferior'] as const).map((pos) => mesh({
    id: `parathyroid-${pos}-${side}`, label: `${cap(pos)} parathyroid gland (${side})`, synonyms: ['parathyroid'], layer: 'thyroid', side, organ: 'parathyroid-glands',
    summary: pos === 'superior' ? `The upper parathyroid on the back of the ${side} thyroid lobe, about level with the cricoid cartilage.` : `The lower parathyroid on the back of the ${side} thyroid lobe, near its lower pole.`,
    function: 'Senses blood calcium with calcium-sensing receptors and releases PTH when it falls.',
    hormones: ['pth'], modelNote: `${MODELLED} The lower glands vary most in position.`,
    related: [`thyroid-lobe-${side}`, 'inferior-thyroid-artery-' + side], sources: [OS('5'), 'gray'],
  }))),
  ...SIDES.map((side) => mesh({
    id: `thymus-${side}`, label: `${cap(side)} lobe of the thymus`, synonyms: ['thymus'], layer: 'thymus', side, organ: 'thymus',
    summary: 'One of the two lobes of the thymus, in the upper chest.',
    function: 'T cells mature here; thymosins help them.',
    modelNote: side === 'left' ? `HuBMAP thymus, ${dims(m.thymus.sizeMm)} for both lobes. In older adults it is mostly fat.` : 'HuBMAP thymus. This lobe lies close to the midline in this body.',
    related: ['sternum'], sources: [OS('10'), 'hra-united'],
  })),

  // ── Adrenal glands ────────────────────────────────────────────────────────
  ...SIDES.flatMap((side) => [
    mesh({
      id: `adrenal-cortex-${side}`, label: `${cap(side)} adrenal cortex`, synonyms: ['adrenal cortex', 'adrenal gland', 'suprarenal gland', 'zona glomerulosa', 'zona fasciculata', 'zona reticularis'], layer: 'adrenal', side, organ: `adrenal-gland-${side}`,
      summary: 'The yellow outer part of the adrenal gland, about 80–90 % of it.',
      function: 'Three zones from outside in: the zona glomerulosa makes aldosterone (salt and water), the zona fasciculata cortisol (stress, glucose) under ACTH, and the zona reticularis androgens.',
      hormones: ['aldosterone', 'cortisol', 'dhea'], modelNote: `${BP_NOTE} Kept at its own size and pushed out of this body’s kidney.`,
      related: [`adrenal-medulla-${side}`, `kidney-${side}`, `suprarenal-vein-${side}`], closeUp: 'adrenal', sources: [OS('6'), 'bodyparts3d'],
    }),
    mesh({
      id: `adrenal-medulla-${side}`, label: `${cap(side)} adrenal medulla`, synonyms: ['adrenal medulla', 'chromaffin cells'], layer: 'adrenal', side, organ: `adrenal-gland-${side}`,
      summary: 'The red-brown core of the adrenal gland.',
      function: 'Its chromaffin cells are modified sympathetic neurons: nerve signals in stress make them release adrenaline and noradrenaline into the blood within seconds.',
      hormones: ['adrenaline', 'noradrenaline'],
      modelNote: `Modelled inside the BodyParts3D gland: about ${Math.round(m.adrenal[side].medullaShare * 100)} % of its volume (textbooks: about 10–20 %). Seen with a cut or a see-through cortex.`,
      related: [`adrenal-cortex-${side}`], closeUp: 'adrenal', sources: [OS('6')],
    }),
  ]),

  // ── Pancreas ──────────────────────────────────────────────────────────────
  mesh({ id: 'pancreas-head', label: 'Head of the pancreas', synonyms: ['uncinate process'], layer: 'pancreas', side: 'midline', organ: 'pancreas', summary: 'The widest part of the pancreas, in the C-shaped curve of the duodenum; its hook-like uncinate process lies behind the mesenteric vessels.', function: 'Has the fewest islets per gram; its ducts open into the duodenum.', hormones: ['insulin', 'glucagon'], related: ['duodenum', 'pancreas-neck'], closeUp: 'islet', sources: [OS('9'), 'hra-united'] }),
  mesh({ id: 'pancreas-neck', label: 'Neck of the pancreas', layer: 'pancreas', side: 'midline', organ: 'pancreas', summary: 'The short narrow part in front of the portal vein.', function: 'Its veins, like the rest of the pancreas’s, drain into the portal vein, so insulin and glucagon reach the liver first.', hormones: ['insulin', 'glucagon'], related: ['hepatic-portal-vein'], closeUp: 'islet', sources: [OS('9'), 'hra-united'] }),
  mesh({ id: 'pancreas-body', label: 'Body of the pancreas', layer: 'pancreas', side: 'midline', organ: 'pancreas', summary: 'The main part, crossing the spine behind the stomach.', function: 'Islets are scattered through it; the splenic artery and vein run along its back.', hormones: ['insulin', 'glucagon', 'somatostatin-p'], related: ['splenic-vein', 'stomach'], closeUp: 'islet', sources: [OS('9'), 'hra-united'] }),
  mesh({ id: 'pancreas-tail', label: 'Tail of the pancreas', layer: 'pancreas', side: 'left', organ: 'pancreas', summary: 'The narrow end, reaching the spleen.', function: 'Holds the most islets per gram.', hormones: ['insulin', 'glucagon'], related: ['spleen', 'pancreas-body'], closeUp: 'islet', sources: [OS('9'), 'hra-united'] }),
  mesh({ id: 'pancreatic-duct', label: 'Pancreatic ducts', synonyms: ['duct of Wirsung', 'exocrine pancreas'], layer: 'pancreas', side: 'midline', organ: 'pancreas', summary: 'The ducts running through the pancreas to the duodenum.', function: 'Carry the exocrine juice (enzymes and bicarbonate) to the gut. Endocrine hormones never use ducts: they enter the blood.', related: ['duodenum'], sources: [OS('9'), 'hra-united'] }),
  ...SIDES.map((side) => mesh({
    id: `ovary-${side}`, label: `${cap(side)} ovary`, synonyms: ['ovary', 'gonad'], layer: 'ovary', side,
    summary: 'An almond-shaped gland beside the uterus, on the side wall of the pelvis.',
    function: 'Releases eggs and makes oestradiol (from the follicles), progesterone (from the corpus luteum) and inhibin, under FSH and LH.',
    hormones: ['oestradiol', 'progesterone', 'inhibin'],
    modelNote: `HuBMAP ovary, ${dims(m.ovary[side])}. The reference body was 59 years old: after the menopause the ovaries are small (about 3 × 2 × 1 cm before it).`,
    related: ['uterus', `uterine-tube-${side}`], sources: [OS('8'), 'hra-united'],
  })),

  // ── Other hormone makers ──────────────────────────────────────────────────
  mesh({ id: 'heart-atria', label: 'Atria of the heart', synonyms: ['atrium', 'ANP'], layer: 'makers', side: 'midline', organ: 'heart', summary: 'The two upper chambers of the heart.', function: 'Stretched by a large blood volume, their muscle cells release atrial natriuretic peptide (ANP).', hormones: ['anp'], related: ['heart-ventricles', 'superior-vena-cava'], sources: [OS('10'), 'hra-united'] }),
  mesh({ id: 'heart-ventricles', label: 'Ventricles of the heart', synonyms: ['ventricle', 'BNP'], layer: 'makers', side: 'midline', organ: 'heart', summary: 'The two lower, pumping chambers.', function: 'When overstretched they release BNP; its level in the blood helps doctors diagnose heart failure.', hormones: ['bnp'], related: ['heart-atria', 'ascending-aorta'], sources: [OS('10'), 'hra-united'] }),
  ...SIDES.map((side) => mesh({ id: `kidney-${side}`, label: `${cap(side)} kidney`, synonyms: ['kidney', 'renal'], layer: 'makers', side, summary: 'One of the two kidneys, against the back wall of the abdomen.', function: 'Makes erythropoietin (red blood cells), renin (which starts the renin–angiotensin–aldosterone system) and calcitriol (active vitamin D); responds to ADH, aldosterone, PTH and ANP.', hormones: ['epo', 'renin', 'calcitriol'], related: [`adrenal-gland-${side}`, `renal-artery-${side}`], sources: [OS('10'), 'hra-united'] })),
  mesh({ id: 'stomach', label: 'Stomach', layer: 'makers', side: 'midline', summary: 'The muscular bag under the left ribs.', function: 'Its G cells make gastrin (acid release) and other cells ghrelin (hunger).', hormones: ['gastrin', 'ghrelin'], modelNote: `${BP_NOTE} Pushed out of this body’s liver, spleen and pancreas, where it overlapped.`, related: ['duodenum', 'pancreas'], sources: [OS('10'), 'bodyparts3d'] }),
  mesh({ id: 'duodenum', label: 'Duodenum', synonyms: ['small intestine'], layer: 'makers', side: 'midline', summary: 'The first part of the small intestine, curving round the head of the pancreas.', function: 'Its cells release secretin, cholecystokinin and GIP when food arrives, which control the pancreas, gallbladder and insulin release.', hormones: ['secretin', 'cck', 'gip'], related: ['pancreas-head', 'stomach'], sources: [OS('10'), 'hra-united'] }),
  mesh({ id: 'liver', label: 'Liver', layer: 'makers', side: 'midline', summary: 'The large organ under the right ribs.', function: 'Makes IGF-1 under growth hormone, and is the first target of insulin and glucagon, which reach it through the portal vein; it also stores glucose as glycogen.', hormones: ['igf1'], related: ['hepatic-portal-vein', 'pancreas'], sources: [OS('10'), 'hra-united'] }),

  // ── Neighbours ────────────────────────────────────────────────────────────
  mesh({ id: 'spleen', label: 'Spleen', layer: 'neighbours', side: 'left', summary: 'An organ of the immune system in the upper left abdomen.', function: 'The tail of the pancreas reaches it; its vein carries pancreatic hormones to the portal vein.', related: ['pancreas-tail', 'splenic-vein'], sources: ['hra-united'] }),
  mesh({ id: 'uterus', label: 'Uterus', synonyms: ['womb'], layer: 'neighbours', side: 'midline', summary: 'The womb, in the middle of the pelvis.', function: 'A target of oestradiol and progesterone (its lining) and oxytocin (labour).', related: ['ovary-left', 'ovary-right'], sources: ['hra-united'] }),
  ...SIDES.map((side) => mesh({ id: `uterine-tube-${side}`, label: `${cap(side)} uterine tube`, synonyms: ['fallopian tube', 'oviduct'], layer: 'neighbours', side, summary: 'The tube from the uterus to the ovary.', function: 'Its fringed end catches the egg released by the ovary.', related: [`ovary-${side}`, 'uterus'], sources: ['hra-united'] })),

  // ── Arteries ──────────────────────────────────────────────────────────────
  mesh({ id: 'ascending-aorta', label: 'Ascending aorta', layer: 'artery', side: 'midline', organ: 'aorta', summary: 'The first part of the aorta, rising from the left ventricle.', function: 'All hormones leaving the heart for the body pass through it.', related: ['aortic-arch', 'heart-ventricles'], sources: ['openstax-vessels', 'hra-united'] }),
  mesh({ id: 'aortic-arch', label: 'Arch of the aorta', layer: 'artery', side: 'midline', organ: 'aorta', summary: 'The curve of the aorta over the heart.', function: 'Gives off the brachiocephalic trunk, the left common carotid and the left subclavian arteries, which supply the head, neck (and thyroid) and arms.', related: ['brachiocephalic-trunk', 'common-carotid-artery-left'], sources: ['openstax-vessels', 'hra-united'] }),
  mesh({ id: 'thoracic-aorta', label: 'Thoracic aorta', synonyms: ['descending aorta'], layer: 'artery', side: 'midline', organ: 'aorta', summary: 'The aorta descending through the chest.', function: 'Carries blood down to the abdomen.', related: ['abdominal-aorta'], sources: ['openstax-vessels', 'hra-united'] }),
  mesh({ id: 'abdominal-aorta', label: 'Abdominal aorta', layer: 'artery', side: 'midline', organ: 'aorta', summary: 'The aorta in the abdomen, in front of the lumbar spine.', function: 'Gives off the coeliac trunk (pancreas, liver), the suprarenal and renal arteries, and the ovarian arteries.', related: ['celiac-trunk', 'renal-artery-left'], sources: ['openstax-vessels', 'hra-united'] }),
  mesh({ id: 'brachiocephalic-trunk', label: 'Brachiocephalic trunk', layer: 'artery', side: 'midline', summary: 'The first branch of the aortic arch.', function: 'Divides into the right common carotid and right subclavian arteries.', related: ['aortic-arch', 'subclavian-artery-right'], sources: ['openstax-vessels', 'hra-united'] }),
  ...SIDES.map((side) => mesh({ id: `common-carotid-artery-${side}`, label: `${cap(side)} common carotid artery`, synonyms: ['carotid artery'], layer: 'artery', side, summary: 'The main artery of the neck.', function: 'Runs up beside the thyroid and larynx; its internal carotid branch supplies the brain, hypothalamus and pituitary.', modelNote: side === 'left' ? 'HuBMAP vessel (its upper neck part is not in the reference body).' : BP_NOTE, related: [`internal-carotid-artery-${side}`, `thyroid-lobe-${side}`], sources: ['openstax-vessels', side === 'left' ? 'hra-united' : 'bodyparts3d'] })),
  ...SIDES.map((side) => mesh({ id: `subclavian-artery-${side}`, label: `${cap(side)} subclavian artery`, layer: 'artery', side, summary: 'The artery to the arm.', function: 'Its thyrocervical trunk gives the inferior thyroid artery.', modelNote: side === 'left' ? undefined : BP_NOTE, related: [`inferior-thyroid-artery-${side}`], sources: ['openstax-vessels', side === 'left' ? 'hra-united' : 'bodyparts3d'] })),
  ...SIDES.map((side) => mesh({ id: `internal-carotid-artery-${side}`, label: `${cap(side)} internal carotid artery`, layer: 'artery', side, summary: 'The artery into the skull, running beside the pituitary.', function: 'Its hypophyseal branches supply the hypothalamus and pituitary, feeding the portal system.', modelNote: `${BP_NOTE} Only its part inside the skull.`, related: ['pituitary-gland', `common-carotid-artery-${side}`], sources: [OS('3'), 'bodyparts3d'] })),
  ...SIDES.map((side) => mesh({ id: `inferior-thyroid-artery-${side}`, label: `${cap(side)} inferior thyroid artery`, synonyms: ['thyrocervical trunk', 'thyroid artery'], layer: 'artery', side, summary: 'The artery to the lower thyroid and the parathyroids, from the thyrocervical trunk.', function: 'The thyroid has one of the richest blood supplies of any organ, so its hormones enter the blood quickly.', modelNote: `${BP_NOTE} The superior thyroid arteries (from the external carotids) are not in the model.`, related: [`thyroid-lobe-${side}`, `parathyroid-inferior-${side}`], sources: [OS('4'), 'bodyparts3d'] })),
  ...SIDES.map((side) => mesh({ id: `suprarenal-arteries-${side}`, label: `${cap(side)} suprarenal arteries`, synonyms: ['adrenal arteries'], layer: 'artery', side, summary: 'Small arteries to the adrenal gland.', function: 'Bring ACTH and angiotensin II to the adrenal cortex.', modelNote: BP_NOTE, related: [`adrenal-gland-${side}`], sources: [OS('6'), 'bodyparts3d'] })),
  ...SIDES.map((side) => mesh({ id: `renal-artery-${side}`, label: `${cap(side)} renal artery`, layer: 'artery', side, summary: 'The artery to the kidney.', function: 'Brings ADH, aldosterone, PTH and ANP to the kidney.', related: [`kidney-${side}`], sources: ['openstax-vessels', 'hra-united'] })),
  mesh({ id: 'celiac-trunk', label: 'Coeliac trunk', synonyms: ['celiac trunk'], layer: 'artery', side: 'midline', summary: 'A short branch of the abdominal aorta.', function: 'Its branches supply the stomach, liver, spleen and pancreas.', related: ['splenic-artery'], sources: ['openstax-vessels', 'hra-united'] }),
  mesh({ id: 'splenic-artery', label: 'Splenic artery', layer: 'artery', side: 'left', summary: 'The artery running along the top of the pancreas to the spleen.', function: 'Gives many small branches to the body and tail of the pancreas.', related: ['pancreas-body'], sources: ['openstax-vessels', 'hra-united'] }),
  mesh({ id: 'pulmonary-trunk', label: 'Pulmonary trunk', synonyms: ['pulmonary arteries'], layer: 'artery', side: 'midline', summary: 'The artery from the right ventricle to the lungs.', function: 'Hormones from the veins pass through the lungs before reaching the body.', related: ['heart-ventricles', 'pulmonary-veins'], sources: ['openstax-vessels', 'hra-united'] }),

  // ── Veins ─────────────────────────────────────────────────────────────────
  mesh({ id: 'superior-vena-cava', label: 'Superior vena cava', synonyms: ['SVC'], layer: 'vein', side: 'midline', summary: 'The large vein bringing blood from the head, neck and arms to the heart.', function: 'Carries the hormones of the pituitary, pineal, thyroid and parathyroids to the heart.', related: ['heart-atria'], sources: ['openstax-vessels', 'hra-united'] }),
  mesh({ id: 'inferior-vena-cava', label: 'Inferior vena cava', synonyms: ['IVC'], layer: 'vein', side: 'midline', summary: 'The large vein from the lower body to the heart.', function: 'Carries the hormones of the adrenals, kidneys, ovaries and (through the liver) the pancreas and gut.', related: ['heart-atria', 'hepatic-veins'], sources: ['openstax-vessels', 'hra-united'] }),
  ...SIDES.map((side) => mesh({ id: `brachiocephalic-vein-${side}`, label: `${cap(side)} brachiocephalic vein`, layer: 'vein', side, summary: 'Joins the jugular and subclavian veins; the two form the superior vena cava.', function: 'The thyroid’s inferior thyroid veins drain into it.', modelNote: BP_NOTE, related: ['superior-vena-cava'], sources: ['openstax-vessels', 'bodyparts3d'] })),
  ...SIDES.map((side) => mesh({ id: `internal-jugular-vein-${side}`, label: `${cap(side)} internal jugular vein`, synonyms: ['jugular vein'], layer: 'vein', side, summary: 'The large vein of the neck, draining the brain.', function: 'Carries the pituitary’s and pineal’s hormones from the venous sinuses of the skull towards the heart.', modelNote: `${BP_NOTE} Only its lower part.`, related: [`brachiocephalic-vein-${side}`], sources: ['openstax-vessels', 'bodyparts3d'] })),
  ...SIDES.map((side) => mesh({ id: `suprarenal-vein-${side}`, label: `${cap(side)} suprarenal vein`, synonyms: ['adrenal vein'], layer: 'vein', side, summary: side === 'left' ? 'Drains the left adrenal gland into the left renal vein.' : 'Drains the right adrenal gland straight into the inferior vena cava.', function: 'Carries cortisol, aldosterone and adrenaline out of the gland.', modelNote: BP_NOTE, related: [`adrenal-gland-${side}`], sources: [OS('6'), 'bodyparts3d'] })),
  ...SIDES.map((side) => mesh({ id: `renal-vein-${side}`, label: `${cap(side)} renal vein`, layer: 'vein', side, summary: 'Drains the kidney into the inferior vena cava.', function: side === 'left' ? 'The left one also receives the left adrenal and ovarian veins.' : 'Carries EPO, renin and calcitriol away.', related: [`kidney-${side}`, 'inferior-vena-cava'], sources: ['openstax-vessels', 'hra-united'] })),
  mesh({ id: 'splenic-vein', label: 'Splenic vein', layer: 'vein', side: 'left', summary: 'The vein behind the pancreas, from the spleen to the portal vein.', function: 'Collects the pancreas’s insulin and glucagon.', related: ['hepatic-portal-vein', 'pancreas-body'], sources: ['openstax-vessels', 'hra-united'] }),
  mesh({ id: 'hepatic-portal-vein', label: 'Hepatic portal vein', synonyms: ['portal vein'], layer: 'vein', side: 'midline', summary: 'The vein carrying blood from the gut, spleen and pancreas into the liver.', function: 'Brings insulin and glucagon to the liver at high concentration, before they reach the rest of the body.', related: ['liver', 'splenic-vein'], sources: ['openstax-vessels', 'hra-united'] }),
  mesh({ id: 'hepatic-veins', label: 'Hepatic veins', layer: 'vein', side: 'midline', summary: 'The veins draining the liver into the inferior vena cava.', function: 'Carry the blood (and hormones) that passed through the liver to the heart.', related: ['liver', 'inferior-vena-cava'], sources: ['openstax-vessels', 'hra-united'] }),
  mesh({ id: 'pulmonary-veins', label: 'Pulmonary veins', layer: 'vein', side: 'midline', summary: 'The four veins from the lungs to the left atrium.', function: 'Bring blood back from the lungs to be pumped to the body.', related: ['heart-atria'], sources: ['openstax-vessels', 'hra-united'] }),

  // ── Airway ────────────────────────────────────────────────────────────────
  mesh({ id: 'thyroid-cartilage', label: 'Thyroid cartilage', synonyms: ['Adam’s apple', 'Adams apple', 'laryngeal prominence', 'larynx'], layer: 'airway', side: 'midline', organ: 'larynx-and-trachea', summary: 'The largest cartilage of the larynx, forming the Adam’s apple.', function: 'Named for its shield shape (Greek thyreos, shield), like the thyroid gland below it. The gland’s upper poles reach its sides.', related: ['thyroid-gland', 'cricoid-cartilage'], sources: ['hra-united', 'gray'] }),
  mesh({ id: 'cricoid-cartilage', label: 'Cricoid cartilage', synonyms: ['cricoid'], layer: 'airway', side: 'midline', organ: 'larynx-and-trachea', summary: 'The ring of cartilage at the bottom of the larynx.', function: 'The isthmus of the thyroid lies just below it, and the superior parathyroids about level with it.', related: ['thyroid-isthmus', 'trachea'], sources: ['hra-united', 'gray'] }),
  mesh({ id: 'trachea', label: 'Trachea', synonyms: ['windpipe', 'tracheal rings'], layer: 'airway', side: 'midline', organ: 'larynx-and-trachea', summary: 'The windpipe, stiffened by C-shaped rings of cartilage.', function: 'The thyroid wraps round its front and sides; a large goitre can press on it.', related: ['thyroid-gland'], sources: ['hra-united', 'gray'] }),
  mesh({ id: 'hyoid-bone', label: 'Hyoid bone', synonyms: ['hyoid'], layer: 'airway', side: 'midline', organ: 'larynx-and-trachea', summary: 'A U-shaped bone above the larynx.', function: 'A thyroglossal duct cyst (left over from the thyroid’s descent in the embryo) often lies near it.', modelNote: BP_NOTE, related: ['thyroid-cartilage'], sources: ['gray', 'bodyparts3d'] }),

  // ── Brain (faded) ─────────────────────────────────────────────────────────
  ...SIDES.map((side) => mesh({ id: `thalamus-${side}`, label: `${cap(side)} thalamus`, layer: 'brain', side, organ: 'brain', summary: 'The relay centre of the forebrain, above the hypothalamus.', function: 'The hypothalamus lies below it and the pineal gland behind it.', related: ['hypothalamus', 'pineal-gland'], sources: ['hra-united'] })),
  mesh({ id: 'third-ventricle', label: 'Third ventricle', layer: 'brain', side: 'midline', organ: 'brain', summary: 'The narrow fluid-filled space between the two halves of the diencephalon.', function: 'The hypothalamus forms its floor and walls; the pineal gland sits at its back.', related: ['hypothalamus', 'pineal-gland'], sources: ['hra-united'] }),
  ...SIDES.map((side) => mesh({ id: `cerebrum-${side}`, label: `${cap(side)} cerebral hemisphere`, synonyms: ['cerebrum', 'white matter'], layer: 'cerebrum', side, organ: 'brain', summary: 'The white matter of one half of the forebrain (shown faded).', function: 'Gives the brain’s outline around the glands at its base.', modelNote: 'The HuBMAP (Allen) white matter of the forebrain; the cortex is not shown.', related: ['thalamus-' + side], sources: ['hra-united'] })),
  mesh({ id: 'cerebellum', label: 'Cerebellum', layer: 'cerebrum', side: 'midline', organ: 'brain', summary: 'The “little brain” at the back of the skull.', function: 'Coordinates movement; shown faded as a landmark.', related: ['brainstem'], sources: ['hra-united'] }),
  mesh({ id: 'brainstem', label: 'Brainstem', synonyms: ['midbrain', 'medulla oblongata'], layer: 'brain', side: 'midline', organ: 'brain', summary: 'The midbrain and medulla, joining the brain to the spinal cord.', function: 'Shown faded as a landmark below the hypothalamus.', related: ['hypothalamus', 'cerebellum'], sources: ['hra-united'] }),

  // ── Bones ─────────────────────────────────────────────────────────────────
  mesh({ id: 'cervical-spine', label: 'Cervical spine (C1–C7)', synonyms: ['neck vertebrae'], layer: 'bone', side: 'midline', organ: 'spine', summary: 'The seven neck vertebrae.', function: 'The thyroid usually lies at the level of C5 to T1.', related: ['thyroid-gland'], sources: ['openstax-skeleton', 'hra-united'] }),
  mesh({ id: 'thoracic-spine', label: 'Thoracic spine (T1–T12)', layer: 'bone', side: 'midline', organ: 'spine', summary: 'The twelve vertebrae of the chest.', function: 'The adrenal glands lie level with T11–T12.', related: ['adrenal-gland-left'], sources: ['openstax-skeleton', 'hra-united'] }),
  mesh({ id: 'lumbar-spine', label: 'Lumbar spine (L1–L6)', synonyms: ['lumbar vertebrae', 'bone', 'skeleton'], layer: 'bone', side: 'midline', organ: 'spine', summary: 'The vertebrae of the lower back (six in this body).', function: 'Bone stores 99 % of the body’s calcium: PTH releases it, calcitonin slows its release. Its marrow responds to EPO.', related: ['kidney-left'], sources: ['openstax-skeleton', OS('5'), 'hra-united'] }),
  mesh({ id: 'sacrum', label: 'Sacrum and coccyx', layer: 'bone', side: 'midline', organ: 'spine', summary: 'The fused vertebrae at the back of the pelvis.', function: 'The ovaries lie in front of it, on the side walls of the pelvis.', related: ['ovary-left'], sources: ['openstax-skeleton', 'hra-united'] }),
  mesh({ id: 'sphenoid-bone', label: 'Sphenoid bone (sella turcica)', synonyms: ['sella turcica', 'pituitary fossa', 'hypophyseal fossa'], layer: 'bone', side: 'midline', summary: 'A bone in the middle of the skull base, shaped like a bat.', function: 'The pituitary sits in its sella turcica (“Turkish saddle”). Surgeons reach pituitary tumours through the sphenoid sinus, from the nose.', modelNote: `${BP_NOTE} Shown see-through.`, related: ['pituitary-gland'], sources: [OS('3'), 'bodyparts3d'] }),
  mesh({ id: 'skull', label: 'Skull', synonyms: ['cranium'], layer: 'skeleton', side: 'midline', summary: 'The bones of the skull and face (shown see-through).', function: 'Protects the brain and the glands at its base.', modelNote: BP_NOTE, related: ['sphenoid-bone'], sources: ['openstax-skeleton', 'bodyparts3d'] }),
  mesh({ id: 'mandible', label: 'Mandible', synonyms: ['lower jaw'], layer: 'skeleton', side: 'midline', summary: 'The lower jaw.', function: 'A landmark above the neck.', modelNote: BP_NOTE, related: ['hyoid-bone'], sources: ['openstax-skeleton', 'bodyparts3d'] }),
  ...SIDES.map((side) => mesh({ id: `ribs-${side}`, label: `${cap(side)} ribs`, synonyms: ['ribs', 'rib cage'], layer: 'skeleton', side, summary: 'The twelve ribs of one side.', function: 'Shield the heart, liver, spleen and the upper kidneys and adrenals.', modelNote: BP_NOTE, related: ['sternum'], sources: ['openstax-skeleton', 'bodyparts3d'] })),
  mesh({ id: 'sternum', label: 'Sternum', synonyms: ['breastbone', 'manubrium'], layer: 'skeleton', side: 'midline', summary: 'The breastbone.', function: 'The thymus lies behind its upper part; a large goitre can grow down behind it (retrosternal goitre).', modelNote: BP_NOTE, related: ['thymus'], sources: ['openstax-skeleton', 'bodyparts3d'] }),
  ...SIDES.map((side) => mesh({ id: `clavicle-${side}`, label: `${cap(side)} clavicle`, synonyms: ['collarbone'], layer: 'skeleton', side, summary: 'The collarbone.', function: 'A landmark at the root of the neck.', modelNote: BP_NOTE, related: ['sternum'], sources: ['openstax-skeleton', 'bodyparts3d'] })),
  ...SIDES.map((side) => mesh({ id: `hip-bone-${side}`, label: `${cap(side)} hip bone`, synonyms: ['pelvis', 'ilium'], layer: 'skeleton', side, summary: 'The large bone of one side of the pelvis.', function: 'Oestradiol helps keep bone strong; after the menopause bone is lost faster.', modelNote: BP_NOTE, related: [`ovary-${side}`], sources: ['openstax-skeleton', 'bodyparts3d'] })),
];

export const endocrineDefinition: SimulationDefinition = {
  schemaVersion: 1,
  id: 'endocrine-lab',
  title: 'Human Endocrine System — Interactive 3D Learning Lab',
  domain: 'biology',
  simulationType: '3d-anatomy',
  audience: 'Secondary school (Classes 10–12) and first-year undergraduate biology',
  summary:
    'Explore the hormone glands of the HuBMAP female reference body: the hypothalamus and pituitary, pineal, thyroid and parathyroids, thymus, adrenal glands, pancreas and ovaries, with the heart, kidneys and gut as hormone makers. Watch hormones travel in the real blood vessels, break the feedback loops of the thyroid, stress and ovary axes, eat a meal and follow insulin and glucagon, trigger fight or flight, set the body clock, balance blood calcium, see a hormone act on a cell, and read the blood tests of common disorders.',
  learningObjectives: [
    { id: 'glands', text: 'Name and locate the endocrine glands and the hormones each makes.' },
    { id: 'hypothalamus', text: 'Explain how the hypothalamus controls the anterior pituitary (portal veins) and the posterior pituitary (axons).' },
    { id: 'feedback', text: 'Explain negative feedback in the thyroid, adrenal and ovarian axes, and what happens when it breaks.' },
    { id: 'glucose', text: 'Describe how insulin and glucagon keep blood glucose steady, and what goes wrong in type 1 and type 2 diabetes.' },
    { id: 'stress', text: 'Compare the fast adrenaline response with the slower cortisol response, and describe the daily rhythms of cortisol and melatonin.' },
    { id: 'calcium', text: 'Explain how PTH, calcitriol and calcitonin control blood calcium.' },
    { id: 'cell', text: 'Contrast how water-soluble and lipid-soluble hormones act on their target cells.' },
    { id: 'tests', text: 'Read the pattern of TSH and T4, cortisol, glucose and calcium tests in common disorders.' },
  ],
  assets: [{ id: 'hra-endocrine-v1', role: 'anatomy-model' }],
  layers: [
    { id: 'hypothalamus-pituitary', label: 'Hypothalamus and pituitary', description: 'The hypothalamus, pituitary lobes and stalk.', visibleByDefault: true },
    { id: 'pineal', label: 'Pineal gland', description: 'The melatonin gland in the middle of the brain.', visibleByDefault: true },
    { id: 'thyroid', label: 'Thyroid and parathyroids', description: 'The thyroid lobes and isthmus and the four parathyroids.', visibleByDefault: true },
    { id: 'thymus', label: 'Thymus', description: 'The thymus in the upper chest.', visibleByDefault: true },
    { id: 'adrenal', label: 'Adrenal glands', description: 'Cortex and medulla of both adrenal glands.', visibleByDefault: true },
    { id: 'pancreas', label: 'Pancreas', description: 'Head, neck, body, tail and ducts.', visibleByDefault: true },
    { id: 'ovary', label: 'Ovaries', description: 'Both ovaries.', visibleByDefault: true },
    { id: 'makers', label: 'Other hormone makers', description: 'Heart, kidneys, stomach, duodenum and liver (faded).', visibleByDefault: true },
    { id: 'artery', label: 'Arteries', description: 'The aorta and the arteries to the glands.', visibleByDefault: false },
    { id: 'vein', label: 'Veins', description: 'The venae cavae, portal vein and the veins from the glands.', visibleByDefault: false },
    { id: 'airway', label: 'Larynx and trachea', description: 'The airway the thyroid wraps round.', visibleByDefault: true },
    { id: 'brain', label: 'Thalamus and brainstem', description: 'The parts of the brain around the hypothalamus and pineal (faded).', visibleByDefault: true },
    { id: 'cerebrum', label: 'Cerebrum and cerebellum', description: 'The outline of the brain (very faint).', visibleByDefault: false },
    { id: 'bone', label: 'Spine and sella', description: 'The spine and the sphenoid bone.', visibleByDefault: true },
    { id: 'skeleton', label: 'Skull, ribs and pelvis', description: 'Skull, ribs, sternum, clavicles and hip bones (see-through).', visibleByDefault: false },
    { id: 'neighbours', label: 'Nearby organs', description: 'Spleen, uterus and uterine tubes.', visibleByDefault: true },
  ],
  structures,
  cameraPresets: [
    { id: 'anterior', label: 'Front', direction: [0, 0.03, 1] },
    { id: 'posterior', label: 'Back', direction: [0, 0.03, -1] },
    { id: 'left', label: 'Left side', direction: [1, 0, 0] },
    { id: 'right', label: 'Right side', direction: [-1, 0, 0] },
    { id: 'superior', label: 'Top', direction: [0, 1, 0.0001], up: [0, 0, -1] },
    { id: 'above', label: 'Above', direction: [0.2, 0.85, 0.5] },
    { id: 'oblique', label: '3/4', direction: [0.55, 0.2, 0.8] },
  ],
  defaultCamera: 'anterior',
  tour: [
    { id: 'overview', title: 'The endocrine system', camera: 'anterior', mode: 'explore', frame: 'mode', focus: ['hypothalamus', 'pituitary-gland', 'pineal-gland', 'thyroid-gland', 'thymus', 'adrenal-gland-left', 'adrenal-gland-right', 'pancreas', 'ovary-left', 'ovary-right'], body: 'Endocrine glands release hormones into the blood, which carries them to targets anywhere in the body. Unlike the nerves’ fast, local signals, hormones act more slowly and widely, and for longer.' },
    { id: 'hypothalamus', title: 'The hypothalamus and pituitary', camera: 'oblique', mode: 'explore', focus: ['hypothalamus', 'pituitary-gland', 'sphenoid-bone'], body: 'At the base of the brain the hypothalamus hangs the pituitary on a stalk, in a saddle of the sphenoid bone. Together they control the thyroid, adrenal cortex and gonads, and growth, water balance and milk.' },
    { id: 'portal', title: 'Two ways down the stalk', mode: 'explore', closeUp: 'pituitary', focus: ['pituitary-gland'], body: 'Releasing hormones from hypothalamic neurons enter capillaries at the median eminence and travel down portal veins to the anterior lobe. Other neurons send their axons down the stalk: the posterior lobe releases their ADH and oxytocin.' },
    { id: 'pineal', title: 'The pineal gland', camera: 'left', mode: 'explore', focus: ['pineal-gland', 'third-ventricle'], body: 'Deep in the middle of the brain, behind the third ventricle, the pineal gland makes melatonin at night, timed by the body clock in the hypothalamus.' },
    { id: 'thyroid', title: 'The thyroid wraps the trachea', camera: 'above', mode: 'explore', slice: { axis: 'axial', through: 'thyroid-isthmus' }, isolate: true, tint: false, focus: ['thyroid-gland', 'parathyroid-glands', 'trachea'], body: 'Cut across the neck, the two thyroid lobes hug the sides of the trachea and the isthmus crosses its front, just below the larynx.' },
    { id: 'follicles', title: 'Inside the thyroid', mode: 'explore', closeUp: 'follicle', focus: [], body: 'The thyroid is made of follicles: balls of cells around a store of colloid (thyroglobulin). The cells trap iodine and build T4 and T3, releasing them when TSH arrives. C cells between the follicles make calcitonin.' },
    { id: 'parathyroids', title: 'The parathyroid glands', camera: 'posterior', mode: 'explore', isolate: true, tint: false, focus: ['parathyroid-glands', 'thyroid-gland'], body: 'Seen from behind, four rice-grain-sized parathyroid glands sit on the back of the thyroid. They release PTH whenever blood calcium falls.' },
    { id: 'hpt', title: 'Feedback: the thyroid axis', mode: 'axes', scenario: 'normal', frame: 'mode', focus: [], body: 'TRH from the hypothalamus releases TSH, which makes the thyroid release T4 and T3. Thyroid hormone feeds back to damp TRH and TSH, so the level holds steady, like a thermostat.' },
    { id: 'hashimoto', title: 'When the thyroid fails', mode: 'axes', scenario: 'hashimoto', frame: 'mode', focus: [], body: 'In Hashimoto’s thyroiditis the gland is destroyed: T4 falls, so feedback weakens and TSH rises high. A high TSH is how this hypothyroidism is found on a blood test.' },
    { id: 'adrenal', title: 'The adrenal glands', camera: 'anterior', mode: 'explore', slice: { axis: 'coronal', through: 'adrenal-cortex-left' }, tint: false, focus: ['adrenal-gland-left', 'adrenal-gland-right'], body: 'On top of each kidney: cut open, each adrenal shows a yellow cortex (steroid hormones) around a darker medulla (adrenaline).' },
    { id: 'zones', title: 'Layers of the adrenal', mode: 'explore', closeUp: 'adrenal', focus: [], body: 'Under the capsule, the zona glomerulosa makes aldosterone, the zona fasciculata cortisol and the zona reticularis androgens. In the middle, chromaffin cells of the medulla release adrenaline when sympathetic nerves fire.' },
    { id: 'fight', title: 'Fight or flight', mode: 'stress', fight: true, frame: 'mode', focus: [], body: 'In sudden stress, nerves make the adrenal medulla release adrenaline within seconds: heart rate, blood pressure and glucose rise. Over the next half hour, the HPA axis raises cortisol too.' },
    { id: 'clock', title: 'The body clock', mode: 'stress', clockH: 3, frame: 'mode', focus: ['pineal-gland'], body: 'At 3 am melatonin from the pineal is at its peak and cortisol at its lowest. Cortisol climbs before dawn and peaks just after waking. Bright light at night holds melatonin back.' },
    { id: 'islets', title: 'The islets of Langerhans', mode: 'explore', closeUp: 'islet', focus: [], body: 'Scattered through the pancreas are about a million islets. In each, beta cells (most of them) make insulin, alpha cells glucagon and delta cells somatostatin, beside capillaries that carry the hormones away.' },
    { id: 'meal', title: 'After a meal', mode: 'sugar', diabetes: 'none', clockH: 8.5, frame: 'mode', focus: [], body: 'Glucose from breakfast rises in the blood, and beta cells release insulin into the portal vein. The liver, muscles and fat take glucose up, and within two hours it is back under 140 mg/dL.' },
    { id: 'type2', title: 'Type 2 diabetes', mode: 'sugar', diabetes: 'type2', clockH: 8.5, frame: 'mode', focus: [], body: 'In type 2 diabetes the cells respond poorly to insulin and the beta cells cannot keep up: fasting glucose is above 126 mg/dL and it stays high after meals.' },
    { id: 'calcium', title: 'Balancing calcium', mode: 'calcium', calcium: 'normal', frame: 'mode', focus: [], body: 'When calcium falls, PTH releases it from bone, makes the kidneys keep it and make calcitriol, which takes in more from food. When it rises, PTH falls (and calcitonin rises a little).' },
    { id: 'cell', title: 'A hormone at the cell', mode: 'cell', cellHormone: 'insulin', cellStep: 3, focus: [], body: 'Insulin cannot enter the cell: it binds a receptor on the surface, which signals inside and sends GLUT4 glucose transporters to the membrane. Steroids like cortisol instead cross the membrane and switch on genes.' },
    { id: 'makers', title: 'Other hormone makers', camera: 'anterior', mode: 'explore', focus: ['heart', 'kidney-left', 'kidney-right', 'stomach', 'duodenum', 'liver'], body: 'Many organs also make hormones: the heart (ANP), kidneys (EPO, renin, calcitriol), stomach (gastrin, ghrelin), duodenum (secretin, CCK) and liver (IGF-1). Open the hormone atlas to explore them all.' },
  ],
  sources: [
    { id: OS('1'), citation: 'Betts JG, Young KA, Wise JA, et al. Anatomy and Physiology 2e, section 17.1 "An Overview of the Endocrine System". Houston: OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/17-1-an-overview-of-the-endocrine-system' },
    { id: OS('2'), citation: 'Betts JG, et al. Anatomy and Physiology 2e, section 17.2 "Hormones". OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/17-2-hormones' },
    { id: OS('3'), citation: 'Betts JG, et al. Anatomy and Physiology 2e, section 17.3 "The Pituitary Gland and Hypothalamus". OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/17-3-the-pituitary-gland-and-hypothalamus' },
    { id: OS('4'), citation: 'Betts JG, et al. Anatomy and Physiology 2e, section 17.4 "The Thyroid Gland". OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/17-4-the-thyroid-gland' },
    { id: OS('5'), citation: 'Betts JG, et al. Anatomy and Physiology 2e, section 17.5 "The Parathyroid Glands". OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/17-5-the-parathyroid-glands' },
    { id: OS('6'), citation: 'Betts JG, et al. Anatomy and Physiology 2e, section 17.6 "The Adrenal Glands". OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/17-6-the-adrenal-glands' },
    { id: OS('7'), citation: 'Betts JG, et al. Anatomy and Physiology 2e, section 17.7 "The Pineal Gland". OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/17-7-the-pineal-gland' },
    { id: OS('8'), citation: 'Betts JG, et al. Anatomy and Physiology 2e, section 17.8 "Gonadal and Placental Hormones". OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/17-8-gonadal-and-placental-hormones' },
    { id: OS('9'), citation: 'Betts JG, et al. Anatomy and Physiology 2e, section 17.9 "The Endocrine Pancreas". OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/17-9-the-endocrine-pancreas' },
    { id: OS('10'), citation: 'Betts JG, et al. Anatomy and Physiology 2e, section 17.10 "Organs with Secondary Endocrine Functions". OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/17-10-organs-with-secondary-endocrine-functions' },
    { id: 'openstax-vessels', citation: 'Betts JG, et al. Anatomy and Physiology 2e, section 20.5 "Circulatory Pathways". OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/20-5-circulatory-pathways' },
    { id: 'openstax-skeleton', citation: 'Betts JG, et al. Anatomy and Physiology 2e, sections 7.2 "The Skull" and 7.3 "The Vertebral Column". OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/7-3-the-vertebral-column' },
    { id: 'guyton', citation: 'Hall JE, Hall ME. Guyton and Hall Textbook of Medical Physiology, 14th ed. Philadelphia: Elsevier; 2021. Unit XIV, "Endocrinology and Reproduction" (chapters 75–80).' },
    { id: 'gray', citation: 'Standring S (ed). Gray’s Anatomy: The Anatomical Basis of Clinical Practice, 42nd ed. Elsevier; 2020. Neck: thyroid and parathyroid glands (sizes and relations).' },
    { id: 'bergman', citation: 'Bergman RN, Ider YZ, Bowden CR, Cobelli C. Quantitative estimation of insulin sensitivity. Am J Physiol 1979;236:E667–E677; and Bergman RN, Phillips LS, Cobelli C. J Clin Invest 1981;68:1456–1467 (the minimal model).' },
    { id: 'ada', citation: 'American Diabetes Association Professional Practice Committee. Diagnosis and Classification of Diabetes: Standards of Care in Diabetes. Diabetes Care (annual supplement 1): fasting glucose ≥126 mg/dL, 2-h OGTT ≥200 mg/dL, HbA1c ≥6.5 %.' },
    { id: 'adag', citation: 'Nathan DM, Kuenen J, Borg R, et al. Translating the A1C assay into estimated average glucose values. Diabetes Care 2008;31:1473–1478.' },
    { id: 'ata', citation: 'Jonklaas J, Bianco AC, Bauer AJ, et al. Guidelines for the treatment of hypothyroidism (American Thyroid Association). Thyroid 2014;24:1670–1751.' },
    { id: 'endo-society', citation: 'Bornstein SR, et al. Diagnosis and treatment of primary adrenal insufficiency (Endocrine Society). J Clin Endocrinol Metab 2016;101:364–389; Nieman LK, et al. The diagnosis of Cushing’s syndrome. J Clin Endocrinol Metab 2008;93:1526–1540.' },
    { id: 'brown-1983', citation: 'Brown EM. Four-parameter model of the sigmoidal relationship between parathyroid hormone release and extracellular calcium concentration. J Clin Endocrinol Metab 1983;56:572–581.' },
    { id: 'clock', citation: 'Pruessner JC, et al. Free cortisol levels after awakening. Life Sci 1997;61:2539–2549; Zeitzer JM, et al. Sensitivity of the human circadian pacemaker to nocturnal light. J Physiol 2000;526:695–702; Gooley JJ, et al. J Clin Endocrinol Metab 2011;96:E463–E472.' },
    { id: 'hra-united', citation: 'Browne K, Schlehlein H, et al. 3D Reference Organ Set for Female, v1.5 (HuBMAP Human Reference Atlas). doi:10.48539/HBM352.BTSQ.586', url: 'https://doi.org/10.48539/HBM352.BTSQ.586', license: 'CC BY 4.0' },
    { id: 'bodyparts3d', citation: 'Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K. BodyParts3D: 3D structure database for anatomical concepts. Nucleic Acids Res. 2009;37(Database issue):D782-5. doi:10.1093/nar/gkn613', url: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html', license: 'CC BY 4.0' },
  ],
  disclaimers: [
    'For learning only. This is not a clinical or diagnostic tool, and the explanations have not been reviewed by a physician. The test reader is not for medical decisions.',
    'The hypothalamus, pineal, thymus, pancreas, ovaries, heart, kidneys, vessels and spine are the HuBMAP female reference organs, based on the Visible Human female (59 years old); real bodies vary.',
    'The pituitary, adrenal glands, stomach, skull, ribs, pelvis and some neck vessels come from a different reference body (BodyParts3D), fitted onto this one; their positions are approximate (about 3–8 mm).',
    'The thyroid, parathyroids, pituitary stalk and adrenal medulla are modelled to textbook size, because no open scanned model of them exists. The close-ups and the hormone, glucose, stress and calcium models are teaching models built from textbook values.',
  ],
};
