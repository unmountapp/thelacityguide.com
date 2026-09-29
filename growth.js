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
    ga4: "",        // your Google Analytics ID, e.g. "G-ABC123XYZ"
    metaPixel: "",  // leave empty unless we are running Meta ads for this site
    hub: ""         // your Growth Hub address, e.g. "https://growth-hub.yourname.workers.dev"
  };
  // ==================================================
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
      if (cfg.ga4) gtag("event", "generate_lead", { lead_context: payload.context || "signup" });
      if (cfg.metaPixel) fbq("track", "Lead", { content_name: payload.context || "signup" });
      if (!cfg.hub) return Promise.resolve(false);
      return fetch(cfg.hub.replace(/\/$/, "") + "/lead", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true
      }).then(function (r) { return r.ok; }).catch(function () { return false; });
    }
  };
})();
