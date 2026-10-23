/*
 * دوال منطق بسيطة ومستقلة عن الصفحة (قابلة للاختبار).
 */
var NABD_UTILS = (function () {

  // توحيد النص العربي عشان البحث يلاقي الكلمة حتى لو كتبت بشكل مختلف
  function normalizeAr(text) {
    return String(text == null ? '' : text)
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '')   // شيلة التشكيل
      .replace(/[إأآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // تأمين النص قبل عرضه في الصفحة
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function wordCount(text) {
    return String(text).trim().split(/\s+/).filter(Boolean).length;
  }

  function readMinutes(article) {
    var words = wordCount(article.summary) +
      article.body.reduce(function (n, b) { return n + wordCount(b.text); }, 0);
    return Math.max(1, Math.ceil(words / 150));
  }

  function formatDate(iso) {
    var d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function sectionOf(sections, slug) {
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].slug === slug) return sections[i];
    }
    return null;
  }

  // ترتيب المواضيع: newest / oldest / views
  function sortArticles(articles, mode) {
    var list = articles.slice();
    if (mode === 'oldest') {
      list.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    } else if (mode === 'views') {
      list.sort(function (a, b) { return b.views - a.views; });
    } else {
      list.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    }
    return list;
  }

  function mostRead(articles, limit) {
    return sortArticles(articles, 'views').slice(0, limit);
  }

  // مواضيع ذات صلة: من نفس القسم أولًا، وبعدين غيره لو محتاجين
  function related(articles, article, limit) {
    var same = articles.filter(function (a) { return a.section === article.section && a.id !== article.id; });
    var others = articles.filter(function (a) { return a.section !== article.section; });
    return same.concat(others).slice(0, limit);
  }

  // بحث بالكلمات: كل الكلمات لازم تكون موجودة في الموضوع
  function searchArticles(articles, query, sections) {
    var q = normalizeAr(query);
    if (!q) return [];
    var terms = q.split(' ');
    return articles.filter(function (a) {
      var sec = sectionOf(sections, a.section);
      var hay = normalizeAr([
        a.title, a.summary, a.author, sec ? sec.name : '',
        a.body.map(function (b) { return b.text; }).join(' ')
      ].join(' '));
      return terms.every(function (t) { return hay.indexOf(t) !== -1; });
    });
  }

  function shareLinks(url, title) {
    var u = encodeURIComponent(url);
    var t = encodeURIComponent(title);
    return {
      whatsapp: 'https://wa.me/?text=' + encodeURIComponent(title + ' ' + url),
      x: 'https://twitter.com/intent/tweet?text=' + t + '&url=' + u,
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + u
    };
  }

  // تحليل الرابط (hash) إلى صفحة
  function parseRoute(hash) {
    var raw = String(hash || '').replace(/^#/, '') || '/';
    var qIndex = raw.indexOf('?');
    var pathPart = qIndex === -1 ? raw : raw.slice(0, qIndex);
    var query = qIndex === -1 ? '' : raw.slice(qIndex + 1);
    var params = new URLSearchParams(query);
    var parts;
    try {
      parts = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
    } catch (e) {
      return { name: 'notfound' };
    }
    if (parts.length === 0) return { name: 'home' };
    if (parts[0] === 'section' && parts[1]) {
      var sort = params.get('sort');
      return { name: 'section', slug: parts[1], sort: ['newest', 'oldest', 'views'].indexOf(sort) !== -1 ? sort : 'newest' };
    }
    if (parts[0] === 'article' && parts[1]) return { name: 'article', id: parts[1] };
    if (parts[0] === 'search') return { name: 'search', q: params.get('q') || '' };
    if (parts[0] === 'about') return { name: 'about' };
    if (parts[0] === 'contact') return { name: 'contact' };
    return { name: 'notfound' };
  }

  // التحقق من فورم التواصل
  function validateContact(values) {
    var errors = {};
    var name = String(values.name || '').trim();
    var email = String(values.email || '').trim();
    var message = String(values.message || '').trim();
    if (name.length < 2) errors.name = 'اكتب اسمك (حرفين على الأقل).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'اكتب إيميل صحيح، زي name@example.com.';
    if (message.length < 10) errors.message = 'اكتب رسالتك (10 حروف على الأقل).';
    return errors;
  }

  // بناء رابط mailto برسالة جاهزة
  function contactMailto(email, values) {
    var subject = 'رسالة من موقع نبض الشباب: ' + (values.subject || 'استفسار عام');
    var body = 'الاسم: ' + values.name + '\nالإيميل: ' + values.email + '\n\n' + values.message;
    return 'mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  // صورة SVG تمثيلية للموضوع (لو مفيش صورة حقيقية)
  function hashString(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  function coverDataUri(seed, c1, c2) {
    var h = hashString(seed);
    var cx = 120 + (h % 560);
    var cy = 60 + ((h >> 3) % 260);
    var r = 60 + ((h >> 5) % 90);
    var waveY = 280 + ((h >> 7) % 90);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>' +
      '<rect width="800" height="450" fill="url(#g)"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#ffffff" fill-opacity="0.14"/>' +
      '<circle cx="' + (700 - (h % 300)) + '" cy="' + (380 - ((h >> 9) % 120)) + '" r="' + (90 + ((h >> 11) % 60)) + '" fill="#FF7A1A" fill-opacity="0.35"/>' +
      '<path d="M0 ' + waveY + ' Q 200 ' + (waveY - 70) + ' 400 ' + waveY + ' T 800 ' + waveY + ' V450 H0Z" fill="#FF7A1A" fill-opacity="0.85"/>' +
      '<path d="M0 ' + (waveY + 40) + ' Q 220 ' + (waveY - 20) + ' 420 ' + (waveY + 40) + ' T 800 ' + (waveY + 40) + ' V450 H0Z" fill="#ffffff" fill-opacity="0.22"/>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  return {
    normalizeAr: normalizeAr,
    esc: esc,
    wordCount: wordCount,
    readMinutes: readMinutes,
    formatDate: formatDate,
    sectionOf: sectionOf,
    sortArticles: sortArticles,
    mostRead: mostRead,
    related: related,
    searchArticles: searchArticles,
    shareLinks: shareLinks,
    parseRoute: parseRoute,
    validateContact: validateContact,
    contactMailto: contactMailto,
    hashString: hashString,
    coverDataUri: coverDataUri
  };
})();

if (typeof module !== 'undefined') module.exports = NABD_UTILS;
