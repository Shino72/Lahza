"""اختبار الموقع في متصفح حقيقي (Chromium) على ملف index.html."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
URL = (ROOT / 'index.html').as_uri()
SHOTS = Path('/home/claude/shots'); SHOTS.mkdir(exist_ok=True)
failures = []

def check(label, cond):
    print(('PASS ' if cond else 'FAIL ') + label)
    if not cond:
        failures.append(label)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900}, locale='ar-EG')
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'fonts.g' not in m.location.get('url', '') else None)
    page.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    page.route('**/fonts.gstatic.com/**', lambda r: r.abort())
    page.goto(URL)
    page.wait_for_selector('.lead__title')

    check('الصفحة الرئيسية بتتحمل وفيها خبر رئيسي', page.locator('.lead__title').count() == 1)
    check('القائمة فيها 8 روابط (الرئيسية + 7 أقسام)', page.locator('#nav-links a').count() == 8)
    check('lang و dir عربي RTL', page.get_attribute('html', 'dir') == 'rtl')
    check('كل الصور اتحملت (naturalWidth > 0)',
          page.evaluate("[...document.querySelectorAll('.cover img')].every(i => i.complete && i.naturalWidth > 0)"))
    page.screenshot(path=str(SHOTS / 'home_desktop.png'), full_page=False)

    # التنقل للقسم
    page.click('#nav-links a[data-nav="section:investigations"]')
    page.wait_for_selector('.page-head h1')
    check('الانتقال لقسم التحقيقات', page.inner_text('.page-head h1') == 'تحقيقات صحفية')
    check('زر القائمة النشطة aria-current', page.get_attribute('[data-nav="section:investigations"]', 'aria-current') == 'page')

    # البحث من الهيدر
    page.fill('#header-q', 'الإيجار')
    page.press('#header-q', 'Enter')
    page.wait_for_selector('.result-count')
    check('البحث عن "الإيجار" بيلاقي الموضوع', 'لقينا 1 نتيجة' in page.inner_text('.result-count'))

    # بحث بالهمزة والتشكيل
    page.fill('#page-q', 'إِيجار')
    page.press('#page-q', 'Enter')
    page.wait_for_selector('.result-count')
    check('البحث بيتجاهل الهمزة والتشكيل', 'لقينا 1 نتيجة' in page.inner_text('.result-count'))

    # بحث مفيهوش نتايج
    page.fill('#page-q', 'كلمةمش موجودة خالص')
    page.press('#page-q', 'Enter')
    page.wait_for_selector('.empty')
    check('رسالة "مفيش نتايج" بتظهر', 'مفيش نتايج' in page.inner_text('.empty'))

    # بحث بكود HTML ميتنفذش
    page.fill('#page-q', '<img src=x onerror=alert(1)>')
    page.press('#page-q', 'Enter')
    page.wait_for_selector('.empty')
    check('كود HTML في البحث بيتعرض كنص', page.locator('img[src="x"]').count() == 0)

    # الترتيب
    page.click('#nav-links a[data-nav="section:youth-news"]')
    page.wait_for_selector('.page-head h1')
    first_newest = page.inner_text('.card__title a')
    page.select_option('#sort-select', 'oldest')
    page.wait_for_timeout(200)
    first_oldest = page.inner_text('.card__title a')
    check('تغيير الترتيب بيغير أول موضوع', first_newest != first_oldest)
    check('الترتيب من الأقدم بيبدأ بأقدم موضوع', first_oldest == 'ملتقى توظيف جامعي يجمع الطلاب بأصحاب الشركات الناشئة')

    # صفحة موضوع
    page.click('.card__title a >> nth=0')
    page.wait_for_selector('.article__head h1')
    check('صفحة الموضوع بتفتح بعنوان الموضوع', page.locator('.article__head h1').count() == 1)
    check('أزرار المشاركة موجودة (واتساب / إكس / فيسبوك)',
          page.locator('.share a.btn').count() == 3)
    check('الكاتب والتاريخ ظاهرين', page.locator('.article__head .card__meta').count() == 1)
    page.click('[data-action="copy-link"]')
    page.wait_for_timeout(400)
    status = page.inner_text('#copy-status')
    check('زر نسخ الرابط بيعطي رد', len(status) > 0)
    check('موضوع فيه ملحوظة "صورة تمثيلية"', 'صورة تمثيلية' in page.inner_text('.article__cover') or page.locator('.article__cover figcaption').count() == 1)
    page.screenshot(path=str(SHOTS / 'article_desktop.png'), full_page=False)

    # موضوع فيه مصادر
    page.goto(URL + '#/article/rent-investigation')
    page.wait_for_selector('.article__head h1')
    check('الموضوع اللي فيه مصادر بيعرض قسم المصادر', page.locator('.sources li').count() == 2)

    # صفحة اتصل بنا: validation
    page.goto(URL + '#/contact')
    page.wait_for_selector('#contact-form')
    page.click('#contact-form button[type="submit"]')
    check('الفورم الفاضي بيظهر أخطاء', page.locator('.field-error:not([hidden])').count() == 3)
    page.fill('#name', 'س')
    page.fill('#email', 'مش إيميل')
    page.fill('#message', 'قصير')
    page.click('#contact-form button[type="submit"]')
    check('الإيميل الغلط والاسم القصير بيتسجلوا كخطأ', page.locator('.field-error:not([hidden])').count() == 3)
    page.fill('#name', 'سارة أحمد')
    page.fill('#email', 'test@example.com')
    page.fill('#message', 'عندي اقتراح لموضوع عن الشباب والسكن.')
    page.click('#contact-form button[type="submit"]')
    page.wait_for_timeout(200)
    check('الفورم الصح بيقول إن الإرسال مش متفعّل (الإيميل لسه placeholder)',
          'مش متفعّل' in page.inner_text('#contact-status'))

    # صفحة مش موجودة
    page.goto(URL + '#/xyz/abc')
    page.wait_for_selector('.empty h1')
    check('صفحة 404 لرابط غلط', 'مش موجودة' in page.inner_text('.empty h1'))

    # رابط تالف (نسبة مئوية غلط)
    page.goto(URL + '#/section/%E0%A4%A')
    page.wait_for_selector('.empty h1')
    check('رابط تالف مش بيوقع الموقع', 'مش موجودة' in page.inner_text('.empty h1'))

    check('مفيش أخطاء JavaScript في الكونسول', len(errors) == 0)
    if errors:
        print('  errors:', errors[:5])

    # ---- الموبايل ----
    mctx = browser.new_context(viewport={'width': 390, 'height': 844}, locale='ar-EG', is_mobile=True, has_touch=True)
    m = mctx.new_page()
    m_errors = []
    m.on('pageerror', lambda e: m_errors.append(str(e)))
    m.route('**/fonts.g**', lambda r: r.abort())
    m.goto(URL)
    m.wait_for_selector('.lead__title')
    check('الموبايل: مفيش سكرول أفقي', m.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1'))
    check('الموبايل: القائمة مقفولة في الأول', not m.is_visible('#nav-links'))
    m.click('#nav-toggle')
    m.wait_for_timeout(150)
    check('الموبايل: زر القائمة بيفتحها', m.is_visible('#nav-links a'))
    check('الموبايل: aria-expanded بيتحدث', m.get_attribute('#nav-toggle', 'aria-expanded') == 'true')
    m.screenshot(path=str(SHOTS / 'home_mobile_menu.png'), full_page=False)
    m.click('#nav-links a[data-nav="section:tech"]')
    m.wait_for_selector('.page-head h1')
    check('الموبايل: القائمة بتقفل بعد اختيار قسم', not m.is_visible('#nav-links'))
    m.goto(URL + '#/article/ai-study')
    m.wait_for_selector('.article__head h1')
    check('الموبايل: صفحة الموضوع مفيهاش سكرول أفقي', m.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1'))
    m.screenshot(path=str(SHOTS / 'article_mobile.png'), full_page=False)
    check('الموبايل: مفيش أخطاء JS', len(m_errors) == 0)

    browser.close()

print('\nRESULT:', 'ALL PASSED' if not failures else f'{len(failures)} FAILED: {failures}')
