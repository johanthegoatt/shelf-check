"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/engine.js");

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("reads plain metric and US sizes", () => {
  close(S.parseSize("500g").amount, 500);
  close(S.parseSize("1.5 kg").amount, 1500);
  close(S.parseSize("1,5 kg").amount, 1500);
  close(S.parseSize("16 oz").amount, 453.59237);
  close(S.parseSize("2 lb").amount, 907.18474);
  close(S.parseSize("750ml").amount, 750);
  close(S.parseSize("2 L").amount, 2000);
  close(S.parseSize("12 fl oz").amount, 354.88235475);
  close(S.parseSize("1 gallon").amount, 3785.411784);
  assert.equal(S.parseSize("16 oz").kind, "mass");
  assert.equal(S.parseSize("16 fl. oz").kind, "volume");
});

test("reads multipacks and counts", () => {
  const six = S.parseSize("6 x 330ml");
  assert.equal(six.packs, 6);
  close(six.amount, 1980);
  close(S.parseSize("330 ml x 6").amount, 1980);
  close(S.parseSize("4 pack 250 ml").amount, 1000);
  assert.equal(S.parseSize("12 rolls").kind, "count");
  assert.equal(S.parseSize("12 rolls").amount, 12);
  assert.equal(S.parseSize("24").amount, 24);
});

test("adds mixed parts of one kind and rejects nonsense", () => {
  close(S.parseSize("2 lb 4 oz").amount, 2 * 453.59237 + 4 * 28.349523125);
  assert.equal(S.parseSize("500 g 1 l"), null);
  assert.equal(S.parseSize("big bag"), null);
  assert.equal(S.parseSize(""), null);
  assert.equal(S.parseSize("0 g"), null);
});

test("reads shelf prices in common styles", () => {
  close(S.parsePrice("$3.49"), 3.49);
  close(S.parsePrice("3,49 €"), 3.49);
  close(S.parsePrice("£1"), 1);
  close(S.parsePrice("99p"), 0.99);
  close(S.parsePrice("₱1,250.50"), 1250.5);
  close(S.parsePrice(2.5), 2.5);
  close(S.parsePrice("1.299,00 €"), 1299);
  close(S.parsePrice("€1.299"), 1299);
  close(S.parsePrice("$1,250"), 1250);
  close(S.parsePrice("1 299,50 kr"), 1299.5);
  close(S.parsePrice("Rs. 120"), 120);
  close(S.parsePrice("R$ 5,99"), 5.99);
  close(S.parsePrice("CHF 2.50"), 2.5);
  close(S.parsePrice("0.125"), 0.125);
  close(S.parsePrice("₹1,20,000"), 120000);
  assert.ok(Number.isNaN(S.parsePrice("free")));
});

test("reads shelf offers", () => {
  assert.deepEqual(S.parseDeal("3 for $5"), { type: "multi", qty: 3, price: 5 });
  assert.deepEqual(S.parseDeal("2 for £3.50"), { type: "multi", qty: 2, price: 3.5 });
  assert.deepEqual(S.parseDeal("3 for 99p"), { type: "multi", qty: 3, price: 0.99 });
  assert.deepEqual(S.parseDeal("Buy 2 get 1 free"), { type: "bogo", buy: 2, free: 1 });
  assert.deepEqual(S.parseDeal("buy one get one free"), { type: "bogo", buy: 1, free: 1 });
  assert.deepEqual(S.parseDeal("BOGO"), { type: "bogo", buy: 1, free: 1 });
  assert.deepEqual(S.parseDeal("2nd half price"), { type: "nth", n: 2, off: 50 });
  assert.deepEqual(S.parseDeal("second one 30% off"), { type: "nth", n: 2, off: 30 });
  assert.deepEqual(S.parseDeal("20% off"), { type: "percent", off: 20 });
  assert.deepEqual(S.parseDeal("$1 off"), { type: "amount", off: 1 });
  assert.deepEqual(S.parseDeal("save 50p"), { type: "amount", off: 0.5 });
  assert.equal(S.parseDeal(""), null);
  assert.equal(S.parseDeal("great value"), null);
});

test("works out the real price per pack and how many you must buy", () => {
  const multi = S.dealPrice(2, { type: "multi", qty: 3, price: 5 });
  close(multi.each, 5 / 3);
  assert.equal(multi.mustBuy, 3);
  const bogo = S.dealPrice(4, { type: "bogo", buy: 2, free: 1 });
  close(bogo.each, 8 / 3);
  assert.equal(bogo.mustBuy, 3);
  close(bogo.spend, 8);
  const half = S.dealPrice(3, { type: "nth", n: 2, off: 50 });
  close(half.each, 2.25);
  assert.equal(half.mustBuy, 2);
  close(S.dealPrice(10, { type: "percent", off: 20 }).each, 8);
  close(S.dealPrice(0.8, { type: "amount", off: 1 }).each, 0);
  close(S.dealPrice(3, null).each, 3);
});

test("ranks by unit price and converts to one unit", () => {
  const c = S.compare([
    { name: "Small", price: "$2.00", size: "250 g" },
    { name: "Big", price: "$5.00", size: "1 kg" },
    { name: "Imported", price: "$3.00", size: "16 oz" }
  ]);
  assert.equal(c.kind, "mass");
  assert.equal(c.display.id, "oz");
  assert.equal(c.best.name, "Big");
  assert.deepEqual(c.ranked.map(r => r.name), ["Big", "Imported", "Small"]);
  close(c.ranked[2].dearerPct, 60);
  close(c.best.unitPrice, 0.005 * 28.349523125);
  const kg = S.compare([{ price: 2, size: "250 g" }], { display: "kg" });
  close(kg.best.unitPrice, 8);
});

test("a multi-buy can win, and must-buy counts come through", () => {
  const c = S.compare([
    { name: "Single", price: "1.20", size: "400 g" },
    { name: "Offer", price: "1.30", size: "400 g", deal: "3 for 3" }
  ]);
  assert.equal(c.best.name, "Offer");
  assert.equal(c.best.mustBuy, 3);
  close(c.best.each, 1);
});

test("flags a bigger pack that costs more per unit", () => {
  const c = S.compare([
    { name: "Spaghetti 1kg", price: "1.10", size: "1 kg" },
    { name: "Spaghetti 2kg", price: "2.47", size: "2 kg" }
  ]);
  const trap = c.traps.find(t => t.type === "bigger-costs-more");
  assert.ok(trap);
  assert.equal(trap.item.name, "Spaghetti 2kg");
  assert.equal(trap.than.name, "Spaghetti 1kg");
  close(trap.pct, (2.47 / 2 / 1.1 - 1) * 100);
});

test("flags an offer that still loses", () => {
  const c = S.compare([
    { name: "Brand", price: "4.00", size: "500 ml", deal: "20% off" },
    { name: "Own label", price: "2.50", size: "500 ml" }
  ]);
  const trap = c.traps.find(t => t.type === "deal-not-best");
  assert.equal(trap.item.name, "Brand");
  close(trap.pct, 28);
});

test("ties within 1% and leaves out what cannot be compared", () => {
  const c = S.compare([
    { name: "A", price: "1.00", size: "100 g" },
    { name: "B", price: "2.01", size: "200 g" },
    { name: "Juice", price: "1", size: "1 l" },
    { name: "No price", price: "", size: "1 kg" },
    { name: "Bad size", price: "2", size: "lots" }
  ]);
  assert.ok(c.tie);
  assert.deepEqual(c.bad.map(r => [r.name, r.error]), [["Juice", "kind"], ["No price", "price"], ["Bad size", "size"]]);
  assert.equal(c.traps.length, 0);
});

test("works out the saving for the same amount", () => {
  const c = S.compare([
    { name: "Cheap", price: "3", size: "1 kg" },
    { name: "Dear", price: "2", size: "500 g" }
  ]);
  const s = S.saving(c.best, c.ranked[1], 52);
  close(s.perBuy, 1);
  close(s.perYear, 52);
});

test("reads US shelf shorthand", () => {
  assert.deepEqual(S.parseDeal("2/$5"), { type: "multi", qty: 2, price: 5 });
  assert.deepEqual(S.parseDeal("10 / $10"), { type: "multi", qty: 10, price: 10 });
  assert.deepEqual(S.parseDeal("3/99c"), { type: "multi", qty: 3, price: 0.99 });
  close(S.parseSize("1/2 gal").amount, 3785.411784 / 2);
  close(S.parseSize("½ gallon").amount, 3785.411784 / 2);
  close(S.parseSize("1 1/2 lb").amount, 1.5 * 453.59237);
  close(S.parseSize("1¼ lb").amount, 1.25 * 453.59237);
  assert.equal(S.parseSize("1/0 lb"), null);
});

test("a 2/$5 offer beats a lower shelf price per unit", () => {
  const c = S.compare([
    { name: "Shelf", price: "$2.69", size: "12 oz" },
    { name: "Offer", price: "$3.29", size: "12 oz", deal: "2/$5" }
  ]);
  assert.equal(c.best.name, "Offer");
  close(c.best.each, 2.5);
});

test("rolls times sheets: compares per 100 sheets, not per roll", () => {
  const a = S.parseSize("12 mega rolls, 320 sheets each");
  assert.equal(a.noun, "sheet");
  assert.equal(a.amount, 3840);
  assert.equal(S.parseSize("2-ply 12 rolls of 240 sheets").amount, 2880);
  assert.equal(S.parseSize("18 x 244 sheets").amount, 4392);
  assert.equal(S.parseSize("12 double rolls").noun, "roll");
  close(S.parseSize("6 cans x 12 fl oz").amount, 72 * 29.5735295625);
  // Walmart shelf tags for these packs say 23.3 and 98.3 cents per 100 ct.
  const c = S.compare([
    { name: "Angel Soft", price: "$8.96", size: "12 mega rolls x 320 sheets" },
    { name: "Cottonelle", price: "$15.80", size: "6 mega rolls x 268 sheets" },
    { name: "Store brand", price: "$5", size: "24 rolls" }
  ]);
  assert.equal(c.noun, "sheet");
  assert.equal(c.display.label, "100 sheets");
  assert.deepEqual(c.ranked.map((r) => r.name), ["Angel Soft", "Cottonelle"]);
  close(c.ranked[0].unitPrice, 0.2333, 1e-3);
  close(c.ranked[1].unitPrice, 0.9826, 1e-3);
  assert.deepEqual(c.bad.map((r) => r.error), ["noun"]);
});

test("cheaper percent is measured against the runner-up", () => {
  const c = S.compare([
    { name: "A", price: "1", size: "100 g" },
    { name: "B", price: "1.50", size: "100 g" }
  ]);
  close(c.ranked[1].dearerPct, 50);
  close(c.cheaperPct, 100 / 3);
  const far = S.compare([{ name: "A", price: "1", size: "100 g" }, { name: "B", price: "5", size: "100 g" }]);
  assert.ok(far.cheaperPct < 100);
});

test("offers that used to be misread", () => {
  const each = (deal, price = 2) => S.dealPrice(price, S.parseDeal(deal));
  // British "3 for 2": take three, pay for two.
  assert.deepEqual(S.parseDeal("3 for 2"), { type: "bogo", buy: 2, free: 1 });
  close(each("3 for 2").each, 4 / 3);
  // With money in it, it is a total price.
  assert.deepEqual(S.parseDeal("10 for $10"), { type: "multi", qty: 10, price: 10 });
  assert.deepEqual(S.parseDeal("2 for 3"), { type: "multi", qty: 2, price: 3 });
  // The saving needs the quantity.
  const save = each("buy 3 save $2");
  assert.equal(save.mustBuy, 3);
  close(save.spend, 4);
  close(each("buy 2 save 50p").each, 1.75);
  // Only the free one is discounted.
  close(each("buy one get one 50% off").each, 1.5);
  close(each("buy 2 get 1 half price").spend, 5);
  assert.deepEqual(S.parseDeal("B2G1"), { type: "bogo", buy: 2, free: 1 });
  const pct = each("40% off when you buy 2");
  assert.equal(pct.mustBuy, 2);
  close(pct.each, 1.2);
});

test("loyalty price only counts when the card is on", () => {
  const items = [
    { name: "Big", price: "6", size: "1 kg", memberPrice: "4" },
    { name: "Small", price: "2.50", size: "500 g" }
  ];
  // Card off: Big is 6/kg, Small is 5/kg, so Small wins.
  const off = S.compare(items);
  assert.equal(off.best.name, "Small");
  assert.equal(off.anyMember, true);
  // Card on: Big drops to 4/kg and takes the lead.
  const on = S.compare(items, { member: true });
  assert.equal(on.best.name, "Big");
  assert.equal(on.best.usedMember, true);
  assert.equal(on.memberChangesBest, true);
});

test("a member price never makes a pack dearer than its shelf price", () => {
  const on = S.compare([
    { name: "A", price: "3", size: "1 kg", memberPrice: "5" },
    { name: "B", price: "4", size: "1 kg" }
  ], { member: true });
  // The 5 member price is ignored because the shelf price of 3 is lower.
  assert.equal(on.best.name, "A");
  assert.equal(on.best.usedMember, false);
  close(on.best.unitPrice, 0.3); // per 100 g, still the 3 shelf price
});

test("without any member prices the card toggle changes nothing", () => {
  const items = [
    { name: "A", price: "2", size: "500 g" },
    { name: "B", price: "3", size: "1 kg" }
  ];
  const off = S.compare(items);
  const on = S.compare(items, { member: true });
  assert.equal(off.anyMember, false);
  assert.equal(on.memberChangesBest, false);
  assert.equal(off.best.name, on.best.name);
  close(off.best.unitPrice, on.best.unitPrice);
});

// ---- concentrates / dilution: compare on the made-up amount ----

test("a concentrate that makes more wins over ready-to-use on the prepared price", () => {
  // 500 ml squash at $3 makes 2 L -> $1.50 per made-up L.
  // 1 L ready-to-drink at $2 -> $2 per L. The concentrate is cheaper prepared.
  var r = S.compare([
    { name: "Squash", price: "$3", size: "500 ml", makes: "2 L" },
    { name: "Ready to drink", price: "$2", size: "1 L" }
  ]);
  assert.equal(r.anyDiluted, true);
  assert.equal(r.best.name, "Squash");
  // prepared per ml: $3 / 2000 ml = 0.0015/ml; ready: $2 / 1000 = 0.0020/ml
  assert.ok(Math.abs(r.ranked[0].perBase - 0.0015) < 1e-9);
  assert.ok(Math.abs(r.ranked[1].perBase - 0.0020) < 1e-9);
});

test("without makes, the ready-to-use pack is unchanged and still compared on its own size", () => {
  var r = S.compare([
    { name: "Squash", price: "$3", size: "500 ml" },
    { name: "Ready to drink", price: "$2", size: "1 L" }
  ]);
  assert.equal(r.anyDiluted, false);
  // 300c/500ml = 0.6 vs 200c/1000ml = 0.2 -> ready to drink wins
  assert.equal(r.best.name, "Ready to drink");
});

test("a makes in the wrong kind of unit is ignored, not trusted", () => {
  var r = S.compare([
    { name: "A", price: "$2", size: "500 ml", makes: "2 kg" },
    { name: "B", price: "$3", size: "1 L" }
  ]);
  var a = r.rows.find(function (x) { return x.name === "A"; });
  assert.equal(a.diluted, false);
  assert.equal(a.makesIgnored, true);
  assert.equal(a.preparedAmount, 500); // fell back to the pack size
});

test("the yearly saving uses the prepared amount for a diluted best buy", () => {
  var r = S.compare([
    { name: "Concentrate", price: "$4", size: "1 L", makes: "4 L" }, // 1 c/ml
    { name: "Ready", price: "$6", size: "4 L" }                       // 1.5 c/ml
  ]);
  var s = S.saving(r.ranked[0], r.ranked[1], 12);
  // ($0.0015 - $0.0010)/ml * 4000 ml = $2 a buy; * 12 = $24 a year
  assert.ok(Math.abs(s.perBuy - 2) < 1e-9);
  assert.ok(Math.abs(s.perYear - 24) < 1e-9);
});

test("per-serving ranking flips the winner when concentration differs", () => {
  // A: 1 L for 6, makes 40 washes -> 0.15/wash but 0.006/ml (dearer per ml).
  // B: 2 L for 7, makes 28 washes -> 0.25/wash but 0.0035/ml (cheaper per ml).
  const items = [
    { name: "Concentrate", price: "6", size: "1 L", servings: "40" },
    { name: "Dilute", price: "7", size: "2 L", servings: "28" }
  ];
  const r = S.compare(items);
  assert.equal(r.byServing, true);
  // Per wash the concentrate wins, even though it's dearer per millilitre.
  assert.equal(r.best.name, "Concentrate");
  assert.ok(Math.abs(r.best.perServing - 0.15) < 1e-9);
});

test("serving ranking is off unless every item gives a serving count", () => {
  const items = [
    { name: "A", price: "6", size: "1 L", servings: "40" },
    { name: "B", price: "7", size: "2 L" } // no servings
  ];
  const r = S.compare(items);
  assert.equal(r.byServing, false);
  // Falls back to per-litre, where B (0.0035/ml) beats A (0.006/ml).
  assert.equal(r.best.name, "B");
});

test("a member price is used per serving too", () => {
  const items = [
    { name: "A", price: "10", size: "1 L", servings: "20", memberPrice: "6" },
    { name: "B", price: "7", size: "1 L", servings: "20" }
  ];
  const off = S.compare(items, { member: false });
  assert.equal(off.best.name, "B"); // 7 < 10
  const on = S.compare(items, { member: true });
  assert.equal(on.best.name, "A"); // card drops A to 6 < 7
  assert.ok(Math.abs(on.best.effPerServing - 0.3) < 1e-9); // 6/20
});
