/*
 * دوال العرض: بتاخد البيانات وترجع HTML كنص.
 * كل نص جاي من البيانات أو من المستخدم بيتعقّم بـ esc() قبل ما يتعرض.
 */
var NABD_RENDER = (function (D, U) {
  var SITE = D.SITE;
  var SECTIONS = D.SECTIONS;
  var ARTICLES = D.ARTICLES;
  var esc = U.esc;

  function sec(slug) { return U.sectionOf(SECTIONS, slug); }

  function artById(id) {
    for (var i = 0; i < ARTICLES.length; i++) {
      if (ARTICLES[i].id === id) return ARTICLES[i];
    }
    return null;
  }

  function articleHref(a) { return '#/article/' + encodeURIComponent(a.id); }

  function coverHtml(a, cls) {
    var s = sec(a.section);
    var src = a.image || U.coverDataUri(a.id, s.c1, s.c2);
    return '<div class="cover ' + (cls || '') + '" style="background:linear-gradient(135deg,' + s.c1 + ',' + s.c2 + ')">' +
      '<img src="' + esc(src) + '" alt="' + esc(a.imageAlt || a.title) + '" loading="lazy" decoding="async" data-cover-fallback></div>';
  }

  function tags(a) {
    var s = sec(a.section);
    var out = '<span class="sec-tag" style="--sec:' + s.c2 + '">' + esc(s.name) + '</span>';
    out += '<span class="kind">' + esc(a.kind) + '</span>';
    if (a.sample) out += '<span class="badge-sample">محتوى تجريبي</span>';
    return out;
  }

  function meta(a) {
    return esc(U.formatDate(a.date)) + ' · ' + esc(a.author) + ' · ' + U.readMinutes(a) + ' دقيقة قراءة';
  }

  function card(a, size) {
    return '<article class="card card--' + (size || 'md') + '">' +
      '<a class="card__media" href="' + articleHref(a) + '" tabindex="-1" aria-hidden="true">' + coverHtml(a) + '</a>' +
      '<div class="card__body">' +
        '<p class="card__tags">' + tags(a) + '</p>' +
        '<h3 class="card__title"><a href="' + articleHref(a) + '">' + esc(a.title) + '</a></h3>' +
        '<p class="card__summary">' + esc(a.summary) + '</p>' +
        '<p class="card__meta">' + meta(a) + '</p>' +
      '</div></article>';
  }

  function listItem(a) {
    return '<li class="row"><a href="' + articleHref(a) + '">' +
      '<span class="row__title">' + esc(a.title) + '</span>' +
      '<span class="row__meta">' + esc(sec(a.section).name) + ' · ' + esc(U.formatDate(a.date)) + '</span>' +
      '</a></li>';
  }

  function blockHead(title, moreHref) {
    var more = moreHref ? '<a class="more" href="' + moreHref + '">عرض الكل</a>' : '';
    return '<div class="block-head"><h2>' + esc(title) + '</h2>' + more + '</div>';
  }

  function navKey(route) {
    if (route.name === 'home') return 'home';
    if (route.name === 'section') return 'section:' + route.slug;
    if (route.name === 'article') {
      var a = artById(route.id);
      return a ? 'section:' + a.section : '';
    }
    return '';
  }

  function navHtml() {
    var links = '<a href="#/" data-nav="home">الرئيسية</a>';
    SECTIONS.forEach(function (s) {
      links += '<a href="#/section/' + esc(s.slug) + '" data-nav="section:' + esc(s.slug) + '">' + esc(s.name) + '</a>';
    });
    return links;
  }

  function footerHtml() {
    var sectionLinks = SECTIONS.map(function (s) {
      return '<li><a href="#/section/' + esc(s.slug) + '">' + esc(s.name) + '</a></li>';
    }).join('');
    var socialLinks = Object.keys(SITE.socials).filter(function (k) { return SITE.socials[k]; })
      .map(function (k) { return '<li><a href="' + esc(SITE.socials[k]) + '" target="_blank" rel="noopener noreferrer">' + esc(k) + '</a></li>'; })
      .join('');
    return '<div class="footer-grid">' +
      '<div><p class="footer-logo">' + esc(SITE.name) + '</p><p>' + esc(SITE.tagline) + '</p></div>' +
      '<nav aria-label="أقسام المجلة في التذييل"><h2>الأقسام</h2><ul>' + sectionLinks + '</ul></nav>' +
      '<div><h2>المجلة</h2><ul>' +
        '<li><a href="#/about">من نحن</a></li>' +
        '<li><a href="#/contact">اتصل بنا</a></li>' +
        socialLinks +
      '</ul></div>' +
    '</div>' +
    '<p class="copy">© 2026 ' + esc(SITE.name) + '. موقع تجريبي لمشروع جامعي، والمحتوى المنشور تجريبي.</p>';
  }

  // ---------- الصفحات ----------

  function homePage() {
    var sorted = U.sortArticles(ARTICLES, 'newest');
    var lead = ARTICLES.filter(function (a) { return a.featured; })[0] || sorted[0];
    var others = sorted.filter(function (a) { return a.id !== lead.id; });
    var side = others.slice(0, 2);
    var latest = others.slice(2, 6);
    var reportsAndInvestigations = others.filter(function (a) {
      return a.kind === 'تحقيق' || a.kind === 'تقرير';
    }).slice(0, 3);
    var talks = others.filter(function (a) {
      return a.kind === 'حوار' || a.kind === 'قصة نجاح';
    }).slice(0, 3);
    var top = U.mostRead(ARTICLES, 5);

    var html =
      '<section class="hero" aria-label="أهم الموضوعات">' +
        '<article class="lead">' +
          '<a class="lead__media" href="' + articleHref(lead) + '" tabindex="-1" aria-hidden="true">' + coverHtml(lead) + '</a>' +
          '<div class="lead__body">' +
            '<p class="card__tags">' + tags(lead) + '</p>' +
            '<h1 class="lead__title"><a href="' + articleHref(lead) + '">' + esc(lead.title) + '</a></h1>' +
            '<p class="lead__summary">' + esc(lead.summary) + '</p>' +
            '<p class="card__meta">' + meta(lead) + '</p>' +
          '</div>' +
        '</article>' +
        '<div class="hero__side">' + side.map(function (a) { return card(a, 'sm'); }).join('') + '</div>' +
      '</section>' +
      '<div class="home-layout">' +
        '<div class="home-main">' +
          '<section class="block">' + blockHead('أحدث الأخبار') +
            '<ul class="row-list">' + latest.map(listItem).join('') + '</ul></section>' +
          '<section class="block">' + blockHead('من التحقيقات والتقارير', '#/section/investigations') +
            '<div class="grid">' + reportsAndInvestigations.map(function (a) { return card(a); }).join('') + '</div></section>' +
          '<section class="block">' + blockHead('حوارات وقصص نجاح') +
            '<div class="grid">' + talks.map(function (a) { return card(a); }).join('') + '</div></section>' +
        '</div>' +
        '<aside class="home-aside" aria-label="الأكثر قراءة">' +
          '<h2 class="aside-title">الأكثر قراءة</h2>' +
          '<ol class="top-list">' + top.map(function (a) {
            return '<li><a href="' + articleHref(a) + '">' + esc(a.title) + '</a></li>';
          }).join('') + '</ol>' +
        '</aside>' +
      '</div>';

    return { title: 'الرئيسية', description: SITE.tagline, html: html };
  }

  function sortControl(slug, sort) {
    var opts = [['newest', 'الأحدث'], ['oldest', 'الأقدم'], ['views', 'الأكثر قراءة']];
    return '<div class="toolbar"><label for="sort-select">ترتيب حسب</label>' +
      '<select id="sort-select" data-slug="' + esc(slug) + '">' +
      opts.map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === sort ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') +
      '</select></div>';
  }

  function sectionPage(slug, sort) {
    var s = sec(slug);
    if (!s) return notFoundPage();
    var list = U.sortArticles(ARTICLES.filter(function (a) { return a.section === slug; }), sort);
    var body = list.length
      ? '<div class="grid">' + list.map(function (a) { return card(a); }).join('') + '</div>'
      : '<p class="empty-note">مفيش مواضيع في القسم ده حاليًا.</p>';
    var html =
      '<header class="page-head"><p class="crumbs"><a href="#/">الرئيسية</a> / ' + esc(s.name) + '</p>' +
      '<h1>' + esc(s.name) + '</h1><p class="lead-text">' + esc(s.description) + '</p></header>' +
      sortControl(slug, sort) + body;
    return { title: s.name, description: s.description, html: html };
  }

  function searchPage(q) {
    var query = String(q || '');
    var form =
      '<form id="page-search" class="search search--page" role="search">' +
        '<label for="page-q">ابحث عن موضوع</label>' +
        '<input id="page-q" type="search" name="q" value="' + esc(query) + '">' +
        '<button type="submit">بحث</button>' +
      '</form>';
    var result;
    if (!query.trim()) {
      result = '<p class="empty-note">اكتب كلمة أو اتنين عشان تبحث عن موضوع.</p>';
    } else {
      var found = U.searchArticles(ARTICLES, query, SECTIONS);
      if (found.length === 0) {
        result = '<div class="empty"><p>مفيش نتايج لكلمة «' + esc(query) + '». جرّب كلمة أعم، أو تصفح الأقسام:</p>' +
          '<ul class="chips">' + SECTIONS.map(function (s) {
            return '<li><a href="#/section/' + esc(s.slug) + '">' + esc(s.name) + '</a></li>';
          }).join('') + '</ul></div>';
      } else {
        result = '<p class="result-count">لقينا ' + found.length + ' نتيجة لكلمة «' + esc(query) + '»</p>' +
          '<div class="grid">' + found.map(function (a) { return card(a); }).join('') + '</div>';
      }
    }
    return {
      title: 'بحث' + (query ? ': ' + query : ''),
      description: 'ابحث عن موضوعات في مجلة نبض الشباب.',
      html: '<header class="page-head"><h1>نتائج البحث</h1></header>' + form + result
    };
  }

  function articlePage(id, pageUrl) {
    var a = artById(id);
    if (!a) return notFoundPage();
    var s = sec(a.section);
    var links = U.shareLinks(pageUrl || '', a.title);
    var body = a.body.map(function (b) {
      return b.type === 'h' ? '<h2>' + esc(b.text) + '</h2>' : '<p>' + esc(b.text) + '</p>';
    }).join('');
    var sources = a.sources && a.sources.length
      ? '<section class="sources"><h2>المصادر</h2><ul>' +
          a.sources.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></section>'
      : '';
    var rel = U.related(ARTICLES, a, 3);
    var html =
      '<nav class="crumbs" aria-label="مسار الصفحة"><a href="#/">الرئيسية</a> / ' +
        '<a href="#/section/' + esc(s.slug) + '">' + esc(s.name) + '</a></nav>' +
      '<article class="article">' +
        '<header class="article__head">' +
          '<p class="card__tags">' + tags(a) + '</p>' +
          '<h1>' + esc(a.title) + '</h1>' +
          '<p class="article__summary">' + esc(a.summary) + '</p>' +
          '<p class="card__meta">' + meta(a) + '</p>' +
        '</header>' +
        '<figure class="article__cover">' + coverHtml(a) +
          (a.image ? '' : '<figcaption>صورة تمثيلية للعرض</figcaption>') + '</figure>' +
        '<div class="article__body">' + body + '</div>' +
        sources +
        '<div class="share" role="group" aria-label="شارك الموضوع">' +
          '<span class="share__label">شارك الموضوع:</span>' +
          '<a class="btn" href="' + esc(links.whatsapp) + '" target="_blank" rel="noopener noreferrer">واتساب</a>' +
          '<a class="btn" href="' + esc(links.x) + '" target="_blank" rel="noopener noreferrer">إكس</a>' +
          '<a class="btn" href="' + esc(links.facebook) + '" target="_blank" rel="noopener noreferrer">فيسبوك</a>' +
          '<button type="button" class="btn" data-action="copy-link">نسخ الرابط</button>' +
          '<span id="copy-status" class="status" role="status"></span>' +
        '</div>' +
      '</article>' +
      '<section class="block"><div class="block-head"><h2>مواضيع ذات صلة</h2></div>' +
        '<div class="grid">' + rel.map(function (x) { return card(x); }).join('') + '</div></section>' +
      '<p class="back-row"><a class="btn" href="#/section/' + esc(s.slug) + '">رجوع إلى ' + esc(s.name) + '</a></p>';
    return { title: a.title, description: a.summary, html: html };
  }

  function aboutPage() {
    var html =
      '<header class="page-head"><h1>من نحن</h1></header>' +
      '<div class="prose">' +
        '<p>' + esc(SITE.name) + ' مجلة صحفية رقمية، هدفها تقدم أخبار وتقارير وتحقيقات وحوارات تهم الشباب المصري، بأسلوب عصري وسهل القراءة.</p>' +
        '<p>المجلة مش موقع خدمي أو تجاري. التركيز الأساسي على جمع المعلومات وتقديمها بشكل صحفي، مع ذكر المصادر كلما كان الموضوع مبنيًا على معلومات واقعية.</p>' +
        '<h2>الأقسام</h2>' +
        '<ul>' + SECTIONS.map(function (s) {
          return '<li><a href="#/section/' + esc(s.slug) + '">' + esc(s.name) + '</a>: ' + esc(s.description) + '</li>';
        }).join('') + '</ul>' +
        '<h2>ملحوظة</h2>' +
        '<p>المواضيع المنشورة حاليًا تجريبية للعرض الأكاديمي، والصور تمثيلية. أي محتوى حقيقي بيتضاف هيكون مصدره مذكور.</p>' +
      '</div>';
    return { title: 'من نحن', description: 'تعرف على فكرة مجلة نبض الشباب وأهدافها.', html: html };
  }

  function contactPage() {
    var field = function (id, label, input, errId) {
      return '<div class="field"><label for="' + id + '">' + label + '</label>' + input +
        '<p class="field-error" id="' + errId + '" hidden></p></div>';
    };
    var html =
      '<header class="page-head"><h1>اتصل بنا</h1>' +
        '<p class="lead-text">عندك اقتراح لموضوع، أو ملاحظة على الموقع؟ ابعتلنا.</p></header>' +
      '<form id="contact-form" class="contact" novalidate>' +
        field('name', 'الاسم', '<input id="name" name="name" type="text" autocomplete="name" required aria-describedby="err-name">', 'err-name') +
        field('email', 'الإيميل', '<input id="email" name="email" type="email" autocomplete="email" dir="ltr" required aria-describedby="err-email">', 'err-email') +
        '<div class="field"><label for="subject">نوع الرسالة</label>' +
          '<select id="subject" name="subject">' +
            '<option>استفسار عام</option><option>اقتراح موضوع</option><option>ملاحظة على الموقع</option>' +
          '</select></div>' +
        field('message', 'الرسالة', '<textarea id="message" name="message" rows="6" required aria-describedby="err-message"></textarea>', 'err-message') +
        '<div class="form-actions"><button type="submit" class="btn btn--primary">إرسال</button>' +
          '<span id="contact-status" class="status" role="status"></span></div>' +
        '<p class="hint">الإرسال بيفتح برنامج البريد عندك برسالتك جاهزة.</p>' +
      '</form>';
    return { title: 'اتصل بنا', description: 'ابعت اقتراحك أو ملاحظتك لمجلة نبض الشباب.', html: html };
  }

  function notFoundPage() {
    return {
      title: 'الصفحة مش موجودة',
      description: 'الصفحة اللي بتدور عليها مش موجودة.',
      html: '<div class="empty"><h1>الصفحة دي مش موجودة</h1>' +
        '<p>يمكن الرابط اتغير، أو اتكتب غلط. ارجع للرئيسية أو ابحث عن موضوع.</p>' +
        '<p><a class="btn btn--primary" href="#/">الرئيسية</a></p></div>'
    };
  }

  return {
    homePage: homePage,
    sectionPage: sectionPage,
    searchPage: searchPage,
    articlePage: articlePage,
    aboutPage: aboutPage,
    contactPage: contactPage,
    notFoundPage: notFoundPage,
    navHtml: navHtml,
    navKey: navKey,
    footerHtml: footerHtml,
    card: card
  };
})(NABD_DATA, NABD_UTILS);

if (typeof module !== 'undefined') module.exports = NABD_RENDER;
