/* 上部へ戻るボタン。長いページに設置し、少しスクロールすると右下に表示する。
   外部通信なし。既存の .to-top スタイル（style.css）を利用。二重設置は防止する。 */
(function () {
  "use strict";
  function init() {
    if (document.querySelector(".to-top")) return; // 既に設置済みなら何もしない
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "to-top";
    btn.setAttribute("aria-label", "ページ上部へ戻る");
    btn.innerHTML = "↑";
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    document.body.appendChild(btn);
    window.addEventListener("scroll", function () {
      if (window.pageYOffset > 400) btn.classList.add("show");
      else btn.classList.remove("show");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
