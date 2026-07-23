/* フクダネ 深リンク受け（サイト内検索の「フクダネで見る」用）。
   ?q=<項目名> を受け、一致するカード・行・見出しへスクロールし、親アコーディオンを開いて数秒ハイライトする。
   外部通信なし。各カード系ページで nav.js の前に defer 読み込みする。正規化は search.js と一致。 */
(function () {
  "use strict";
  var q = null;
  try { q = new URLSearchParams(location.search).get("q"); } catch (e) { return; }
  if (!q) return;

  var PUNCT = " 　\t\n\r、。・，．,.（）()「」『』〈〉《》【】［］[]｜|/／-−–—〜~！!？?：:；;";
  function norm(s) {
    s = String(s == null ? "" : s).toLowerCase();
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], o = s.charCodeAt(i);
      if (o >= 0x30A1 && o <= 0x30F6) out += String.fromCharCode(o - 0x60);
      else if (o >= 0xFF01 && o <= 0xFF5E) { var hc = String.fromCharCode(o - 0xFEE0); if (PUNCT.indexOf(hc) < 0) out += hc.toLowerCase(); }
      else if (PUNCT.indexOf(ch) >= 0) { /* skip */ }
      else out += ch;
    }
    return out;
  }

  var target = norm(q);
  if (!target) return;

  // 候補となる見出し・カード要素（data-name＝サービスカードの正式名称を最優先）
  var SEL = "[data-name], .gl-name, .org-name, .creative-name, .voice-name, .tl-event, .fw-acc-title, .fw-table thead th[scope=\"col\"]";

  function run() {
    var nodes = document.querySelectorAll(SEL);
    var best = null, bestScore = -1;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var raw = el.getAttribute("data-name");
      if (raw == null) raw = el.textContent || "";
      var txt = norm(raw.replace(/↗/g, ""));
      if (!txt) continue;
      var score = -1;
      if (txt === target) score = 3;                              // 完全一致
      else if (txt.indexOf(target) === 0) score = 2.5;            // 前方一致（要約deeplink対応）
      else if (txt.indexOf(target) >= 0) score = 2;              // 部分一致
      else if (target.length >= 3 && target.indexOf(txt) >= 0 && txt.length >= 3) score = 1;
      if (score > bestScore) { bestScore = score; best = el; }
    }
    if (!best) return;

    // 親のアコーディオン（details）をすべて開く
    var det = best.closest ? best.closest("details") : null;
    while (det) {
      det.open = true;
      var parent = det.parentElement;
      det = parent && parent.closest ? parent.closest("details") : null;
    }

    // スクロール対象＝カード/行の容器（最も近い容器を優先）
    var card = best.closest ? best.closest("article, li, figure, tr, .tl-item, .voice-card, .creative-card, .gl-card, .org-card, details, section") : null;
    var scrollTarget = card || best;
    try { scrollTarget.scrollIntoView({ behavior: "smooth", block: "center" }); }
    catch (e) { scrollTarget.scrollIntoView(); }
    scrollTarget.classList.add("deeplink-flash");
    setTimeout(function () { scrollTarget.classList.remove("deeplink-flash"); }, 2600);
  }

  // ページ本体のJS描画が終わってから実行（描画は同期IIFEのため、次のマクロタスクで確実に走らせる）
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(run, 0); });
  } else {
    setTimeout(run, 0);
  }
})();
