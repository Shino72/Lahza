// اختبارات المنطق والعرض (بدون متصفح): node tests/logic.test.js
const assert = require('assert');
const path = require('path');
const root = path.join(__dirname, '..');

global.NABD_DATA = require(path.join(root, 'js/data.js'));
global.NABD_UTILS = require(path.join(root, 'js/utils.js'));
const R = require(path.join(root, 'js/render.js'));
const D = NABD_DATA, U = NABD_UTILS;

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS', name); }
  catch (e) { console.log('FAIL', name, '\n   ', e.message); process.exitCode = 1; }
}

test('كل قسم فيه موضوع واحد على الأقل', () => {
  D.SECTIONS.forEach(s => {
    assert.ok(D.ARTICLES.some(a => a.section === s.slug), 'قسم فاضي: ' + s.slug);
  });
});

test('كل موضوع فيه الحقول الأساسية وقسمه موجود', () => {
  const ids = new Set();
  D.ARTICLES.forEach(a => {
    ['id', 'title', 'summary', 'author', 'date', 'kind', 'body'].forEach(k => assert.ok(a[k], a.id + ' ناقص ' + k));
    assert.ok(!ids.has(a.id), 'id مكرر: ' + a.id); ids.add(a.id);
    assert.ok(U.sectionOf(D.SECTIONS, a.section), 'قسم غلط في ' + a.id);
    assert.ok(a.body.every(b => b.text && (b.type === 'p' || b.type === 'h')), 'فقرة غلط في ' + a.id);
    assert.strictEqual(a.sample, true, 'كل المواضيع الحالية لازم تكون تجريبية: ' + a.id);
  });
});

test('ترتيب الأحدث والأقدم صح', () => {
  const newest = U.sortArticles(D.ARTICLES, 'newest').map(a => a.date);
  const oldest = U.sortArticles(D.ARTICLES, 'oldest').map(a => a.date);
  assert.deepStrictEqual(newest, [...newest].sort().reverse());
  assert.deepStrictEqual(oldest, [...oldest].sort());
});

test('الأكثر قراءة بيرجع الأعلى مشاهدات', () => {
  const top = U.mostRead(D.ARTICLES, 3);
  assert.strictEqual(top.length, 3);
  assert.ok(top[0].views >= top[1].views && top[1].views >= top[2].views);
  assert.strictEqual(top[0].id, 'rent-investigation');
});

test('البحث بيتجاهل الهمزات والتشكيل والتاء المربوطة', () => {
  assert.deepStrictEqual(U.searchArticles(D.ARTICLES, 'ايجار', D.SECTIONS).map(a => a.id), ['rent-investigation']);
  assert.deepStrictEqual(U.searchArticles(D.ARTICLES, 'إِيجَار', D.SECTIONS).map(a => a.id), ['rent-investigation']);
  assert.ok(U.searchArticles(D.ARTICLES, 'مساحات', D.SECTIONS).some(a => a.id === 'safe-spaces'));
});

test('البحث بالكلمات: كل الكلمات لازم تكون موجودة', () => {
  assert.strictEqual(U.searchArticles(D.ARTICLES, 'الإيجار تحقيق', D.SECTIONS).length, 1);
  assert.strictEqual(U.searchArticles(D.ARTICLES, 'الإيجار كلمةمش', D.SECTIONS).length, 0);
});

test('البحث الفاضي مبيرجعش حاجة', () => {
  assert.deepStrictEqual(U.searchArticles(D.ARTICLES, '   ', D.SECTIONS), []);
});

test('البحث بيدور في اسم القسم كمان', () => {
  assert.ok(U.searchArticles(D.ARTICLES, 'تكنولوجيا', D.SECTIONS).some(a => a.id === 'ai-study'));
});

test('الراوتر بيفهم الصفحات والترتيب', () => {
  assert.deepStrictEqual(U.parseRoute('#/'), { name: 'home' });
  assert.deepStrictEqual(U.parseRoute('#/section/tech?sort=views'), { name: 'section', slug: 'tech', sort: 'views' });
  assert.deepStrictEqual(U.parseRoute('#/section/tech?sort=xyz').sort, 'newest');
  assert.deepStrictEqual(U.parseRoute('#/article/ai-study'), { name: 'article', id: 'ai-study' });
  assert.deepStrictEqual(U.parseRoute('#/search?q=' + encodeURIComponent('حاجة كده')), { name: 'search', q: 'حاجة كده' });
  assert.deepStrictEqual(U.parseRoute('#/about'), { name: 'about' });
  assert.deepStrictEqual(U.parseRoute('#/contact'), { name: 'contact' });
});

test('الراوتر مش بيقع مع رابط تالف أو مسار غلط', () => {
  assert.deepStrictEqual(U.parseRoute('#/section/%E0%A4%A'), { name: 'notfound' });
  assert.deepStrictEqual(U.parseRoute('#/xyz'), { name: 'notfound' });
  assert.deepStrictEqual(U.parseRoute(''), { name: 'home' });
});

test('التعقيم بيحمي من كود HTML', () => {
  assert.strictEqual(U.esc('<script>"x"&\'y\'</script>'), '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;');
});

test('فورم التواصل بيتحقق من الخانات', () => {
  assert.deepStrictEqual(U.validateContact({ name: 'سارة', email: 'a@b.co', message: 'رسالة كافية هنا' }), {});
  const e = U.validateContact({ name: 'س', email: 'غلط', message: 'قصير' });
  assert.ok(e.name && e.email && e.message);
});

test('رابط الإيميل بيتبني برسالة مشفرة', () => {
  const link = U.contactMailto('x@y.com', { name: 'أحمد', email: 'a@b.co', subject: 'اقتراح موضوع', message: 'سطر\nتاني' });
  assert.ok(link.startsWith('mailto:x@y.com?subject='));
  assert.ok(link.includes('%0A'), 'السطر الجديد لازم يتشفر');
  assert.ok(!link.includes(' '), 'مفيش مسافات خام في الرابط');
});

test('روابط المشاركة فيها الرابط والعنوان مشفرين', () => {
  const s = U.shareLinks('https://x.test/#/article/a?b=1', 'عنوان & مهم');
  assert.ok(s.whatsapp.startsWith('https://wa.me/?text='));
  assert.ok(s.x.includes('url=' + encodeURIComponent('https://x.test/#/article/a?b=1')));
  assert.ok(s.facebook.includes('sharer.php?u='));
  assert.ok(!s.x.includes('&m'), 'العنوان لازم يتشفر');
});

test('صورة الغلاف SVG صالحة وبتتغير حسب الموضوع', () => {
  const a = U.coverDataUri('one', '#000', '#fff');
  const b = U.coverDataUri('two', '#000', '#fff');
  assert.ok(a.startsWith('data:image/svg+xml'));
  assert.notStrictEqual(a, b);
});

test('الصفحة الرئيسية فيها الخبر الرئيسي والأكثر قراءة', () => {
  const h = R.homePage().html;
  assert.ok(h.includes('رحلة البحث عن سكن للطلاب'));
  assert.ok(h.includes('الأكثر قراءة'));
});

test('صفحة القسم الفاضي بتطلع رسالة واضحة، والقسم غلط بيطلع 404', () => {
  assert.ok(R.sectionPage('tech', 'newest').html.includes('ai-study'));
  assert.ok(R.sectionPage('no-such', 'newest').html.includes('مش موجودة'));
});

test('البحث بيعرض كود HTML كنص، ومفيش حقن', () => {
  const r = R.searchPage('<img src=x onerror=alert(1)>').html;
  assert.ok(!r.includes('<img src=x'));
  assert.ok(r.includes('&lt;img'));
});

test('صفحة الموضوع فيها المشاركة والمصادر والتعليق على الصورة التمثيلية', () => {
  const page = R.articlePage('rent-investigation', 'https://x.test/#/article/rent-investigation').html;
  assert.ok(page.includes('واتساب') && page.includes('إكس') && page.includes('فيسبوك'));
  assert.ok(page.includes('المصادر'));
  // كل المواضيع الحالية صورها تمثيلية (SVG)، فالتعليق لازم يظهر
  assert.ok(page.includes('صورة تمثيلية للعرض'));
  const other = R.articlePage('ai-study', 'x').html;
  assert.ok(other.includes('صورة تمثيلية للعرض'));
});

test('موضوع مش موجود بيرجع صفحة 404', () => {
  assert.ok(R.articlePage('no-such-id', '').html.includes('مش موجودة'));
});

test('مفيش روابط فاضية أو وهمية في القائمة', () => {
  const html = R.navHtml() + R.footerHtml();
  assert.ok(!/href="#"/.test(html));
  assert.ok(!/href=""/.test(html));
});

console.log('\n' + passed + ' اختبار عدّى');
