/**
 * UI and simulation state as a pure reducer, so every learner action is unit-testable without
 * rendering. The 3D scene only reads this state; it never owns selection or visibility itself.
 */
import type { CloseUp, Mode, SimulationDefinition, SliceAxis } from '../contract/schema';
import { MODE_CAMERA, MODE_EXTRA, MODE_HIDE, MODE_LAYERS } from './modes';
import { centroidOf, modeBounds, sliceAt } from '../endocrine/anchors';
import { scenarioById, type AxisId, type ScenarioId } from '../endocrine/axes';
import { DEFAULT_MEALS, type Diabetes, type Meal } from '../endocrine/glucose';
import { calciumScenario, type CalciumScenarioId } from '../endocrine/calcium';
import { cellHormone, type CellHormoneId } from '../endocrine/receptors';
import { disorderById } from '../endocrine/disorders';
import { atlasById } from '../endocrine/atlas';

export type { Mode } from '../contract/schema';
export { MODE_LAYERS } from './modes';
export type ColourBy = 'real' | 'layer' | 'class';

export interface Slice {
  axis: SliceAxis;
  /** Position across what the mode shows, -1 … 1. */
  at: number;
  /** Keep the other side of the cut. */
  flip: boolean;
}

export interface Sugar { diabetes: Diabetes; meals: Meal[]; exercise: boolean; insulinUnits: number; clockMin: number }
export interface Stress { fightAt: number | null; clockH: number; bedtimeH: number; lightLux: number }
export interface Calcium { scenario: CalciumScenarioId; dietMg: number; vitaminD: number }

export interface LabState {
  mode: Mode;
  selected: string | null;
  hovered: string | null;
  visibleLayers: ReadonlySet<string>;
  isolate: boolean;
  labels: boolean;
  colourBy: ColourBy;
  slice: Slice;
  /** Animations (hormone flow, cells) running. */
  playing: boolean;
  closeUp: CloseUp | null;
  /** Axes view: the scenario, the tablet doses and how far through its time course (0 … 1). */
  scenario: Record<AxisId, ScenarioId>;
  axis: AxisId;
  doses: { levothyroxine: number; prednisolone: number };
  axisT: number;
  sugar: Sugar;
  stress: Stress;
  calcium: Calcium;
  cell: { hormone: CellHormoneId; step: number };
  disorder: string | null;
  hormone: string | null;
  tourIndex: number;
  /** A camera move the scene should perform; the nonce makes repeat requests distinct. */
  camera: { preset: string; focus: readonly string[]; nonce: number };
}

export type LabAction =
  | { type: 'select'; id: string | null }
  | { type: 'hover'; id: string | null }
  | { type: 'toggle-layer'; layer: string }
  | { type: 'set-isolate'; value: boolean }
  | { type: 'set-labels'; value: boolean }
  | { type: 'set-colour-by'; value: ColourBy }
  | { type: 'set-slice'; axis?: SliceAxis; at?: number; flip?: boolean }
  | { type: 'set-mode'; mode: Mode }
  | { type: 'set-playing'; value: boolean }
  | { type: 'set-close-up'; value: CloseUp | null }
  | { type: 'set-axis'; value: AxisId }
  | { type: 'set-scenario'; value: ScenarioId }
  | { type: 'set-dose'; value: Partial<LabState['doses']> }
  | { type: 'set-axis-t'; value: number }
  | { type: 'set-sugar'; value: Partial<Sugar> }
  | { type: 'set-meal'; index: number; carbsG: number }
  | { type: 'set-stress'; value: Partial<Stress> }
  | { type: 'fight'; at: number }
  | { type: 'set-calcium'; value: Partial<Calcium> }
  | { type: 'set-cell'; hormone: CellHormoneId }
  | { type: 'cell-step'; value: number }
  | { type: 'set-disorder'; value: string | null }
  | { type: 'set-hormone'; value: string | null }
  | { type: 'tour-go'; index: number }
  | { type: 'camera'; preset: string; focus?: readonly string[] }
  | { type: 'reset' };

const NO_SLICE: Slice = { axis: 'off', at: 0, flip: false };
export const DEFAULT_SUGAR: Sugar = { diabetes: 'none', meals: DEFAULT_MEALS.map((m) => ({ ...m })), exercise: false, insulinUnits: 6, clockMin: 13 * 60 };
export const DEFAULT_STRESS: Stress = { fightAt: null, clockH: 8, bedtimeH: 23, lightLux: 5 };
export const DEFAULT_CALCIUM: Calcium = { scenario: 'normal', dietMg: 1000, vitaminD: 1 };

export function initialState(def: SimulationDefinition): LabState {
  return {
    mode: 'explore',
    selected: null,
    hovered: null,
    visibleLayers: new Set(def.layers.filter((l) => l.visibleByDefault).map((l) => l.id)),
    isolate: false,
    labels: false,
    colourBy: 'real',
    slice: NO_SLICE,
    playing: true,
    closeUp: null,
    scenario: { hpt: 'normal', hpa: 'hpa-normal', hpg: 'hpg-normal' },
    axis: 'hpt',
    doses: { levothyroxine: 100, prednisolone: 10 },
    axisT: 1,
    sugar: DEFAULT_SUGAR,
    stress: DEFAULT_STRESS,
    calcium: DEFAULT_CALCIUM,
    cell: { hormone: 'adrenaline', step: 0 },
    disorder: null,
    hormone: null,
    tourIndex: 0,
    camera: { preset: def.defaultCamera, focus: [], nonce: 0 },
  };
}

/** Ids that a selection or tour step highlights: a group stands for its members. */
export function highlightedIds(def: SimulationDefinition, ids: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const id of ids) {
    const s = def.structures.find((x) => x.id === id);
    if (!s) continue;
    if (s.kind === 'group') s.members?.forEach((m) => out.add(m));
    else out.add(id);
  }
  return out;
}

const step = (def: SimulationDefinition, state: LabState) => (state.mode === 'tour' ? def.tour[state.tourIndex] : undefined);

/** The mode in effect: in a tour, the step's (Anatomy if it names none). */
export function effectiveMode(def: SimulationDefinition, state: LabState): Exclude<Mode, 'tour'> {
  if (state.mode === 'tour') return step(def, state)?.mode ?? 'explore';
  return state.mode;
}

/** The atlas hormone in effect. */
export function effectiveHormone(def: SimulationDefinition, state: LabState): string | null {
  const s = step(def, state);
  if (s) return s.hormone ?? null;
  return state.mode === 'atlas' ? state.hormone : null;
}

/** The structures currently in focus: the selection, a disorder's glands, an atlas hormone's gland and targets, or the tour step's. */
export function focusIds(def: SimulationDefinition, state: LabState): string[] {
  if (state.mode === 'tour') return [...(step(def, state)?.focus ?? [])];
  if (state.selected) return [state.selected];
  if (state.mode === 'disorders' && state.disorder) return [...(disorderById(state.disorder)?.glands ?? [])];
  if (state.mode === 'atlas' && state.hormone) {
    const h = atlasById(state.hormone);
    return h ? [...(h.gland ? [h.gland] : []), ...h.targetIds] : [];
  }
  return [];
}

/** The close-up in effect: the tour step's, the cell view's cell, or the learner's. */
export function effectiveCloseUp(def: SimulationDefinition, state: LabState): CloseUp | null {
  const s = step(def, state);
  const mode = effectiveMode(def, state);
  if (mode === 'cell') return 'cell';
  if (s) return s.closeUp ?? null;
  return state.closeUp;
}

/** The axis scenario in effect, with the tablet doses applied. */
export function effectiveScenario(def: SimulationDefinition, state: LabState): { axis: AxisId; id: ScenarioId } {
  const s = step(def, state);
  if (s?.scenario) return { axis: scenarioById(s.scenario).axis, id: s.scenario };
  return { axis: state.axis, id: state.scenario[state.axis] };
}

export function effectiveSugar(def: SimulationDefinition, state: LabState): Sugar {
  const s = step(def, state);
  if (!s) return state.sugar;
  return { ...DEFAULT_SUGAR, diabetes: s.diabetes ?? 'none', clockMin: s.clockH !== undefined ? s.clockH * 60 : DEFAULT_SUGAR.clockMin };
}

export function effectiveStress(def: SimulationDefinition, state: LabState): Stress {
  const s = step(def, state);
  if (!s) return state.stress;
  return { ...DEFAULT_STRESS, clockH: s.clockH ?? DEFAULT_STRESS.clockH, fightAt: s.fight ? 0 : null };
}

export function effectiveCalcium(def: SimulationDefinition, state: LabState): Calcium {
  const s = step(def, state);
  if (!s) return state.calcium;
  const sc = calciumScenario(s.calcium ?? 'normal');
  return { scenario: sc.id, dietMg: sc.input.dietMg, vitaminD: sc.input.vitaminD };
}

export function effectiveCell(def: SimulationDefinition, state: LabState): { hormone: CellHormoneId; step: number } {
  const s = step(def, state);
  if (s?.cellHormone) return { hormone: s.cellHormone, step: s.cellStep ?? 0 };
  return state.cell;
}

/** Whether highlighted structures are tinted: a tour step can turn it off (cut views). */
export function effectiveTint(def: SimulationDefinition, state: LabState): boolean {
  return state.mode === 'tour' ? step(def, state)?.tint !== false : true;
}

/** The colour mode in effect: a tour step can set its own. */
export function effectiveColourBy(def: SimulationDefinition, state: LabState): ColourBy {
  if (state.mode === 'tour') return step(def, state)?.colourBy ?? 'real';
  return state.colourBy;
}

const AXES: Record<Exclude<SliceAxis, 'off'>, 0 | 1 | 2> = { sagittal: 0, axial: 1, coronal: 2 };
/** The cut in effect: a tour step's (through the middle of a structure, if it names one); otherwise the learner's. */
export function effectiveSlice(def: SimulationDefinition, state: LabState): Slice {
  if (state.mode === 'tour') {
    const s = step(def, state);
    if (!s?.slice || s.slice.axis === 'off') return NO_SLICE;
    const ax = AXES[s.slice.axis];
    const at = s.slice.through ? sliceAt(modeBounds(def, s.mode ?? 'explore'), ax, centroidOf(s.slice.through)[ax]) : s.slice.at ?? 0;
    return { axis: s.slice.axis, at, flip: false };
  }
  return state.slice;
}

/** The pituitary close-up keeps these parts of the body model in view. */
const PITUITARY_SCENE = new Set(['hypothalamus', 'pituitary-anterior', 'pituitary-posterior', 'infundibulum', 'sphenoid-bone', 'internal-carotid-artery-left', 'internal-carotid-artery-right', 'third-ventricle', 'thalamus-left', 'thalamus-right', 'brainstem']);

/**
 * Whether a mesh structure is drawn. In Anatomy mode the learner's layers decide; the other modes
 * show their own layers. A highlighted structure is always shown; with isolate on, only those. A
 * magnified close-up hides the body; the pituitary close-up keeps the head's parts around the gland.
 */
export function isVisible(def: SimulationDefinition, state: LabState, id: string): boolean {
  const s = def.structures.find((x) => x.id === id);
  if (!s) return false;
  const close = effectiveCloseUp(def, state);
  if (close === 'pituitary') return PITUITARY_SCENE.has(id);
  if (close) return false;
  const lit = highlightedIds(def, focusIds(def, state));
  if (lit.has(id)) return true;
  const isolate = state.mode === 'tour' ? !!step(def, state)?.isolate : state.isolate;
  if (isolate && lit.size > 0) return false;
  const mode = effectiveMode(def, state);
  if (mode === 'explore') return state.visibleLayers.has(s.layer);
  if ((MODE_HIDE[mode] ?? []).includes(id)) return false;
  return MODE_LAYERS[mode].includes(s.layer) || (MODE_EXTRA[mode] ?? []).includes(id);
}

/**
 * The camera preset that looks at the cut face. The cut keeps the side below the plane on its axis
 * (x: the patient's right, z: the back, y: the lower part), or the side above it when flipped, so
 * the camera looks from the removed side.
 */
export function facingPreset(slice: Slice): string | null {
  switch (slice.axis) {
    case 'sagittal': return slice.flip ? 'right' : 'left';
    case 'coronal': return slice.flip ? 'posterior' : 'anterior';
    case 'axial': return slice.flip ? 'inferior' : 'superior';
    default: return null;
  }
}

/** What the cut leaves in view, for the panel's hint (+x is the patient's left). */
export function keptHalf(slice: Slice): string | null {
  switch (slice.axis) {
    case 'sagittal': return slice.flip ? 'the left side of the body' : 'the right side of the body';
    case 'coronal': return slice.flip ? 'the front half' : 'the back half';
    case 'axial': return slice.flip ? 'the upper part' : 'the lower part';
    default: return null;
  }
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function makeReducer(def: SimulationDefinition) {
  const known = new Set(def.structures.map((s) => s.id));
  const layers = new Set(def.layers.map((l) => l.id));
  const presets = new Set(def.cameraPresets.map((c) => c.id));
  const cam = (state: LabState, preset: string | undefined, focus: readonly string[] = []) =>
    preset && presets.has(preset) ? { preset, focus, nonce: state.camera.nonce + 1 } : state.camera;

  return function reduce(state: LabState, action: LabAction): LabState {
    switch (action.type) {
      case 'select': {
        if (action.id !== null && !known.has(action.id)) return state;
        const selected = action.id === state.selected ? null : action.id;
        return { ...state, selected, isolate: selected ? state.isolate : false, closeUp: selected ? null : state.closeUp };
      }
      case 'hover':
        return action.id === state.hovered || (action.id !== null && !known.has(action.id)) ? state : { ...state, hovered: action.id };
      case 'toggle-layer': {
        if (!layers.has(action.layer)) return state;
        const next = new Set(state.visibleLayers);
        if (next.has(action.layer)) next.delete(action.layer);
        else next.add(action.layer);
        return { ...state, visibleLayers: next };
      }
      case 'set-isolate':
        return { ...state, isolate: action.value };
      case 'set-labels':
        return { ...state, labels: action.value };
      case 'set-colour-by':
        return action.value === state.colourBy ? state : { ...state, colourBy: action.value };
      case 'set-slice': {
        const at = action.at === undefined || !Number.isFinite(action.at) ? state.slice.at : clamp(action.at, -1, 1);
        const axis = action.axis ?? state.slice.axis;
        const fresh = action.axis !== undefined && action.axis !== state.slice.axis && action.at === undefined;
        const slice = { axis, at: fresh ? 0 : at, flip: action.flip ?? state.slice.flip };
        // A new axis or a flip turns the camera to face the cut, from the side the cut removed.
        const turned = axis !== 'off' && (axis !== state.slice.axis || slice.flip !== state.slice.flip);
        if (!turned) return { ...state, slice };
        return { ...state, slice, camera: cam(state, facingPreset(slice) ?? undefined) };
      }
      case 'set-mode': {
        if (action.mode === state.mode) return state;
        if (action.mode === 'tour') {
          const first = def.tour[0];
          return {
            ...state, mode: 'tour', tourIndex: 0, selected: null, isolate: false, playing: true, closeUp: null,
            camera: cam(state, first?.camera ?? MODE_CAMERA[first?.mode ?? 'explore'], first?.frame === 'mode' ? [] : first?.focus ?? []),
          };
        }
        return { ...state, mode: action.mode, playing: true, selected: null, closeUp: null, slice: state.mode === 'tour' ? NO_SLICE : state.slice, camera: cam(state, MODE_CAMERA[action.mode]) };
      }
      case 'set-playing':
        return { ...state, playing: action.value };
      case 'set-close-up':
        return { ...state, closeUp: action.value, selected: action.value ? null : state.selected, camera: { ...state.camera, focus: [], nonce: state.camera.nonce + 1 } };
      case 'set-axis':
        return { ...state, axis: action.value, axisT: 1 };
      case 'set-scenario': {
        const sc = scenarioById(action.value);
        if (!sc) return state;
        return { ...state, axis: sc.axis, scenario: { ...state.scenario, [sc.axis]: sc.id }, axisT: sc.axis === 'hpt' ? 0 : 1 };
      }
      case 'set-dose': {
        const d = { ...state.doses, ...action.value };
        if (!Number.isFinite(d.levothyroxine) || !Number.isFinite(d.prednisolone)) return state;
        return { ...state, doses: { levothyroxine: clamp(Math.round(d.levothyroxine), 0, 300), prednisolone: clamp(d.prednisolone, 0, 60) } };
      }
      case 'set-axis-t':
        return Number.isFinite(action.value) ? { ...state, axisT: clamp(action.value, 0, 1) } : state;
      case 'set-sugar': {
        const v = { ...state.sugar, ...action.value };
        if (!Number.isFinite(v.clockMin) || !Number.isFinite(v.insulinUnits)) return state;
        return { ...state, sugar: { ...v, clockMin: clamp(Math.round(v.clockMin), 0, 1435), insulinUnits: clamp(Math.round(v.insulinUnits), 0, 20) } };
      }
      case 'set-meal': {
        if (!Number.isFinite(action.carbsG) || !state.sugar.meals[action.index]) return state;
        const meals = state.sugar.meals.map((m, i) => (i === action.index ? { ...m, carbsG: clamp(Math.round(action.carbsG), 0, 150) } : m));
        return { ...state, sugar: { ...state.sugar, meals } };
      }
      case 'set-stress': {
        const v = { ...state.stress, ...action.value };
        if (![v.clockH, v.bedtimeH, v.lightLux].every(Number.isFinite)) return state;
        return { ...state, stress: { ...v, clockH: clamp(v.clockH, 0, 24), bedtimeH: clamp(v.bedtimeH, 19, 26), lightLux: clamp(v.lightLux, 0, 1000) } };
      }
      case 'fight':
        return { ...state, stress: { ...state.stress, fightAt: action.at } };
      case 'set-calcium': {
        const v = { ...state.calcium, ...action.value };
        if (!Number.isFinite(v.dietMg) || !Number.isFinite(v.vitaminD)) return state;
        // Choosing a scenario sets its diet and vitamin D; the sliders then change them.
        if (action.value.scenario && action.value.scenario !== state.calcium.scenario) {
          const sc = calciumScenario(action.value.scenario);
          return { ...state, calcium: { scenario: sc.id, dietMg: sc.input.dietMg, vitaminD: sc.input.vitaminD } };
        }
        return { ...state, calcium: { ...v, dietMg: clamp(Math.round(v.dietMg), 100, 2500), vitaminD: clamp(v.vitaminD, 0.05, 1.5) } };
      }
      case 'set-cell':
        return { ...state, cell: { hormone: action.hormone, step: 0 } };
      case 'cell-step': {
        const h = cellHormone(state.cell.hormone);
        return { ...state, cell: { ...state.cell, step: clamp(Math.round(action.value), 0, h.steps.length - 1) } };
      }
      case 'set-disorder': {
        const d = action.value ? disorderById(action.value) : null;
        if (action.value && !d) return state;
        let next: LabState = { ...state, disorder: action.value, selected: null };
        if (d?.shows.axis) { const sc = scenarioById(d.shows.axis); next = { ...next, axis: sc.axis, scenario: { ...next.scenario, [sc.axis]: sc.id }, axisT: 1 }; }
        if (d?.shows.diabetes) next = { ...next, sugar: { ...next.sugar, diabetes: d.shows.diabetes } };
        if (d?.shows.calcium) { const sc = calciumScenario(d.shows.calcium); next = { ...next, calcium: { scenario: sc.id, dietMg: sc.input.dietMg, vitaminD: sc.input.vitaminD } }; }
        return { ...next, camera: d ? cam(state, 'anterior', d.glands) : state.camera };
      }
      case 'set-hormone': {
        const h = action.value ? atlasById(action.value) : null;
        if (action.value && !h) return state;
        const ids = h ? [...(h.gland ? [h.gland] : []), ...h.targetIds] : [];
        return { ...state, hormone: action.value, selected: null, camera: h && ids.length ? cam(state, 'anterior', ids) : state.camera };
      }
      case 'tour-go': {
        const index = clamp(action.index, 0, def.tour.length - 1);
        const s = def.tour[index];
        if (!s) return state;
        return { ...state, mode: 'tour', tourIndex: index, camera: cam(state, s.camera ?? MODE_CAMERA[s.mode ?? 'explore'], s.frame === 'mode' || s.closeUp ? [] : s.focus) };
      }
      case 'camera':
        if (!presets.has(action.preset)) return state;
        return { ...state, camera: { preset: action.preset, focus: action.focus ?? [], nonce: state.camera.nonce + 1 } };
      case 'reset': {
        const fresh = initialState(def);
        return { ...fresh, camera: { ...fresh.camera, nonce: state.camera.nonce + 1 } };
      }
    }
  };
}
