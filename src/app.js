(function () {
  "use strict";
  var S = window.ShelfCheck;
  var KEY = "shelfcheck.v1";
  var list = document.getElementById("items");
  var tpl = document.getElementById("item-tpl");
  var answer = document.getElementById("answer");
  var units = document.getElementById("units");
  var noop = function () {};
  var Tag = window.Tag || { mood: noop, react: noop, start: noop, thinking: noop, settle: noop };

  var state = { items: [blank(), blank()], unit: null, often: "52" };
  var touched = {};
  var last = null, lastSig = "", timer = 0;

  function blank() { return { name: "", price: "", size: "", deal: "" }; }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return false;
      var s = JSON.parse(raw);
      if (!s || !Array.isArray(s.items) || !s.items.length) return false;
      state.items = s.items.slice(0, 12).map(function (it) {
        return { name: str(it.name), price: str(it.price), size: str(it.size), deal: str(it.deal) };
      });
      state.unit = typeof s.unit === "string" ? s.unit : null;
      state.often = ["0", "12", "26", "52", "104"].indexOf(s.often) >= 0 ? s.often : "52";
      return true;
    } catch (e) { return false; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function str(v) { return typeof v === "string" ? v.slice(0, 60) : ""; }
  function filled(it) { return !!(it.price.trim() || it.size.trim() || it.deal.trim()); }

  function renderItems(focusIndex) {
    list.textContent = "";
    state.items.forEach(function (it, i) {
      var li = tpl.content.firstElementChild.cloneNode(true);
      li.dataset.i = i;
      li.querySelector(".item-num").textContent = i + 1;
      li.querySelector(".x").setAttribute("aria-label", "Remove item " + (i + 1));
      li.querySelectorAll("input").forEach(function (inp) {
        var f = inp.dataset.f, id = "f" + i + f;
        inp.id = id;
        inp.value = it[f];
        var lab = li.querySelector('[data-for="' + f + '"]');
        if (lab) lab.setAttribute("for", id);
        if (f === "name") inp.setAttribute("aria-label", "Name of item " + (i + 1));
      });
      list.appendChild(li);
    });
    if (focusIndex != null) {
      var row = list.children[focusIndex];
      if (row) row.querySelector('[data-f="price"]').focus();
    }
  }

  list.addEventListener("input", function (ev) {
    var li = ev.target.closest(".item");
    if (!li) return;
    state.items[+li.dataset.i][ev.target.dataset.f] = ev.target.value;
    save();
    Tag.thinking();
    clearTimeout(timer);
    timer = setTimeout(function () { update(true); }, 380);
  });
  list.addEventListener("focusout", function (ev) {
    var li = ev.target.closest && ev.target.closest(".item");
    if (!li || !ev.target.dataset.f) return;
    touched[li.dataset.i + ev.target.dataset.f] = true;
    clearTimeout(timer);
    update(true);
  });
  list.addEventListener("click", function (ev) {
    var x = ev.target.closest(".x");
    if (!x) return;
    var i = +x.closest(".item").dataset.i;
    var gone = state.items[i];
    if (state.items.length <= 1) state.items = [blank()];
    else state.items.splice(i, 1);
    touched = {};
    save();
    renderItems();
    var next = list.children[Math.min(i, list.children.length - 1)];
    if (next) next.querySelector(".x").focus();
    update(false);
    Tag.react("removed", { name: gone.name || "That one" });
  });

  document.getElementById("add").addEventListener("click", function () {
    if (state.items.length >= 12) { Tag.react("full"); return; }
    state.items.push(blank());
    save();
    renderItems(state.items.length - 1);
    update(false);
    Tag.react("added", { count: state.items.length });
  });
  document.getElementById("clear").addEventListener("click", function () {
    if (state.items.some(filled) && !confirm("Clear every item?")) return;
    state.items = [blank(), blank()];
    state.unit = null;
    touched = {};
    save();
    renderItems(0);
    update(false);
    Tag.react("cleared");
  });
  document.getElementById("example").addEventListener("click", function () {
    state.items = [
      { name: "Spaghetti 500 g", price: "$0.75", size: "500 g", deal: "" },
      { name: "Spaghetti 1 kg", price: "$1.10", size: "1 kg", deal: "" },
      { name: "Spaghetti 2 kg \"value pack\"", price: "$2.47", size: "2 kg", deal: "" },
      { name: "Fancy linguine", price: "$1.60", size: "500 g", deal: "2 for $1.30" }
    ];
    state.unit = null;
    touched = {};
    save();
    renderItems();
    Tag.react("example");
    update(false);
  });

  function currency() {
    for (var i = 0; i < state.items.length; i++) {
      var p = state.items[i].price.trim();
      var m = p.match(/[$€£₱¥₹₩]|A\$|R\$|kr/);
      if (m) return m[0];
      if (/\d\s*p$/i.test(p)) return "£";
    }
    return "";
  }
  function money(n, sym) {
    var d = n !== 0 && Math.abs(n) < 0.1 ? 3 : 2;
    var s = n.toFixed(d);
    return sym === "€" ? s.replace(".", ",") + " €" : sym + s;
  }

  var ERR = {
    price: function (it) { return it.price.trim() ? "I can't read that price. Try 3.49 or $3.49." : "Add the price from the label."; },
    size: function (it) { return it.size.trim() ? "I can't read that size. Try 500 g, 1.5 kg, 6 x 330 ml or 12 rolls." : "Add the size, like 500 g."; },
    deal: function () { return "I don't know that offer. Try 3 for $5, buy 2 get 1 free or 20% off. Or leave it empty."; },
    kind: function (it, r) { return "This one is sold by " + KIND[r.size && r.size.kind || ""] + " but the others by " + KIND[last.kind] + ", so I left it out."; }
  };
  var KIND = { mass: "weight", volume: "volume", count: "count", "": "something else" };
  var FIELD = { price: "price", size: "size", deal: "deal", kind: "size" };

  function update(fromTyping) {
    var idx = [], input = [];
    state.items.forEach(function (it, i) {
      if (!filled(it)) return;
      idx.push(i);
      input.push({ name: it.name.trim() || "Item " + (i + 1), price: it.price, size: it.size, deal: it.deal });
    });
    var c = S.compare(input, { display: state.unit || undefined });
    last = c;

    var errs = {};
    c.rows.forEach(function (r) {
      if (!r.error) return;
      var i = idx[r.index], it = state.items[i], f = FIELD[r.error];
      var show = r.error === "kind" || r.error === "deal" || it[f].trim() || touched[i + f];
      if (show) errs[i] = { field: f, text: ERR[r.error](it, r) };
    });
    Array.prototype.forEach.call(list.children, function (li) {
      var i = +li.dataset.i, e = errs[i], p = li.querySelector(".err");
      li.classList.toggle("has-err", !!e);
      li.querySelectorAll("input").forEach(function (inp) {
        var bad = !!e && inp.dataset.f === e.field;
        inp.setAttribute("aria-invalid", bad ? "true" : "false");
        if (bad) inp.setAttribute("aria-describedby", "e" + i); else inp.removeAttribute("aria-describedby");
      });
      p.id = "e" + i;
      p.hidden = !e;
      p.textContent = e ? e.text : "";
    });

    renderUnits(c);
    renderAnswer(c, idx);

    var sig = JSON.stringify([c.ranked.map(function (r) { return r.index; }), c.traps.length, Object.keys(errs).length]);
    if (sig !== lastSig || !fromTyping) {
      lastSig = sig;
      var named = function (r) { return r ? r.name : ""; };
      Tag.react("result", {
        ok: c.ranked.length,
        errors: Object.keys(errs).length,
        traps: c.traps.length,
        tie: c.tie,
        best: named(c.best),
        trap: c.traps[0] ? { type: c.traps[0].type, name: c.traps[0].item.name } : null,
        mustBuy: c.best ? c.best.mustBuy : 1,
        typing: fromTyping
      });
    } else {
      Tag.settle(c.ranked.length, Object.keys(errs).length, c.traps.length);
    }
  }

  function renderUnits(c) {
    units.textContent = "";
    units.hidden = !c.kind || c.kind === "count";
    if (units.hidden) return;
    S.DISPLAY[c.kind].forEach(function (d) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "radio");
      var on = c.display && c.display.id === d[0];
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
      b.dataset.id = d[0];
      b.textContent = "per " + d[2];
      units.appendChild(b);
    });
  }
  units.addEventListener("click", function (ev) {
    var b = ev.target.closest("button");
    if (!b) return;
    pick(b.dataset.id);
  });
  units.addEventListener("keydown", function (ev) {
    var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!keys[ev.key]) return;
    ev.preventDefault();
    var bs = Array.prototype.slice.call(units.querySelectorAll("button"));
    var i = bs.findIndex(function (b) { return b.getAttribute("aria-checked") === "true"; });
    var n = bs[(i + keys[ev.key] + bs.length) % bs.length];
    pick(n.dataset.id);
    var again = units.querySelector('[data-id="' + n.dataset.id + '"]');
    if (again) again.focus();
  });
  function pick(id) {
    state.unit = id;
    save();
    update(false);
    Tag.react("unit");
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderAnswer(c, idx) {
    answer.textContent = "";
    var sym = currency();
    var per = c.display ? " per " + c.display.label : "";
    if (!c.ranked.length) {
      var e = el("div", "empty");
      e.appendChild(el("strong", null, "Nothing to compare yet"));
      e.appendChild(document.createTextNode("Type the price and size from two shelf labels. Not sure? Tap \"Try an example\"."));
      answer.appendChild(e);
      return;
    }
    if (c.ranked.length === 1) {
      var one = c.ranked[0];
      var e1 = el("div", "empty");
      e1.appendChild(el("strong", null, one.name + ": " + money(one.unitPrice, sym) + per));
      e1.appendChild(document.createTextNode("Add one more item to see which is cheaper."));
      answer.appendChild(e1);
      return;
    }
    var best = c.best;
    var w = el("div", "winner");
    w.appendChild(el("small", null, c.tie ? "It's a tie" : "Best buy"));
    w.appendChild(el("p", "w-name", best.name));
    w.appendChild(el("p", "w-unit", money(best.unitPrice, sym) + per));
    var note = "";
    if (c.tie) {
      var tied = c.ranked.filter(function (r) { return r.tied && r !== best; }).map(function (r) { return r.name; });
      note = "Same price per unit as " + tied.join(", ") + " (within 1%). Pick the one you like.";
    } else if (c.ranked[1]) {
      note = Math.round(c.ranked[1].dearerPct) + "% cheaper than the next best.";
    }
    if (best.mustBuy > 1) note += " You need to buy " + best.mustBuy + " to get this price (" + money(best.spend, sym) + " in total).";
    if (note) w.appendChild(el("p", "w-note", note.trim()));
    answer.appendChild(w);

    var max = c.ranked[c.ranked.length - 1].unitPrice || 1;
    var ol = el("ol", "rank");
    ol.setAttribute("aria-label", "All items, cheapest first");
    c.ranked.forEach(function (r) {
      var li = el("li", r.tied ? "best" : "");
      var nm = el("span", "r-name", r.name);
      if (r.tied) nm.appendChild(el("span", "pill good", "best"));
      else nm.appendChild(el("span", "pill", "+" + Math.round(r.dearerPct) + "%"));
      li.appendChild(nm);
      li.appendChild(el("span", "r-price", money(r.unitPrice, sym) + per));
      var bar = el("span", "r-bar");
      bar.setAttribute("aria-hidden", "true");
      var fill = el("span");
      fill.style.width = Math.max(4, (r.unitPrice / max) * 100) + "%";
      bar.appendChild(fill);
      li.appendChild(bar);
      var meta = money(r.price, sym) + " for " + r.size.label;
      if (r.deal) meta += ", with the offer " + money(r.each, sym) + " each" + (r.mustBuy > 1 ? " if you buy " + r.mustBuy : "");
      li.appendChild(el("span", "r-meta", meta));
      ol.appendChild(li);
    });
    answer.appendChild(ol);

    if (c.traps.length) {
      var t = el("div", "traps");
      c.traps.forEach(function (tr) {
        var box = el("div", "trap");
        if (tr.type === "bigger-costs-more") {
          box.appendChild(el("strong", null, "Bigger is not cheaper here"));
          box.appendChild(document.createTextNode(tr.item.name + " is the bigger pack but costs " + Math.round(tr.pct) + "% more per unit than " + tr.than.name + ". Buying the smaller one twice works out cheaper."));
        } else {
          box.appendChild(el("strong", null, "This offer is not the best deal"));
          box.appendChild(document.createTextNode(tr.item.name + " is on offer but still costs " + Math.round(tr.pct) + "% more per unit than " + tr.than.name + "."));
        }
        t.appendChild(box);
      });
      answer.appendChild(t);
    }

    var skipped = c.bad.filter(function (r) { return r.error === "kind"; });
    if (skipped.length) {
      answer.appendChild(el("p", "skipped", "Left out: " + skipped.map(function (r) { return r.name; }).join(", ") + " (sold by a different kind of unit)."));
    }

    var worst = c.ranked[c.ranked.length - 1];
    var sv = S.saving(best, worst, 1);
    if (sv.perBuy > 0.005) {
      var box2 = el("div", "save");
      var lab = el("label", null, "if you buy " + best.size.label);
      lab.setAttribute("for", "often");
      var sel = el("select");
      sel.id = "often";
      [["104", "twice a week"], ["52", "every week"], ["26", "every 2 weeks"], ["12", "every month"]].forEach(function (o) {
        var op = el("option", null, o[1]);
        op.value = o[0];
        if (state.often === o[0]) op.selected = true;
        sel.appendChild(op);
      });
      var out = el("output");
      out.setAttribute("for", "often");
      var write = function () { out.textContent = money(sv.perBuy * +sel.value, sym); };
      write();
      sel.addEventListener("change", function () { state.often = sel.value; save(); write(); Tag.react("often"); });
      box2.appendChild(document.createTextNode("Picking " + best.name + " over " + worst.name + " saves "));
      box2.appendChild(out);
      box2.appendChild(document.createTextNode(" a year "));
      box2.appendChild(lab);
      box2.appendChild(sel);
      answer.appendChild(box2);
    }
  }

  var had = load();
  renderItems();
  update(false);
  Tag.start(had && state.items.some(filled));
  window.__shelf = { state: state, last: function () { return last; } };
})();
