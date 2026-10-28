# Testing

Results recorded on 2026-10-22 on Windows 11, Node 22.14.0. Browser tests ran in headless Chromium (Playwright 1.64, software WebGL via SwiftShader, which uses the automatic low-quality mode). The GPU check ran in installed Google Chrome 155 on an AMD Radeon integrated GPU (ANGLE, Direct3D 11).

## Commands

| Check | Command | What it covers |
|---|---|---|
| Types | `npm run typecheck` | TypeScript strict, `noUncheckedIndexedAccess` |
| Unit | `npm test` | Definition and validation gate (no warnings; unapproved asset and a missing left/right partner rejected); one mesh structure per model node; every left/right structure on its side; https-only sources; the modelled parts named as modelled. Body layout: pituitary below the hypothalamus in the sella; pineal behind the thalamus; thyroid round the front of the trachea between cricoid and sternum; parathyroids behind the lobes; adrenals on the kidneys with the medulla inside the cortex; pancreas head in the duodenal curve; ovaries in the pelvis, thymus behind the sternum; gland sizes in textbook ranges; the fits within their limits. Hormone routes: veins end in the right atrium, arteries start at the top of the aorta, paths join with no jump over 8 mm and reach their targets. Reducer: mode layers and close-ups, axis scenarios and time course, clamping, disorders and atlas focus, thyroidectomy and goitre sizes, tour cuts through a structure, cut facing. Search; the structure list names every mesh once; `closeHoles` on synthetic and all 95 model meshes. Science: thyroid axis rest, thyroidectomy and levothyroxine, classic patterns, T4 half-life; cortisol clock, prednisolone, Cushing's and Addison's; melatonin at night and light suppression; fight or flight timing; ovary axis, menopause and the pill; blood sugar (healthy, ADA cut-offs for type 2, type 1 with and without insulin, insulin and glucagon timing, units and HbA1c); calcium rest, response to low calcium and scenario patterns; the test reader; disorders linked to real glands; cell signalling step order; complete atlas entries |
| Assets | `npm run validate:assets` | GLB sha256 = provenance, node set = geometry record, finite positions within 0.55 m, unit normals, indices in range, triangle counts, baked `_TISSUE` on every mesh, attribution names HuBMAP, BodyParts3D, DBCLS, CC BY 4.0, the modelled parts and the source and output hashes |
| Determinism | re-run `tools/extract-endocrine.mjs` then `tools/bake-shading.mjs` | Byte-identical `endocrine.glb` |
| Build | `npm run build` | Type check + production bundle |
| E2E | `npm run build && npm run e2e` | 25 scenarios below; screenshots in `docs/screenshots/` |

## E2E scenarios (`tests/e2e/lab.spec.ts`)

1. Loads with no console errors and a clean main screen.
2. Clicking the model selects the structure under the pointer.
3. Search finds glands by name and synonym.
4. A gland lists its parts, a part links back, and the modelled thyroid says it is modelled.
5. A gland's hormone chips open the atlas, and its close-up button opens its tissue.
6. Colour by gland and by hormone class repaint the model.
7. Layers hide and show structures; the skeleton can be shown.
8. Isolate, Zoom to and Reset.
9. Camera presets and region buttons change the view.
10. Labels mode shows labels that do not overlap.
11. The cut turns the camera to face it; Flip and Off.
12. Axes: thyroid feedback, thyroidectomy and levothyroxine, Graves' and Addison's.
13. Axes: the ovary axis after the menopause.
14. Blood sugar: a glucose tolerance test (healthy, then type 2 over the cut-offs), type 1 without meal insulin, the islet close-up.
15. Stress and clock: fight or flight raises adrenaline and heart rate; melatonin at night; light holds it back.
16. Calcium: PTH holds calcium; a parathyroid adenoma, lost glands, vitamin D deficiency.
17. Cell: insulin works from the surface, cortisol inside the nucleus.
18. Disorders: a disorder shows its pattern, and the test reader reads entered results.
19. Hormone atlas: search, filter, and a hormone's route in the blood.
20. Guided tour (19 steps): forward, back, into a close-up, Finish.
21. Phone 390×844: no horizontal overflow; Structures opens from the dock; picking shows the details.
22. About (ⓘ): HuBMAP and BodyParts3D credits; Escape closes.
23. `?nowebgl`: fallback message; the list, details and panels still work.
24. Missing model (HTTP 404): error alert; Try again refetches and loads.
25. Reduced motion: the animated views and close-ups work without errors.

## Results

| Check | Result |
|---|---|
| `npm run typecheck` | **Pass** |
| `npm test` | **Pass**: 71/71 in 4 files |
| `npm run validate:assets` | **Pass**: 95 nodes, 253,603 triangles, sha256 `b248617a868b…` |
| Determinism | **Pass**: re-extraction gives the same unbaked model (`935332e0…`) and re-baking the recorded final sha256 (`b248617a868b…`) |
| `npm run build` | **Pass**. Vite warns about chunk size (1.79 MB of JavaScript, mostly three.js) |
| `npm run e2e` | **Pass**: 24/25 in the full run (23 min); the one failure was the blood-sugar test's wrong expectation (see below), which passes after the fix |
| Live site (2026-10-22) | **Pass**: https://endocrine-anatomy-lab.vercel.app returns the page; `models/endocrine.glb` is served with the recorded sha256 `b248617a868b…`; every mode opens in Chrome 155 with no console errors (ready in 11.9 s; Anatomy, Disorders, Atlas and Tour 61 fps, Cell 54, Stress 38, Calcium 33, Axes 31, Blood sugar 15 with the laptop in a power-saving state) |
| GPU check (Chrome 155, AMD Radeon, D3D11) | Every mode and all 19 tour steps render with no console errors. Frame rates, with the laptop in a power-saving state: Anatomy 61 fps, Axes 29–41, Blood sugar 23, Stress 33, Calcium 31, Cell 53 |

## Defects found and fixed during QA

- **The thyroid side check failed**: this body's larynx lies about 9 mm right of the midline. The thyroid is now checked against the airway's centre, and the parathyroids against the airway too.
- **The adrenal glands came out about 25 mL** (scaled with the abdomen fit). They are now placed by the fit but keep their own size, and the medulla is inset so it makes up about a tenth of the gland.
- **The first model was too heavy** (322,000 triangles); simplifying the skeleton, thalami and tubes brought it to 254,000.
- **The heart route ran the wrong way.** It now follows the right atrium, right ventricle, pulmonary trunk, lungs, pulmonary veins, left heart and aorta.
- **The physiology models were retuned** against their published patterns: a two-compartment gut and insulin sensitivity for blood sugar; the cortisol clock and Addison's for the stress axis; the feedback floor of the ovary axis; the bone, gut and urine terms of calcium; the stress response's baseline.
- **Slow loading**: every part's cut cap was built at load. Caps are now built the first time a cut crosses a part.
- **The head view was hazy and cut off at the top**: the cerebrum sat in the brain layer. It has its own hidden layer now, the home view includes it, and the sphenoid is fainter.
- **The blood-sugar view ran at 2 fps**: shader compiles on every mode change plus a 10 Hz update. Shaders are now warmed up with `compileAsync`, the panels update every 250 ms and the view shows fewer layers (23 fps).
- **The glucose line was invisible and panel labels wrapped**: chart colours and CSS fixed.
- **Three tour steps were unclear** (the thyroid cut, the parathyroids, the adrenal cut). Tour steps can now isolate their structures, turn off the tint so the tissue's colours show, and use a new "above" camera.
- **The blood-sugar test expected an untreated type 1 day**, but the view always gives 16 units of basal insulin. The test now checks the day without meal insulin (about 160 mg/dL against about 100 with 6 units).

## Phone and tablet layouts

Added 2026-10-28, the same layer as the heart lab: `src/app/layout.ts` (the layout from the screen size: `desktop`, `sheet` for phones and portrait tablets, `landscape` for phones on their side), `src/ui/Sheet.tsx` (the details as a bottom sheet with a handle: tap to step peek / half / full, drag to follow the finger, drag down or flick to close) and a "Phones and tablets" block in `src/styles.css` (safe-area insets, finger-sized controls, a mode row that scrolls sideways). Picking a structure frames it above the sheet and hides the title and mode buttons until the details close; a tap on empty space closes them too.

`tests/e2e/responsive.spec.ts` (the same file in every lab) runs at 390×844, 844×390, 768×1024, 820×1180, 1024×768 and 1366×820 (touch emulation below 1024 px): no horizontal scroll; title, modes, dock and sheet on screen and not overlapping; room left for the model; finger-sized controls; the sheet folds, opens and expands by tap, keyboard and drag; the picked structure's label stays above the sheet; closing by ✕, by a tap on empty space and by dragging down (real touch events); a mode's own panel keeps the mode buttons and cannot be dismissed; every mode fits and scrolls to its end. Screenshots are in `docs/screenshots/responsive/`.

**Result (2026-10-28):** the whole GPU suite (this lab's own scenarios and the layout checks), installed Chrome, AMD Radeon integrated GPU: **56 passed in 6.0 min**.

**Not verified:** physical phones and tablets (only Chrome's device emulation at the six sizes), notches and safe areas on a real device, multi-finger gestures, the on-screen keyboard over the search box, and Safari and Firefox.

## Not verified

- **Physical devices other than one AMD integrated GPU.** No phone, tablet or discrete GPU was tested. Firefox and Safari were not run.
- **Automated accessibility audit.** axe-core is not installed; keyboard paths and ARIA labels were checked by hand and by E2E only.
- **Medical review.** The text follows OpenStax A&P 2e and the cited papers and guidelines; no endocrinologist has reviewed it.
- **The physiology models are teaching models.** The axes are compartment models with textbook half-lives and feedback; blood sugar is the Bergman minimal model; calcium is a steady state of daily fluxes; the stress and clock curves are fitted shapes. None is for dosing or diagnosis.
- **The fit of BodyParts3D is approximate**: 2.6–6.9 mm by region; the parts come from a male body.
- **Modelled parts.** No open scanned model has a thyroid, so the thyroid, parathyroids, pituitary stalk and adrenal medulla are built in code to real sizes; the close-ups (follicle, islet, adrenal layers, cell) are illustrations.
