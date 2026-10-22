import { useId } from 'react';
import { useLab } from '../app/LabContext';
import { effectiveCloseUp } from '../app/state';
import type { CloseUp } from '../contract/schema';
import { closeUpFrame } from '../endocrine/anchors';

export const CLOSE_UP_LABEL: Record<Exclude<CloseUp, 'cell'>, string> = {
  pituitary: 'portal veins and axons',
  follicle: 'thyroid follicles',
  islet: 'an islet of Langerhans',
  adrenal: 'the layers of the adrenal',
};

const TEXT: Record<Exclude<CloseUp, 'cell'>, { title: string; body: string; parts: [string, string][] }> = {
  pituitary: {
    title: 'Inside the pituitary stalk',
    body: 'The hypothalamus controls the two lobes in two different ways.',
    parts: [
      ['Portal veins (purple)', 'Neurons near the median eminence release releasing hormones (TRH, CRH, GnRH, GHRH) into a first capillary bed. Portal veins carry them down the stalk to a second capillary bed in the anterior lobe, so tiny amounts reach it undiluted.'],
      ['Axons (blue)', 'Neurons of the paraventricular and supraoptic nuclei make ADH and oxytocin and send them down their own axons. The posterior lobe stores them and releases them into the blood.'],
      ['Anterior lobe hormones (cyan)', 'TSH, ACTH, FSH, LH, growth hormone and prolactin leave in the veins that drain the pituitary.'],
    ],
  },
  follicle: {
    title: 'Thyroid follicles',
    body: 'Each follicle is a hollow ball of cells around a store of colloid.',
    parts: [
      ['Follicular cells', 'Take up iodide from the blood (purple), make thyroglobulin and attach iodine to it in the colloid.'],
      ['Colloid', 'A store of thyroglobulin carrying T4 and T3: enough for weeks.'],
      ['When TSH arrives', 'The cells take colloid back in, cut T4 and T3 free and release them into the capillaries (pink). The more TSH, the more they release and the taller the cells grow.'],
      ['C cells', 'Parafollicular cells between the follicles release calcitonin when calcium is high.'],
    ],
  },
  islet: {
    title: 'An islet of Langerhans',
    body: 'About a million islets, each about 0.1–0.2 mm across, are scattered through the pancreas among the enzyme-making acinar cells.',
    parts: [
      ['Beta cells (gold)', 'Most of the islet, in its core. They release insulin when blood glucose rises.'],
      ['Alpha cells (blue)', 'Mostly at the edge. They release glucagon when glucose falls.'],
      ['Delta cells (green)', 'Release somatostatin, which damps both.'],
      ['Capillaries', 'Every islet cell is close to a capillary; the blood takes the hormones to the portal vein and the liver.'],
    ],
  },
  adrenal: {
    title: 'The layers of the adrenal gland',
    body: 'From the capsule inwards, three zones of cortex surround the medulla.',
    parts: [
      ['Zona glomerulosa', 'Rounded clusters of cells making aldosterone, under angiotensin II and potassium.'],
      ['Zona fasciculata', 'The thickest zone: straight cords of pale, fat-filled cells making cortisol under ACTH.'],
      ['Zona reticularis', 'A network of cells making androgens (DHEA).'],
      ['Medulla', 'Chromaffin cells, modified sympathetic neurons, releasing adrenaline and noradrenaline into the central vein when nerves fire.'],
    ],
  },
};

/** The explanation beside a close-up, and the way back to the body. */
export function CloseUpPanel() {
  const { def, state, dispatch } = useLab();
  const id = useId();
  const close = effectiveCloseUp(def, state);
  if (!close || close === 'cell') return null;
  const t = TEXT[close];
  const mag = closeUpFrame(close).magnified;
  return (
    <section className="sheet closeup-panel" aria-labelledby={`${id}-title`} data-close-up={close}>
      <div className="detail-head">
        <div>
          <p className="eyebrow">Close-up{mag > 1 ? ` · magnified about ${mag}×` : ' · real size'}</p>
          <h2 id={`${id}-title`} className="panel-title">{t.title}</h2>
        </div>
        {state.mode !== 'tour' && <button type="button" className="secondary" onClick={() => dispatch({ type: 'set-close-up', value: null })}>Back to the body</button>}
      </div>
      <p className="small">{t.body}</p>
      <dl className="closeup-parts small">
        {t.parts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <p className="muted small">{close === 'pituitary' ? 'The gland and hypothalamus are from the reference body (see-through here); the vessels, axons and neurons are drawn, and wider than life.' : 'Drawn in code at textbook proportions, not a scan; cells are simplified.'}</p>
    </section>
  );
}
