import type { AnatomicalStructure } from '../contract/schema';
import type { ColourBy } from '../app/state';
import type { TissueLook } from './tissue';

/**
 * Real looks as in a fresh specimen: a pinkish-grey pituitary; a deep red-brown, glossy thyroid; tan
 * parathyroids; yellow adrenal cortex round a red-brown medulla; a lobulated pale pink-tan
 * pancreas; pale, bumpy ovaries; a pale pink-grey thymus; red arteries and blue veins; ivory bone;
 * the brain and the organs around the glands faded.
 */
const REAL: Record<string, TissueLook> = {
  hypothalamus: { color: '#d8b0a8', roughness: 0.4, clearcoat: 0.5, sheen: 0.4, sheenColor: '#fff0ea', rim: 0.18, rimColor: '#ffc8b8', ao: 0.6, mottle: 0.25, mottleTint: '#b88a80' },
  pituitary: { color: '#c9877e', roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.15, sheen: 0.35, sheenColor: '#ffd8cc', rim: 0.2, rimColor: '#ffa898', ao: 0.6, mottle: 0.3, mottleTint: '#9a5a52' },
  neurohypophysis: { color: '#dcc0b2', roughness: 0.4, clearcoat: 0.6, sheen: 0.35, rim: 0.18, ao: 0.6, mottle: 0.2, mottleTint: '#b89a8a' },
  stalk: { color: '#d8a89c', roughness: 0.35, clearcoat: 0.6, sheen: 0.3, rim: 0.18, ao: 0.6, mottle: 0.15 },
  pineal: { color: '#c89a86', roughness: 0.4, clearcoat: 0.55, sheen: 0.35, rim: 0.2, ao: 0.6, mottle: 0.35, mottleTint: '#9a6a58' },
  thyroid: { color: '#8e2e2a', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.35, sheenColor: '#ffc8c0', rim: 0.22, rimColor: '#ff8070', ao: 0.6, mottle: 0.4, mottleTint: '#5e1a18' },
  parathyroid: { color: '#c89a5a', roughness: 0.4, clearcoat: 0.7, sheen: 0.4, sheenColor: '#fff0d0', rim: 0.2, rimColor: '#ffd090', ao: 0.55, mottle: 0.25, mottleTint: '#9a6a30' },
  thymus: { color: '#d8b4a8', roughness: 0.5, clearcoat: 0.45, sheen: 0.45, sheenColor: '#fff4ee', rim: 0.15, ao: 0.75, mottle: 0.5, mottleTint: '#c8a070' },
  adrenalCortex: { color: '#d89a36', roughness: 0.5, clearcoat: 0.45, sheen: 0.45, sheenColor: '#fff0c0', rim: 0.18, rimColor: '#ffc860', ao: 0.8, mottle: 0.45, mottleTint: '#a86a1a' },
  adrenalMedulla: { color: '#7a3a2e', roughness: 0.45, clearcoat: 0.5, sheen: 0.3, rim: 0.15, ao: 0.7, mottle: 0.3, mottleTint: '#4e2018' },
  pancreas: { color: '#e2b490', roughness: 0.55, clearcoat: 0.4, sheen: 0.45, sheenColor: '#fff2e0', rim: 0.12, ao: 0.85, mottle: 0.6, mottleTint: '#b8865c' },
  duct: { color: '#efe0c8', roughness: 0.35, clearcoat: 0.7, sheen: 0.3, rim: 0.1, ao: 0.6, mottle: 0.1 },
  ovary: { color: '#e8cfc0', roughness: 0.55, clearcoat: 0.4, sheen: 0.45, sheenColor: '#ffffff', rim: 0.12, ao: 0.85, mottle: 0.55, mottleTint: '#c0a090' },
  heart: { color: '#9a3a34', roughness: 0.35, clearcoat: 0.7, sheen: 0.3, rim: 0.2, ao: 0.75, mottle: 0.3, mottleTint: '#6a2018' },
  kidney: { color: '#9a4a3c', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.35, rim: 0.22, rimColor: '#ff9a88', ao: 0.55, mottle: 0.18, mottleTint: '#6e2c22' },
  liver: { color: '#7a2e22', roughness: 0.3, clearcoat: 0.8, sheen: 0.3, rim: 0.2, ao: 0.75, mottle: 0.3, mottleTint: '#4e1a12' },
  gut: { color: '#e0a090', roughness: 0.35, clearcoat: 0.8, sheen: 0.35, rim: 0.2, ao: 0.75, mottle: 0.3, mottleTint: '#b07060' },
  spleen: { color: '#6a2a3c', roughness: 0.3, clearcoat: 0.8, sheen: 0.3, rim: 0.2, ao: 0.75, mottle: 0.3, mottleTint: '#401828' },
  uterus: { color: '#d88a88', roughness: 0.35, clearcoat: 0.7, sheen: 0.35, rim: 0.2, ao: 0.75, mottle: 0.25, mottleTint: '#a85858' },
  artery: { color: '#b4262a', roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.15, sheen: 0.2, rim: 0.25, rimColor: '#ff5a50', ao: 0.7, mottle: 0.15, mottleTint: '#7a1418' },
  vein: { color: '#4a3a78', roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.15, sheen: 0.2, rim: 0.2, rimColor: '#8a7ac0', ao: 0.7, mottle: 0.15, mottleTint: '#2a2050' },
  cartilage: { color: '#d8dcd0', roughness: 0.35, clearcoat: 0.6, sheen: 0.4, sheenColor: '#ffffff', rim: 0.15, ao: 0.8, mottle: 0.25, mottleTint: '#aab0a0' },
  airway: { color: '#e0b8b0', roughness: 0.4, clearcoat: 0.6, sheen: 0.35, rim: 0.15, ao: 0.8, mottle: 0.25, mottleTint: '#b89088' },
  brain: { color: '#e6c8c0', roughness: 0.5, clearcoat: 0.3, sheen: 0.4, rim: 0.15, ao: 0.7, mottle: 0.2 },
  bone: { color: '#e6d9bc', roughness: 0.7, clearcoat: 0.1, sheen: 0.15, sheenColor: '#fff6e0', rim: 0.05, ao: 0.95, mottle: 0.35, mottleTint: '#bfae88' },
};

function kindOf(s: AnatomicalStructure): string {
  const id = s.id;
  if (id === 'hypothalamus') return 'hypothalamus';
  if (id === 'pituitary-anterior') return 'pituitary';
  if (id === 'pituitary-posterior') return 'neurohypophysis';
  if (id === 'infundibulum') return 'stalk';
  if (id === 'pineal-gland') return 'pineal';
  if (id.startsWith('parathyroid')) return 'parathyroid';
  if (s.layer === 'thyroid') return 'thyroid';
  if (s.layer === 'thymus') return 'thymus';
  if (id.startsWith('adrenal-medulla')) return 'adrenalMedulla';
  if (s.layer === 'adrenal') return 'adrenalCortex';
  if (id === 'pancreatic-duct') return 'duct';
  if (s.layer === 'pancreas') return 'pancreas';
  if (s.layer === 'ovary') return 'ovary';
  if (id.startsWith('heart')) return 'heart';
  if (id.startsWith('kidney')) return 'kidney';
  if (id === 'liver') return 'liver';
  if (id === 'spleen') return 'spleen';
  if (id === 'uterus' || id.startsWith('uterine-tube')) return 'uterus';
  if (s.layer === 'artery' || id === 'pulmonary-trunk') return 'artery';
  if (s.layer === 'vein') return 'vein';
  if (id === 'trachea') return 'airway';
  if (s.layer === 'airway') return id === 'hyoid-bone' ? 'bone' : 'cartilage';
  if (s.layer === 'brain' || s.layer === 'cerebrum') return 'brain';
  if (s.layer === 'bone' || s.layer === 'skeleton') return 'bone';
  return 'gut';
}

export function realLook(s: AnatomicalStructure): TissueLook {
  return REAL[kindOf(s)] ?? REAL.gut!;
}

/** How see-through each structure is in its real look (1 = opaque). The organs around the glands are ghosts. */
export function realOpacity(s: AnatomicalStructure): number {
  switch (s.layer) {
    case 'neighbours': return 0.3;
    case 'skeleton': return 0.2;
    case 'cerebrum': return 0.1;
    case 'brain': return 0.3;
    case 'makers': return s.id === 'liver' ? 0.2 : s.id.startsWith('kidney') ? 0.45 : s.id.startsWith('heart') ? 0.28 : 0.38;
    default: break;
  }
  if (s.id === 'sphenoid-bone') return 0.22;
  if (s.id === 'trachea') return 0.75;
  return 1;
}

/** One hue per layer (Colour: Glands). */
export const LAYER_COLOUR: Record<string, string> = {
  'hypothalamus-pituitary': '#c070e0', pineal: '#7a7aff', thyroid: '#e04878', thymus: '#e0a0c0', adrenal: '#f0a020', pancreas: '#f2c230', ovary: '#ff7ab8',
  makers: '#60c0a0', artery: '#e03040', vein: '#4060d0', airway: '#a0b8c8', brain: '#c8c0d0', cerebrum: '#d8d0e0', bone: '#d8c8a0', skeleton: '#d8c8a0', neighbours: '#9aa0a8',
};

/** Colour: Hormone class. Glands by the chemistry of their main hormones. */
export const CLASS_COLOUR = { peptide: '#4a9aff', amine: '#40c878', steroid: '#f08a2a', mixed: '#b070e0', none: '#8a8f98' } as const;
const CLASS_OF: Record<string, keyof typeof CLASS_COLOUR> = {
  hypothalamus: 'peptide', 'pituitary-anterior': 'peptide', 'pituitary-posterior': 'peptide', infundibulum: 'peptide', 'pineal-gland': 'amine',
  'thyroid-lobe-left': 'amine', 'thyroid-lobe-right': 'amine', 'thyroid-isthmus': 'amine', 'thymus-left': 'peptide', 'thymus-right': 'peptide',
  'adrenal-cortex-left': 'steroid', 'adrenal-cortex-right': 'steroid', 'adrenal-medulla-left': 'amine', 'adrenal-medulla-right': 'amine',
  'pancreas-head': 'peptide', 'pancreas-neck': 'peptide', 'pancreas-body': 'peptide', 'pancreas-tail': 'peptide', 'ovary-left': 'steroid', 'ovary-right': 'steroid',
  'heart-atria': 'peptide', 'heart-ventricles': 'peptide', 'kidney-left': 'mixed', 'kidney-right': 'mixed', stomach: 'peptide', duodenum: 'peptide', liver: 'peptide',
};
export const classOf = (id: string) => (id.startsWith('parathyroid') ? 'peptide' : CLASS_OF[id] ?? 'none');

/** Groups use the colour of their layer. */
export function baseColour(s: AnatomicalStructure, colourBy: ColourBy): string {
  if (colourBy === 'class') return CLASS_COLOUR[classOf(s.id)];
  if (colourBy === 'layer' || s.kind === 'group') return LAYER_COLOUR[s.layer] ?? realLook(s).color;
  return realLook(s).color;
}

export const HIGHLIGHT = '#ffc94d';
export const HOVER = '#ffe7a8';
/** The glow of an active gland. */
export const GLOW = '#ffd27a';

/** Cut-surface colours: what a slice through each tissue shows. */
const CUT: Record<string, string> = {
  hypothalamus: '#e0c0b8', pituitary: '#c08078', neurohypophysis: '#e0ccc0', stalk: '#d8b0a4', pineal: '#c8a090', thyroid: '#9a3a32', parathyroid: '#c8a060', thymus: '#e0c4a8',
  adrenalCortex: '#e8b040', adrenalMedulla: '#8a4030', pancreas: '#e8c4a0', duct: '#f0e4d0', ovary: '#ece0d4', heart: '#8a3028', kidney: '#a85846', liver: '#6e2a20', gut: '#d49888',
  spleen: '#5a2232', uterus: '#c47a78', artery: '#9a2024', vein: '#3a2c60', cartilage: '#e4e8dc', airway: '#e8c8c0', brain: '#ecd8d0', bone: '#dccdaa',
};
export function cutColour(s: AnatomicalStructure): string {
  return CUT[kindOf(s)] ?? '#c9a090';
}
