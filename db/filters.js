// フクダネ 社会福祉法人DB 共有フィルタ（db.html と ranking.html で共通利用）
// 都道府県はプルダウン（単一選択）、他の軸はチェックボックス（複数選択＝枠内OR）。枠どうしはAND。

function fesc(s){ return String(s).replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

// 照合用の正規化：「社会福祉法人」と全角/半角スペースを除去（表示名は接頭辞除去済み）。
function normName(s){ return String(s).replace(/社会福祉法人/g,'').replace(/[\s　]/g,''); }

// 設立年 → 年代区分
function eraOf(y){
  if(!y) return null;
  if(y<=1950) return '〜1950';
  if(y<=1975) return '1951-1975';
  if(y<=2000) return '1976-2000';
  return '2001〜';
}

// チェックボックスの絞り込み軸（都道府県はプルダウンのため含めない）
const FILTER_AXES = [
  {axis:'biz', label:'主な事業', opts:[['高齢','高齢'],['障害','障害'],['児童','児童'],['その他','その他']]},
  {axis:'kubun', label:'法人区分', opts:[['一般法人','一般法人'],['社会福祉協議会','社会福祉協議会'],['共同募金会','共同募金会'],['社会福祉事業団','社会福祉事業団'],['その他','その他']]},
  {axis:'size', label:'収益規模帯', opts:[['1億未満','1億円未満'],['1-3億','1〜3億円'],['3-5億','3〜5億円'],['5-10億','5〜10億円'],['10-30億','10〜30億円'],['30億以上','30億円以上']]},
  {axis:'era', label:'設立年代', opts:[['〜1950','〜1950年'],['1951-1975','1951〜1975年'],['1976-2000','1976〜2000年'],['2001〜','2001年〜']]},
  {axis:'hq', label:'法人本部', opts:[['1','本部あり'],['0','本部なし']]},
  {axis:'kessan', label:'経常増減差額（最新年度）', opts:[['plus','プラス（黒字）'],['minus','マイナス（赤字）']]},
];

// レコードから軸の値を取り出す
function axisVal(r, axis){
  switch(axis){
    case 'biz':   return r.biz;
    case 'kubun': return r.kb;
    case 'size':  return r.sz;
    case 'era':   return eraOf(r.sy);
    case 'hq':    return (r.hq===null||r.hq===undefined) ? null : String(r.hq);
    case 'kessan':
      if(r.sr===null||r.sr===undefined) return null;
      return r.sr<0 ? 'minus' : 'plus';   // 0以上はプラス（黒字）側に含める
    default:      return null;
  }
}

// 絞り込みUI（都道府県プルダウン＋チェックボックス群）を container に構築
function buildFilters(containerId, index, onChange){
  const box = document.getElementById(containerId);
  const prefs = {};
  index.forEach(r=>{ if(r.pref) prefs[r.pref]=r.pcode; });
  const prefOpts = Object.keys(prefs).sort((a,b)=>prefs[a].localeCompare(prefs[b]))
    .map(p=>`<option value="${fesc(p)}">${fesc(p)}</option>`).join('');
  let html = `<div class="fgroup fpref"><label class="flabel">都道府県</label>
    <select class="pref-select"><option value="">すべて</option>${prefOpts}</select></div>`;
  html += FILTER_AXES.map(g=>`
    <fieldset class="fgroup"><legend>${g.label}</legend>
      <div class="checks">${g.opts.map(([v,l])=>
        `<label><input type="checkbox" data-axis="${g.axis}" value="${fesc(v)}">${fesc(l)}</label>`).join('')}</div>
    </fieldset>`).join('');
  box.innerHTML = html;
  box.querySelector('.pref-select').addEventListener('change', onChange);
  box.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.addEventListener('change', onChange));
}

// 現在の絞り込み状態から判定関数を作る（都道府県=AND、各枠内=OR、枠間=AND）
function makePredicate(containerId){
  const box = document.getElementById(containerId);
  const prefV = box.querySelector('.pref-select').value;
  const sel = {};
  box.querySelectorAll('input[type=checkbox]:checked').forEach(cb=>{
    (sel[cb.dataset.axis] = sel[cb.dataset.axis] || new Set()).add(cb.value);
  });
  const axes = Object.keys(sel);
  return function(r){
    if(prefV && r.pref!==prefV) return false;
    for(const ax of axes){ if(!sel[ax].has(axisVal(r, ax))) return false; }
    return true;
  };
}

// 絞り込みをすべて解除
function clearFilters(containerId){
  const box = document.getElementById(containerId);
  box.querySelector('.pref-select').value = '';
  box.querySelectorAll('input[type=checkbox]:checked').forEach(cb=>{ cb.checked=false; });
}
