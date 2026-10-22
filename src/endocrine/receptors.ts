/**
 * How hormones act on a target cell (pure data). Water-soluble hormones (peptides and
 * catecholamines) cannot cross the membrane: they bind a receptor on the surface, which works through
 * a second messenger or an enzyme inside, in seconds to minutes. Lipid-soluble hormones (steroids
 * and thyroid hormones) cross the membrane and bind receptors inside the cell that switch genes on,
 * over hours (OpenStax A&P 2e §17.2; Guyton & Hall 14e ch. 75).
 */

export type CellHormoneId = 'adrenaline' | 'glucagon' | 'insulin' | 'cortisol' | 't3';
export type Kind = 'surface' | 'nuclear';

export interface CellStep {
  id: string;
  label: string;
  text: string;
  /** Rough time after the hormone arrives. */
  time: string;
  /** What the close-up shows at this step. */
  show: 'arrive' | 'bind' | 'messenger' | 'kinase' | 'effect' | 'enter' | 'receptor' | 'nucleus' | 'mrna' | 'protein';
}

export interface CellHormone {
  id: CellHormoneId;
  label: string;
  kind: Kind;
  /** Chemical class. */
  chemistry: string;
  cell: string;
  receptor: string;
  colour: string;
  steps: CellStep[];
}

const surface = (h: Omit<CellHormone, 'kind'>): CellHormone => ({ ...h, kind: 'surface' });
const nuclear = (h: Omit<CellHormone, 'kind'>): CellHormone => ({ ...h, kind: 'nuclear' });

export const CELL_HORMONES: CellHormone[] = [
  surface({
    id: 'adrenaline', label: 'Adrenaline', chemistry: 'Amine (catecholamine), water-soluble', cell: 'Liver cell', receptor: 'β2-adrenergic receptor (G-protein-coupled)', colour: '#ff6a3a',
    steps: [
      { id: 'arrive', label: 'Arrives in the blood', text: 'Adrenaline from the adrenal medulla reaches the liver within seconds. It is water-soluble, so it stays outside the cell.', time: '0 s', show: 'arrive' },
      { id: 'bind', label: 'Binds its receptor', text: 'It fits the β2-adrenergic receptor, a protein that crosses the membrane seven times. Binding changes the receptor’s shape.', time: '< 1 s', show: 'bind' },
      { id: 'gprotein', label: 'G protein and cAMP', text: 'The receptor switches on a G protein (Gs), which switches on adenylyl cyclase: it makes many molecules of cyclic AMP, the second messenger.', time: 'seconds', show: 'messenger' },
      { id: 'pka', label: 'Protein kinase A', text: 'cAMP activates protein kinase A, which switches on enzymes by adding phosphate. Each step multiplies the signal (amplification).', time: 'seconds', show: 'kinase' },
      { id: 'effect', label: 'Glucose released', text: 'Glycogen phosphorylase breaks glycogen down, and the liver releases glucose into the blood for the muscles.', time: 'within a minute', show: 'effect' },
    ],
  }),
  surface({
    id: 'glucagon', label: 'Glucagon', chemistry: 'Peptide, water-soluble', cell: 'Liver cell', receptor: 'Glucagon receptor (G-protein-coupled)', colour: '#4a9aff',
    steps: [
      { id: 'arrive', label: 'Arrives from the pancreas', text: 'Alpha cells release glucagon when blood glucose is low; it reaches the liver first, through the portal vein.', time: '0 s', show: 'arrive' },
      { id: 'bind', label: 'Binds its receptor', text: 'The glucagon receptor on the liver cell’s surface is another G-protein-coupled receptor.', time: '< 1 s', show: 'bind' },
      { id: 'camp', label: 'cAMP rises', text: 'As with adrenaline, a G protein makes adenylyl cyclase produce cyclic AMP.', time: 'seconds', show: 'messenger' },
      { id: 'pka', label: 'Protein kinase A', text: 'Protein kinase A switches on glycogen breakdown and, over hours, the enzymes that make new glucose (gluconeogenesis).', time: 'minutes', show: 'kinase' },
      { id: 'effect', label: 'Glucose out', text: 'The liver releases glucose, raising the blood glucose back to normal between meals.', time: 'minutes', show: 'effect' },
    ],
  }),
  surface({
    id: 'insulin', label: 'Insulin', chemistry: 'Peptide, water-soluble', cell: 'Muscle or fat cell', receptor: 'Insulin receptor (tyrosine kinase)', colour: '#f2c230',
    steps: [
      { id: 'arrive', label: 'Arrives after a meal', text: 'Beta cells release insulin as blood glucose rises after a meal.', time: '0 s', show: 'arrive' },
      { id: 'bind', label: 'Binds its receptor', text: 'The insulin receptor is itself an enzyme (a tyrosine kinase). Binding makes its two halves add phosphate to each other.', time: '< 1 s', show: 'bind' },
      { id: 'irs', label: 'Signals inside', text: 'The active receptor adds phosphate to insulin receptor substrate (IRS), which starts a chain (PI3-kinase, then Akt).', time: 'seconds', show: 'kinase' },
      { id: 'glut4', label: 'GLUT4 to the surface', text: 'Vesicles carrying GLUT4 glucose transporters move to the membrane and fuse with it.', time: 'minutes', show: 'messenger' },
      { id: 'effect', label: 'Glucose in', text: 'Glucose enters through GLUT4 and is stored as glycogen or used. Blood glucose falls.', time: 'minutes', show: 'effect' },
    ],
  }),
  nuclear({
    id: 'cortisol', label: 'Cortisol', chemistry: 'Steroid, lipid-soluble (carried on a protein in the blood)', cell: 'Liver cell', receptor: 'Glucocorticoid receptor (inside the cell)', colour: '#e8902a',
    steps: [
      { id: 'arrive', label: 'Arrives on a carrier', text: 'Most cortisol travels bound to a carrier protein; the free part leaves the blood.', time: '0 min', show: 'arrive' },
      { id: 'enter', label: 'Crosses the membrane', text: 'Being lipid-soluble, cortisol passes straight through the cell membrane.', time: 'seconds', show: 'enter' },
      { id: 'receptor', label: 'Binds a receptor inside', text: 'In the cytoplasm it binds the glucocorticoid receptor, which lets go of its chaperone proteins.', time: 'minutes', show: 'receptor' },
      { id: 'nucleus', label: 'Into the nucleus', text: 'The hormone–receptor pair moves into the nucleus and binds DNA at glucocorticoid response elements.', time: 'minutes', show: 'nucleus' },
      { id: 'mrna', label: 'Genes switched on', text: 'Genes are transcribed into messenger RNA, which leaves the nucleus.', time: '30 min – hours', show: 'mrna' },
      { id: 'protein', label: 'New proteins', text: 'Ribosomes make new proteins, such as the enzymes that make glucose from amino acids. The effect lasts hours.', time: 'hours', show: 'protein' },
    ],
  }),
  nuclear({
    id: 't3', label: 'Thyroid hormone (T3)', chemistry: 'Amine (iodinated), lipid-soluble', cell: 'Almost any cell', receptor: 'Thyroid hormone receptor (in the nucleus)', colour: '#d84a8a',
    steps: [
      { id: 'arrive', label: 'Arrives as T4 and T3', text: 'The thyroid releases mostly T4; cells turn it into the more active T3.', time: '0', show: 'arrive' },
      { id: 'enter', label: 'Enters the cell', text: 'Transporter proteins (such as MCT8) carry it across the membrane.', time: 'minutes', show: 'enter' },
      { id: 'receptor', label: 'Into the nucleus', text: 'T3 binds its receptor, which already sits on the DNA paired with the retinoid X receptor.', time: 'minutes', show: 'nucleus' },
      { id: 'mrna', label: 'Genes switched on', text: 'Genes for enzymes, sodium-potassium pumps and mitochondria are transcribed.', time: 'hours', show: 'mrna' },
      { id: 'protein', label: 'Faster metabolism', text: 'More pumps and mitochondria raise the cell’s use of oxygen and heat production: the basal metabolic rate rises over days.', time: 'hours – days', show: 'protein' },
    ],
  }),
];
export const cellHormone = (id: CellHormoneId) => CELL_HORMONES.find((h) => h.id === id)!;
