import { expect, test } from '@playwright/test';

const categories = [
  ['egypt', 'مصر', 'Egypt'],
  ['politics', 'سياسة', 'Politics'],
  ['arab-world', 'عرب وعالم', 'Arab & World'],
  ['economy', 'اقتصاد', 'Economy'],
  ['sports', 'رياضة', 'Sports'],
  ['entertainment', 'فن', 'Entertainment'],
  ['drama', 'دراما', 'Drama'],
  ['crime', 'حوادث', 'Crime & Incidents'],
  ['technology', 'تكنولوجيا', 'Technology'],
  ['lifestyle', 'لايف ستايل', 'Lifestyle'],
] as const;

const pages = ['/ar/', '/en/', '/ar/news/new-public-library-opens/', '/ar/advertise/', '/ar/category/economy/', '/ar/search/?q=مصر'];

test('Arabic is RTL and English is LTR', async ({ page }) => {
  await page.goto('/ar/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

for (const path of pages) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('navigation lists all ten categories and each page loads', async ({ page }) => {
  await page.goto('/ar/');
  const nav = page.getByRole('navigation', { name: 'الأقسام' });
  for (const [slug, ar] of categories) {
    await expect(nav.getByRole('link', { name: ar, exact: true })).toHaveAttribute('href', `/ar/category/${slug}/`);
  }
  for (const [slug, ar, en] of categories) {
    const arResponse = await page.goto(`/ar/category/${slug}/`);
    expect(arResponse?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(ar);
    await page.goto(`/en/category/${slug}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(en);
  }
});

test('advertising shortcut stays visible while scrolling and opens the advertising page', async ({ page }) => {
  await page.goto('/ar/');
  await page.mouse.wheel(0, 2500);
  await page.waitForTimeout(200);
  const button = page.locator('.ad-button');
  await expect(button).toBeInViewport();
  await button.click();
  await expect(page).toHaveURL(/\/ar\/advertise\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('أعلن مع لحظة');
});

test('advertising page uses the exact contact links', async ({ page }) => {
  await page.goto('/ar/advertise/');
  const card = page.locator('.contact-card');
  await expect(card).toContainText('01101135785');
  await expect(card).toContainText('WhatsApp & Call');
  await expect(card.locator('a[href="tel:01101135785"]')).toHaveCount(1);
  await expect(card.locator('a[href="https://wa.me/201101135785"]')).toHaveCount(1);
  await expect(card.locator('a[href="mailto:Seifkhaledamer6@gmail.com"]')).toHaveCount(1);
  // The form stays disabled until inquiries can be stored securely.
  await expect(page.getByRole('button', { name: 'إرسال الطلب' })).toBeDisabled();
  await expect(page.locator('#company')).toBeDisabled();
});

test('footer shows leadership, contact and key links', async ({ page }) => {
  await page.goto('/en/');
  const footer = page.locator('footer.site-footer');
  await expect(footer).toContainText('Chairman of the Board');
  await expect(footer).toContainText('Seif Khaled Amer');
  await expect(footer).toContainText('Editor-in-Chief');
  await expect(footer).toContainText('Reem Harb');
  for (const href of ['/en/advertise/', '/en/about/', '/en/privacy/']) {
    await expect(footer.locator(`a[href="${href}"]`)).toHaveCount(1);
  }
  await page.goto('/ar/about/');
  await expect(page.locator('main')).toContainText('سيف خالد عامر');
  await expect(page.locator('main')).toContainText('ريم حرب');
});

test('article page has headline, author, date, body, sharing and translation link', async ({ page }) => {
  await page.goto('/ar/news/new-public-library-opens/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('افتتاح مكتبة عامة جديدة');
  await expect(page.locator('.article__meta')).toContainText('فريق التحرير');
  await expect(page.locator('.article__meta time')).toHaveAttribute('datetime', '2026-10-23T08:30:00Z');
  await expect(page.locator('.article__body p')).toHaveCount(3);
  await expect(page.locator('.share a[href^="https://wa.me/?text="]')).toHaveCount(1);
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /\/en\/news\/new-public-library-opens\/$/);
  await page.getByRole('link', { name: 'Read in English' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('New public library opens');
});

test('article page exposes NewsArticle structured data and canonical URL', async ({ page }) => {
  await page.goto('/ar/news/new-public-library-opens/');
  const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
  expect(jsonLd['@type']).toBe('NewsArticle');
  expect(jsonLd.datePublished).toBe('2026-10-23T08:30:00Z');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/ar\/news\/new-public-library-opens\/$/);
});

test('language switch goes to the equivalent page', async ({ page }) => {
  await page.goto('/ar/category/sports/');
  await page.locator('.lang-switch').click();
  await expect(page).toHaveURL(/\/en\/category\/sports\/$/);
});

test('search normalises Arabic and never returns unpublished stories', async ({ page }) => {
  await page.goto('/ar/search/?q=' + encodeURIComponent('المكتبه'));
  await expect(page.locator('[data-search-results] h3 a').first()).toHaveAttribute('href', '/ar/news/new-public-library-opens/');
  await page.goto('/ar/search/?q=' + encodeURIComponent('مسودة'));
  await expect(page.locator('[data-search-results]')).toContainText('لا توجد نتائج');
  await page.goto('/ar/search/?q=' + encodeURIComponent('اختبار الجدولة'));
  await expect(page.locator('[data-search-results] h3')).toHaveCount(0);
});

test('unpublished stories are not reachable', async ({ page }) => {
  for (const slug of ['unpublished-draft-story', 'story-in-review', 'scheduled-future-story']) {
    const response = await page.goto(`/ar/news/${slug}/`);
    expect(response?.status()).toBe(404);
  }
});

test('sitemap lists published stories only and preview builds are not indexable', async ({ page, request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/ar/news/new-public-library-opens/');
  expect(sitemap).toContain('hreflang="en"');
  expect(sitemap).not.toContain('unpublished-draft-story');
  expect(sitemap).not.toContain('scheduled-future-story');
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /');
  await page.goto('/ar/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('.preview-banner')).toBeVisible();
});

test('pages contain no executable inline scripts', async ({ page }) => {
  for (const path of ['/ar/', '/ar/news/new-public-library-opens/', '/ar/search/']) {
    await page.goto(path);
    const inline = await page.locator('script:not([src]):not([type="application/json"]):not([type="application/ld+json"])').count();
    expect(inline).toBe(0);
  }
});
