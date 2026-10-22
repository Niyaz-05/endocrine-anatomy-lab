import { useEffect, useRef } from 'react';
import { useLab } from '../app/LabContext';
import { CLASS_COLOUR, LAYER_COLOUR } from '../viewer/palette';
import { HORMONE_COLOUR } from '../endocrine/live';

/**
 * Source, scope and credits, kept off the main screen. The HuBMAP and BodyParts3D attribution
 * required by CC BY 4.0 lives here and is reachable from the ⓘ button and the "Source & credits" link.
 */
export function AboutSheet({ onClose }: { onClose: () => void }) {
  const { def } = useLab();
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    title.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const hormones: [string, string][] = [['Releasing hormones', 'releasing'], ['TSH', 'tsh'], ['T4 and T3', 't4'], ['ACTH', 'acth'], ['Cortisol', 'cortisol'], ['LH and FSH', 'lh'], ['Oestradiol', 'oestradiol'], ['Insulin', 'insulin'], ['Glucagon', 'glucagon'], ['Adrenaline', 'adrenaline'], ['Melatonin', 'melatonin'], ['PTH', 'pth'], ['Calcitriol', 'calcitriol']];
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="about-sheet glass" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ghost sheet-close" onClick={onClose} aria-label="Close">✕</button>
        <p className="eyebrow">Source &amp; scope</p>
        <h2 id="about-title" className="sheet-title" tabIndex={-1} ref={title}>About this lab</h2>
        <p>{def.summary}</p>

        <h3 className="group-title">You will learn to</h3>
        <ul className="objectives">
          {def.learningObjectives.map((o) => <li key={o.id}>{o.text}</li>)}
        </ul>

        <h3 className="group-title">Colours</h3>
        <p className="small muted">
          “Real” shows the glands as they look in a specimen: a pinkish-grey pituitary, a deep red-brown thyroid with tan
          parathyroids, a yellow adrenal cortex round a red-brown medulla, a lobulated pale pancreas, pale ovaries, red arteries,
          blue-purple veins and ivory bone; the brain and the organs around the glands are faded. “Glands” gives each layer its
          own colour; “Hormone class” colours each gland by the chemistry of its main hormones.
        </p>
        <p className="legend-row">
          {def.layers.map((l) => <span key={l.id}><span className="dot" style={{ background: LAYER_COLOUR[l.id] }} aria-hidden="true" /> {l.label}</span>)}
        </p>
        <p className="legend-row">
          <span><span className="dot" style={{ background: CLASS_COLOUR.peptide }} aria-hidden="true" /> Peptides and proteins</span>
          <span><span className="dot" style={{ background: CLASS_COLOUR.amine }} aria-hidden="true" /> Amines (from amino acids)</span>
          <span><span className="dot" style={{ background: CLASS_COLOUR.steroid }} aria-hidden="true" /> Steroids (from cholesterol)</span>
          <span><span className="dot" style={{ background: CLASS_COLOUR.mixed }} aria-hidden="true" /> Several kinds</span>
        </p>
        <p className="legend-row">
          {hormones.map(([label, k]) => <span key={k}><span className="dot" style={{ background: HORMONE_COLOUR[k] }} aria-hidden="true" /> {label}</span>)}
        </p>

        <h3 className="group-title">Simulations</h3>
        <ul className="small disclaimers">
          <li>Axes: each hormone moves towards the level its drivers ask for at a rate set by its half-life (TSH about 1 h, T4 about 7 days, ACTH about 10 min, cortisol about 70 min), with negative feedback. Steady states sit in the adult reference ranges (TSH 0.4–4.0 mIU/L, free T4 12–22 pmol/L, 9 am cortisol 140–690 nmol/L).</li>
          <li>Blood sugar: Bergman’s minimal model of glucose and insulin action, with beta-cell insulin release, alpha-cell glucagon and meal absorption, tuned so a healthy adult is about 90 mg/dL fasting and under 140 two hours after a meal. ADA cut-offs; HbA1c from the average glucose (ADAG).</li>
          <li>Stress and clock: adrenaline’s half-life of about 2 minutes; the daily cortisol curve with its awakening response; melatonin rising two hours before bedtime and held back by light (about half at 100 lux).</li>
          <li>Calcium: a steep PTH response to ionised calcium (Brown 1983), with PTH acting on bone, kidney and, through calcitriol, the gut; a steady state of daily fluxes.</li>
          <li>Hormone routes: particles follow the real veins, heart and arteries of the reference body; small vessels not in the model (sinuses of the skull, thyroid veins, ovarian vessels, the lungs) are smooth curves between real points.</li>
        </ul>

        <h3 className="group-title">Please note</h3>
        <ul className="small disclaimers">
          {def.disclaimers.map((d) => <li key={d}>{d}</li>)}
        </ul>

        <h3 className="group-title">Source</h3>
        <p className="small">
          Hypothalamus, pineal, thymus, pancreas, ovaries, heart, kidneys, liver, duodenum, larynx and trachea, the main vessels,
          brain landmarks and spine: the HuBMAP Human Reference Atlas 3D Reference Organ Set for Female (v1.5), from the Visible
          Human female, by Kristen Browne, Heidi Schlehlein et al. Pituitary, adrenal glands, stomach, skull, ribs, sternum,
          clavicles, hip bones, hyoid and some neck vessels: BodyParts3D, © The Database Center for Life Science. All licensed
          under CC Attribution 4.0 International. The thyroid, parathyroids, pituitary stalk and adrenal medulla are modelled
          here. Neither HuBMAP nor DBCLS has reviewed or endorsed this lab.
        </p>
        <div className="link-list small">
          <a href={`${import.meta.env.BASE_URL}ATTRIBUTION.md`} target="_blank" rel="noopener">Attribution and changes made ↗</a>
          <a href="https://doi.org/10.48539/HBM352.BTSQ.586" target="_blank" rel="noopener noreferrer">HRA female organ set ↗</a>
          <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" target="_blank" rel="noopener noreferrer">BodyParts3D ↗</a>
          <a href="https://openstax.org/books/anatomy-and-physiology-2e/pages/17-introduction" target="_blank" rel="noopener noreferrer">OpenStax A&amp;P 2e, chapter 17 ↗</a>
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0 licence ↗</a>
        </div>
      </section>
    </div>
  );
}
