# Attribution and asset provenance

## 3D model — `models/endocrine.glb`

### Sources

1. **3D Reference Organ Set for Female v1.5 (HuBMAP Human Reference Atlas, united female)**, by **Kristen Browne and Heidi Schlehlein** (and HRA contributors), from the Visible Human Female (National Library of Medicine). DOI https://doi.org/10.48539/HBM352.BTSQ.586. Licensed **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/).
   - Taken as converted by *Female Atlas* (github.com/Niyaz-05/female-atlas, commit `4c2dfcca02739b59827601915128ee64abdff2ea`; its `atlas.json` sha256 `5fec63b2ebcb76ecd9c33027ed725e8ec0a7a76b756f72681285410072ae5c51`). The converter's +0.794760942 m vertical translation is reversed here.
   - It provides the hypothalamus, pineal body, thalami, third ventricle, brainstem, cerebral white matter and cerebellum (Allen brain); the thyroid and cricoid cartilages and the trachea; both thymus lobes; the pancreas (head, neck, body, tail, uncinate process, ducts) and duodenum; both ovaries; the heart's atria and ventricles, pulmonary trunk and veins; the kidney capsules; the liver, spleen, uterus and uterine tubes; the aorta (ascending, arch, thoracic, abdominal), brachiocephalic trunk, left common carotid and subclavian arteries, coeliac trunk, splenic artery, renal arteries and veins, both venae cavae, splenic, portal and hepatic veins; and the vertebrae C1–L6, sacrum and coccyx.
2. **BodyParts3D 4.0**, © The **Database Center for Life Science** (DBCLS), CC BY 4.0. https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
   - The pituitary gland, sphenoid bone, skull and mandible, internal carotid arteries, the adrenal glands with their suprarenal arteries and veins, the stomach, the right common carotid and subclavian arteries, inferior thyroid arteries and thyrocervical trunks, brachiocephalic and internal jugular veins, hyoid bone, ribs, sternum, clavicles and hip bones, which the HRA set does not include.
   - Taken as converted by *Human Atlas* (github.com/Niyaz-05/human-atlas, commit `76f069640f2c3dd40a58d1556896ac25008f592e`; its `atlas.json` sha256 `c359f4bcd2cba90b7411d66d5e9fc04dc81294d46cd5c1e8b212c824f2e5bbee`).

Neither HuBMAP nor DBCLS has reviewed or endorsed this lab.

### Modelled parts (not from any scan)

No open scanned model of the thyroid or parathyroid glands exists (BodyParts3D 3.0 and 4.0 and all 81 HRA reference organs lack one), so these parts are modelled in `tools/extract-endocrine.mjs` to textbook size around the real structures of this body (Gray's Anatomy, 42nd ed.):

- **Thyroid lobes** (about 50 mm high, 20 mm wide and deep, from the level of the thyroid cartilage to the 5th–6th tracheal ring) and **isthmus** (over tracheal rings 2–4), pushed onto the HRA trachea and larynx so that they wrap the real airway.
- **Four parathyroid glands**, 6 × 4 × 2 mm, on the back of the lobes.
- **The pituitary stalk** (infundibulum), from the HRA hypothalamus to the placed pituitary.
- **The adrenal medulla**, an inner surface of each placed BodyParts3D adrenal gland, about a tenth of its volume.
- The two **pituitary lobes** are the BodyParts3D pituitary split by a frontal plane (front 74 % anterior lobe).

The close-ups (portal veins and axons of the pituitary, thyroid follicles, an islet of Langerhans, the zones of the adrenal, a target cell) are drawn in code at runtime and are not part of the model.

### Changes made (as CC BY 4.0 requires)

`tools/extract-endocrine.mjs`:
- Selected and merged the source meshes listed in `src/endocrine/source/structures.source.json`; welded coincident vertices; simplified the large meshes with meshoptimizer within the relative error bounds given there (largest error used: 0.94 %); subdivided and smoothed the small parts; recomputed smooth normals.
- Placed the BodyParts3D parts with similarity transforms (rotation, uniform scale, shift) fitted by Horn's method on the centroids of parts both bodies share:
  - head (pituitary, sphenoid, skull, internal carotids) on the thalami, hypothalamus, midbrain, pineal, cerebellum and medulla: 6.9 mm RMS;
  - neck (neck vessels, hyoid) on the thyroid and cricoid cartilages and C3–T2: 5.4 mm RMS;
  - thorax (ribs, sternum, clavicles) on T1–T12: 4.6 mm RMS;
  - abdomen (stomach) on T10–L2: 2.6 mm RMS;
  - pelvis (hip bones) on the lowest three lumbar vertebrae and the sacrum (this body has six lumbar vertebrae): 6.7 mm RMS;
  - adrenal glands and their vessels on each kidney, by iterative closest point of the BodyParts3D kidney onto the HRA kidney (5.4 mm RMS left, 6.7 mm right); the adrenal glands are kept at their own size.
- Pushed the stomach out of the HRA liver, spleen and pancreas, where 38 % of its vertices lay inside them.
- Generated the modelled parts above; measured the glands; checked the body layout; and traced the hormone routes (gland → vein → heart → artery → target) through the centre lines of the real vessels, with smooth curves where the small vessels are not in the model.
- Translated so that the middle of the glands is the origin.

`tools/bake-shading.mjs` then adds a per-vertex `_TISSUE` attribute: ambient occlusion and a noise value, for the real-tissue look.

The output is `models/endocrine.glb` (5,227,160 bytes, 253,603 triangles, sha256 `b248617a868b9d346f91b40a8b6d7e13a560410606c5e20e97c540420f8339ed`). Every input hash is in `src/endocrine/generated/provenance.json`.

### Scientific sources for the simulations

- Anatomy and physiology text: OpenStax *Anatomy and Physiology 2e*, ch. 17 (§17.1–17.10), §7.2–7.3 and §20.5, CC BY 4.0.
- Hormone kinetics, feedback and the adrenal, thyroid and calcium physiology: Hall JE, Hall ME. *Guyton and Hall Textbook of Medical Physiology*, 14th ed., 2021, ch. 75–80.
- Glucose and insulin: Bergman RN et al. *Am J Physiol* 1979;236:E667–E677 and *J Clin Invest* 1981;68:1456–1467 (minimal model). Diagnostic cut-offs: American Diabetes Association, *Standards of Care in Diabetes*. HbA1c: Nathan DM et al. *Diabetes Care* 2008;31:1473–1478 (ADAG).
- Thyroid ranges and treatment: Jonklaas J et al. American Thyroid Association guidelines, *Thyroid* 2014;24:1670–1751.
- Adrenal tests: Bornstein SR et al. *J Clin Endocrinol Metab* 2016;101:364–389; Nieman LK et al. *J Clin Endocrinol Metab* 2008;93:1526–1540.
- PTH and calcium: Brown EM. *J Clin Endocrinol Metab* 1983;56:572–581.
- Body clock: Pruessner JC et al. *Life Sci* 1997;61:2539–2549; Zeitzer JM et al. *J Physiol* 2000;526:695–702; Gooley JJ et al. *J Clin Endocrinol Metab* 2011;96:E463–E472.
