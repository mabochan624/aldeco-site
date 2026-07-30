(function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- スクロール進捗バー ---- */
  var progress = document.getElementById("progress");

  /* ---- ヘッダー: 下で隠す・上で出す ---- */
  var header = document.querySelector("header");
  var lastY = 0;

  function onScroll() {
    var y = window.scrollY;
    if (header) {
      if (y > 80 && y > lastY) header.classList.add("hidden");
      else header.classList.remove("hidden");
      header.classList.toggle("scrolled", y > 10);
    }
    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
    }
    if (!reduced) parallax(y);
    lastY = y;
  }

  /* ---- ウォーターマークのパララックス ---- */
  var marks = [].slice.call(document.querySelectorAll(".watermark"));
  function parallax() {
    var vh = window.innerHeight;
    marks.forEach(function (el) {
      var r = el.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      var progress01 = (r.top + r.height / 2 - vh / 2) / vh;
      el.style.transform = "translateY(" + (progress01 * -60).toFixed(1) + "px)";
    });
  }

  var ticking = false;
  window.addEventListener("scroll", function () {
    if (!ticking) {
      requestAnimationFrame(function () { onScroll(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });

  /* ---- リビール+スタッガー ---- */
  [].slice.call(document.querySelectorAll(".stats, .steps, .values, .biz, .goals, .roadmap"))
    .forEach(function (el) { el.classList.add("stagger"); });

  var targets = [].slice.call(document.querySelectorAll("section .container, .hero .container, .showcase, .m-line, .m-defbox"));
  targets.forEach(function (el) { el.classList.add("reveal"); });

  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var prefix = el.getAttribute("data-prefix") || "";
    var decimals = (String(target).split(".")[1] || "").length;
    var dur = 1300;
    var start = null;
    var textNode = el.firstChild; // 数字のテキストノード(smallタグは維持)
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      textNode.nodeValue = prefix + (target * eased).toFixed(decimals);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  if (!("IntersectionObserver" in window) || reduced) {
    targets.forEach(function (el) { el.classList.add("in"); });
    [].slice.call(document.querySelectorAll(".num[data-count]")).forEach(function (el) {
      var t = el.getAttribute("data-count"), pre = el.getAttribute("data-prefix") || "";
      el.firstChild.nodeValue = pre + t;
    });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        [].slice.call(e.target.querySelectorAll(".num[data-count]")).forEach(countUp);
        io.unobserve(e.target);
      });
    }, { threshold: 0.12 });
    targets.forEach(function (el) { io.observe(el); });
  }

  onScroll();
})();
