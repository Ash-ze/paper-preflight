import { expect, test, type Page } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const fixture = (n: string) => join(here, '..', 'fixtures', n);
const shots = join(here, '..', '..', 'docs', 'screenshots');
const SHOOT = !!process.env.SCREENSHOTS;

/** Record every request that leaves the page's own origin. */
function watchNetwork(page: Page) {
  const external: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['127.0.0.1:4173'].includes(u.host) && !['blob:', 'data:'].includes(u.protocol)) external.push(r.url());
  });
  return external;
}

async function upload(page: Page, name: string) {
  await page.locator('#file').setInputFiles(fixture(name));
  await expect(page.locator('.summary')).toBeVisible();
}

test('clean PDF passes all checks with no external requests', async ({ page }) => {
  const external = watchNetwork(page);
  await page.goto('/');
  await upload(page, 'clean.pdf');
  await expect(page.locator('.summary')).toHaveAttribute('data-status', 'pass');
  for (const id of ['anonymity', 'fonts', 'pages', 'refs', 'paper', 'images']) {
    await expect(page.locator(`#check-${id}`)).toHaveAttribute('data-status', 'pass');
  }
  await expect(page.locator('#check-pages')).toContainText('References heading detected on page 9');
  expect(external).toEqual([]);
});

test('leaky PDF shows anonymity, reference, font and image findings', async ({ page }) => {
  await page.goto('/');
  await page.locator('#names').fill('Alex Placeholder');
  await page.locator('#affils').fill('Exampleton Robotics Lab');
  await upload(page, 'leaky.pdf');
  await expect(page.locator('.summary')).toHaveAttribute('data-status', 'fail');
  const anon = page.locator('#check-anonymity');
  await expect(anon).toHaveAttribute('data-status', 'fail');
  await expect(anon.locator('[data-code="anon.metaAuthor"]')).toHaveCount(2);
  await expect(anon.locator('[data-code="anon.ack"]')).toContainText('p. 4');
  await expect(anon.locator('[data-code="anon.hostLink"]').first()).toContainText('github.com');
  await expect(anon.locator('[data-code="anon.selfCite"]')).toHaveCount(1);
  await expect(page.locator('#check-refs [data-code="refs.ref"]')).toContainText('p. 2');
  await expect(page.locator('#check-refs [data-code="refs.cite"]')).toContainText('p. 3');
  await expect(page.locator('#check-fonts')).toHaveAttribute('data-status', 'warn');
  await expect(page.locator('#check-images [data-code="images.lowres"]')).toBeVisible();

  // evidence expands and highlights the match
  const ev = page.locator('#check-refs [data-code="refs.ref"] details');
  await ev.locator('summary').click();
  await expect(ev.locator('mark')).toHaveText('??');
  await anon.locator('[data-code="anon.ack"] summary').click();
  if (SHOOT) await page.screenshot({ path: join(shots, 'report-leaky-en.png'), fullPage: true });
});

test('overlength A4 PDF fails page limit and paper size; preset switch re-runs', async ({ page }) => {
  await page.goto('/');
  await upload(page, 'overlength.pdf');
  await expect(page.locator('#check-pages [data-code="pages.overBody"]')).toContainText('Main text is 12 pages, limit is 9 (3 over)');
  await expect(page.locator('#check-paper')).toHaveAttribute('data-status', 'fail');
  await page.locator('#preset').selectOption('acl-long');
  await expect(page.locator('#check-paper')).toHaveAttribute('data-status', 'pass');
  await expect(page.locator('#check-pages [data-code="pages.overBody"]')).toContainText('limit is 8');
  await page.locator('#bodyEnd').fill('8');
  await expect(page.locator('#check-pages')).toHaveAttribute('data-status', 'pass');
});

test('Chinese UI on a phone-sized screen, Type 3 font detected', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.locator('#lang').click();
  await expect(page.locator('h1')).toHaveText('Paper Preflight');
  await expect(page.locator('.drop-title')).toHaveText('把 PDF 拖到这里');
  await page.locator('#preset').selectOption('icml');
  await upload(page, 'type3.pdf');
  await expect(page.locator('#check-fonts')).toHaveAttribute('data-status', 'fail');
  await expect(page.locator('#check-fonts [data-code="fonts.type3"]')).toContainText('Type 3 字体');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  if (SHOOT) await page.screenshot({ path: join(shots, 'mobile-zh-type3.png'), fullPage: true });
  await ctx.close();
});

test('dark theme', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await upload(page, 'overlength.pdf');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(15, 17, 21)');
  if (SHOOT) await page.screenshot({ path: join(shots, 'report-overlength-dark.png'), fullPage: false });
  await ctx.close();
});

test('production build ships a CSP that blocks outgoing connections', async ({ page }) => {
  await page.goto('/');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("connect-src 'self'");
  const blocked = await page.evaluate(async () => {
    try {
      await fetch('https://example.org/');
      return false;
    } catch {
      return true;
    }
  });
  expect(blocked).toBe(true);
});
