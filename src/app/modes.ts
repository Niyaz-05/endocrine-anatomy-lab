import type { Mode } from '../contract/schema';

const GLAND_LAYERS = ['hypothalamus-pituitary', 'pineal', 'thyroid', 'thymus', 'adrenal', 'pancreas', 'ovary'];

/** Which layers each mode shows (the learner's layer toggles apply in Anatomy mode). */
export const MODE_LAYERS: Record<Exclude<Mode, 'explore' | 'tour'>, readonly string[]> = {
  axes: ['hypothalamus-pituitary', 'thyroid', 'adrenal', 'ovary', 'artery', 'vein', 'makers', 'airway', 'brain', 'bone'],
  sugar: ['pancreas', 'makers', 'artery', 'vein', 'bone'],
  stress: ['hypothalamus-pituitary', 'pineal', 'adrenal', 'makers', 'artery', 'vein', 'brain', 'bone'],
  calcium: ['thyroid', 'airway', 'makers', 'bone', 'skeleton', 'artery', 'vein'],
  // The cell view draws its own magnified cell.
  cell: [],
  disorders: [...GLAND_LAYERS, 'makers', 'airway', 'brain', 'bone'],
  atlas: [...GLAND_LAYERS, 'makers', 'airway', 'brain', 'bone', 'artery', 'vein'],
};

/** Single structures a mode adds to its layers. */
export const MODE_EXTRA: Partial<Record<Mode, readonly string[]>> = {
  sugar: ['spleen'],
  stress: ['thyroid-lobe-left', 'thyroid-lobe-right', 'thyroid-isthmus'],
};

/** Structures a mode hides although their layer is shown. */
export const MODE_HIDE: Partial<Record<Mode, readonly string[]>> = {
  axes: ['liver', 'stomach', 'duodenum'],
  sugar: ['kidney-left', 'kidney-right', 'heart-atria'],
  stress: ['liver', 'stomach', 'duodenum'],
  calcium: ['liver', 'stomach', 'heart-ventricles', 'heart-atria', 'skull', 'mandible', 'ribs-left', 'ribs-right', 'sternum', 'clavicle-left', 'clavicle-right'],
  disorders: ['liver', 'stomach', 'duodenum'],
};

/** The camera each mode starts with. */
export const MODE_CAMERA: Partial<Record<Mode, string>> = {
  explore: 'anterior', axes: 'anterior', sugar: 'anterior', stress: 'anterior', calcium: 'anterior', cell: 'anterior', disorders: 'anterior', atlas: 'anterior',
};
