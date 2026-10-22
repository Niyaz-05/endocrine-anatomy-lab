import { useEffect, useId, useMemo, useState } from 'react';
import { useLab } from '../app/LabContext';
import { effectiveCalcium, effectiveCell, effectiveHormone, effectiveScenario, effectiveStress, effectiveSugar } from '../app/state';
import { AXIS_LABEL, REF, SCENARIOS, type AxisId, type ScenarioId } from '../endocrine/axes';
import { dayStats, fastingCategory, hba1cCategory, ogtt, toMmol, twoHourCategory, type Diabetes } from '../endocrine/glucose';
import { cortisolClock, fightOrFlight, isAsleep, melatonin } from '../endocrine/stress';
import { CALCIUM_SCENARIOS, REF_CA, calciumScenario, calciumSteady, pthAt } from '../endocrine/calcium';
import { CELL_HORMONES, cellHormone, type CellHormoneId } from '../endocrine/receptors';
import { DISORDERS, disorderById, readCalcium, readCortisol, readGlucose, readThyroid } from '../endocrine/disorders';
import { ATLAS, atlasById, searchAtlas, type Chemistry } from '../endocrine/atlas';
import { HORMONE_COLOUR, hpaSeries, hpgSeries, hptSeries, live, sampleAt, sugarSeries } from '../endocrine/live';
import { offModelNotes } from '../endocrine/anchors';
import { CLASS_COLOUR } from '../viewer/palette';
import { Legend, LineChart } from './Chart';

function PlayButton() {
  const { state, dispatch } = useLab();
  return (
    <button type="button" className="secondary" onClick={() => dispatch({ type: 'set-playing', value: !state.playing })} aria-pressed={!state.playing}>
      {state.playing ? 'Pause' : 'Play'}
    </button>
  );
}

function Radios<T extends string | number | null>({ label, options, value, onChange, disabled }: { label: string; options: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="seg-toggle wrap" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.id)} type="button" role="radio" aria-checked={value === o.id} disabled={disabled} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

function Slider({ label, min, max, step, value, unit, onChange, text, disabled }: { label: string; min: number; max: number; step: number; value: number; unit: string; onChange: (v: number) => void; text?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="field slider-field">
      <label htmlFor={id} className="small"><span>{label}</span> <strong>{text ?? `${value} ${unit}`}</strong></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} aria-valuetext={text ?? `${value} ${unit}`} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

/** Advances a value four times a second while playing (the time sliders); stops at the end. */
function useTicker(on: boolean, tick: () => void) {
  useEffect(() => {
    if (!on) return;
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [on, tick]);
}

const f0 = (x: number) => Math.round(x).toLocaleString('en-GB');
const f1 = (x: number) => x.toFixed(1);
const f2 = (x: number) => x.toFixed(2);
const clock = (h: number) => { const hh = Math.floor(((h % 24) + 24) % 24), mm = Math.round((h - Math.floor(h)) * 60) % 60; return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
const flag = (v: number, [lo, hi]: readonly [number, number]) => (v < lo ? 'low' : v > hi ? 'high' : 'normal');
const Flag = ({ v, range }: { v: number; range: readonly [number, number] }) => {
  const f = flag(v, range);
  return <span className={`flag is-${f}`}>{f}</span>;
};

/** The flows the 3D view draws, as a legend. */
function FlowLegend() {
  const { def, state } = useLab();
  const flows = live(def, state).flows;
  return flows.length ? <Legend items={flows.map((f) => ({ label: f.label, colour: f.colour }))} /> : null;
}

// ── Axes ──────────────────────────────────────────────────────────────────
export function AxesPanel() {
  const { def, state, dispatch } = useLab();
  const id = useId();
  const touring = state.mode === 'tour';
  const { axis, id: scenario } = effectiveScenario(def, state);
  const sc = SCENARIOS.find((s) => s.id === scenario)!;
  const t = touring ? 1 : state.axisT;
  const tick = useMemo(() => () => dispatch({ type: 'set-axis-t', value: state.axisT >= 1 ? 1 : state.axisT + 0.025 }), [dispatch, state.axisT]);
  useTicker(state.playing && !touring && state.axisT < 1 && state.mode === 'axes', tick);
  return (
    <section className="sheet axes-panel" aria-labelledby={`${id}-title`}>
      <div className="detail-head"><h2 id={`${id}-title`} className="panel-title">Hormone axes and feedback</h2><PlayButton /></div>
      <Radios label="Axis" options={(['hpt', 'hpa', 'hpg'] as AxisId[]).map((a) => ({ id: a, label: AXIS_LABEL[a] }))} value={axis} disabled={touring} onChange={(a) => dispatch({ type: 'set-axis', value: a })} />
      <div className="seg-toggle wrap scenario-list" role="group" aria-label="Scenario">
        {SCENARIOS.filter((s) => s.axis === axis).map((s) => (
          <button key={s.id} type="button" aria-pressed={s.id === scenario} disabled={touring} onClick={() => dispatch({ type: 'set-scenario', value: s.id as ScenarioId })}>{s.label}</button>
        ))}
      </div>
      <p className="small" aria-live="polite">{sc.text}</p>
      {scenario === 'levothyroxine' && <Slider label="Levothyroxine" min={0} max={200} step={25} value={state.doses.levothyroxine} unit="µg a day" disabled={touring} onChange={(v) => dispatch({ type: 'set-dose', value: { levothyroxine: v } })} />}
      {scenario === 'prednisolone' && <Slider label="Prednisolone" min={0} max={40} step={2.5} value={state.doses.prednisolone} unit="mg a day" disabled={touring} onChange={(v) => dispatch({ type: 'set-dose', value: { prednisolone: v } })} />}
      {axis === 'hpt' && <HptView scenario={scenario} t={t} />}
      {axis === 'hpa' && <HpaView scenario={scenario} t={t} />}
      {axis === 'hpg' && <HpgView scenario={scenario} t={t} />}
      <Slider label={axis === 'hpt' ? 'Time since the change' : 'Time'} min={0} max={1} step={0.01} value={t} unit="" disabled={touring} text={axis === 'hpt' ? `day ${Math.round(t * 90)}` : clock(t * (axis === 'hpa' ? 48 : 24))} onChange={(v) => dispatch({ type: 'set-axis-t', value: v })} />
      <h3 className="group-title">In the 3D view</h3>
      <FlowLegend />
      <p className="muted small">The glowing glands are active; particles show each hormone’s route through the real veins, heart and arteries, more of them when its level is high. Releasing hormones run down the pituitary stalk in the portal veins. Teaching model with textbook half-lives (TSH about 1 h, T4 about 7 days; ACTH about 10 min, cortisol about 70 min).</p>
    </section>
  );
}

function HptView({ scenario, t }: { scenario: string; t: number }) {
  const { state } = useLab();
  const s = hptSeries(scenario, state.doses.levothyroxine);
  const now = s[Math.round(t * (s.length - 1))]!;
  const r = readThyroid(now.tsh, now.ft4);
  return (
    <>
      <LineChart
        label={`TSH and free T4 over 90 days: now TSH ${f2(now.tsh)} mIU/L, free T4 ${f1(now.ft4)} pmol/L.`}
        series={[{ label: 'TSH', colour: HORMONE_COLOUR.tsh!, values: s.map((x) => x.tsh) }, { label: 'Free T4', colour: HORMONE_COLOUR.t4!, values: s.map((x) => x.ft4), right: true }]}
        xMax={90} xTicks={[0, 30, 60, 90].map((d) => ({ at: d, text: `day ${d}` }))}
        yLeft={{ min: 0.01, max: 200, ticks: [0.01, 0.1, 1, 10, 100], unit: 'TSH mIU/L', log: true }}
        yRight={{ min: 0, max: 60, ticks: [0, 12, 22, 40, 60], unit: 'free T4 pmol/L' }}
        band={{ from: 0.4, to: 4, text: 'normal TSH' }} cursor={t * 90}
      />
      <Legend items={[{ label: 'TSH (log scale)', colour: HORMONE_COLOUR.tsh! }, { label: 'Free T4', colour: HORMONE_COLOUR.t4! }]} />
      <dl className="readout" aria-live="polite">
        <div><dt>TSH</dt><dd data-tsh={now.tsh.toFixed(3)}>{now.tsh < 0.1 ? now.tsh.toFixed(3) : f2(now.tsh)} mIU/L <Flag v={now.tsh} range={REF.tsh} /></dd></div>
        <div><dt>Free T4</dt><dd data-ft4={now.ft4.toFixed(2)}>{f1(now.ft4)} pmol/L <Flag v={now.ft4} range={REF.ft4} /></dd></div>
        <div><dt>Free T3</dt><dd>{f1(now.ft3)} pmol/L <Flag v={now.ft3} range={REF.ft3} /></dd></div>
        <div><dt>Thyroid size</dt><dd data-size={now.size.toFixed(2)}>{now.size === 0 ? 'removed' : `${Math.round(now.size * 100)} % of normal${now.size > 1.25 ? ': a goitre' : ''}`}</dd></div>
      </dl>
      <p className="small"><strong>Reading:</strong> {r.text}</p>
    </>
  );
}

function HpaView({ scenario, t }: { scenario: string; t: number }) {
  const { state } = useLab();
  const s = hpaSeries(scenario, state.doses.prednisolone);
  const now = s[Math.round(t * (s.length - 1))]!;
  const at9 = s.find((x) => Math.abs(x.h - 33) < 0.05)!;
  return (
    <>
      <LineChart
        label={`Cortisol and ACTH over two days: now cortisol ${f0(now.cortisol)} nmol/L, ACTH ${f0(now.acth)} pg/mL.`}
        series={[{ label: 'Cortisol', colour: HORMONE_COLOUR.cortisol!, values: s.map((x) => x.cortisol) }, { label: 'ACTH', colour: HORMONE_COLOUR.acth!, values: s.map((x) => x.acth), right: true }]}
        xMax={48} xTicks={[0, 12, 24, 36, 48].map((h) => ({ at: h, text: clock(h) }))}
        yLeft={{ min: 0, max: 1200, ticks: [0, 300, 600, 900, 1200], unit: 'cortisol nmol/L' }}
        yRight={{ min: 1, max: 400, ticks: [1, 10, 100, 400], unit: 'ACTH pg/mL', log: true }}
        band={{ from: REF.cortisol8am[0], to: REF.cortisol8am[1], text: '9 am range' }} cursor={t * 48}
        marks={[{ at: 7, text: 'wake' }, { at: 31, text: 'wake' }]}
      />
      <Legend items={[{ label: 'Cortisol', colour: HORMONE_COLOUR.cortisol! }, { label: 'ACTH (log scale)', colour: HORMONE_COLOUR.acth! }]} />
      <dl className="readout" aria-live="polite">
        <div><dt>Now ({clock(now.h)})</dt><dd data-cortisol={now.cortisol.toFixed(0)} data-acth={now.acth.toFixed(1)}>cortisol {f0(now.cortisol)} nmol/L · ACTH {f0(now.acth)} pg/mL</dd></div>
        <div><dt>9 am cortisol</dt><dd data-cortisol9={at9.cortisol.toFixed(0)}>{f0(at9.cortisol)} nmol/L <Flag v={at9.cortisol} range={REF.cortisol8am} /></dd></div>
        <div><dt>9 am ACTH</dt><dd>{f0(at9.acth)} pg/mL <Flag v={at9.acth} range={REF.acth} /></dd></div>
      </dl>
    </>
  );
}

function HpgView({ scenario, t }: { scenario: string; t: number }) {
  const s = hpgSeries(scenario);
  const now = s[Math.round(t * (s.length - 1))]!;
  const mean = (k: 'lh' | 'fsh' | 'oestradiol') => s.reduce((n, x) => n + x[k], 0) / s.length;
  return (
    <>
      <LineChart
        label={`LH, FSH and oestradiol over a day: LH about ${f1(mean('lh'))}, FSH ${f1(mean('fsh'))} IU/L, oestradiol ${f0(mean('oestradiol'))} pmol/L.`}
        series={[{ label: 'LH', colour: HORMONE_COLOUR.lh!, values: s.map((x) => x.lh) }, { label: 'FSH', colour: HORMONE_COLOUR.fsh!, values: s.map((x) => x.fsh), dashed: true }, { label: 'Oestradiol', colour: HORMONE_COLOUR.oestradiol!, values: s.map((x) => x.oestradiol), right: true }]}
        xMax={24} xTicks={[0, 6, 12, 18, 24].map((h) => ({ at: h, text: clock(h) }))}
        yLeft={{ min: 0, max: 80, ticks: [0, 10, 30, 60, 80], unit: 'LH, FSH IU/L' }}
        yRight={{ min: 0, max: 700, ticks: [0, 300, 600], unit: 'oestradiol pmol/L' }}
        cursor={t * 24}
      />
      <Legend items={[{ label: 'LH', colour: HORMONE_COLOUR.lh! }, { label: 'FSH', colour: HORMONE_COLOUR.fsh! }, { label: 'Oestradiol', colour: HORMONE_COLOUR.oestradiol! }]} />
      <dl className="readout" aria-live="polite">
        <div><dt>LH</dt><dd data-lh={mean('lh').toFixed(1)}>{f1(now.lh)} IU/L now (day mean {f1(mean('lh'))}) <Flag v={mean('lh')} range={REF.lh} /></dd></div>
        <div><dt>FSH</dt><dd data-fsh={mean('fsh').toFixed(1)}>{f1(mean('fsh'))} IU/L <Flag v={mean('fsh')} range={REF.fsh} /></dd></div>
        <div><dt>Oestradiol</dt><dd>{f0(mean('oestradiol'))} pmol/L <Flag v={mean('oestradiol')} range={REF.oestradiol} /></dd></div>
      </dl>
      <p className="muted small">Follicular phase. Each GnRH pulse (about every 90 minutes) gives an LH pulse; the mid-cycle LH surge, driven by positive feedback from high oestradiol, is not modelled here.</p>
    </>
  );
}

// ── Blood sugar ───────────────────────────────────────────────────────────
/** Glucose itself (not a hormone) on the chart. */
const GLUCOSE = '#d0405a';
const CAT_TEXT = { normal: 'normal', prediabetes: 'prediabetes range', diabetes: 'diabetes range' } as const;
export function SugarPanel() {
  const { def, state, dispatch } = useLab();
  const id = useId();
  const touring = state.mode === 'tour';
  const sugar = effectiveSugar(def, state);
  const series = sugarSeries(sugar);
  const now = sampleAt(series, sugar.clockMin);
  const st = dayStats(series);
  const [test, setTest] = useState<{ diabetes: Diabetes; fasting: number; twoHour: number } | null>(null);
  const tick = useMemo(() => () => dispatch({ type: 'set-sugar', value: { clockMin: (state.sugar.clockMin + 20) % 1440 } }), [dispatch, state.sugar.clockMin]);
  useTicker(state.playing && !touring && state.mode === 'sugar', tick);
  const set = (v: Partial<typeof sugar>) => dispatch({ type: 'set-sugar', value: v });
  return (
    <section className="sheet sugar-panel" aria-labelledby={`${id}-title`}>
      <div className="detail-head"><h2 id={`${id}-title`} className="panel-title">Blood sugar: insulin and glucagon</h2><PlayButton /></div>
      <Radios label="Diabetes" options={[{ id: 'none', label: 'Healthy' }, { id: 'type1', label: 'Type 1' }, { id: 'type2', label: 'Type 2' }] as const} value={sugar.diabetes} disabled={touring} onChange={(d) => set({ diabetes: d })} />
      <LineChart
        label={`Glucose over a day: now ${f0(now.glucose)} mg/dL at ${clock(sugar.clockMin / 60)}; average ${f0(st.mean)} mg/dL.`}
        series={[{ label: 'Glucose', colour: GLUCOSE, values: series.map((x) => x.glucose) }, { label: 'Insulin', colour: HORMONE_COLOUR.insulin!, values: series.map((x) => x.insulin), right: true }, { label: 'Glucagon', colour: HORMONE_COLOUR.glucagon!, values: series.map((x) => x.glucagon), right: true, dashed: true }]}
        xMax={24} xTicks={[0, 6, 12, 18, 24].map((h) => ({ at: h, text: clock(h) }))}
        yLeft={{ min: 40, max: 400, ticks: [70, 140, 200, 300, 400], unit: 'glucose mg/dL' }}
        yRight={{ min: 0, max: 200, ticks: [0, 50, 100, 150, 200], unit: 'insulin µU/mL · glucagon pg/mL' }}
        band={{ from: 70, to: 140, text: 'healthy range' }} cursor={sugar.clockMin / 60}
        marks={[...sugar.meals.map((m) => ({ at: m.atMin / 60, text: `${m.carbsG} g` })), ...(sugar.exercise ? [{ at: 17, text: 'exercise' }] : [])]}
      />
      <Legend items={[{ label: 'Glucose', colour: GLUCOSE }, { label: 'Insulin', colour: HORMONE_COLOUR.insulin! }, { label: 'Glucagon', colour: HORMONE_COLOUR.glucagon! }]} />
      <Slider label="Time of day" min={0} max={1435} step={5} value={sugar.clockMin} unit="" text={clock(sugar.clockMin / 60)} disabled={touring} onChange={(v) => set({ clockMin: v })} />
      <dl className="readout" aria-live="polite">
        <div><dt>Glucose now</dt><dd data-glucose={now.glucose.toFixed(0)} className={now.glucose > 180 || now.glucose < 70 ? 'warn' : 'ok'}>{f0(now.glucose)} mg/dL ({f1(toMmol(now.glucose))} mmol/L)</dd></div>
        <div><dt>Insulin · glucagon</dt><dd data-insulin={now.insulin.toFixed(1)}>{f1(now.insulin)} µU/mL · {f0(now.glucagon)} pg/mL</dd></div>
        <div><dt>Day</dt><dd data-mean={st.mean.toFixed(0)}>average {f0(st.mean)} mg/dL · {f0(st.min)}–{f0(st.max)} · estimated HbA1c {f1(st.hba1c)} %</dd></div>
      </dl>
      <h3 className="group-title">The day</h3>
      <fieldset className="plain" disabled={touring}>
        {sugar.meals.map((m, i) => <Slider key={i} label={`Meal at ${clock(m.atMin / 60)}`} min={0} max={150} step={5} value={m.carbsG} unit="g carbohydrate" onChange={(v) => dispatch({ type: 'set-meal', index: i, carbsG: v })} />)}
        <label className="check"><input type="checkbox" checked={sugar.exercise} onChange={(e) => set({ exercise: e.target.checked })} /> 45 minutes of exercise at 17:00</label>
        {sugar.diabetes === 'type1' && <Slider label="Rapid insulin with each meal" min={0} max={12} step={1} value={sugar.insulinUnits} unit="units" onChange={(v) => set({ insulinUnits: v })} text={`${sugar.insulinUnits} units (plus 16 units of basal insulin at 22:00)`} />}
      </fieldset>
      <div className="button-row">
        <button type="button" className="secondary" disabled={touring} onClick={() => { const o = ogtt(sugar.diabetes); setTest({ diabetes: sugar.diabetes, fasting: o.fasting, twoHour: o.twoHour }); }}>Run a glucose tolerance test</button>
        <button type="button" className="secondary" onClick={() => dispatch({ type: 'set-close-up', value: 'islet' })} disabled={touring}>Look inside an islet</button>
      </div>
      {test && (
        <p className="small" aria-live="polite" data-ogtt-fasting={test.fasting.toFixed(0)} data-ogtt-2h={test.twoHour.toFixed(0)}>
          <strong>75 g OGTT ({test.diabetes === 'none' ? 'healthy' : test.diabetes === 'type1' ? 'type 1' : 'type 2'}):</strong> fasting {f0(test.fasting)} mg/dL ({CAT_TEXT[fastingCategory(test.fasting)]}), 2 hours {f0(test.twoHour)} mg/dL ({CAT_TEXT[twoHourCategory(test.twoHour)]}). Estimated HbA1c for this day: {f1(st.hba1c)} % ({CAT_TEXT[hba1cCategory(st.hba1c)]}).
        </p>
      )}
      <p className="muted small">{sugar.diabetes === 'type1' ? 'Type 1: the beta cells are destroyed, so only injected insulin works. Set the dose to 0 to see glucose climb without it.' : sugar.diabetes === 'type2' ? 'Type 2: cells respond to insulin about a third as well, the liver makes too much glucose, and the beta cells release less and later.' : 'Insulin from the beta cells follows glucose closely; glucagon rises between meals and during exercise, keeping glucose up.'} Bergman minimal model with textbook parameters; ADA cut-offs. For learning only.</p>
    </section>
  );
}

// ── Stress and the body clock ─────────────────────────────────────────────
export function StressPanel() {
  const { def, state, dispatch } = useLab();
  const id = useId();
  const touring = state.mode === 'tour';
  const st = effectiveStress(def, state);
  const wake = (st.bedtimeH + 8) % 24;
  const base = cortisolClock(st.clockH, wake);
  const ff = fightOrFlight(5, base);
  const fNow = st.fightAt === null ? null : ff[Math.min(ff.length - 1, Math.round(st.fightAt * 2))]!;
  const tick = useMemo(() => () => { if (state.stress.fightAt !== null && state.stress.fightAt < 60) dispatch({ type: 'fight', at: Math.min(60, state.stress.fightAt + 1) }); }, [dispatch, state.stress.fightAt]);
  useTicker(state.playing && !touring && state.mode === 'stress' && state.stress.fightAt !== null && state.stress.fightAt < 60, tick);
  const hours = Array.from({ length: 97 }, (_, i) => i / 4);
  const mel = (h: number) => melatonin(h, { bedtimeH: st.bedtimeH % 24, wakeH: wake, lightLux: st.lightLux });
  const melNow = mel(st.clockH);
  const asleep = isAsleep(st.clockH, { bedtimeH: st.bedtimeH % 24, wakeH: wake });
  return (
    <section className="sheet stress-panel" aria-labelledby={`${id}-title`}>
      <div className="detail-head"><h2 id={`${id}-title`} className="panel-title">Stress and the body clock</h2><PlayButton /></div>
      <h3 className="group-title">Fight or flight</h3>
      <div className="button-row">
        <button type="button" disabled={touring} onClick={() => dispatch({ type: 'fight', at: 0 })}>A sudden fright (5 minutes)</button>
        {state.stress.fightAt !== null && !touring && <button type="button" className="secondary" onClick={() => dispatch({ type: 'set-stress', value: { fightAt: null } })}>Calm down</button>}
      </div>
      {fNow ? (
        <>
          <LineChart
            label={`Adrenaline and cortisol over an hour after a fright: at minute ${Math.round(st.fightAt ?? 0)}, adrenaline ${f0(fNow.adrenaline)} pg/mL.`}
            series={[{ label: 'Adrenaline', colour: HORMONE_COLOUR.adrenaline!, values: ff.map((x) => x.adrenaline) }, { label: 'Cortisol', colour: HORMONE_COLOUR.cortisol!, values: ff.map((x) => x.cortisol), right: true }]}
            xMax={60} xTicks={[0, 15, 30, 45, 60].map((m) => ({ at: m, text: `${m} min` }))}
            yLeft={{ min: 0, max: 500, ticks: [0, 100, 250, 500], unit: 'adrenaline pg/mL' }}
            yRight={{ min: 0, max: 900, ticks: [0, 300, 600, 900], unit: 'cortisol nmol/L' }}
            cursor={st.fightAt ?? 0} marks={[{ at: 2, text: 'fright' }]}
          />
          <dl className="readout" aria-live="polite">
            <div><dt>Minute {Math.round(st.fightAt ?? 0)}</dt><dd data-adrenaline={fNow.adrenaline.toFixed(0)}>adrenaline {f0(fNow.adrenaline)} pg/mL · cortisol {f0(fNow.cortisol)} nmol/L</dd></div>
            <div><dt>Heart and blood</dt><dd data-hr={fNow.heartRate.toFixed(0)}>{f0(fNow.heartRate)} beats/min · {f0(fNow.systolic)} mmHg systolic · glucose {f0(fNow.glucose)} mg/dL</dd></div>
          </dl>
          <p className="muted small">Adrenaline comes from the adrenal medulla within seconds, by nerve; with a half-life of about 2 minutes it is gone soon after. Cortisol, by the HPA axis, peaks about 20–30 minutes later and lasts for hours.</p>
        </>
      ) : <p className="small muted">Press the button to trigger the sympathetic nerves to the adrenal medulla.</p>}
      <h3 className="group-title">The body clock</h3>
      <LineChart
        label={`Cortisol and melatonin over 24 hours; at ${clock(st.clockH)} cortisol ${f0(base)} nmol/L and melatonin ${f0(melNow)} pg/mL.`}
        series={[{ label: 'Cortisol', colour: HORMONE_COLOUR.cortisol!, values: hours.map((h) => cortisolClock(h, wake)) }, { label: 'Melatonin', colour: HORMONE_COLOUR.melatonin!, values: hours.map(mel), right: true }]}
        xMax={24} xTicks={[0, 6, 12, 18, 24].map((h) => ({ at: h, text: clock(h) }))}
        yLeft={{ min: 0, max: 700, ticks: [0, 200, 400, 600], unit: 'cortisol nmol/L' }}
        yRight={{ min: 0, max: 100, ticks: [0, 25, 50, 75, 100], unit: 'melatonin pg/mL' }}
        cursor={st.clockH} marks={[{ at: st.bedtimeH % 24, text: 'bed' }, { at: wake, text: 'wake' }]}
      />
      <Legend items={[{ label: 'Cortisol', colour: HORMONE_COLOUR.cortisol! }, { label: 'Melatonin', colour: HORMONE_COLOUR.melatonin! }]} />
      <fieldset className="plain" disabled={touring}>
        <Slider label="Time of day" min={0} max={24} step={0.25} value={st.clockH} unit="" text={clock(st.clockH)} onChange={(v) => dispatch({ type: 'set-stress', value: { clockH: v } })} />
        <Slider label="Bedtime" min={20} max={26} step={0.5} value={st.bedtimeH} unit="" text={`${clock(st.bedtimeH)} (wake ${clock(wake)})`} onChange={(v) => dispatch({ type: 'set-stress', value: { bedtimeH: v } })} />
        <Slider label="Light in the evening" min={0} max={1000} step={5} value={st.lightLux} unit="lux" text={`${st.lightLux} lux${st.lightLux <= 10 ? ' (dim)' : st.lightLux <= 300 ? ' (room light, screens)' : ' (bright)'}`} onChange={(v) => dispatch({ type: 'set-stress', value: { lightLux: v } })} />
      </fieldset>
      <dl className="readout" aria-live="polite">
        <div><dt>At {clock(st.clockH)}</dt><dd data-melatonin={melNow.toFixed(0)} data-cortisol-clock={base.toFixed(0)}>melatonin {f0(melNow)} pg/mL · cortisol {f0(base)} nmol/L · {asleep ? 'asleep' : 'awake'}</dd></div>
      </dl>
      <p className="muted small">The suprachiasmatic nucleus of the hypothalamus is the master clock; light reaching the eyes resets it and holds back the pineal’s melatonin (about half at 100 lux). Cortisol rises about 50 % in the half hour after waking.</p>
    </section>
  );
}

// ── Calcium ───────────────────────────────────────────────────────────────
export function CalciumPanel() {
  const { def, state, dispatch } = useLab();
  const id = useId();
  const touring = state.mode === 'tour';
  const c = effectiveCalcium(def, state);
  const sc = calciumScenario(c.scenario);
  const r = calciumSteady({ dietMg: c.dietMg, vitaminD: c.vitaminD, parathyroid: sc.input.parathyroid });
  const curve = Array.from({ length: 61 }, (_, i) => pthAt(0.9 + i * 0.01, sc.input.parathyroid));
  const read = readCalcium(r.total, r.pth);
  return (
    <section className="sheet calcium-panel" aria-labelledby={`${id}-title`}>
      <div className="detail-head"><h2 id={`${id}-title`} className="panel-title">Blood calcium: PTH and vitamin D</h2></div>
      <div className="seg-toggle wrap scenario-list" role="group" aria-label="Scenario">
        {CALCIUM_SCENARIOS.map((s) => <button key={s.id} type="button" aria-pressed={s.id === c.scenario} disabled={touring} onClick={() => dispatch({ type: 'set-calcium', value: { scenario: s.id } })}>{s.label}</button>)}
      </div>
      <p className="small" aria-live="polite">{sc.text}</p>
      <fieldset className="plain" disabled={touring}>
        <Slider label="Calcium in the diet" min={100} max={2500} step={50} value={c.dietMg} unit="mg a day" onChange={(v) => dispatch({ type: 'set-calcium', value: { dietMg: v } })} />
        <Slider label="Vitamin D" min={0.05} max={1.5} step={0.05} value={c.vitaminD} unit="" text={c.vitaminD < 0.5 ? 'deficient' : c.vitaminD < 0.8 ? 'low' : 'enough'} onChange={(v) => dispatch({ type: 'set-calcium', value: { vitaminD: v } })} />
      </fieldset>
      <dl className="readout" aria-live="polite">
        <div><dt>Total calcium</dt><dd data-ca={r.total.toFixed(2)}>{f2(r.total)} mmol/L ({f1(r.total * 4.008)} mg/dL) <Flag v={r.total} range={REF_CA.total} /></dd></div>
        <div><dt>Ionised calcium</dt><dd>{f2(r.ionised)} mmol/L</dd></div>
        <div><dt>PTH</dt><dd data-pth={r.pth.toFixed(2)}>{f1(r.pth)} pmol/L <Flag v={r.pth} range={REF_CA.pth} /></dd></div>
        <div><dt>Calcitriol</dt><dd>{f0(r.calcitriol)} pmol/L <Flag v={r.calcitriol} range={REF_CA.calcitriol} /></dd></div>
        <div><dt>Calcitonin</dt><dd>{r.calcitonin > 1 ? 'raised' : 'low (minor in adults)'}</dd></div>
      </dl>
      <table className="flux small" aria-label="Calcium moving into and out of the blood each day">
        <tbody>
          <tr><th scope="row">From the gut (calcitriol)</th><td>+{f0(r.gut)} mg/day</td></tr>
          <tr><th scope="row">{Math.abs(r.bone) < 1 ? 'Bone (built and broken down equally)' : r.bone > 0 ? 'From bone (PTH)' : 'Into bone'}</th><td>{Math.abs(r.bone) < 1 ? '0' : `${r.bone > 0 ? '+' : '−'}${f0(Math.abs(r.bone))}`} mg/day</td></tr>
          <tr><th scope="row">Lost in the urine (PTH keeps it)</th><td>−{f0(r.urine)} mg/day</td></tr>
        </tbody>
      </table>
      <h3 className="group-title">PTH against calcium</h3>
      <LineChart
        label={`The parathyroids' response: PTH falls steeply as ionised calcium rises; now ${f2(r.ionised)} mmol/L and PTH ${f1(r.pth)} pmol/L.`}
        series={[{ label: 'PTH', colour: HORMONE_COLOUR.pth!, values: curve }]} xMax={0.6}
        xTicks={[0, 0.2, 0.4, 0.6].map((x) => ({ at: x, text: (0.9 + x).toFixed(1) }))}
        yLeft={{ min: 0, max: 30, ticks: [0, 10, 20, 30], unit: 'PTH pmol/L' }} cursor={Math.max(0, Math.min(0.6, r.ionised - 0.9))} height={100}
      />
      <p className="small"><strong>Reading:</strong> {read.text}</p>
      <FlowLegend />
      <p className="muted small">Steady state of a teaching model: the steep PTH curve follows Brown (1983); 99 % of the body’s calcium is in bone. Total calcium here assumes a normal albumin.</p>
    </section>
  );
}

// ── Hormone at the cell ───────────────────────────────────────────────────
export function CellPanel() {
  const { def, state, dispatch } = useLab();
  const id = useId();
  const touring = state.mode === 'tour';
  const c = effectiveCell(def, state);
  const h = cellHormone(c.hormone);
  const step = h.steps[c.step]!;
  return (
    <section className="sheet cell-panel" aria-labelledby={`${id}-title`}>
      <div className="detail-head"><h2 id={`${id}-title`} className="panel-title">A hormone at the cell</h2><PlayButton /></div>
      <Radios label="Hormone" options={CELL_HORMONES.map((x) => ({ id: x.id, label: x.label.replace(' (T3)', ' T3') }))} value={c.hormone} disabled={touring} onChange={(x: CellHormoneId) => dispatch({ type: 'set-cell', hormone: x })} />
      <p className="small"><span className="dot" aria-hidden="true" style={{ background: h.colour }} /> <strong>{h.chemistry}.</strong> {h.kind === 'surface' ? 'It cannot cross the fatty membrane, so it binds a receptor on the surface and acts through messengers inside: fast.' : 'It crosses the membrane and binds a receptor inside the cell that switches genes on: slow but long-lasting.'} Target: {h.cell.toLowerCase()}; receptor: {h.receptor}.</p>
      <ol className="flow-steps small cell-steps">
        {h.steps.map((s, i) => (
          <li key={s.id} className={i === c.step ? 'is-current' : undefined}>
            <span className="dot" aria-hidden="true" style={{ background: i <= c.step ? h.colour : 'transparent', borderColor: h.colour }} />
            <span className="step-label"><button type="button" className="link" disabled={touring} aria-current={i === c.step ? 'step' : undefined} onClick={() => dispatch({ type: 'cell-step', value: i })}>{s.label}</button><span className="step-time">{s.time}</span></span>
            {i === c.step && <span className="block">{s.text}</span>}
          </li>
        ))}
      </ol>
      <div className="button-row">
        <button type="button" className="secondary" disabled={touring || c.step === 0} onClick={() => dispatch({ type: 'cell-step', value: c.step - 1 })}>Back</button>
        <button type="button" disabled={touring || c.step === h.steps.length - 1} onClick={() => dispatch({ type: 'cell-step', value: c.step + 1 })} data-step={step.id}>Next step</button>
      </div>
      <p className="muted small">A cell magnified about 1,000 times, drawn in code. Receptors, enzymes and genes are symbols, not to scale.</p>
    </section>
  );
}

// ── Disorders and tests ───────────────────────────────────────────────────
type TestTab = 'thyroid' | 'cortisol' | 'glucose' | 'calcium';
function num(v: string): number | null { const n = Number(v); return v.trim() !== '' && Number.isFinite(n) ? n : null; }
function NumField({ label, value, onChange, unit, step = 0.1 }: { label: string; value: string; onChange: (v: string) => void; unit: string; step?: number }) {
  return (
    <label className="field"><span className="small">{label} ({unit})</span>
      <input type="number" inputMode="decimal" step={step} value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} in ${unit}`} />
    </label>
  );
}
export function DisordersPanel() {
  const { state, dispatch } = useLab();
  const id = useId();
  const d = state.disorder ? disorderById(state.disorder) : null;
  const [tab, setTab] = useState<TestTab>('thyroid');
  const [v, setV] = useState({ tsh: '6.5', ft4: '9', cortisol: '320', dex: '', fasting: '105', twoHour: '', hba1c: '5.9', ca: '2.75', pth: '8.5' });
  const set = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  // The disorder's pattern, from the same models the other views use.
  let pattern: { k: string; v: string }[] = [];
  if (d?.shows.axis) {
    const sc = SCENARIOS.find((s) => s.id === d.shows.axis)!;
    if (sc.axis === 'hpt') { const s = hptSeries(sc.id, 100); const now = s[s.length - 1]!; pattern = [{ k: 'TSH', v: `${f2(now.tsh)} mIU/L` }, { k: 'Free T4', v: `${f1(now.ft4)} pmol/L` }, { k: 'Reading', v: readThyroid(now.tsh, now.ft4).text }]; }
    if (sc.axis === 'hpa') { const s = hpaSeries(sc.id, 10); const at9 = s.find((x) => Math.abs(x.h - 33) < 0.05)!; pattern = [{ k: '9 am cortisol', v: `${f0(at9.cortisol)} nmol/L` }, { k: '9 am ACTH', v: `${f0(at9.acth)} pg/mL` }, { k: 'Reading', v: readCortisol(at9.cortisol, null)[0]!.text }]; }
  }
  if (d?.shows.diabetes) { const o = ogtt(d.shows.diabetes); const st = dayStats(sugarSeries({ diabetes: d.shows.diabetes, meals: state.sugar.meals, exercise: false, insulinUnits: 0, clockMin: 0 })); pattern = [{ k: 'Fasting glucose', v: `${f0(o.fasting)} mg/dL` }, { k: '2-hour OGTT', v: `${f0(o.twoHour)} mg/dL` }, { k: 'HbA1c (estimated, untreated)', v: `${f1(st.hba1c)} %` }, { k: 'Reading', v: readGlucose(o.fasting, o.twoHour, st.hba1c).text }]; }
  if (d?.shows.calcium) { const sc = calciumScenario(d.shows.calcium); const r = calciumSteady(sc.input); pattern = [{ k: 'Total calcium', v: `${f2(r.total)} mmol/L` }, { k: 'PTH', v: `${f1(r.pth)} pmol/L` }, { k: 'Reading', v: readCalcium(r.total, r.pth).text }]; }
  const out = tab === 'thyroid' && num(v.tsh) !== null && num(v.ft4) !== null ? [{ pattern: readThyroid(num(v.tsh)!, num(v.ft4)!).pattern, text: readThyroid(num(v.tsh)!, num(v.ft4)!).text }]
    : tab === 'cortisol' && num(v.cortisol) !== null ? readCortisol(num(v.cortisol)!, num(v.dex))
    : tab === 'glucose' && (num(v.fasting) !== null || num(v.twoHour) !== null || num(v.hba1c) !== null) ? (() => { const g = readGlucose(num(v.fasting), num(v.twoHour), num(v.hba1c)); return [{ pattern: g.category, text: `${g.parts.map((p) => `${p.test}: ${CAT_TEXT[p.category]}`).join('; ')}. ${g.text}` }]; })()
    : tab === 'calcium' && num(v.ca) !== null && num(v.pth) !== null ? [{ pattern: readCalcium(num(v.ca)!, num(v.pth)!).pattern, text: readCalcium(num(v.ca)!, num(v.pth)!).text }]
    : [];
  return (
    <section className="sheet disorders-panel" aria-labelledby={`${id}-title`}>
      <div className="detail-head"><h2 id={`${id}-title`} className="panel-title">Disorders and blood tests</h2></div>
      <ul className="segment-list small disorder-list">
        {DISORDERS.map((x) => <li key={x.id}><button type="button" aria-pressed={state.disorder === x.id} onClick={() => dispatch({ type: 'set-disorder', value: state.disorder === x.id ? null : x.id })}>{x.label}</button></li>)}
      </ul>
      {d && (
        <div className="segment-detail" aria-live="polite" data-disorder={d.id}>
          <h3 className="group-title">{d.label}</h3>
          <p className="small"><strong>Cause:</strong> {d.cause}</p>
          <p className="small"><strong>Signs:</strong> {d.signs}</p>
          <p className="small"><strong>Treatment:</strong> {d.treatment}</p>
          <dl className="readout">{pattern.map((p) => <div key={p.k}><dt>{p.k}</dt><dd>{p.v}</dd></div>)}</dl>
        </div>
      )}
      <h3 className="group-title">Test reader</h3>
      <Radios label="Test" options={[{ id: 'thyroid', label: 'Thyroid' }, { id: 'cortisol', label: 'Cortisol' }, { id: 'glucose', label: 'Glucose' }, { id: 'calcium', label: 'Calcium' }] as const} value={tab} onChange={setTab} />
      <form className="test-form" onSubmit={(e) => e.preventDefault()}>
        {tab === 'thyroid' && <><NumField label="TSH" unit="mIU/L" value={v.tsh} onChange={set('tsh')} /><NumField label="Free T4" unit="pmol/L" value={v.ft4} onChange={set('ft4')} /></>}
        {tab === 'cortisol' && <><NumField label="9 am cortisol" unit="nmol/L" step={1} value={v.cortisol} onChange={set('cortisol')} /><NumField label="Cortisol after 1 mg dexamethasone (optional)" unit="nmol/L" step={1} value={v.dex} onChange={set('dex')} /></>}
        {tab === 'glucose' && <><NumField label="Fasting glucose" unit="mg/dL" step={1} value={v.fasting} onChange={set('fasting')} /><NumField label="2-hour OGTT (optional)" unit="mg/dL" step={1} value={v.twoHour} onChange={set('twoHour')} /><NumField label="HbA1c (optional)" unit="%" value={v.hba1c} onChange={set('hba1c')} /></>}
        {tab === 'calcium' && <><NumField label="Total calcium" unit="mmol/L" step={0.01} value={v.ca} onChange={set('ca')} /><NumField label="PTH" unit="pmol/L" value={v.pth} onChange={set('pth')} /></>}
      </form>
      <div className="test-result" aria-live="polite" data-pattern={out.map((o) => o.pattern).join(' ')}>
        {out.length ? out.map((o) => <p key={o.pattern} className="small">{o.text}</p>) : <p className="small muted">Enter the results above.</p>}
      </div>
      <p className="small warn">For learning only: not for medical decisions. Real results are read by a clinician, with the lab’s own ranges and the whole picture.</p>
    </section>
  );
}

// ── Hormone atlas ─────────────────────────────────────────────────────────
export function AtlasPanel() {
  const { def, state, dispatch } = useLab();
  const id = useId();
  const [q, setQ] = useState('');
  const [chem, setChem] = useState<Chemistry | 'all'>('all');
  const current = effectiveHormone(def, state);
  const h = current ? atlasById(current) : null;
  const list = searchAtlas(q).filter((x) => chem === 'all' || x.chemistry === chem);
  const notes = h ? [...new Set(h.paths.flat().map((s) => offModelNotes[s]).filter((x): x is string => !!x))] : [];
  return (
    <section className="sheet atlas-panel" aria-labelledby={`${id}-title`}>
      <div className="detail-head"><h2 id={`${id}-title`} className="panel-title">Hormone atlas</h2><span className="muted small">{ATLAS.length} hormones</span></div>
      <div className="search">
        <label htmlFor={`${id}-q`} className="sr-only">Search hormones</label>
        <input id={`${id}-q`} type="search" placeholder="Search, e.g. insulin, kidney, stress" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </div>
      <Radios label="Chemistry" options={[{ id: 'all', label: 'All' }, { id: 'peptide', label: 'Peptides' }, { id: 'amine', label: 'Amines' }, { id: 'steroid', label: 'Steroids' }] as const} value={chem} onChange={setChem} />
      {h && (
        <div className="segment-detail atlas-detail" aria-live="polite" data-hormone={h.id}>
          <h3 className="group-title"><span className="dot" aria-hidden="true" style={{ background: CLASS_COLOUR[h.chemistry] }} /> {h.name}</h3>
          <dl className="readout small">
            <div><dt>Made by</dt><dd>{h.gland ? <button type="button" className="link" onClick={() => dispatch({ type: 'select', id: h.gland! })}>{h.glandLabel}</button> : h.glandLabel}</dd></div>
            <div><dt>Chemistry</dt><dd>{h.chemistry} ({h.soluble === 'water' ? 'water-soluble: surface receptors' : 'lipid-soluble: receptors inside the cell'})</dd></div>
            <div><dt>Released by</dt><dd>{h.trigger}</dd></div>
            <div><dt>Acts on</dt><dd>{h.targets}</dd></div>
            <div><dt>Effect</dt><dd>{h.effect}</dd></div>
            <div><dt>Half-life</dt><dd>{h.halfLife}</dd></div>
          </dl>
          <p className="muted small">{h.paths.length ? `In the 3D view, gold particles trace its route from the gland to its targets.${notes.length ? ' ' + notes.join(' ') : ''}` : 'Its gland or route is not in this model.'}</p>
        </div>
      )}
      <ul className="struct-list atlas-list" aria-label="Hormones">
        {list.map((x) => (
          <li key={x.id}>
            <button type="button" aria-pressed={current === x.id} disabled={state.mode === 'tour'} onClick={() => dispatch({ type: 'set-hormone', value: current === x.id ? null : x.id })}>
              <span className="dot" aria-hidden="true" style={{ background: CLASS_COLOUR[x.chemistry] }} />{x.name}<span className="muted small"> · {x.glandLabel.replace(/ \(.*\)$/, '')}</span>
            </button>
          </li>
        ))}
        {!list.length && <li className="muted small">No hormone matches “{q.trim()}”.</li>}
      </ul>
    </section>
  );
}
