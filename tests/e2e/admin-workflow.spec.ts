import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import sharp from 'sharp';
import { totp } from '../integration/helpers';

/*
 * Full newsroom workflow against a running server connected to a fresh local
 * Supabase stack (see README). Emails are read from the local Mailpit inbox.
 */

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const SETUP_TOKEN = process.env.OWNER_SETUP_TOKEN ?? '';
const run = Date.now().toString(36);
const owner = { name: 'مالك الموقع', email: `owner-${run}@example.com`, password: `Owner-${run}-Passw0rd` };
const writer = { name: 'صحفي تجريبي', email: `writer-${run}@example.com`, password: `Writer-${run}-Passw0rd` };
const headline = `خبر اختبار النشر ${run}`;

test.describe.configure({ mode: 'serial' });

async function inviteLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const list = (await res.json()) as { messages?: { ID: string }[] };
    const id = list.messages?.[0]?.ID;
    if (id) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { HTML: string };
      const match = /href="([^"]*\/admin\/auth\/confirm\/[^"]*)"/.exec(message.HTML);
      if (match) return match[1]!.replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no email for ${email}`);
}

async function acceptInvite(page: Page, email: string, password: string) {
  const link = new URL(await inviteLink(email));
  await page.goto(link.pathname + link.search);
  // Opening the link alone must not spend the token.
  await expect(page.locator('form button[type="submit"]')).toBeVisible();
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin\/set-password\//);
  await page.locator('#password').fill(password);
  await page.locator('#confirm').fill(password);
  await page.locator('form.admin-form button[type="submit"]').click();
}

async function flash(page: Page) {
  return page.locator('.flash').first();
}

async function testImage(): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 675, channels: 3, background: { r: 200, g: 16, b: 46 } } })
    .png()
    .toBuffer();
}

test.describe('newsroom workflow', () => {
  test.skip(!SETUP_TOKEN, 'OWNER_SETUP_TOKEN is not set');

  let context: BrowserContext;
  let page: Page;
  let articleId = '';
  let slug = '';

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ baseURL: 'http://localhost:4321' });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('Owner account is created through the one-time setup with MFA', async () => {
    await page.goto('/admin/setup/');
    await page.locator('#token').fill('wrong-token-wrong-token-wrong');
    await page.locator('#name').fill(owner.name);
    await page.locator('#email').fill(owner.email);
    await page.locator('form button[type="submit"]').click();
    await expect(await flash(page)).toHaveClass(/flash--error/);

    await page.locator('#token').fill(SETUP_TOKEN);
    await page.locator('#name').fill(owner.name);
    await page.locator('#email').fill(owner.email);
    await page.locator('form button[type="submit"]').click();
    await expect(await flash(page)).toHaveClass(/flash--ok/);

    await acceptInvite(page, owner.email, owner.password);
    await expect(page).toHaveURL(/\/admin\/mfa\/setup\//);
    const secret = (await page.locator('[data-mfa-secret]').textContent())!.trim();
    await page.locator('#code').fill(totp(secret));
    await page.locator('form.admin-form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/$/);

    await page.goto('/admin/setup/');
    await expect(page.locator('#token')).toHaveCount(0);
  });

  test('dashboard pages are reachable', async () => {
    for (const path of ['/admin/articles/', '/admin/media/', '/admin/categories/', '/admin/homepage/', '/admin/settings/', '/admin/inquiries/', '/admin/staff/', '/admin/audit/', '/admin/account/']) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('create a draft with an uploaded image; it is not public', async ({ request }) => {
    await page.goto('/admin/articles/new/');
    await page.locator('#title').fill(headline);
    await page.locator('#summary').fill('ملخص خبر الاختبار.');
    await page.locator('[data-add="paragraph"]').click();
    await page.locator('[data-blocks] textarea').first().fill('هذه فقرة من نص خبر الاختبار.');

    await page.locator('[data-pick-cover]').click();
    await page.locator('[data-upload-input]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: await testImage() });
    await expect(page.locator('[data-cover-preview] img')).toBeVisible();

    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(await flash(page)).toHaveClass(/flash--ok/);
    articleId = /\/admin\/articles\/([0-9a-f-]{36})\//.exec(page.url())![1]!;
    slug = await page.locator('#slug').inputValue();
    expect(slug).toMatch(/^[a-z0-9-]+$/);

    expect((await request.get(`/ar/news/${slug}/`)).status()).toBe(404);
    const preview = await page.goto(`/admin/articles/${articleId}/preview/`);
    expect(preview?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(headline);
  });

  test('publish: the article appears on the public site with its image', async ({ request }) => {
    await page.goto(`/admin/articles/${articleId}/`);
    await page.getByRole('button', { name: 'نشر الآن' }).click();
    await expect(await flash(page)).toHaveClass(/flash--ok/);

    const article = await request.get(`/ar/news/${slug}/`);
    expect(article.status()).toBe(200);
    const html = await article.text();
    expect(html).toContain(headline);
    const imageUrl = /<img src="([^"]+media-public[^"]+)"/.exec(html)?.[1];
    expect(imageUrl).toBeTruthy();
    expect((await request.get(imageUrl!)).status()).toBe(200);

    expect(await (await request.get('/ar/')).text()).toContain(headline);
    expect(await (await request.get('/ar/category/egypt/')).text()).toContain(headline);
    expect(await (await request.get(`/ar/search/?q=${encodeURIComponent('اختبار النشر')}`)).text()).toContain(headline);
    expect(await (await request.get('/sitemap.xml')).text()).toContain(`/ar/news/${slug}/`);
  });

  test('edit and unpublish update the public site', async ({ request }) => {
    await page.goto(`/admin/articles/${articleId}/`);
    await page.locator('#title').fill(`${headline} (محدث)`);
    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(await flash(page)).toHaveClass(/flash--ok/);
    expect(await (await request.get(`/ar/news/${slug}/`)).text()).toContain(`${headline} (محدث)`);

    const html = await (await request.get(`/ar/news/${slug}/`)).text();
    const imageUrl = /<img src="([^"]+media-public[^"]+)"/.exec(html)![1]!;

    await page.getByRole('button', { name: 'إلغاء النشر' }).click();
    await expect(await flash(page)).toHaveClass(/flash--ok/);
    expect((await request.get(`/ar/news/${slug}/`)).status()).toBe(404);
    // The image is withdrawn from public storage once no published article uses it.
    expect((await request.get(imageUrl)).status()).not.toBe(200);
  });

  test('advertising inquiries are stored and visible to the Owner only', async ({ browser }) => {
    const visitor = await browser.newPage({ baseURL: 'http://localhost:4321' });
    await visitor.goto('/ar/advertise/');
    await visitor.locator('#company').fill(`شركة اختبار ${run}`);
    await visitor.locator('#contactPerson').fill('منى');
    await visitor.locator('#email').fill('mona@example.com');
    await visitor.locator('#phone').fill('01000000000');
    await visitor.locator('#details').fill('حملة تجريبية');
    await visitor.getByRole('button', { name: 'إرسال الطلب' }).click();
    await expect(visitor).toHaveURL(/sent=1/);
    await expect(visitor.locator('.notice--success')).toBeVisible();

    await visitor.locator('#company').fill('');
    await visitor.getByRole('button', { name: 'إرسال الطلب' }).click();
    await visitor.close();

    await page.goto('/admin/inquiries/');
    await expect(page.locator('main')).toContainText(`شركة اختبار ${run}`);
  });

  test('a journalist invited by the Owner cannot publish', async ({ browser }) => {
    await page.goto('/admin/staff/');
    await page.locator('#inv-name').fill(writer.name);
    await page.locator('#inv-email').fill(writer.email);
    await page.locator('#inv-role').selectOption('journalist');
    await page.getByRole('button', { name: 'دعوة عضو' }).click();
    await expect(await flash(page)).toHaveClass(/flash--ok/);

    const ctx = await browser.newContext({ baseURL: 'http://localhost:4321' });
    const w = await ctx.newPage();
    await acceptInvite(w, writer.email, writer.password);
    await expect(w).toHaveURL(/\/admin\/$/);

    // No staff, settings or inquiry pages for journalists.
    await expect(w.locator('.admin-nav a[href="/admin/staff/"]')).toHaveCount(0);
    await w.goto('/admin/inquiries/');
    await expect(w).toHaveURL(/\/admin\/\?error=forbidden/);

    await w.goto('/admin/articles/new/');
    await w.locator('#title').fill(`مسودة صحفي ${run}`);
    await w.locator('[data-add="paragraph"]').click();
    await w.locator('[data-blocks] textarea').first().fill('نص.');
    await w.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(await flash(w)).toHaveClass(/flash--ok/);
    await expect(w.getByRole('button', { name: 'نشر الآن' })).toHaveCount(0);

    // Forging the publish action is rejected by the database.
    const forged = w.waitForResponse((r) => r.request().method() === 'POST');
    await w.evaluate(() => {
      const form = document.getElementById('article-form') as HTMLFormElement;
      const b = document.createElement('button');
      b.name = 'intent';
      b.value = 'publish';
      form.append(b);
      b.click();
    });
    expect((await forged).status()).toBe(400);
    await expect(w.locator('.flash--error')).toBeVisible();
    const writerSlug = await w.locator('#slug').inputValue();
    expect((await w.request.get(`/ar/news/${writerSlug}/`)).status()).toBe(404);
    await ctx.close();
  });

  test('bilingual versions, scheduling, homepage featuring and the ticker', async ({ request }) => {
    const create = async (lang: 'ar' | 'en', title: string, slugValue: string) => {
      await page.goto('/admin/articles/new/');
      await page.locator('#lang').selectOption(lang);
      await page.locator('#title').fill(title);
      await page.locator('#slug').fill(slugValue);
      await page.locator('[data-add="paragraph"]').click();
      await page.locator('[data-blocks] textarea').first().fill(lang === 'ar' ? 'نص عربي.' : 'English text.');
      await page.getByRole('button', { name: 'نشر الآن' }).click();
      await expect(await flash(page)).toHaveClass(/flash--ok/);
      return /\/admin\/articles\/([0-9a-f-]{36})\//.exec(page.url())![1]!;
    };
    await create('ar', `خبر ثنائي اللغة ${run}`, `bilingual-${run}`);
    await create('en', `Bilingual story ${run}`, `bilingual-${run}`);
    await page.locator('#translation_of').selectOption({ label: `خبر ثنائي اللغة ${run}` });
    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(await flash(page)).toHaveClass(/flash--ok/);

    const ar = await (await request.get(`/ar/news/bilingual-${run}/`)).text();
    expect(ar).toContain(`hreflang="en" href="http://localhost:4321/en/news/bilingual-${run}/"`);
    expect(ar).toContain('Read in English');
    const en = await request.get(`/en/news/bilingual-${run}/`);
    expect(en.status()).toBe(200);
    expect(await en.text()).toContain('dir="ltr"');

    // Scheduled for tomorrow: saved, but not public yet.
    await page.goto('/admin/articles/new/');
    await page.locator('#title').fill(`خبر مجدول ${run}`);
    await page.locator('#slug').fill(`scheduled-${run}`);
    await page.locator('[data-add="paragraph"]').click();
    await page.locator('[data-blocks] textarea').first().fill('نص.');
    const tomorrow = new Date(Date.now() + 86_400_000);
    const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(tomorrow);
    await page.locator('#publish_at').fill(`${local}T09:00`);
    await page.getByRole('button', { name: 'جدولة النشر' }).click();
    await expect(await flash(page)).toHaveClass(/flash--ok/);
    await expect(page.locator('.pill--scheduled')).toBeVisible();
    expect((await request.get(`/ar/news/scheduled-${run}/`)).status()).toBe(404);

    // Feature the Arabic story and add a ticker item linked to it.
    await page.goto('/admin/homepage/');
    await page.locator('#add-ar').selectOption({ label: `خبر ثنائي اللغة ${run}` });
    await page.locator('form:has(#add-ar) button[type="submit"]').click();
    await expect(await flash(page)).toHaveClass(/flash--ok/);
    await page.locator('#t-text').fill(`عاجل ${run}`);
    await page.locator('#t-article').selectOption({ label: `AR · خبر ثنائي اللغة ${run}` });
    await page.getByRole('button', { name: 'إضافة', exact: true }).click();
    await expect(await flash(page)).toHaveClass(/flash--ok/);

    const home = await (await request.get('/ar/')).text();
    expect(home).toContain(`عاجل ${run}`);
    const lead = /<article class="story-lead">[\s\S]*?<\/article>/.exec(home)?.[0] ?? '';
    expect(lead).toContain(`خبر ثنائي اللغة ${run}`);
  });

  test('every change is in the audit log', async () => {
    await page.goto('/admin/audit/');
    const text = await page.locator('main').textContent();
    for (const action of ['article.create', 'article.status', 'auth.password_set', 'staff_invitations.insert']) {
      expect(text).toContain(action);
    }
  });
});
