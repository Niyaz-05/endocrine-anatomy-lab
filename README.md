# Human Endocrine System — Interactive 3D Learning Lab

A realistic, interactive 3D endocrine system for secondary-school and first-year biology:

- **Real look.** A pinkish-grey pituitary in the saddle of the sphenoid, a deep red-brown lobulated thyroid with tan parathyroids, yellow adrenal cortex round a red-brown medulla, a lobulated pale pancreas, pale ovaries, red arteries, blue-purple veins and ivory bone; the brain and the organs around the glands faded. "Colour" switches to **Glands** (one colour per layer) or **Hormone class** (peptide, amine or steroid).
- **Anatomy explorer.** The hypothalamus, pituitary (anterior and posterior lobes, stalk), pineal, thyroid and parathyroids, thymus, adrenal glands (cortex and medulla), pancreas (head, neck, body, tail, ducts) and ovaries; the heart, kidneys, stomach, duodenum and liver as hormone makers; the vessels hormones travel in; the larynx and trachea, brain, spine, skull, ribs and pelvis as landmarks. Search with synonyms ("hypophysis", "suprarenal", "islets", "Adam's apple"); fly to the head, neck, abdomen or pelvis.
- **Hormone axes.** Hypothalamus → pituitary → thyroid, adrenal cortex or ovary, with negative feedback you can break: remove the thyroid, give levothyroxine, iodine deficiency (the gland grows into a goitre), Hashimoto's, Graves', pituitary failure; prednisolone, Addison's, Cushing's; the menopause, the pill, a GnRH agonist. Hormone particles travel in the real veins, heart and arteries, more of them as the level rises; charts follow TSH and T4 over 90 days, ACTH and cortisol over two days, LH and FSH over a day.
- **Blood sugar.** A day of meals (and exercise) through Bergman's minimal model: insulin from the beta cells into the portal vein, glucagon between meals; healthy, type 1 (with or without insulin) and type 2; a glucose tolerance test against the ADA cut-offs and an estimated HbA1c.
- **Stress and the body clock.** A sudden fright: adrenaline in seconds (heart rate, blood pressure, glucose), cortisol over half an hour. The daily cortisol curve and pineal melatonin, with your bedtime and evening light.
- **Calcium.** PTH, calcitriol and calcitonin holding blood calcium steady: a low-calcium diet, vitamin D deficiency, a parathyroid adenoma, glands lost in surgery, with the daily flows in from the gut and bone and out in the urine.
- **A hormone at the cell.** Adrenaline and glucagon (G protein and cAMP), insulin (receptor tyrosine kinase and GLUT4), cortisol and T3 (receptors inside, genes and new proteins), step by step in a magnified cell.
- **Disorders and tests.** Eleven common disorders with their causes, signs, treatment and test patterns from the same models; a reader for TSH and free T4, cortisol and the dexamethasone test, glucose and HbA1c, calcium and PTH.
- **Hormone atlas.** 45 hormones: where each is made, what releases it, what it acts on and does, its chemistry and half-life; picking one lights its gland and targets and draws its route.
- **Close-ups, cut and guided tour.** The pituitary's portal veins and axons at real size; magnified thyroid follicles, an islet of Langerhans and the zones of the adrenal. Slice the body side-to-side, front-to-back or top-to-bottom (the camera turns to face the cut), and take a 19-step tour.

**Educational only.** This is not a clinical tool, and the text has not been reviewed by a physician. The glands, organs, vessels and spine are the HuBMAP Human Reference Atlas female organ set; the pituitary, adrenal glands, stomach, skull, ribs, pelvis and some neck vessels are BodyParts3D (DBCLS), fitted onto it. All are CC BY 4.0; see [public/ATTRIBUTION.md](public/ATTRIBUTION.md). **No open scanned thyroid or parathyroid model exists**, so those glands (with the pituitary stalk and the adrenal medulla) are modelled to textbook size around the real airway, and labelled as modelled.

## Run

Requires Node.js ≥ 22.12.

```sh
npm install
npm run dev            # http://localhost:5192
npm run build          # type-check + production build → dist/
npm run preview        # http://localhost:5193
```

Add `?quality=high` or `?quality=low` to the URL to force a rendering quality. By default the lab drops the costly wet coat and sheen on software renderers and when frames stay slow.

## Check

```sh
npm run typecheck
npm test                         # unit tests (Vitest)
npm run validate:assets          # model hash, nodes, geometry sanity, baked shading, attribution
npx playwright install chromium  # once
npm run build && npm run e2e     # browser tests (Playwright)
```

See [docs/TESTING.md](docs/TESTING.md) for results and what is not verified, and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it is built.

## Rebuild the model

`public/models/endocrine.glb` is generated from two checkouts:

1. The Female Atlas (`github.com/Niyaz-05/female-atlas`): the HRA united female body.
2. The Human Atlas (`github.com/Niyaz-05/human-atlas`): BodyParts3D.

```sh
node tools/extract-endocrine.mjs "<female-atlas>/public/models" "<human-atlas>/public/models"
node tools/bake-shading.mjs
node tools/validate-assets.mjs
```

Both steps are deterministic, and every input and the output are hashed in `src/endocrine/generated/provenance.json`, with the BodyParts3D fits, the measurements, the layout checks and the hormone routes.

## Deploy

The site is a Vercel project (Vite preset, output `dist/`) deployed with `vercel deploy --prod`.

## Layout

| Path | What |
|---|---|
| `src/contract/` | Simulation schema (zod), approved-asset registry, validation gate |
| `src/endocrine/` | Definition (structures, layers, tour, sources); the axes, glucose, stress and clock, calcium, disorders and test reader, receptors and atlas models; `live.ts` (what the views show now); anchors and routes; generated geometry and provenance |
| `src/app/` | Pure state reducer (modes, colour, cut, close-ups, scenarios, day, stress, calcium, cell, disorder, atlas), mode layers, search, React context |
| `src/viewer/` | three.js / react-three-fiber scene: tissue material and lighting, the model (lobule pattern, gland glow, goitre, cut caps), hormone particles, close-ups, camera rig, labels |
| `src/ui/` | Panels: structures (colour, cut, layers), details, Axes, Blood sugar, Stress and clock, Calcium, Cell, Disorders, Atlas, close-up, tour, About; a small SVG chart |
| `tools/` | Extraction, shading bake and asset validation |
| `tests/unit`, `tests/e2e` | Vitest and Playwright suites |
