/* Growth layer shared by every content site in the portfolio.
 * Fill in SETTINGS below once per site. Anything left blank simply doesn't load.
 *
 * Does four things:
 *  1. Loads GA4 (and the Meta Pixel if set).
 *  2. Remembers which ad or link brought the visitor (90 days).
 *  3. Counts every click to a booking/affiliate partner as "affiliate_click", with where on the page it was.
 *  4. Growth.lead({...}) sends a signup to the Growth Hub so it's actually saved.
 */
(function () {
  // ===== THE ONLY LINES YOU EDIT FOR THIS SITE =====
  var SETTINGS = {
    site: "lacityguide",
    ga4: "G-DHH2SYM71H",        // your Google Analytics ID, e.g. "G-ABC123XYZ"
    metaPixel: "",  // leave empty unless we are running Meta ads for this site
    hub: "https://growth-hub.customercareblackaiser.workers.dev/",        // your Growth Hub address, e.g. "https://growth-hub.yourname.workers.dev"
    web3forms: "82857485-4fd0-4838-a04d-1a0731eb3f27"  // emails every signup to your inbox (get a new key at web3forms.com)
  };
  // ==================================================
  var SITE_NAME = "The LA City Guide";
  var cfg = {}, page = window.GROWTH || {};
  for (var k in SETTINGS) cfg[k] = page[k] || SETTINGS[k];   // a page can override, blanks don't
  var PARTNERS = {
    "awin1.com": "awin", "booking.com": "booking", "viator.com": "viator", "getyourguide.com": "getyourguide",
    "skyscanner.com": "skyscanner", "skyscanner.net": "skyscanner", "expedia.com": "expedia", "kayak.com": "kayak",
    "hotels.com": "hotels", "airbnb.com": "airbnb", "stubhub.com": "stubhub", "seatgeek.com": "seatgeek",
    "buy.stripe.com": "stripe_checkout"
  };

  function setCookie(k, v, d) { document.cookie = k + "=" + encodeURIComponent(v) + ";path=/;max-age=" + d * 86400 + ";SameSite=Lax"; }
  function getCookie(k) { var m = document.cookie.match(new RegExp("(?:^|; )" + k + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : ""; }

  var q = new URLSearchParams(location.search), touch = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"].forEach(function (k) { if (q.get(k)) touch[k] = q.get(k); });
  if (Object.keys(touch).length) {
    if (!getCookie("g_first")) setCookie("g_first", JSON.stringify(touch), 90);
    setCookie("g_last", JSON.stringify(touch), 90);
  }
  function attribution() { try { return JSON.parse(getCookie("g_last") || getCookie("g_first") || "{}"); } catch (e) { return {}; } }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { dataLayer.push(arguments); };
  if (cfg.ga4) {
    var s = document.createElement("script"); s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + cfg.ga4; document.head.appendChild(s);
    gtag("js", new Date()); gtag("config", cfg.ga4);
  }
  if (cfg.metaPixel) {
    !function (f, b, e, v, n, t, x) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
      x = b.getElementsByTagName(e)[0]; x.parentNode.insertBefore(t, x); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", cfg.metaPixel); fbq("track", "PageView");
  }

  function partnerOf(href) {
    try {
      var host = new URL(href, location.href).hostname.replace(/^www\./, "");
      for (var d in PARTNERS) if (host === d || host.slice(-(d.length + 1)) === "." + d) return PARTNERS[d];
    } catch (e) {}
    return "";
  }
  function placementOf(a, href) {
    var m = /[?&]clickref=([^&]+)/.exec(href);
    return a.getAttribute("data-placement") || (m ? decodeURIComponent(m[1]) : "") || "";
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var partner = partnerOf(a.href);
    if (!partner) return;
    var params = { partner: partner, placement: placementOf(a, a.href), page_path: location.pathname + location.hash, link_text: (a.textContent || "").trim().slice(0, 60) };
    if (cfg.ga4) gtag("event", partner === "stripe_checkout" ? "begin_checkout" : "affiliate_click", Object.assign({ transport_type: "beacon" }, params));
    if (cfg.metaPixel) fbq("trackCustom", "AffiliateClick", params);
  }, true);

  window.Growth = {
    attribution: attribution,
    /** lead({email, context, name?, company?, message?, website?}) -> Promise<boolean> */
    lead: function (data) {
      var payload = Object.assign({ page: location.pathname + location.hash, attribution: attribution() }, data || {});
      if (payload.website) return Promise.resolve(true);   // spam bot filled the hidden field: pretend it worked
      if (cfg.ga4) gtag("event", "generate_lead", { lead_context: payload.context || "signup" });
      if (cfg.metaPixel) fbq("track", "Lead", { content_name: payload.context || "signup" });
      var jobs = [];
      // 1) a saved copy in the Growth Hub spreadsheet
      if (cfg.hub) jobs.push(fetch(cfg.hub.replace(/\/$/, "") + "/lead", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true
      }).then(function (r) { return r.ok; }).catch(function () { return false; }));
      // 2) an email to your inbox
      if (cfg.web3forms) {
        var a = payload.attribution || {};
        var lines = ["Site: " + SITE_NAME, "Type: " + (payload.context || "signup"), "Email: " + payload.email];
        if (payload.name) lines.push("Name: " + payload.name);
        if (payload.company) lines.push("Organization: " + payload.company);
        if (payload.message) lines.push("Details: " + payload.message);
        lines.push("Page: " + payload.page);
        if (a.utm_source || a.utm_campaign) lines.push("Came from: " + [a.utm_source, a.utm_medium, a.utm_campaign].filter(Boolean).join(" / "));
        jobs.push(fetch("https://api.web3forms.com/submit", {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ access_key: cfg.web3forms, subject: SITE_NAME + ": new " + (payload.context || "signup") + " from " + payload.email,
            from_name: SITE_NAME, email: payload.email, name: payload.name || payload.email, message: lines.join("\n") })
        }).then(function (r) { return r.json(); }).then(function (j) { return !!(j && j.success); }).catch(function () { return false; }));
      }
      if (!jobs.length) return Promise.resolve(false);
      // success if at least one of the two worked: nothing is lost unless both fail
      return Promise.all(jobs).then(function (res) { return res.indexOf(true) !== -1; });
    }
  };
})();
