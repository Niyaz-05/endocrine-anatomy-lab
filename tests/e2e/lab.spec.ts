import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const SHOTS = 'docs/screenshots';
fs.mkdirSync(SHOTS, { recursive: true });

async function open(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`/${query}`);
  return errors;
}
async function ready(page: Page) {
  await expect(page.locator('.viewer[data-ready="true"]')).toBeVisible({ timeout: 120_000 });
  await settle(page);
}
/** Waits until the canvas has rendered two more frames (software WebGL can be slow to compile shaders). */
async function settle(page: Page, ms = 1000) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(ms);
}
const detailTitle = (page: Page) => page.locator('#detail-title');
const listButton = (page: Page, name: string | RegExp) => page.locator('.structure-panel .struct-list button', { hasText: name });
const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });
const mode = (page: Page, name: string) => page.locator('nav[aria-label="Mode"] button', { hasText: new RegExp(`^${name}$`) }).click();
const cameraButton = (page: Page, name: string) => page.locator('[aria-label="Camera views"] button', { hasText: new RegExp(`^${name}$`) });
const slider = (page: Page, name: RegExp) => page.getByRole('slider', { name });
const num = async (page: Page, sel: string, attr: string) => Number(await page.locator(sel).first().getAttribute(attr));

test('loads the endocrine system without console errors and with a clean main screen', async ({ page }) => {
  const errors = await open(page);
  await ready(page);
  await expect(page.getByRole('heading', { name: 'Endocrine System', level: 1 })).toBeVisible();
  await expect(page.locator('aside.right')).toHaveCount(0);
  await expect(radio(page, 'Real')).toHaveAttribute('aria-checked', 'true');
  await page.screenshot({ path: `${SHOTS}/01-initial.png` });
  expect(errors).toEqual([]);
});

test('clicking the model selects the structure under the pointer', async ({ page }) => {
  await open(page);
  await ready(page);
  const box = (await page.locator('.viewer canvas').boundingBox())!;
  // The free area between the panels: its centre line is the spine and the organs in front of it.
  const x = box.x + 318 + (box.width - 318) / 2;
  for (const f of [0.45, 0.55, 0.62, 0.7, 0.38]) {
    await page.mouse.click(x, box.y + box.height * f);
    if (await detailTitle(page).count()) break;
  }
  await expect(detailTitle(page)).toHaveText(/./);
  await expect(page.locator('aside.right')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/02-selected.png` });
});

test('search finds glands by name and synonym', async ({ page }) => {
  await open(page);
  await ready(page);
  const search = page.getByLabel('Search structures');
  await search.fill('hypophysis');
  await search.press('Enter');
  await expect(detailTitle(page)).toHaveText('Pituitary gland');
  await search.fill('IVC');
  await expect(page.locator('.search-results')).toContainText('Inferior vena cava');
  await search.fill('Adam’s apple');
  await expect(page.locator('.search-results')).toContainText('Thyroid cartilage');
  await search.fill('suprarenal');
  await expect(page.locator('.search-results')).toContainText('adrenal');
  await search.fill('zzzz');
  await expect(page.getByText('No structure matches')).toBeVisible();
  await search.press('Escape');
  await expect(page.locator('fieldset.layers')).toBeVisible();
});

test('a gland lists its parts, a part links back, and the modelled thyroid says so', async ({ page }) => {
  await open(page);
  await ready(page);
  await listButton(page, /^Thyroid gland$/).click();
  await expect(detailTitle(page)).toHaveText('Thyroid gland');
  await expect(page.locator('aside.right')).toContainText('3 parts');
  await page.locator('aside.right .chips button', { hasText: 'Left lobe of the thyroid' }).click();
  await expect(detailTitle(page)).toHaveText('Left lobe of the thyroid');
  await page.locator('aside.right summary', { hasText: 'Model note' }).click();
  await expect(page.locator('aside.right .model-note')).toContainText('Modelled');
  await page.locator('aside.right .chip-row button', { hasText: 'Thyroid gland' }).click();
  await expect(detailTitle(page)).toHaveText('Thyroid gland');
});

test('a gland opens its hormones in the atlas and its tissue in a close-up', async ({ page }) => {
  const errors = await open(page);
  await ready(page);
  await listButton(page, /^Pituitary gland$/).click();
  await page.locator('aside.right .hormone-chips button', { hasText: /^TSH$/ }).click();
  await expect(page.locator('[data-hormone]')).toHaveAttribute('data-hormone', 'tsh');
  await mode(page, 'Anatomy');
  await listButton(page, /^Thyroid gland$/).click();
  await page.getByRole('button', { name: /Close-up: thyroid follicles/ }).click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-close-up', 'follicle');
  await expect(page.locator('.closeup-panel')).toContainText('Thyroid follicles');
  await settle(page, 2000);
  await page.screenshot({ path: `${SHOTS}/03-follicles.png` });
  await page.getByRole('button', { name: 'Back to the body' }).click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-close-up', 'none');
  expect(errors).toEqual([]);
});

test('colour by gland and by hormone class repaint the model', async ({ page }) => {
  await open(page);
  await ready(page);
  const canvas = page.locator('.viewer canvas');
  const real = await canvas.screenshot();
  await radio(page, 'Glands').click();
  await settle(page);
  const glands = await canvas.screenshot();
  expect(Buffer.compare(real, glands)).not.toBe(0);
  await radio(page, 'Hormone class').click();
  await settle(page);
  expect(Buffer.compare(glands, await canvas.screenshot())).not.toBe(0);
  await page.screenshot({ path: `${SHOTS}/04-hormone-class.png` });
});

test('layers hide and show structures; the skeleton can be shown', async ({ page }) => {
  await open(page);
  await ready(page);
  await expect(listButton(page, /^Skull/).locator('.tag')).toHaveText('hidden');
  await page.getByLabel('Skull, ribs and pelvis').check();
  await expect(listButton(page, /^Skull/).locator('.tag')).toHaveCount(0);
  await page.getByLabel('Thyroid and parathyroids').uncheck();
  await expect(listButton(page, /^Thyroid gland/).locator('.tag')).toHaveText('hidden');
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/05-skeleton.png` });
});

test('isolate, zoom and reset', async ({ page }) => {
  await open(page);
  await ready(page);
  await listButton(page, /^Left adrenal gland$/).click();
  await page.getByLabel('Isolate').check();
  await expect(listButton(page, /^Pancreas/).locator('.tag')).toHaveText('hidden');
  await page.getByRole('button', { name: 'Zoom to' }).click();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/06-isolated-adrenal.png` });
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(detailTitle(page)).toHaveCount(0);
  await expect(listButton(page, /^Pancreas/).locator('.tag')).toHaveCount(0);
});

test('camera presets and region buttons change the view', async ({ page }) => {
  await open(page);
  await ready(page);
  const canvas = page.locator('.viewer canvas');
  const first = await canvas.screenshot();
  await cameraButton(page, 'Back').click();
  await settle(page, 1200);
  const back = await canvas.screenshot();
  expect(Buffer.compare(first, back)).not.toBe(0);
  await page.locator('[aria-label="Fly to a region"] button', { hasText: 'Neck' }).click();
  await settle(page, 1500);
  expect(Buffer.compare(back, await canvas.screenshot())).not.toBe(0);
  await page.screenshot({ path: `${SHOTS}/07-neck.png` });
});

test('labels mode shows non-overlapping labels', async ({ page }) => {
  await open(page);
  await ready(page);
  await page.getByLabel('Labels').check();
  await settle(page, 1500);
  const shown = page.locator('.scene-label[data-state="shown"]');
  expect(await shown.count()).toBeGreaterThanOrEqual(3);
  const boxes = await shown.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.top, r.right, r.bottom]));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i]!, boxes[j]!];
    expect(!(a[2]! <= b[0]! || b[2]! <= a[0]! || a[3]! <= b[1]! || b[3]! <= a[1]!), `labels ${i} and ${j} overlap`).toBe(false);
  }
  await page.screenshot({ path: `${SHOTS}/08-labels.png` });
});

test('the cut faces the camera to it, and can be flipped and turned off', async ({ page }) => {
  const errors = await open(page);
  await ready(page);
  const canvas = page.locator('.viewer canvas');
  const whole = await canvas.screenshot();
  await radio(page, 'Front').click();
  await expect(cameraButton(page, 'Front')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.slice-hint')).toHaveText('Showing the back half');
  await settle(page, 2500);
  expect(Buffer.compare(whole, await canvas.screenshot())).not.toBe(0);
  await page.screenshot({ path: `${SHOTS}/09-cut-frontal.png` });
  await page.getByRole('button', { name: 'Flip' }).click();
  await expect(cameraButton(page, 'Back')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.slice-hint')).toHaveText('Showing the front half');
  await radio(page, 'Side').click();
  await expect(page.locator('.slice-hint')).toHaveText('Showing the left side of the body');
  await radio(page, 'Off').click();
  await expect(page.getByLabel('Cut position')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Axes: thyroid feedback, surgery and tablets, Graves’ and Addison’s', async ({ page }) => {
  test.slow();
  const errors = await open(page);
  await ready(page);
  await mode(page, 'Axes');
  const panel = page.locator('.axes-panel');
  await expect(panel.locator('[data-tsh]')).toHaveAttribute('data-tsh', '1.500');
  await panel.getByRole('button', { name: 'Thyroid removed' }).click();
  await slider(page, /Time since the change/).fill('1');
  await expect.poll(() => num(page, '.axes-panel [data-tsh]', 'data-tsh')).toBeGreaterThan(50);
  await expect(panel.locator('[data-size]')).toHaveAttribute('data-size', '0.00');
  await panel.getByRole('button', { name: 'Removed + tablets' }).click();
  await slider(page, /Time since the change/).fill('1');
  await expect.poll(() => num(page, '.axes-panel [data-tsh]', 'data-tsh')).toBeLessThan(4);
  await panel.getByRole('button', { name: 'Graves’ disease' }).click();
  await slider(page, /Time since the change/).fill('1');
  await expect.poll(() => num(page, '.axes-panel [data-tsh]', 'data-tsh')).toBeLessThan(0.1);
  await expect(panel).toContainText('hyperthyroidism');
  await settle(page, 2000);
  await page.screenshot({ path: `${SHOTS}/10-axes-graves.png` });
  await radio(page, 'Stress (HPA)').click();
  await panel.getByRole('button', { name: 'Addison’s disease' }).click();
  await expect.poll(() => num(page, '.axes-panel [data-cortisol9]', 'data-cortisol9')).toBeLessThan(140);
  expect(errors).toEqual([]);
});

test('Axes: the ovary axis after the menopause', async ({ page }) => {
  await open(page);
  await ready(page);
  await mode(page, 'Axes');
  await radio(page, 'Ovary (HPG)').click();
  const panel = page.locator('.axes-panel');
  expect(await num(page, '.axes-panel [data-fsh]', 'data-fsh')).toBeLessThan(10);
  await panel.getByRole('button', { name: 'Menopause' }).click();
  await expect.poll(() => num(page, '.axes-panel [data-fsh]', 'data-fsh')).toBeGreaterThan(30);
});

test('Blood sugar: a glucose tolerance test, type 2 and type 1 without meal insulin', async ({ page }) => {
  test.slow();
  const errors = await open(page);
  await ready(page);
  await mode(page, 'Blood sugar');
  const panel = page.locator('.sugar-panel');
  await panel.getByRole('button', { name: 'Run a glucose tolerance test' }).click();
  expect(await num(page, '[data-ogtt-fasting]', 'data-ogtt-fasting')).toBeLessThan(100);
  expect(await num(page, '[data-ogtt-2h]', 'data-ogtt-2h')).toBeLessThan(140);
  await settle(page, 1500);
  await page.screenshot({ path: `${SHOTS}/11-blood-sugar.png` });
  await radio(page, 'Type 2').click();
  await panel.getByRole('button', { name: 'Run a glucose tolerance test' }).click();
  await expect.poll(() => num(page, '[data-ogtt-fasting]', 'data-ogtt-fasting')).toBeGreaterThanOrEqual(126);
  expect(await num(page, '[data-ogtt-2h]', 'data-ogtt-2h')).toBeGreaterThanOrEqual(200);
  await radio(page, 'Type 1').click();
  await slider(page, /Rapid insulin with each meal/).fill('0');
  // Basal insulin alone (no meal doses): the day averages about 160 mg/dL against about 100 with 6 units.
  await expect.poll(() => num(page, '.sugar-panel [data-mean]', 'data-mean')).toBeGreaterThan(150);
  await panel.getByRole('button', { name: 'Look inside an islet' }).click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-close-up', 'islet');
  expect(errors).toEqual([]);
});

test('Stress and clock: fight or flight, melatonin at night and light', async ({ page }) => {
  const errors = await open(page);
  await ready(page);
  await mode(page, 'Stress & clock');
  const panel = page.locator('.stress-panel');
  await panel.getByRole('button', { name: /A sudden fright/ }).click();
  // The response runs for a simulated hour: catch it while adrenaline is up (and the heart racing).
  await expect.poll(async () => (await num(page, '[data-adrenaline]', 'data-adrenaline')) > 300 && (await num(page, '[data-hr]', 'data-hr')) > 100, { timeout: 20_000, intervals: [100] }).toBe(true);
  await settle(page, 1500);
  await page.screenshot({ path: `${SHOTS}/12-fight-or-flight.png` });
  await slider(page, /Time of day/).fill('3');
  expect(await num(page, '[data-melatonin]', 'data-melatonin')).toBeGreaterThan(50);
  await slider(page, /Time of day/).fill('22');
  const dim = await num(page, '[data-melatonin]', 'data-melatonin');
  await slider(page, /Light in the evening/).fill('300');
  await expect.poll(() => num(page, '[data-melatonin]', 'data-melatonin')).toBeLessThan(dim / 2);
  expect(errors).toEqual([]);
});

test('Calcium: PTH holds calcium; an adenoma, lost glands and vitamin D deficiency', async ({ page }) => {
  await open(page);
  await ready(page);
  await mode(page, 'Calcium');
  const panel = page.locator('.calcium-panel');
  await expect(panel.locator('[data-ca]')).toHaveAttribute('data-ca', '2.40');
  await panel.getByRole('button', { name: 'Parathyroid adenoma' }).click();
  await expect.poll(() => num(page, '[data-ca]', 'data-ca')).toBeGreaterThan(2.6);
  await expect(panel).toContainText('primary hyperparathyroidism');
  await panel.getByRole('button', { name: 'Glands lost in surgery' }).click();
  await expect.poll(() => num(page, '[data-ca]', 'data-ca')).toBeLessThan(2.2);
  await panel.getByRole('button', { name: 'Vitamin D deficiency' }).click();
  await expect.poll(() => num(page, '[data-pth]', 'data-pth')).toBeGreaterThan(6.9);
  await settle(page, 1500);
  await page.screenshot({ path: `${SHOTS}/13-calcium.png` });
});

test('Cell: insulin works from the surface, cortisol inside the nucleus', async ({ page }) => {
  const errors = await open(page);
  await ready(page);
  await mode(page, 'Cell');
  await expect(page.locator('.viewer')).toHaveAttribute('data-close-up', 'cell');
  const panel = page.locator('.cell-panel');
  await radio(page, 'Insulin').click();
  for (let i = 0; i < 3; i++) await panel.getByRole('button', { name: 'Next step' }).click();
  await expect(panel.locator('.is-current')).toContainText('GLUT4');
  await settle(page, 1500);
  await page.screenshot({ path: `${SHOTS}/14-cell-insulin.png` });
  await radio(page, 'Cortisol').click();
  for (let i = 0; i < 3; i++) await panel.getByRole('button', { name: 'Next step' }).click();
  await expect(panel.locator('.is-current')).toContainText('nucleus');
  expect(errors).toEqual([]);
});

test('Disorders: a disorder shows its pattern and the test reader reads results', async ({ page }) => {
  await open(page);
  await ready(page);
  await mode(page, 'Disorders');
  const panel = page.locator('.disorders-panel');
  await panel.getByRole('button', { name: 'Addison’s disease' }).click();
  await expect(panel.locator('[data-disorder]')).toContainText('9 am cortisol');
  await expect(panel.locator('[data-pattern]')).toHaveAttribute('data-pattern', 'primary-hypo');
  await radio(page, 'Calcium').click();
  await expect(panel.locator('[data-pattern]')).toHaveAttribute('data-pattern', 'primary-hyperpara');
  await radio(page, 'Glucose').click();
  await page.getByLabel('Fasting glucose in mg/dL').fill('130');
  await expect(panel.locator('[data-pattern]')).toHaveAttribute('data-pattern', 'diabetes');
  await settle(page, 1500);
  await page.screenshot({ path: `${SHOTS}/15-disorders.png` });
});

test('Hormone atlas: search, filter and show a hormone’s route', async ({ page }) => {
  const errors = await open(page);
  await ready(page);
  await mode(page, 'Hormone atlas');
  const panel = page.locator('.atlas-panel');
  await page.getByLabel('Search hormones').fill('vasopressin');
  await expect(panel.locator('.atlas-list li')).toHaveCount(1);
  await panel.locator('.atlas-list button').first().click();
  await expect(panel.locator('[data-hormone]')).toHaveAttribute('data-hormone', 'adh');
  await page.getByLabel('Search hormones').fill('');
  await radio(page, 'Steroids').click();
  await expect(panel.locator('.atlas-list')).toContainText('Cortisol');
  await expect(panel.locator('.atlas-list')).not.toContainText('Insulin');
  await panel.locator('.atlas-list button', { hasText: 'Cortisol' }).click();
  await settle(page, 2000);
  await page.screenshot({ path: `${SHOTS}/16-atlas-cortisol.png` });
  expect(errors).toEqual([]);
});

test('guided tour navigates forward, back, into a close-up, and finishes', async ({ page }) => {
  test.slow();
  await open(page);
  await ready(page);
  await mode(page, 'Guided tour');
  await expect(page.getByText(/step 1 of 19/)).toBeVisible();
  await expect(page.locator('#tour-title')).toHaveText('The endocrine system');
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page.locator('#tour-title')).toHaveText('Two ways down the stalk');
  await expect(page.locator('.viewer')).toHaveAttribute('data-close-up', 'pituitary');
  await settle(page, 2500);
  await page.screenshot({ path: `${SHOTS}/17-tour-pituitary.png` });
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByText(/step 2 of 19/)).toBeVisible();
  await expect(page.locator('.viewer')).toHaveAttribute('data-close-up', 'none');
  await page.locator('.tour-index button', { hasText: 'The thyroid wraps the trachea' }).click();
  await expect(page.locator('.slice-hint')).toContainText('set by the tour');
  await settle(page, 2500);
  await page.screenshot({ path: `${SHOTS}/18-tour-thyroid-cut.png` });
  await page.locator('.tour-index button').last().click();
  await expect(page.getByText(/step 19 of 19/)).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('button', { name: 'Anatomy' })).toHaveAttribute('aria-pressed', 'true');
});

test('phone layout: structures open from the dock and details follow a pick', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await ready(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator('aside.left')).toBeHidden();
  await page.getByRole('button', { name: 'Structures' }).click();
  await listButton(page, /^Pineal gland$/).click();
  await expect(page.locator('aside.left')).toBeHidden();
  await expect(detailTitle(page)).toHaveText('Pineal gland');
  await page.screenshot({ path: `${SHOTS}/19-phone.png` });
});

test('the About sheet holds the HuBMAP and BodyParts3D credits', async ({ page }) => {
  await open(page);
  await ready(page);
  await page.getByRole('button', { name: /About this lab/ }).click();
  const dialog = page.getByRole('dialog', { name: 'About this lab' });
  await expect(dialog).toContainText('HuBMAP');
  await expect(dialog).toContainText('BodyParts3D');
  await expect(dialog).toContainText('Bergman');
  await expect(dialog).toContainText('modelled');
  await expect(dialog).toContainText('CC Attribution 4.0');
  await page.screenshot({ path: `${SHOTS}/20-about.png` });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('without WebGL the learning content still works', async ({ page }) => {
  await open(page, '?nowebgl');
  await expect(page.getByRole('heading', { name: '3D view unavailable' })).toBeVisible();
  await listButton(page, /^Pineal gland$/).click();
  await expect(detailTitle(page)).toHaveText('Pineal gland');
  await mode(page, 'Disorders');
  await expect(page.locator('.disorders-panel [data-pattern]')).toHaveAttribute('data-pattern', 'primary-hypo');
  await mode(page, 'Calcium');
  await expect(page.locator('.calcium-panel [data-ca]')).toHaveAttribute('data-ca', '2.40');
});

test('a missing model shows an error with a working retry', async ({ page }) => {
  let fail = true;
  await page.route('**/models/endocrine.glb', (route) => (fail ? route.fulfill({ status: 404, body: 'not found' }) : route.continue()));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('The 3D model could not be loaded');
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await ready(page);
});

test('reduced motion: the animated views and close-ups work without errors', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1366, height: 820 } });
  const page = await context.newPage();
  const errors = await open(page);
  await ready(page);
  for (const m of ['Axes', 'Blood sugar', 'Stress & clock', 'Calcium', 'Cell']) { await mode(page, m); await settle(page, 800); }
  expect(errors).toEqual([]);
  await context.close();
});
