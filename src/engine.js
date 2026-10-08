(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ShelfCheck = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var UNITS = {
    mg: ["mass", 0.001], g: ["mass", 1], gram: ["mass", 1], grams: ["mass", 1], gr: ["mass", 1],
    kg: ["mass", 1000], kilo: ["mass", 1000], kilos: ["mass", 1000], kilogram: ["mass", 1000], kilograms: ["mass", 1000],
    oz: ["mass", 28.349523125], ounce: ["mass", 28.349523125], ounces: ["mass", 28.349523125],
    lb: ["mass", 453.59237], lbs: ["mass", 453.59237], pound: ["mass", 453.59237], pounds: ["mass", 453.59237],
    ml: ["volume", 1], millilitre: ["volume", 1], milliliter: ["volume", 1], millilitres: ["volume", 1], milliliters: ["volume", 1],
    cl: ["volume", 10], dl: ["volume", 100],
    l: ["volume", 1000], lt: ["volume", 1000], ltr: ["volume", 1000], litre: ["volume", 1000], liter: ["volume", 1000], litres: ["volume", 1000], liters: ["volume", 1000],
    floz: ["volume", 29.5735295625], pt: ["volume", 473.176473], pint: ["volume", 473.176473], pints: ["volume", 473.176473],
    qt: ["volume", 946.352946], quart: ["volume", 946.352946], quarts: ["volume", 946.352946],
    gal: ["volume", 3785.411784], gallon: ["volume", 3785.411784], gallons: ["volume", 3785.411784],
    ea: ["count", 1], each: ["count", 1], ct: ["count", 1], count: ["count", 1], pc: ["count", 1], pcs: ["count", 1],
    piece: ["count", 1], pieces: ["count", 1], pack: ["count", 1], packs: ["count", 1], item: ["count", 1], items: ["count", 1],
    roll: ["count", 1], rolls: ["count", 1], sheet: ["count", 1], sheets: ["count", 1], tab: ["count", 1], tabs: ["count", 1],
    tablet: ["count", 1], tablets: ["count", 1], pod: ["count", 1], pods: ["count", 1], bag: ["count", 1], bags: ["count", 1],
    can: ["count", 1], cans: ["count", 1], bottle: ["count", 1], bottles: ["count", 1], egg: ["count", 1], eggs: ["count", 1],
    wash: ["count", 1], washes: ["count", 1], load: ["count", 1], loads: ["count", 1], nappy: ["count", 1], nappies: ["count", 1],
    diaper: ["count", 1], diapers: ["count", 1], wipe: ["count", 1], wipes: ["count", 1], capsule: ["count", 1], capsules: ["count", 1]
  };

  function num(s) {
    s = String(s).trim();
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
    else s = s.replace(",", ".");
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }

  function unitOf(word) {
    var w = String(word || "").toLowerCase().replace(/\.$/, "").replace(/\s+/g, "");
    if (w === "fl.oz" || w === "fluidounce" || w === "fluidounces" || w === "fl") w = "floz";
    return UNITS[w] || null;
  }

  function parseSize(text) {
    if (text == null) return null;
    var s = String(text).toLowerCase().replace(/×/g, "x").replace(/fl\.?\s*oz/g, "floz").trim();
    s = s.replace(/(\d+)?\s*([½¼¾])/g, function (_, w, f) { return String((w ? +w : 0) + { "½": 0.5, "¼": 0.25, "¾": 0.75 }[f]); });
    s = s.replace(/(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)(?=\s*[a-z])/g, function (_, w, a, b) { return +b ? String((w ? +w : 0) + a / b) : _; });
    if (!s) return null;
    var packs = 1;
    var m = s.match(/^(\d+)\s*(?:x|pack of|pk|pack|\*)\s*(.+)$/);
    if (m && /\d/.test(m[2])) { packs = parseInt(m[1], 10); s = m[2]; }
    else {
      m = s.match(/^(.+?)\s*(?:x|\*)\s*(\d+)$/);
      if (m && /[a-z]/.test(m[1])) { packs = parseInt(m[2], 10); s = m[1]; }
    }
    var re = /(\d+(?:[.,]\d+)*)\s*([a-z.]+)?/g, part, kind = null, total = 0, found = false;
    while ((part = re.exec(s))) {
      var amount = num(part[1]);
      var u = part[2] ? unitOf(part[2]) : ["count", 1];
      if (!u || !isFinite(amount)) return null;
      if (kind && kind !== u[0]) return null;
      kind = u[0];
      total += amount * u[1];
      found = true;
    }
    if (!found || !(total > 0) || !(packs > 0)) return null;
    return { kind: kind, amount: total * packs, packs: packs, label: String(text).trim() };
  }

  function parsePrice(text) {
    if (typeof text === "number") return text;
    var s = String(text || "").trim().toLowerCase();
    var pence = s.match(/^(\d+)\s*(p|c|¢|cents?)$/);
    if (pence) return parseInt(pence[1], 10) / 100;
    s = s.replace(/[^\d.,]/g, "");
    if (!s) return NaN;
    if (/,\d{2}$/.test(s) && s.indexOf(".") === -1) s = s.replace(",", ".");
    return num(s);
  }

  function parseDeal(text) {
    var s = String(text || "").toLowerCase().trim();
    if (!s) return null;
    var m;
    if ((m = s.match(/^(\d+)\s*\/\s*[^\d\s]?\s*(\d+(?:[.,]\d+)?)\s*(p|c|¢)?$/))) {
      var t2 = num(m[2]);
      if (m[3]) t2 /= 100;
      return { type: "multi", qty: parseInt(m[1], 10), price: t2 };
    }
    if ((m = s.match(/(\d+)\s*(?:for|x for)\s*[^\d]*(\d+(?:[.,]\d+)?)\s*(p|c|¢)?/))) {
      var total = num(m[2]);
      if (m[3]) total /= 100;
      return { type: "multi", qty: parseInt(m[1], 10), price: total };
    }
    if (/\bbogo\b/.test(s)) return { type: "bogo", buy: 1, free: 1 };
    if ((m = s.match(/buy\s*(\d+|one|two|three)\s*(?:,\s*)?get\s*(\d+|one|two|three)\s*free/))) {
      return { type: "bogo", buy: word(m[1]), free: word(m[2]) };
    }
    if ((m = s.match(/(2nd|second|3rd|third)\b.*?(half price|half off|(\d+(?:\.\d+)?)\s*%\s*off|free)/))) {
      var n = /2nd|second/.test(m[1]) ? 2 : 3;
      var off = /half/.test(m[2]) ? 50 : m[2] === "free" ? 100 : parseFloat(m[3]);
      return { type: "nth", n: n, off: off };
    }
    if ((m = s.match(/(\d+(?:[.,]\d+)?)\s*%\s*off/))) return { type: "percent", off: num(m[1]) };
    if ((m = s.match(/(?:save\s*)?[^\d]*(\d+(?:[.,]\d+)?)\s*(p|c|¢)?\s*(?:off)?/)) && /off|save/.test(s)) {
      var v = num(m[1]);
      if (m[2]) v /= 100;
      return { type: "amount", off: v };
    }
    return null;
  }

  function word(w) {
    return { one: 1, two: 2, three: 3 }[w] || parseInt(w, 10);
  }

  function dealPrice(price, deal) {
    if (!deal) return { each: price, mustBuy: 1, spend: price };
    switch (deal.type) {
      case "multi":
        return { each: deal.price / deal.qty, mustBuy: deal.qty, spend: deal.price };
      case "bogo": {
        var take = deal.buy + deal.free;
        return { each: (price * deal.buy) / take, mustBuy: take, spend: price * deal.buy };
      }
      case "nth": {
        var spend = price * (deal.n - 1) + price * (1 - deal.off / 100);
        return { each: spend / deal.n, mustBuy: deal.n, spend: spend };
      }
      case "percent":
        return { each: price * (1 - deal.off / 100), mustBuy: 1, spend: price * (1 - deal.off / 100) };
      case "amount":
        var p = Math.max(0, price - deal.off);
        return { each: p, mustBuy: 1, spend: p };
    }
    return { each: price, mustBuy: 1, spend: price };
  }

  var DISPLAY = {
    mass: [["100g", 100, "100 g"], ["kg", 1000, "kg"], ["oz", 28.349523125, "oz"], ["lb", 453.59237, "lb"]],
    volume: [["100ml", 100, "100 ml"], ["l", 1000, "litre"], ["floz", 29.5735295625, "fl oz"], ["gal", 3785.411784, "gallon"]],
    count: [["item", 1, "item"]]
  };
  var IMPERIAL = /\b(oz|ounces?|lbs?|pounds?|fl\.?\s*oz|pints?|quarts?|gal|gallons?)\b/i;

  function displayFor(kind, id) {
    var list = DISPLAY[kind] || [];
    for (var i = 0; i < list.length; i++) if (list[i][0] === id) return { id: list[i][0], base: list[i][1], label: list[i][2] };
    return null;
  }

  function defaultDisplay(kind, labels) {
    var imperial = labels.some(function (l) { return IMPERIAL.test(l); });
    if (kind === "mass") return displayFor(kind, imperial ? "oz" : "100g");
    if (kind === "volume") return displayFor(kind, imperial ? "floz" : "100ml");
    return displayFor("count", "item");
  }

  var TIE = 0.01;

  function compare(items, opts) {
    opts = opts || {};
    var rows = items.map(function (it, i) {
      var row = { index: i, name: String(it.name || "").trim() || "Item " + (i + 1), ok: false };
      var price = parsePrice(it.price);
      var size = parseSize(it.size);
      var deal = it.deal ? parseDeal(it.deal) : null;
      if (!(price > 0)) row.error = "price";
      else if (!size) row.error = "size";
      else if (it.deal && String(it.deal).trim() && !deal) row.error = "deal";
      if (row.error) return row;
      var d = dealPrice(price, deal);
      row.ok = true;
      row.price = price;
      row.size = size;
      row.deal = deal;
      row.each = d.each;
      row.mustBuy = d.mustBuy;
      row.spend = d.spend;
      row.perBase = d.each / size.amount;
      row.plainPerBase = price / size.amount;
      return row;
    });

    var counts = {};
    rows.forEach(function (r) { if (r.ok) counts[r.size.kind] = (counts[r.size.kind] || 0) + 1; });
    var kind = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0] || null;
    rows.forEach(function (r) { if (r.ok && r.size.kind !== kind) { r.ok = false; r.error = "kind"; } });

    var good = rows.filter(function (r) { return r.ok; });
    var display = kind ? (opts.display && displayFor(kind, opts.display)) || defaultDisplay(kind, good.map(function (r) { return r.size.label; })) : null;
    good.forEach(function (r) { r.unitPrice = r.perBase * display.base; });

    var ranked = good.slice().sort(function (a, b) { return a.perBase - b.perBase || a.index - b.index; });
    var best = ranked[0] || null;
    ranked.forEach(function (r, i) {
      r.rank = i + 1;
      r.dearerPct = best ? (r.perBase / best.perBase - 1) * 100 : 0;
      r.tied = r.dearerPct < TIE * 100;
      r.best = r.tied;
    });

    return {
      kind: kind,
      display: display,
      rows: rows,
      ranked: ranked,
      best: best,
      tie: ranked.length > 1 && ranked[1].tied,
      traps: findTraps(ranked),
      bad: rows.filter(function (r) { return !r.ok; })
    };
  }

  function findTraps(ranked) {
    var traps = [];
    ranked.forEach(function (big) {
      var worstSmaller = null;
      ranked.forEach(function (small) {
        if (small === big || small.size.amount >= big.size.amount) return;
        if (big.perBase > small.perBase * (1 + TIE) && (!worstSmaller || small.perBase < worstSmaller.perBase)) worstSmaller = small;
      });
      if (worstSmaller) traps.push({ type: "bigger-costs-more", item: big, than: worstSmaller, pct: (big.perBase / worstSmaller.perBase - 1) * 100 });
    });
    var best = ranked[0];
    ranked.forEach(function (r) {
      if (r.deal && !r.tied && best) traps.push({ type: "deal-not-best", item: r, than: best, pct: r.dearerPct });
    });
    return traps;
  }

  function saving(best, other, timesPerYear) {
    if (!best || !other) return { perBuy: 0, perYear: 0 };
    var amount = best.size.amount;
    var perBuy = (other.perBase - best.perBase) * amount;
    return { perBuy: perBuy, perYear: perBuy * (timesPerYear || 0) };
  }

  return {
    UNITS: UNITS,
    DISPLAY: DISPLAY,
    parseSize: parseSize,
    parsePrice: parsePrice,
    parseDeal: parseDeal,
    dealPrice: dealPrice,
    displayFor: displayFor,
    compare: compare,
    saving: saving
  };
});
