(function () {
  "use strict";
  var btn = document.getElementById("tag");
  var bubble = document.getElementById("tag-bubble");
  var dock = document.getElementById("tag-dock");
  var hide = document.getElementById("tag-hide");
  var noop = function () {};
  if (!btn) { window.Tag = { mood: noop, thinking: noop, react: noop, settle: noop, start: noop }; return; }

  var still = matchMedia("(prefers-reduced-motion: reduce)");
  var base = "sleepy", flashing = false, flashTimer = 0, bubbleTimer = 0, taps = [], tipAt = {};
  var stage = "empty";

  var TIPS = {
    empty: [
      "Hi, I'm Tag! Type the price and size from two shelf labels and I'll tell you which is cheaper.",
      "Not sure what to type? Tap \"Try an example\" and watch.",
      "Sizes like 500 g, 2 L, 16 oz or 12 rolls all work. I'll do the maths."
    ],
    one: [
      "Good start! Now add a second item to compare it with.",
      "Comparing a big pack and a small pack? Add both."
    ],
    errors: [
      "One thing to fix. Look for the red note under the item.",
      "Offers are optional. If I can't read one, just leave it empty."
    ],
    traps: [
      "Gotcha! A shelf trap. Read the red box to see why.",
      "The big pack is not always the cheap one. Always check the price per unit."
    ],
    done: [
      "The yellow card is your best buy. Grab that one!",
      "Switch \"per 100 g\" to \"per kg\" if that's what your shop prints.",
      "Multi-buy offers only count if you really need that many.",
      "Pick how often you buy it and I'll show the yearly saving."
    ]
  };

  function setMood(m) { btn.setAttribute("data-mood", m); }
  function say(text, ms) {
    if (dock.classList.contains("tucked")) return;
    bubble.textContent = text;
    bubble.classList.remove("pop");
    void bubble.offsetWidth;
    bubble.classList.add("pop");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.textContent = ""; }, ms || 7000);
  }
  function flash(m, ms) {
    setMood(m);
    flashing = true;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { flashing = false; setMood(base); }, ms || 1300);
  }
  function play(cls) {
    if (still.matches) return;
    btn.classList.remove("hop", "wiggle");
    void btn.offsetWidth;
    btn.classList.add(cls);
  }
  btn.addEventListener("animationend", function () { btn.classList.remove("hop", "wiggle"); });

  function settle(ok, errors, traps) {
    stage = errors ? "errors" : traps ? "traps" : ok >= 2 ? "done" : ok === 1 ? "one" : "empty";
    base = errors || traps ? "worried" : ok >= 2 ? "happy" : ok === 1 ? "thinking" : "sleepy";
    if (!flashing) setMood(base);
  }

  function nextTip() {
    var l = TIPS[stage];
    var i = tipAt[stage] || 0;
    tipAt[stage] = (i + 1) % l.length;
    return l[i];
  }

  btn.addEventListener("click", function () {
    if (dock.classList.contains("tucked")) {
      dock.classList.remove("tucked");
      remember(false);
      play("hop");
      say("I'm back! Tap me any time for a tip.");
      return;
    }
    var now = Date.now();
    taps = taps.filter(function (t) { return now - t < 1500; });
    taps.push(now);
    if (taps.length >= 5) {
      taps = [];
      play("wiggle");
      flash("wow", 1200);
      say("Hey, that tickles! I'm a price tag, not a price check button.");
      return;
    }
    play("hop");
    if (base === "sleepy") flash("happy", 1500);
    say(nextTip());
  });

  hide.addEventListener("click", function () {
    dock.classList.add("tucked");
    bubble.textContent = "";
    remember(true);
    btn.focus();
  });
  function remember(t) { try { localStorage.setItem("shelfcheck.tagTucked", t ? "1" : ""); } catch (e) {} }

  var pupils = btn.querySelectorAll(".t-pupil");
  var target = null, frame = 0;
  function look() {
    frame = 0;
    if (!target || base === "sleepy") return;
    var r = btn.getBoundingClientRect();
    var dx = target.x - (r.left + r.width * 0.58), dy = target.y - (r.top + r.height * 0.48);
    var d = Math.hypot(dx, dy) || 1, reach = Math.min(1, d / 240);
    var x = (dx / d) * 3.2 * reach, y = (dy / d) * 3.6 * reach;
    pupils.forEach(function (p) { p.style.transform = "translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px)"; });
  }
  function aim(x, y) { target = { x: x, y: y }; if (!frame) frame = requestAnimationFrame(look); }
  window.addEventListener("pointermove", function (ev) { aim(ev.clientX, ev.clientY); }, { passive: true });
  document.addEventListener("focusin", function (ev) {
    if (ev.target === btn || !ev.target.getBoundingClientRect) return;
    var r = ev.target.getBoundingClientRect();
    aim(r.left + r.width / 2, r.top + r.height / 2);
  });

  (function blink() {
    setTimeout(function () {
      if (base !== "sleepy" && !document.hidden) {
        btn.classList.add("blink");
        setTimeout(function () { btn.classList.remove("blink"); }, 140);
      }
      blink();
    }, 2500 + Math.random() * 4000);
  })();

  var lastBest = "", lastTrap = "";
  function react(what, d) {
    d = d || {};
    switch (what) {
      case "result":
        settle(d.ok, d.errors, d.traps);
        if (d.errors && !d.typing) { flash("worried", 1500); say(TIPS.errors[0]); return; }
        if (d.trap && d.trap.name + d.trap.type !== lastTrap) {
          lastTrap = d.trap.name + d.trap.type;
          play("wiggle");
          say(d.trap.type === "bigger-costs-more"
            ? "Gotcha! " + d.trap.name + " is bigger but costs more per unit. Sneaky!"
            : "Careful: " + d.trap.name + " is on offer, but it's still not the cheapest.");
        } else if (d.ok >= 2 && d.best && d.best !== lastBest) {
          play("hop");
          flash("wow", 900);
          say(d.tie ? "It's a tie! Pick whichever you like." :
            d.mustBuy > 1 ? d.best + " wins, but only if you buy " + d.mustBuy + ". Will you use them all?" :
            d.best + " is the best buy. Grab that one!");
        }
        if (!d.trap) lastTrap = "";
        lastBest = d.ok >= 2 ? d.best : "";
        break;
      case "added": say(d.count === 3 ? "Three items. The more you compare, the surer you can be." : "Another one? Go for it."); break;
      case "removed": flash("worried", 900); say(d.name + " is gone."); break;
      case "cleared": flash("sleepy", 1000); say("All clear. What's on the shelf?"); break;
      case "full": flash("worried", 1200); say("Twelve is my limit. Remove one to add another."); break;
      case "example": play("hop"); say("Here's the pasta aisle. Look at the 2 kg \"value pack\"..."); break;
      case "unit": say("Same answer, new unit. Use the one your shop prints so you can check the labels."); break;
      case "often": play("hop"); say("Small savings add up when you buy it often."); break;
    }
  }

  function thinking() {
    if (dock.classList.contains("tucked")) return;
    setMood("thinking");
    flashing = true;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { flashing = false; setMood(base); }, 900);
  }

  function start(returning) {
    try { if (localStorage.getItem("shelfcheck.tagTucked")) dock.classList.add("tucked"); } catch (e) {}
    setTimeout(function () {
      if (bubble.textContent) return;
      say(returning ? "Welcome back! Your shelf is just how you left it." : "Hi, I'm Tag! Type what two shelf labels say and I'll find the real best deal.");
    }, 700);
  }

  window.Tag = { mood: function (m) { base = m; setMood(m); }, thinking: thinking, react: react, settle: settle, start: start };
})();
