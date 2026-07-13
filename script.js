/* =============================================================
   La Table du Kirchberg — script.js
   Sprachwechsel · Scroll-Effekte · Öffnungsstatus · Plat du jour
   Vanilla JS, kein localStorage, keine Libraries.
   ============================================================= */
(function () {
  "use strict";

  /* ------------------------------------------------------------
     KONFIGURATION
     Nach dem Worker-Deploy hier die echte URL eintragen, z. B.
     "https://plat-du-jour.<account>.workers.dev/api/plat-du-jour".
     Solange die URL leer ist, zeigt die Karte Demo-Daten
     (damit das Feature im Portfolio sichtbar bleibt).
     ------------------------------------------------------------ */
  var PLAT_API_URL = "";

  var SUPPORTED_LANGS = ["fr", "de", "en", "lb"];
  var DEFAULT_LANG = "fr";
  var TZ = "Europe/Luxembourg";

  var prefersReducedMotion =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* =============================================================
     1) MEHRSPRACHIGKEIT
     ============================================================= */
  var currentLang = DEFAULT_LANG;

  function detectLang() {
    var candidates = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < candidates.length; i++) {
      var code = String(candidates[i]).slice(0, 2).toLowerCase();
      if (SUPPORTED_LANGS.indexOf(code) !== -1) return code;
    }
    return DEFAULT_LANG;
  }

  function applyTranslations(lang) {
    var dict = window.TRANSLATIONS[lang] || window.TRANSLATIONS[DEFAULT_LANG];

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (dict[key]) el.textContent = dict[key];
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria");
      if (dict[key]) el.setAttribute("aria-label", dict[key]);
    });

    document.documentElement.lang = lang;
    if (dict["meta.title"]) document.title = dict["meta.title"];

    var map = document.getElementById("mapFrame");
    if (map && dict["contact.mapTitle"]) map.title = dict["contact.mapTitle"];

    document.querySelectorAll(".lang-switch button").forEach(function (btn) {
      var active = btn.getAttribute("data-lang") === lang;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });

    currentLang = lang;
    updateOpenStatus(); // Statustexte folgen der Sprache
    renderPlatDate();   // Datumsformat folgt der Sprache
  }

  function switchLang(lang) {
    if (lang === currentLang) return;
    if (prefersReducedMotion) {
      applyTranslations(lang);
      return;
    }
    // kurzer Cross-Fade statt hartem Umschalten
    document.body.classList.add("lang-switching");
    window.setTimeout(function () {
      applyTranslations(lang);
      document.body.classList.remove("lang-switching");
    }, 230);
  }

  document.querySelectorAll(".lang-switch button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      switchLang(btn.getAttribute("data-lang"));
    });
  });

  /* =============================================================
     2) HEADER-ZUSTAND + BACK-TO-TOP (ein Scroll-Listener, rAF)
     ============================================================= */
  var header = document.getElementById("siteHeader");
  var backToTop = document.getElementById("backToTop");
  var scrollTicking = false;

  function onScrollFrame() {
    var y = window.scrollY;
    header.classList.toggle("scrolled", y > 40);
    backToTop.classList.toggle("visible", y > 600);
    scrollTicking = false;
  }
  window.addEventListener(
    "scroll",
    function () {
      if (!scrollTicking) {
        scrollTicking = true;
        window.requestAnimationFrame(onScrollFrame);
      }
    },
    { passive: true }
  );
  onScrollFrame();

  backToTop.addEventListener("click", function () {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth"
    });
  });

  /* =============================================================
     3) SCROLL-REVEAL + SCROLL-SPY (IntersectionObserver)
     ============================================================= */
  if ("IntersectionObserver" in window && !prefersReducedMotion) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    document.querySelectorAll(".reveal").forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    document.documentElement.classList.add("no-observer");
  }

  var spyLinks = document.querySelectorAll(".main-nav a[data-spy]");
  if ("IntersectionObserver" in window && spyLinks.length) {
    var spyObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = entry.target.id;
          spyLinks.forEach(function (link) {
            link.classList.toggle("active", link.getAttribute("data-spy") === id);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    ["menu", "about", "hours", "contact"].forEach(function (id) {
      var section = document.getElementById(id);
      if (section) spyObserver.observe(section);
    });
  }

  /* =============================================================
     4) SPEISEKARTEN-TABS
     ============================================================= */
  var tabs = document.querySelectorAll(".menu-tabs [role='tab']");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var cat = tab.getAttribute("data-cat");
      tabs.forEach(function (t) {
        var active = t === tab;
        t.classList.toggle("active", active);
        t.setAttribute("aria-selected", String(active));
      });
      document.querySelectorAll(".menu-panel").forEach(function (panel) {
        var active = panel.id === "panel-" + cat;
        panel.classList.toggle("active", active);
        if (active) panel.removeAttribute("hidden");
        else panel.setAttribute("hidden", "");
      });
    });
  });

  /* =============================================================
     5) ÖFFNUNGSZEITEN — Status & Live-Uhr (Zeitzone Luxemburg)
     Mo–Fr 12:00–14:30 & 19:00–22:00 · Sa 19:00–22:30 · So zu
     ============================================================= */
  var HOURS = {
    1: [[720, 870], [1140, 1320]], // Mo   12:00–14:30, 19:00–22:00
    2: [[720, 870], [1140, 1320]],
    3: [[720, 870], [1140, 1320]],
    4: [[720, 870], [1140, 1320]],
    5: [[720, 870], [1140, 1320]],
    6: [[1140, 1350]],             // Sa   19:00–22:30
    0: []                          // So   Ruhetag
  };
  var DAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  function nowInLuxembourg() {
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(new Date());
    var out = {};
    parts.forEach(function (p) { out[p.type] = p.value; });
    return {
      day: DAY_INDEX[out.weekday],
      minutes: parseInt(out.hour, 10) % 24 * 60 + parseInt(out.minute, 10),
      clock: out.hour + ":" + out.minute
    };
  }

  function fmtTime(minutes) {
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  /* Nächste Öffnung finden: heute später, oder an einem Folgetag */
  function nextOpening(day, minutes) {
    var todaySlots = HOURS[day] || [];
    for (var i = 0; i < todaySlots.length; i++) {
      if (minutes < todaySlots[i][0]) {
        return { sameDay: true, day: day, time: todaySlots[i][0] };
      }
    }
    for (var offset = 1; offset <= 7; offset++) {
      var d = (day + offset) % 7;
      if ((HOURS[d] || []).length) {
        return { sameDay: false, day: d, time: HOURS[d][0][0] };
      }
    }
    return null;
  }

  function updateOpenStatus() {
    var badges = document.querySelectorAll(".status-badge");
    if (!badges.length) return;

    var dict = window.TRANSLATIONS[currentLang];
    var now = nowInLuxembourg();

    var isOpen = (HOURS[now.day] || []).some(function (slot) {
      return now.minutes >= slot[0] && now.minutes < slot[1];
    });

    var label;
    if (isOpen) {
      label = dict["status.open"];
    } else {
      var next = nextOpening(now.day, now.minutes);
      label = dict["status.closed"];
      if (next) {
        var opensKey = next.sameDay
          ? "status.opensAt"
          : next.day === 6 ? "status.opensSat" : "status.opensMon";
        label += " · " + dict[opensKey] + " " + fmtTime(next.time);
      }
    }

    // Auf alle Status-Badges anwenden (Hero + Öffnungszeiten)
    badges.forEach(function (badge) {
      badge.classList.toggle("is-open", isOpen);
      badge.classList.toggle("is-closed", !isOpen);
      var text = badge.querySelector(".status-text");
      var clock = badge.querySelector(".status-clock");
      if (text) text.textContent = label;
      if (clock) clock.textContent = now.clock;
    });

    // "Heute"-Zeile in der Tabelle markieren
    document.querySelectorAll("#hoursTable tr").forEach(function (row) {
      var days = row.getAttribute("data-days");
      var match =
        days === String(now.day) ||
        (days === "1-5" && now.day >= 1 && now.day <= 5);
      row.classList.toggle("today", match);
    });
  }

  updateOpenStatus();
  window.setInterval(updateOpenStatus, 30000);

  /* =============================================================
     6) PLAT DU JOUR — dynamisch vom Worker (oder Demo-Daten)
     ============================================================= */
  var platData = null;

  function renderPlatDate() {
    var el = document.getElementById("platDate");
    if (!el || !platData || !platData.updatedAt) return;
    // Demo-Modus: mehrsprachige Beschreibung folgt der Sprache
    if (platData.descriptions) {
      document.getElementById("platDesc").textContent =
        platData.descriptions[currentLang] || platData.descriptions.fr || "";
    }
    var locale = { fr: "fr-LU", de: "de-LU", en: "en-GB", lb: "de-LU" }[currentLang];
    var d = new Date(platData.updatedAt);
    el.dateTime = d.toISOString();
    el.textContent = new Intl.DateTimeFormat(locale, {
      day: "numeric", month: "long", year: "numeric", timeZone: TZ
    }).format(d);
  }

  function showPlat(data) {
    // Älter als 7 Tage? Dann lieber gar nicht zeigen als etwas Falsches.
    var age = Date.now() - new Date(data.updatedAt).getTime();
    if (!data.dish || isNaN(age) || age > 7 * 24 * 60 * 60 * 1000) return;

    platData = data;
    document.getElementById("platDish").textContent = data.dish;
    document.getElementById("platDesc").textContent = data.description || "";
    document.getElementById("platPrice").textContent = data.price || "";
    renderPlatDate();

    var section = document.getElementById("plat");
    section.hidden = false;
    // Einblend-Animation im nächsten Frame starten
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        document.getElementById("platCard").classList.add("shown");
      });
    });
  }

  function loadPlatDuJour() {
    if (!PLAT_API_URL) {
      // Demo-Daten, solange kein Worker konfiguriert ist
      var demoDescriptions = {
        fr: "Sandre de la Moselle, beurre blanc au riesling, poireaux fondants et pommes grenaille.",
        de: "Zander von der Mosel, Riesling-Beurre-blanc, geschmolzener Lauch und Drillinge.",
        en: "Moselle pike-perch, Riesling beurre blanc, melted leeks and baby potatoes.",
        lb: "Sander vun der Musel, Riesling-Beurre-blanc, geschmollte Porrett a kleng Gromperen."
      };
      showPlat({
        dish: "Filet de sandre, beurre blanc au riesling",
        price: "24,50 €",
        description: demoDescriptions[currentLang] || demoDescriptions.fr,
        descriptions: demoDescriptions,
        updatedAt: new Date().toISOString()
      });
      return;
    }

    fetch(PLAT_API_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(showPlat)
      .catch(function () {
        /* API nicht erreichbar → Karte bleibt ausgeblendet */
      });
  }

  /* =============================================================
     7) KARTE — leichtgewichtige Fassade (lädt erst beim Antippen)
     Spart auf Mobilfunk den Google-Maps-Download beim ersten Laden.
     ============================================================= */
  var mapFacade = document.getElementById("mapFacade");
  if (mapFacade) {
    mapFacade.addEventListener("click", function () {
      var dict = window.TRANSLATIONS[currentLang];
      var iframe = document.createElement("iframe");
      iframe.id = "mapFrame";
      iframe.className = "map-embed";
      iframe.src = mapFacade.getAttribute("data-embed");
      iframe.title = dict["contact.mapTitle"] || "Google Maps";
      iframe.loading = "lazy";
      iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
      iframe.setAttribute("allowfullscreen", "");
      mapFacade.replaceWith(iframe);
    });
  }

  /* =============================================================
     INIT
     ============================================================= */
  applyTranslations(detectLang());
  loadPlatDuJour();
})();
