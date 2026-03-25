(function () {
  var navLinks = document.querySelectorAll(".site-nav-list a[href^='#']");
  var brandLink = document.querySelector(".site-brand[href^='#']");
  var headerEl = document.querySelector(".site-header");
  var sectionNodes = document.querySelectorAll(".section-vcardbody");
  var track = document.querySelector(".site-nav-track");
  var indicator = document.querySelector(".site-nav-indicator");
  var sections = [];
  var prefersReduced =
    typeof window.matchMedia !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setHeaderHeight() {
    if (!headerEl) return;
    document.documentElement.style.setProperty(
      "--header-height",
      headerEl.offsetHeight + "px"
    );
  }

  function getScrollOffset() {
    return headerEl ? headerEl.offsetHeight + 20 : 100;
  }

  navLinks.forEach(function (a) {
    var id = a.getAttribute("href");
    if (id && id.length > 1) {
      var el = document.querySelector(id);
      if (el) sections.push({ el: el, link: a });
    }
  });

  function updateNavIndicator() {
    if (!track || !indicator) return;
    var active = document.querySelector(".site-nav-list a.is-active");
    if (!active) return;
    var tr = track.getBoundingClientRect();
    var lr = active.getBoundingClientRect();
    indicator.style.width = lr.width + "px";
    indicator.style.transform =
      "translateX(" + (lr.left - tr.left) + "px)";
    track.classList.add("is-ready");
  }

  function setActive() {
    if (!sections.length) return;

    var scrollY = window.scrollY;
    var doc = document.documentElement;
    var vh = window.innerHeight;
    var edge = getScrollOffset();
    var last = sections[sections.length - 1];
    var beforeLast =
      sections.length >= 2 ? sections[sections.length - 2] : null;

    /* Short last section: at end of document always highlight Contact */
    if (vh + scrollY >= doc.scrollHeight - 36) {
      sections.forEach(function (s) {
        s.link.classList.toggle("is-active", s === last);
      });
      updateNavIndicator();
      return;
    }

    var y = scrollY + edge;
    var current = sections[0];
    sections.forEach(function (s) {
      if (s.el.offsetTop <= y) current = s;
    });

    /* Activate Contact earlier: block is small, enters viewport before scroll line hits its offsetTop */
    if (beforeLast && last) {
      var r = last.el.getBoundingClientRect();
      var contactEntering =
        scrollY >= beforeLast.el.offsetTop - 0.12 * vh &&
        r.top < vh * 0.78 &&
        r.bottom > 6;
      if (contactEntering) current = last;
    }

    sections.forEach(function (s) {
      s.link.classList.toggle("is-active", s === current);
    });
    updateNavIndicator();
  }

  window.addEventListener("scroll", setActive, { passive: true });
  window.addEventListener("resize", function () {
    setHeaderHeight();
    updateNavIndicator();
  });

  if (headerEl && typeof ResizeObserver !== "undefined") {
    var ro = new ResizeObserver(function () {
      setHeaderHeight();
      updateNavIndicator();
    });
    ro.observe(headerEl);
  }

  function scheduleIndicator() {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(updateNavIndicator);
    });
  }

  setHeaderHeight();
  scheduleIndicator();
  setActive();

  window.addEventListener("load", function () {
    setHeaderHeight();
    scheduleIndicator();
    setActive();
  });

  function clearReveal() {
    sectionNodes.forEach(function (s) {
      s.classList.remove("section--reveal");
    });
  }

  function playSectionReveal(target) {
    if (prefersReduced) return;
    clearReveal();
    void target.offsetWidth;
    target.classList.add("section--reveal");
    window.setTimeout(function () {
      target.classList.remove("section--reveal");
    }, 1150);
  }

  function goToSection(target, navAnchor) {
    if (prefersReduced) {
      target.scrollIntoView({ behavior: "auto", block: "start" });
      return;
    }

    if (navAnchor) {
      navAnchor.classList.add("is-active");
      sections.forEach(function (s) {
        if (s.link !== navAnchor) s.link.classList.remove("is-active");
      });
      scheduleIndicator();
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });

    var ran = false;
    function runReveal() {
      if (ran) return;
      ran = true;
      playSectionReveal(target);
    }

    if ("onscrollend" in window) {
      window.addEventListener("scrollend", runReveal, { once: true });
    }
    window.setTimeout(runReveal, 680);
  }

  navLinks.forEach(function (a) {
    a.addEventListener("click", function (e) {
      var href = a.getAttribute("href");
      var target = href && document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      goToSection(target, a);
    });
  });

  if (brandLink) {
    brandLink.addEventListener("click", function (e) {
      var href = brandLink.getAttribute("href");
      var target = href && document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      var homeLink = document.querySelector('.site-nav-list a[href="#section-home"]');
      goToSection(target, homeLink || null);
    });
  }
})();
