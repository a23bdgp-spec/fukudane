/* フクダネ 共通ナビ。外部依存なし。
   ・ハンバーガー開閉（スマホ）
   ・カテゴリのドロップダウン（PC＝ホバー/クリック、キーボード・aria対応。スマホ＝グループ見出し展開）
   ・現在ページに aria-current を付与し、そのグループを開いた状態にする */
(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }
  var isPC = function () { return window.matchMedia ? window.matchMedia("(min-width: 769px)").matches : true; };

  ready(function () {
    // ---- ハンバーガー開閉 ----
    document.querySelectorAll(".nav-toggle").forEach(function (btn) {
      var nav = document.getElementById(btn.getAttribute("aria-controls"));
      if (!nav) return;
      function setOpen(open) {
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        nav.classList.toggle("nav-open", open);
        if (open) { var f = nav.querySelector("a,button"); if (f) f.focus(); }
      }
      btn.addEventListener("click", function () { setOpen(btn.getAttribute("aria-expanded") !== "true"); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") { setOpen(false); btn.focus(); }
      });
      nav.addEventListener("click", function (e) {
        // メニュー内のリンク（グループ開閉ボタンは除く）を選んだら閉じる
        if (e.target.closest("a") && btn.getAttribute("aria-expanded") === "true") setOpen(false);
      });
    });

    // ---- カテゴリのドロップダウン ----
    document.querySelectorAll(".nav-group").forEach(function (g) {
      var btn = g.querySelector(".nav-group-btn");
      var menu = g.querySelector(".nav-menu");
      if (!btn || !menu) return;
      function open(o) { btn.setAttribute("aria-expanded", o ? "true" : "false"); g.classList.toggle("is-open", o); }
      btn.addEventListener("click", function (e) { e.stopPropagation(); open(btn.getAttribute("aria-expanded") !== "true"); });
      // PCはホバーでも開く
      g.addEventListener("mouseenter", function () { if (isPC()) open(true); });
      g.addEventListener("mouseleave", function () { if (isPC()) open(false); });
      // キーボード操作
      btn.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault(); open(true); var a = menu.querySelector("a"); if (a) a.focus();
        } else if (e.key === "Escape") { open(false); }
      });
      menu.addEventListener("keydown", function (e) {
        var items = Array.prototype.slice.call(menu.querySelectorAll("a"));
        var i = items.indexOf(document.activeElement);
        if (e.key === "ArrowDown") { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
        else if (e.key === "Escape") { e.preventDefault(); open(false); btn.focus(); }
        else if (e.key === "Tab") { open(false); }
      });
    });
    // 外側クリックで開いているグループを閉じる（PC）
    document.addEventListener("click", function (e) {
      document.querySelectorAll(".nav-group.is-open").forEach(function (g) {
        if (!g.contains(e.target)) { g.classList.remove("is-open"); var b = g.querySelector(".nav-group-btn"); if (b) b.setAttribute("aria-expanded", "false"); }
      });
    });

    // ---- 現在ページの表示（aria-current＋グループ強調） ----
    var file = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("#primary-nav a, #db-nav-links a").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (href.indexOf("#") >= 0) return;
      if ((href.split("/").pop() || "") === file) {
        a.setAttribute("aria-current", "page");
        var grp = a.closest(".nav-group");
        if (grp) { grp.classList.add("has-current"); }
      }
    });
  });
})();
