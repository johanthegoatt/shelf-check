/* Shelf Check engine. No DOM, so the page and node:test run the same code. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ShelfCheck = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Every unit maps to a kind and a factor into that kind's base unit
  // (grams, millilitres or single items). US customary volumes are used for
  // fl oz, pint, quart and gallon because those are what US labels print.
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
    // Accept a decimal comma ("1,5 kg") as long as it is not a thousands group.
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

  // Reads what a label says the pack holds: "500g", "1.5 kg", "2 lb 4 oz",
  // "6 x 330ml", "4 pack 250 ml", "12 rolls", "16 fl oz". Returns
  // { kind, amount (in base units), packs, label } or null.
  function parseSize(text) {
    if (text == null) return null;
    var s = String(text).toLowerCase().replace(/×/g, "x").replace(/fl\.?\s*oz/g, "floz").trim();
    if (!s) return null;
    var packs = 1;
    // Multipack forms: "6 x 330ml", "6x330 ml", "330ml x 6", "4 pack 250 ml".
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

  // Reads a shelf price: "$3.49", "3,49 €", "£1", "99p", "₱125". Returns a
  // number in the main currency unit, or NaN.
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

  return {
    UNITS: UNITS,
    parseSize: parseSize,
    parsePrice: parsePrice
  };
});
