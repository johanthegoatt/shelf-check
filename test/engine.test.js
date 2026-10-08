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
