/*
 * ربط الموقع: التوجيه (hash routing) والأحداث (ضغط، بحث، ترتيب، فورم التواصل).
 */
(function () {
  var D = NABD_DATA;
  var U = NABD_UTILS;
  var R = NABD_RENDER;
  var app = document.getElementById('app');
  var lastPath = null;

  function setMeta(description) {
    var m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute('content', description);
  }

  function setNavCurrent(key) {
    var links = document.querySelectorAll('[data-nav]');
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute('data-nav') === key) {
        links[i].setAttribute('aria-current', 'page');
      } else {
        links[i].removeAttribute('aria-current');
      }
    }
  }

  function render() {
    var hash = window.location.hash;
    var route = U.parseRoute(hash);
    var page;
    switch (route.name) {
      case 'home': page = R.homePage(); break;
      case 'section': page = R.sectionPage(route.slug, route.sort); break;
      case 'article': page = R.articlePage(route.id, window.location.href); break;
      case 'search': page = R.searchPage(route.q); break;
      case 'about': page = R.aboutPage(); break;
      case 'contact': page = R.contactPage(); break;
      default: page = R.notFoundPage();
    }

    app.innerHTML = page.html;
    document.title = page.title + ' | ' + D.SITE.name;
    setMeta(page.description);
    setNavCurrent(R.navKey(route));

    // نرجع لأعلى الصفحة لما المسار يتغير، مش لما الترتيب يتغير بس
    var path = hash.split('?')[0];
    if (path !== lastPath) {
      window.scrollTo(0, 0);
      lastPath = path;
    }
    var h1 = app.querySelector('h1');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      h1.focus({ preventScroll: true });
    }
  }

  function toggleNav() {
    var nav = document.getElementById('site-nav');
    var btn = document.getElementById('nav-toggle');
    var open = nav.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function closeNav() {
    document.getElementById('site-nav').classList.remove('is-open');
    document.getElementById('nav-toggle').setAttribute('aria-expanded', 'false');
  }

  function copyLink() {
    var url = window.location.href;
    var status = document.getElementById('copy-status');
    function ok() { status.textContent = 'اتنسخ الرابط ✓'; }
    function fail() { status.textContent = 'متعرفش تنسخ تلقائيًا، انسخ الرابط من شريط العنوان.'; }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var done = false;
      try { done = document.execCommand('copy'); } catch (e) { done = false; }
      document.body.removeChild(ta);
      if (done) ok(); else fail();
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(ok, fallback);
    } else {
      fallback();
    }
  }

  function handleContact(form) {
    var values = {
      name: form.elements.name.value,
      email: form.elements.email.value,
      subject: form.elements.subject.value,
      message: form.elements.message.value
    };
    var errors = U.validateContact(values);
    var status = document.getElementById('contact-status');
    var keys = ['name', 'email', 'message'];

    keys.forEach(function (k) {
      var el = document.getElementById('err-' + k);
      var input = form.elements[k];
      if (errors[k]) {
        el.textContent = errors[k];
        el.hidden = false;
        input.setAttribute('aria-invalid', 'true');
      } else {
        el.textContent = '';
        el.hidden = true;
        input.removeAttribute('aria-invalid');
      }
    });

    if (Object.keys(errors).length) {
      status.textContent = 'في خانات محتاجة تعديل، راجعها تحت.';
      status.className = 'status status--error';
      form.elements[Object.keys(errors)[0]].focus();
      return;
    }

    var email = D.SITE.contactEmail;
    if (!email || email.indexOf('example.com') !== -1) {
      status.textContent = 'إرسال الرسالة مش متفعّل لحد ما يتحط إيميل المجلة.';
      status.className = 'status status--error';
      return;
    }

    var a = document.createElement('a');
    a.href = U.contactMailto(email, values);
    document.body.appendChild(a);
    a.click();
    a.remove();
    status.textContent = 'هيفتح برنامج البريد عندك ومعاه رسالتك جاهزة. لو مفتحش، ابعت رسالتك على ' + email + ' مباشرة.';
    status.className = 'status status--ok';
  }

  // ---------- الأحداث ----------

  document.addEventListener('click', function (e) {
    var actionEl = e.target.closest ? e.target.closest('[data-action]') : null;
    if (actionEl) {
      var action = actionEl.getAttribute('data-action');
      if (action === 'copy-link') copyLink();
      if (action === 'toggle-nav') toggleNav();
      return;
    }
    if (e.target.closest && e.target.closest('#site-nav a')) closeNav();
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.id === 'header-search') {
      e.preventDefault();
      var q = form.querySelector('input[name="q"]').value.trim();
      window.location.hash = '#/search?q=' + encodeURIComponent(q);
      closeNav();
    } else if (form.id === 'page-search') {
      e.preventDefault();
      var q2 = form.querySelector('input[name="q"]').value.trim();
      window.location.hash = '#/search?q=' + encodeURIComponent(q2);
    } else if (form.id === 'contact-form') {
      e.preventDefault();
      handleContact(form);
    }
  });

  document.addEventListener('change', function (e) {
    if (e.target.id === 'sort-select') {
      var slug = e.target.getAttribute('data-slug');
      window.location.hash = '#/section/' + encodeURIComponent(slug) + '?sort=' + encodeURIComponent(e.target.value);
    }
  });

  // لو صورة اتعملها خطأ في التحميل، بنشيلها ونسيب الخلفية الملونة
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.hasAttribute('data-cover-fallback')) {
      if (t.parentNode) t.parentNode.classList.add('cover--missing');
      t.remove();
    }
  }, true);

  // ---------- التشغيل ----------
  document.getElementById('nav-links').innerHTML = R.navHtml();
  document.getElementById('footer').innerHTML = R.footerHtml();
  window.addEventListener('hashchange', render);
  render();
})();
