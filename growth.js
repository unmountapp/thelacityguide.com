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
    ga4: "G-DHH2SYM71H",
    metaPixel: "",
    hub: "https://growth-hub.customercareblackaiser.workers.dev/",
    web3forms: "82857485-4fd0-4838-a04d-1a0731eb3f27"
  };
  // ==================================================
  var SITE_NAME = "The LA City Guide";
  var cfg = {}, page = window.GROWTH || {};
  for (var k in SETTINGS) cfg[k] = page[k] || SETTINGS[k];
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
    lead: function (data) {
      var payload = Object.assign({ page: location.pathname + location.hash, attribution: attribution() }, data || {});
      if (payload.website) return Promise.resolve(true);
      if (cfg.ga4) gtag("event", "generate_lead", { lead_context: payload.context || "signup" });
      if (cfg.metaPixel) fbq("track", "Lead", { content_name: payload.context || "signup" });
      var jobs = [];
      if (cfg.hub) jobs.push(fetch(cfg.hub.replace(/\/$/, "") + "/lead", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true
      }).then(function (r) { return r.ok; }).catch(function () { return false; }));
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
      return Promise.all(jobs).then(function (res) { return res.indexOf(true) !== -1; });
    }
  };
})();

/* API-free itinerary map. This local SVG renderer provides the small Leaflet API
   used by the homepage, so no API key, map account, billing, or tile service is needed. */
(function () {
  "use strict";
  if (location.pathname !== "/" && location.pathname !== "/index.html") return;

  var allPoints = [];
  var mapState = null;
  var SVG_NS = "http://www.w3.org/2000/svg";

  function svg(name, attrs, text) {
    var el = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (text != null) el.textContent = text;
    return el;
  }
  function getAllPoints() {
    return Array.prototype.map.call(document.querySelectorAll(".attraction-item[data-lat][data-lng]"), function (el) {
      return { name: el.dataset.name, lat: parseFloat(el.dataset.lat), lng: parseFloat(el.dataset.lng) };
    }).filter(function (p) { return isFinite(p.lat) && isFinite(p.lng); });
  }
  function boundsFor(points) {
    var b = { west: -118.78, east: -117.78, south: 33.68, north: 34.27 };
    if (!points.length) return b;
    b.west = Math.min.apply(null, points.map(function (p) { return p.lng; }));
    b.east = Math.max.apply(null, points.map(function (p) { return p.lng; }));
    b.south = Math.min.apply(null, points.map(function (p) { return p.lat; }));
    b.north = Math.max.apply(null, points.map(function (p) { return p.lat; }));
    var xp = Math.max(.18, (b.east - b.west) * .22), yp = Math.max(.12, (b.north - b.south) * .25);
    b.west -= xp; b.east += xp; b.south -= yp; b.north += yp;
    if (b.east - b.west < .72) { var cx = (b.east + b.west) / 2; b.west = cx - .36; b.east = cx + .36; }
    if (b.north - b.south < .48) { var cy = (b.north + b.south) / 2; b.south = cy - .24; b.north = cy + .24; }
    return b;
  }
  function render() {
    if (!mapState || !mapState.host) return;
    var host = mapState.host, selected = mapState.markers.map(function (m) {
      return { name: m.name || "Itinerary stop", lat: m.lat, lng: m.lng };
    });
    var b = boundsFor(selected), W = 760, H = 350, pad = 18;
    function x(lng) { return pad + (lng - b.west) / (b.east - b.west) * (W - pad * 2); }
    function y(lat) { return H - pad - (lat - b.south) / (b.north - b.south) * (H - pad * 2); }
    function visible(p) { return p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east; }

    host.innerHTML = "";
    host.style.cssText = "width:100%;height:350px;overflow:hidden;position:relative;background:#a8d5ea";
    var root = svg("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", height: "100%", role: "img", "aria-label": "Los Angeles itinerary map" });
    root.appendChild(svg("rect", { width: W, height: H, fill: "#a8d5ea" }));
    root.appendChild(svg("path", { d: "M 0 0 H 760 V 350 H 120 C 180 295 155 250 240 205 C 285 180 275 115 335 80 C 390 45 420 10 450 0 Z", fill: "#edf0e8", stroke: "#5689a5", "stroke-width": 3 }));

    [[34.20,-118.22,33.78,-118.29,"I-5"],[34.05,-118.68,34.05,-117.78,"I-10"],[34.22,-118.47,33.78,-118.29,"I-405"],[34.20,-118.60,34.06,-118.25,"US 101"]].forEach(function (r) {
      var a={lat:r[0],lng:r[1]}, z={lat:r[2],lng:r[3]};
      if (visible(a) || visible(z)) {
        root.appendChild(svg("line", { x1:x(a.lng), y1:y(a.lat), x2:x(z.lng), y2:y(z.lat), stroke:"#fff", "stroke-width":4, opacity:.9 }));
        root.appendChild(svg("text", { x:x(a.lng)+5, y:y(a.lat)-5, fill:"#516274", "font-size":10, "font-weight":700 }, r[4]));
      }
    });
    [["Santa Monica",34.0195,-118.4912],["Los Angeles",34.0522,-118.2437],["Pasadena",34.1478,-118.1445],["Inglewood",33.9617,-118.3531],["Long Beach",33.7701,-118.1937],["Anaheim",33.8366,-117.9143]].forEach(function (p) {
      if (visible({lat:p[1],lng:p[2]})) root.appendChild(svg("text", { x:x(p[2])+5, y:y(p[1])-5, fill:"#34495e", "font-size":11, "font-weight":700, stroke:"#edf0e8", "stroke-width":3, "paint-order":"stroke" }, p[0]));
    });
    allPoints.forEach(function (p) {
      if (visible(p)) root.appendChild(svg("circle", { cx:x(p.lng), cy:y(p.lat), r:4, fill:"#607d8b", stroke:"#fff", "stroke-width":1.5, opacity:.48 }));
    });
    if (selected.length > 1) root.appendChild(svg("polyline", { points:selected.map(function(p){return x(p.lng)+","+y(p.lat);}).join(" "), fill:"none", stroke:"#f0b429", "stroke-width":3, "stroke-dasharray":"7 6", opacity:.85 }));
    selected.forEach(function (p, i) {
      var px=x(p.lng), py=y(p.lat), right=px < W-180;
      root.appendChild(svg("circle", { cx:px, cy:py, r:11, fill:"#f0b429", stroke:"#0d1b3e", "stroke-width":2.5 }));
      root.appendChild(svg("text", { x:px, y:py+4, fill:"#0d1b3e", "font-size":11, "font-weight":800, "text-anchor":"middle" }, i+1));
      root.appendChild(svg("text", { x:px+(right?14:-14), y:py+4, fill:"#0d1b3e", "font-size":11, "font-weight":800, "text-anchor":right?"start":"end", stroke:"#fff", "stroke-width":4, "paint-order":"stroke" }, p.name));
    });
    host.appendChild(root);
    if (!selected.length) {
      var note=document.createElement("div"); note.textContent="Add a stop to map your day";
      note.style.cssText="position:absolute;left:50%;bottom:18px;transform:translateX(-50%);background:rgba(13,27,62,.9);color:#fff;padding:8px 12px;border-radius:18px;font-size:11px;white-space:nowrap";
      host.appendChild(note);
    }
  }
  function miniLeaflet() {
    return {
      map: function (id) {
        mapState = { host: document.getElementById(id), markers: [] };
        return { setView:function(){render();return this;}, removeLayer:function(m){var i=mapState.markers.indexOf(m);if(i>-1)mapState.markers.splice(i,1);render();}, fitBounds:function(){render();} };
      },
      tileLayer: function () { return { addTo:function(){render();return this;} }; },
      circleMarker: function (coords) {
        var marker={lat:coords[0],lng:coords[1],name:"Itinerary stop"};
        return Object.assign(marker,{addTo:function(){mapState.markers.push(marker);render();return marker;},bindPopup:function(html){var tmp=document.createElement("div");tmp.innerHTML=html;marker.name=(tmp.textContent||"").replace(/Day\s+\d+.*/,"").trim();render();return marker;}});
      },
      featureGroup: function () { return { getBounds:function(){return {pad:function(){return this;}};} }; }
    };
  }
  document.addEventListener("DOMContentLoaded", function () {
    allPoints = getAllPoints();
    window.L = miniLeaflet();
    var container=document.getElementById("map-container");
    if (container && !document.getElementById("map-no-key-note")) {
      var bar=document.createElement("div"); bar.id="map-no-key-note";
      bar.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;background:#0d1b3e;border-top:1px solid #243060;font-size:11px;color:#77dda0";
      bar.innerHTML='<strong>✓ API-free map — no key or account required</strong><a href="https://www.openstreetmap.org/#map=10/34.05/-118.30" target="_blank" rel="noopener" style="color:#f0b429;text-decoration:none;font-weight:700">Open detailed map ↗</a>';
      container.appendChild(bar);
    }
  });
})();
