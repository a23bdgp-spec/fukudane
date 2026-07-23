/* フクダネ 共通ナビ（ハンバーガー開閉）
   外部依存なし。スマホ幅のみボタンが現れ、PC幅は横並びを維持（表示はCSSで制御）。
   .nav-toggle ボタンの aria-controls が指すナビ要素を開閉する。 */
(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    var toggles = document.querySelectorAll(".nav-toggle");
    toggles.forEach(function (btn) {
      var nav = document.getElementById(btn.getAttribute("aria-controls"));
      if (!nav) return;

      function setOpen(open) {
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        nav.classList.toggle("nav-open", open);
        if (open) {
          var first = nav.querySelector("a");
          if (first) first.focus();
        }
      }

      btn.addEventListener("click", function () {
        setOpen(btn.getAttribute("aria-expanded") !== "true");
      });

      // Escで閉じてボタンへフォーカスを戻す
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") {
          setOpen(false);
          btn.focus();
        }
      });

      // ナビ内リンクを選んだら閉じる（スマホでの遷移後の閉じ状態を保つ）
      nav.addEventListener("click", function (e) {
        if (e.target.closest("a") && btn.getAttribute("aria-expanded") === "true") {
          setOpen(false);
        }
      });
    });
  });
})();
