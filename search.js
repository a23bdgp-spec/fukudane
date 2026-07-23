/* フクダネ 横断検索（第1版）。外部通信なし・サイト内 search-index.json のみ参照。
   正規化(norm)は build_search.py と完全一致させること。 */
(function () {
  "use strict";

  var TYPES = [
    { key: "all", label: "すべて" },
    { key: "service", label: "サービス" },
    { key: "history", label: "制度の歴史" },
    { key: "job", label: "福祉の仕事" },
    { key: "organization", label: "福祉業界団体" },
    { key: "guideline", label: "ガイドライン" },
    { key: "management", label: "経営資料" },
    { key: "fee", label: "報酬" },
    { key: "kitei", label: "モデル規程" },
    { key: "foreign", label: "外国人材" },
    { key: "grant", label: "助成団体" },
    { key: "term", label: "用語" }
  ];
  var TYPE_LABEL = {};
  TYPES.forEach(function (t) { TYPE_LABEL[t.key] = t.label; });

  var qEl = document.getElementById("q");
  var tabsEl = document.getElementById("search-tabs");
  var countEl = document.getElementById("search-count");
  var resultsEl = document.getElementById("search-results");

  var INDEX = [];
  var activeType = "all";
  var PAGE_SIZE = 30;      // 初期表示件数・「さらに表示」1回あたりの追加件数
  var shown = PAGE_SIZE;   // 現在表示している件数（種別タブ切替・新しい入力でリセット）
  var loaded = false;      // 索引の読み込み完了フラグ
  var ver = (typeof BUILD_VERSION !== "undefined") ? BUILD_VERSION : "";

  // 全角→半角・カタカナ→ひらがな・小文字化・空白記号除去（build_search.py の norm と一致）
  var PUNCT = " 　\t\n\r、。・，．,.（）()「」『』〈〉《》【】［］[]｜|/／-−–—〜~！!？?：:；;";
  function norm(s) {
    // NFKC正規化を前置（半角カナ・全角英数などを標準形へ）。build_search.py・deeplink.js と一致させること
    s = String(s == null ? "" : s).normalize("NFKC").toLowerCase();
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], o = s.charCodeAt(i);
      if (o >= 0x30A1 && o <= 0x30F6) out += String.fromCharCode(o - 0x60);
      else if (o >= 0xFF01 && o <= 0xFF5E) {
        var hc = String.fromCharCode(o - 0xFEE0);
        if (PUNCT.indexOf(hc) < 0) out += hc.toLowerCase();
      } else if (PUNCT.indexOf(ch) >= 0) { /* skip */ }
      else out += ch;
    }
    return out;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) {
    var s = String(u == null ? "" : u).trim();
    return /^https?:\/\//i.test(s) ? s : "";
  }

  // 1レコードのスコア（画面には出さない）
  function scoreOf(rec, terms, qFull) {
    var hay = rec.hay || "";
    for (var i = 0; i < terms.length; i++) {
      if (hay.indexOf(terms[i]) < 0) return -1; // 全語AND
    }
    var score = 0;
    var tn = norm(rec.title);
    if (tn === qFull) score += 100; else if (tn.indexOf(qFull) >= 0) score += 40;
    var aliasN = (rec.alias || []).map(norm);
    var aliasExact = aliasN.some(function (a) { return a === qFull; });
    var aliasPart = aliasN.some(function (a) { return terms.some(function (t) { return a.indexOf(t) >= 0; }); });
    if (aliasExact) score += 80; else if (aliasPart) score += 30;
    if (norm(rec.subtitle).indexOf(qFull) >= 0) score += 15;
    var be = norm((rec.body || "") + (rec.extra || ""));
    if (terms.some(function (t) { return be.indexOf(t) >= 0; })) score += 5;
    return score;
  }

  // 正規化文字列の各文字が元文（NFKC後）のどの位置に対応するかの対応表つき正規化
  function normWithMap(base) {
    var out = "", map = [];
    for (var i = 0; i < base.length; i++) {
      var ch = base[i], o = base.charCodeAt(i);
      if (o >= 0x30A1 && o <= 0x30F6) { out += String.fromCharCode(o - 0x60); map.push(i); }
      else if (o >= 0xFF01 && o <= 0xFF5E) { var hc = String.fromCharCode(o - 0xFEE0); if (PUNCT.indexOf(hc) < 0) { out += hc.toLowerCase(); map.push(i); } }
      else if (PUNCT.indexOf(ch) >= 0) { /* skip */ }
      else { out += ch.toLowerCase(); map.push(i); }
    }
    return { n: out, map: map };
  }

  // 本文から、一致語を中心に前後を切り出した抜粋を返す（プレーンテキスト。cardHtml側でescする）
  function snippet(body, terms) {
    var raw = String(body || "");
    if (!raw) return "";
    var base = raw.normalize("NFKC");         // 表示用の基準文字列
    var nm = normWithMap(base);               // 正規化文字列と元位置の対応
    var pos = -1;
    for (var i = 0; i < terms.length; i++) {
      var p = nm.n.indexOf(terms[i]);
      if (p >= 0) { pos = p; break; }
    }
    if (pos < 0) return base.length > 120 ? base.slice(0, 120) + "…" : base;
    var origPos = nm.map[pos] != null ? nm.map[pos] : 0;
    var start = Math.max(0, origPos - 30);
    var end = Math.min(base.length, origPos + 90);
    return (start > 0 ? "…" : "") + base.slice(start, end) + (end < base.length ? "…" : "");
  }

  function matchedAlias(rec, terms) {
    var al = rec.alias || [];
    for (var i = 0; i < al.length; i++) {
      var an = norm(al[i]);
      for (var j = 0; j < terms.length; j++) {
        if (an.indexOf(terms[j]) >= 0) return al[i];
      }
    }
    return "";
  }

  function cardHtml(rec, terms) {
    var h = '<article class="sr-card">';
    h += '<div class="sr-head">';
    h += '<h3 class="sr-title">' + esc(rec.title) + "</h3>";
    h += '<span class="sr-badge">' + esc(TYPE_LABEL[rec.type] || rec.type) + "</span>";
    h += "</div>";
    var ma = matchedAlias(rec, terms);
    if (ma && norm(ma) !== norm(rec.title)) h += '<p class="sr-alias">別名：' + esc(ma) + "</p>";
    if (rec.subtitle) h += '<p class="sr-sub">' + esc(rec.subtitle) + "</p>";
    var body = snippet(rec.body, terms);
    if (body) h += '<p class="sr-snippet">' + esc(body) + "</p>";
    var meta = [];
    if (rec.date_label) meta.push(esc(rec.date_label));
    if (rec.source_label) meta.push(esc(rec.source_label));
    if (meta.length) h += '<p class="sr-meta">' + meta.join("　/　") + "</p>";
    h += '<p class="sr-links">';
    if (rec.deeplink) h += '<a class="sr-link" href="' + esc(rec.deeplink) + '">フクダネで見る</a>';
    var su = safeUrl(rec.source_url);
    if (su) h += '<a class="sr-link" href="' + esc(su) + '" target="_blank" rel="noopener noreferrer">出典を見る↗</a>';
    h += "</p></article>";
    return h;
  }

  function currentQuery() {
    var raw = qEl.value;
    // 空白に加え、中黒・スラッシュ・読点・句点など記号でも語を分割する
    var terms = norm(raw).length ? raw.split(/[\s　・／/、,。]+/).map(norm).filter(Boolean) : [];
    return { terms: terms, qFull: norm(raw) };
  }

  function computeMatches() {
    var q = currentQuery();
    if (q.terms.length === 0) return { list: [], counts: null, empty: true };
    var scored = [];
    for (var i = 0; i < INDEX.length; i++) {
      var sc = scoreOf(INDEX[i], q.terms, q.qFull);
      if (sc >= 0) scored.push({ rec: INDEX[i], score: sc });
    }
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.rec.title.length - b.rec.title.length;
    });
    var counts = { all: scored.length };
    scored.forEach(function (s) { counts[s.rec.type] = (counts[s.rec.type] || 0) + 1; });
    return { list: scored, counts: counts, empty: false, terms: q.terms };
  }

  function renderTabs(counts) {
    var h = "";
    TYPES.forEach(function (t) {
      var n = counts ? (counts[t.key] || 0) : 0;
      var cls = "search-tab" + (t.key === activeType ? " is-active" : "") + (n === 0 && counts ? " is-empty" : "");
      var pressed = (t.key === activeType) ? "true" : "false";
      h += '<button type="button" class="' + cls + '" data-type="' + t.key + '" aria-pressed="' + pressed + '"' + (n === 0 && counts && t.key !== "all" ? " disabled" : "") + ">" +
        esc(t.label) + '<span class="search-tab-n">' + (counts ? "（" + n + "）" : "") + "</span></button>";
    });
    tabsEl.innerHTML = h;
  }

  function render() {
    var m = computeMatches();
    renderTabs(m.counts);
    if (m.empty) {
      countEl.textContent = "";
      resultsEl.innerHTML = '<p class="sr-hint">キーワードを入力すると、サービス・制度・仕事・団体・ガイドライン・経営資料・用語をまとめて検索します。</p>';
      return;
    }
    var list = m.list;
    if (activeType !== "all") list = list.filter(function (s) { return s.rec.type === activeType; });
    var total = list.length;
    countEl.textContent = total + "件";
    if (total === 0) {
      resultsEl.innerHTML =
        '<div class="sr-empty"><p>該当する情報が見つかりませんでした。検索語を変えてお試しください。</p>' +
        '<p class="sr-empty-links">よく使う入口：' +
        '<a href="service.html">福祉サービス一覧</a>　<a href="history.html">制度の歴史</a>　' +
        '<a href="organizations.html">福祉業界団体</a>　<a href="guidelines.html">ガイドライン集</a></p></div>';
      return;
    }
    if (shown > total) shown = total;
    var html = "";
    for (var i = 0; i < shown; i++) html += cardHtml(list[i].rec, m.terms);
    // 「さらに表示」（残りがある場合のみ）。件数表記は「◯件中◯件を表示」
    if (total > shown) {
      html += '<div class="sr-more">' +
        '<p class="sr-more-count">' + total + "件中" + shown + "件を表示</p>" +
        '<button type="button" class="sr-more-btn">さらに表示</button></div>';
    } else if (total > PAGE_SIZE) {
      html += '<div class="sr-more"><p class="sr-more-count">' + total + "件中" + total + "件を表示</p></div>";
    }
    resultsEl.innerHTML = html;
  }

  tabsEl.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-type]");
    if (!btn || btn.disabled) return;
    activeType = btn.getAttribute("data-type");
    shown = PAGE_SIZE; // 種別タブ切替で表示件数をリセット
    render();
  });

  qEl.addEventListener("input", function () { activeType = "all"; shown = PAGE_SIZE; render(); });

  // 「さらに表示」で表示件数を増やす（リセットせず追加）
  resultsEl.addEventListener("click", function (e) {
    var b = e.target.closest(".sr-more-btn");
    if (!b) return;
    shown += PAGE_SIZE;
    render();
  });

  // ?q= を初期値に反映
  var q0 = new URLSearchParams(location.search).get("q");
  if (q0) qEl.value = q0;

  // 索引の読み込みが終わるまで入力を無効化し、案内プレースホルダを表示する
  var basePlaceholder = qEl.getAttribute("placeholder") || "";
  qEl.disabled = true;
  qEl.setAttribute("placeholder", "検索データを読み込んでいます…");

  // 索引読み込み
  fetch("search-index.json?v=" + ver)
    .then(function (r) { if (!r.ok) throw new Error("load"); return r.json(); })
    .then(function (data) {
      INDEX = Array.isArray(data) ? data : [];
      loaded = true;
      qEl.disabled = false;
      qEl.setAttribute("placeholder", basePlaceholder);
      render();
      // フォーカスは ?q= 初期値がある場合、またはPC（精密ポインタ）のときのみ
      var isFinePointer = window.matchMedia && window.matchMedia("(pointer:fine)").matches;
      if (q0 || isFinePointer) qEl.focus();
    })
    .catch(function () {
      qEl.disabled = false;
      qEl.setAttribute("placeholder", basePlaceholder);
      resultsEl.innerHTML = '<p class="sr-hint">検索データを読み込めませんでした。時間をおいて再度お試しください。</p>';
    });
})();
