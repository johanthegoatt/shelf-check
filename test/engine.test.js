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
