# Architecture

The endocrine lab shares the heart, lungs, brain, digestive, eye and kidney labs' design: a validated, data-only **`SimulationDefinition`** rendered by a generic viewer. The code is a deliberate copy of the kidney lab, not a shared package, so each lab deploys independently.

## Differences from the kidney lab

| Area | Endocrine |
|---|---|
| Contract | Modes `explore` / `axes` / `sugar` / `stress` / `calcium` / `cell` / `disorders` / `atlas` / `tour`. Structures can list the hormones they make (atlas ids) and a close-up. Tour steps can set a mode, an axis scenario, diabetes type, a fright, the time of day, a calcium scenario, a cell hormone and step, an atlas hormone, a close-up, a cut (by position or through the middle of a structure), the colour, and whether to show only (`isolate`) and tint the focus structures |
| Validation | The hormones a structure lists must be in the atlas; a tour cut's structure must exist; every `-left` mesh needs its `-right` partner, on the side it names; on top of the shared checks |
| Science (`src/endocrine/`) | `axes.ts`: the HPT, HPA and HPG axes as first-order compartments with half-lives and Hill-type feedback, steady states in the reference ranges, 16 scenarios. `glucose.ts`: Bergman's minimal model with beta-cell (first and second phase) insulin, alpha-cell glucagon, two-compartment meal absorption, exercise, type 1 and 2, OGTT, ADA categories and ADAG HbA1c. `stress.ts`: fight or flight (adrenaline half-life about 2 min, cortisol later), the daily cortisol curve with its awakening response, melatonin with light suppression. `calcium.ts`: a steep PTH–calcium sigmoid and a daily flux balance (gut, bone, urine) solved for calcium. `disorders.ts`: test-reader rules and 11 disorders linked to the models. `receptors.ts`: surface and nuclear signalling steps. `atlas.ts`: 45 hormones with routes. `live.ts`: turns the state in effect into gland activity, the thyroid's size and the hormone flows. All pure and unit-tested |
| Mode views | Each mode shows its own layers (`src/app/modes.ts`) and hides the organs that would block it; the glands glow by their activity; the thyroid scales with its goitre (and is gone after thyroidectomy) |
| Model (`EndocrineModel.tsx`) | A lobule pattern (two sheared sine lattices, no loops or hashes) breaks up the pancreas, ovaries and thyroid. All shaders are compiled once at load (`compileAsync`, every part shown), so a new view never stalls. Cut caps are built the first time a cut crosses a part (closing 95 meshes up front was slow). The adrenal cortex turns see-through when its medulla is highlighted |
| Flow (`HormoneFlow.tsx`) | Particles along each flow's paths, a path being a list of route segments joined end to start (`routePath`); the hormone's level sets how many particles show and their size. Drawn over the tissue |
| Close-ups (`CloseUps.tsx`) | The pituitary at real size around the real gland (seen through it): magnocellular neurons and axons down the stalk, the primary capillary plexus, portal veins, the secondary plexus, the superior hypophyseal artery. Magnified scenes, built in local units and scaled into their gland's position while the body is hidden: thyroid follicles (cut open: cell walls round colloid, C cells, capillaries, iodide in and T4 out with TSH), an islet (a section: beta core, alpha mantle, delta cells, acinar cells, capillaries, insulin and glucagon released with their levels), the adrenal zones (capsule, glomerulosa, fasciculata, reticularis, medulla, central vein), and a target cell whose receptor, messengers, kinases, GLUT4, nucleus, mRNA and ribosome appear step by step |
| Cut | The stencil-capped cut with `closeHoles`; a tour step can cut through the middle of a named structure |

The real-tissue look (`tissue.ts`, `Lighting.tsx`, `tools/bake-shading.mjs`) is the same in every lab.

## Asset pipeline

```
HRA united female v1.5 (y − 0.7948 m): hypothalamus, pineal, brain landmarks,   ─┐
  larynx, trachea, thymus, pancreas, duodenum, ovaries, heart, kidneys, liver,    │
  spleen, uterus, tubes, main vessels, C1–L6, sacrum                              ├─ tools/extract-endocrine.mjs
BodyParts3D (Human Atlas) ─ 7 similarity fits ─ mould (stomach), own size (adrenals)│
Modelled: thyroid lobes and isthmus (wrapped on the airway), parathyroids,        │
  pituitary stalk, adrenal medulla; pituitary split into its lobes                ┘
        │  95 nodes, ~254k triangles; measurements; layout checks; hormone route segments
        └─ tools/bake-shading.mjs ─▶ public/models/endocrine.glb (5.2 MB) · geometry.json · provenance.json
```

**Fitting BodyParts3D.** Similarity transforms (rotation, uniform scale, shift), Horn's method on the centroids of shared parts:
- **head** (pituitary, sphenoid, skull, mandible, internal carotids): thalami, hypothalamus, midbrain, pineal, cerebellum and medulla (6.9 mm RMS). The Allen brain's side suffixes are the reverse of the patient's sides, so the pairs are matched by position; the fornix was dropped (too close to the midline to tell its side);
- **neck** (neck vessels, hyoid): thyroid and cricoid cartilages and C3–T2 (5.4 mm);
- **thorax** (ribs, sternum, clavicles): T1–T12 (4.6 mm);
- **abdomen** (stomach): T10–L2 (2.6 mm); the stomach is then pushed out of the HRA liver, spleen and pancreas (38 % of its vertices were inside);
- **pelvis** (hip bones): BodyParts3D L3–L5 and sacrum onto HRA L4–L6 and sacrum, since this body has six lumbar vertebrae (6.7 mm);
- **kidney-left / kidney-right** (adrenal glands and vessels): as in the kidney lab, ICP of the BodyParts3D kidney onto the HRA kidney with a fixed scale (5.4 and 6.7 mm surface RMS). That scale (1.36 and 1.22) would enlarge the adrenals, so they are placed by the fit but kept at their own size.

**Modelled parts.**
- **Thyroid lobes:** rings of ellipses along the airway's height (its centre and radius measured on the HRA trachea and larynx in 4 mm slabs), a pear profile 50 mm tall from 28 mm above to 22 mm below the cricoid's lower border, turning towards the front as it descends; smoothed and pushed out to 0.7 mm off the airway so they wrap it. **Isthmus:** a flattened tube round the front of the trachea at rings 2–4 (4 mm ring pitch). **Parathyroids:** ellipsoids on the most posterior point of each lobe at the cricoid level and near the lower pole.
- **Pituitary lobes:** the gland's inside sampled on a 0.3 mm grid; the frontal plane at the 25th percentile of depth splits it; each half is closed by fans over its boundary loops.
- **Adrenal medulla:** each vertex of the placed gland moved 45 % of the way to the opposite wall (ray cast along its inward normal, at most 6 mm), then a quarter of the way to the centre, and smoothed: 16 % and 11 % of the volume.
- **Stalk:** a tapering tube from the base of the hypothalamus to the top of the posterior lobe (10 mm).

**Hormone routes.** Centre lines of the real vessels (slab centroids between their ends), joined into segments: every vein to the right atrium (`*-to-heart`), the heart (right atrium → right ventricle → pulmonary trunk → lungs, not modelled → pulmonary veins → left atrium → left ventricle → ascending aorta), and every artery from the top of the ascending aorta (`to-*`, along the arch and aorta to the branch). Small vessels not in the model (venous sinuses, thyroid and ovarian veins, hepatic artery) are smooth curves between real points, with a note in `offModel`. The hypophyseal portal and posterior-lobe paths run down the stalk.

**Measured and checked.** Gland sizes (principal extents) and volumes (grid sampling), the thyroid's level, the pancreas's length, the medulla's share; checks that the pituitary hangs below the hypothalamus in the sella with its anterior lobe in front, the pineal lies behind the thalamus, the thyroid crosses the front of the trachea between the cricoid and the sternum with its lobes either side, the parathyroids lie behind the lobes, the adrenals sit above the kidneys, the pancreas's head lies in the duodenal curve, the ovaries are in the pelvis, and every vein ends in the right atrium. The extraction fails if any check fails.

## Performance

At 1440 × 900 on an AMD integrated GPU the static views run at 60 fps. The animated views keep rendering every frame; their cost is per pixel (fill rate): at a quarter of the pixels the axes view runs at about 58 fps. The time sliders tick four times a second, and the shaders are compiled at load so changing view does not stall. The lab drops the coat and sheen if frames stay slower than 50 ms.
