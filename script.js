(function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- スクロール進捗バー ---- */
  var progress = document.getElementById("progress");

  /* ---- ヘッダー: 下で隠す・上で出す ---- */
  var header = document.querySelector("header");
  var lastY = 0;

  var floatCta = document.getElementById("float-cta");

  function onScroll() {
    var y = window.scrollY;
    if (header) {
      if (y > 80 && y > lastY) header.classList.add("hidden");
      else header.classList.remove("hidden");
      header.classList.toggle("scrolled", y > 10);
    }
    if (floatCta) floatCta.classList.toggle("show", y > 600);
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

  /* ---- フォーム: ページ遷移せず、その場で送信して結果を出す ---- */
  [].slice.call(document.querySelectorAll('form[action*="formspree.io"]')).forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var label = btn ? btn.textContent : "";
      if (btn) { btn.disabled = true; btn.textContent = "送信中…"; }

      fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      }).then(function (res) {
        if (!res.ok) throw new Error("send failed");
        if (typeof gtag === "function") gtag("event", "form_submit", { form_url: form.action, from: location.pathname });
        var done = document.createElement("div");
        done.className = "form-done";
        done.innerHTML = '<p class="form-done-title">送信しました。ありがとうございます！</p>' +
          '<p>内容を確認して、折り返しご連絡します。<br>お急ぎの場合は <a href="tel:080-4402-3343">080-4402-3343</a>（佐藤・代表直通）へどうぞ。</p>';
        form.parentNode.replaceChild(done, form);
        done.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      }).catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = label; }
        var err = form.querySelector(".form-error");
        if (!err) {
          err = document.createElement("p");
          err.className = "form-error";
          form.appendChild(err);
        }
        err.textContent = "送信できませんでした。時間をおいてもう一度試すか、お電話（080-4402-3343）かメール（info@aldeco.co.jp）でご連絡ください。";
      });
    });
  });

  onScroll();
})();
