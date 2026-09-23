/* 컴활 2급 필기 CBT 모의고사 - 엔진
 * 문제 은행 두 갈래
 *   1) window.COMHWAL2_PAST  : 실제 기출 회차 (이 저장소의 data/past.js)
 *   2) window.COMHWAL2_DATA  : 개념게임(comhwal2)과 공유하는 단원별 문제
 */
'use strict';

var DATA = window.COMHWAL2_DATA || {};
var PAST = window.COMHWAL2_PAST || null;
var SUBJECTS = [
  { key: 'comp', label: '1과목', name: '컴퓨터 일반' },
  { key: 'excel', label: '2과목', name: '스프레드시트 일반' },
];
var SUBJ_NAME = { comp: '컴퓨터 일반', excel: '스프레드시트 일반' };
var PASS_AVG = 60, FAIL_UNDER = 40;   // 합격 평균 / 과락 기준

var exam = null;   // { qs:[], idx, minutes, deadline, timer, startTime }

/* ---------- 유틸 ---------- */
var $ = function (id) { return document.getElementById(id); };
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function pad2(n) { return (n < 10 ? '0' : '') + n; }

/* ---------- 문제 은행 ---------- */
// 개념게임 단원 문제 → 평평한 배열
function poolOf(key) {
  var s = DATA[key];
  var arr = [];
  if (s && s.units) s.units.forEach(function (u) {
    (u.quiz || []).forEach(function (q) {
      arr.push({ subj: key, subjName: s.name, q: q.q, o: q.o, a: q.a, ex: q.ex, unit: u.name });
    });
  });
  return arr;
}
// 기출 120선 → 평평한 배열
function bestPool(subjKey) {
  if (!PAST || !PAST.best || !PAST.best.items) return [];
  return PAST.best.items
    .filter(function (x) { return !subjKey || x.subj === subjKey; })
    .map(function (x) {
      return { subj: x.subj, subjName: SUBJ_NAME[x.subj], q: x.q, o: x.o, a: x.a, ex: x.ex, unit: x.tag || '기출 120선' };
    });
}
// 모든 기출 회차의 문항
function roundPool(subj) {
  if (!PAST || !PAST.rounds) return [];
  var out = [];
  PAST.rounds.forEach(function (r) {
    (r.qs || []).forEach(function (x) {
      if (!subj || x.subj === subj) out.push({ subj: x.subj, subjName: SUBJ_NAME[x.subj], q: x.q, o: x.o, a: x.a, ex: x.ex, unit: r.name, ver: x.ver });
    });
  });
  return out;
}
function roundById(id) {
  if (!PAST || !PAST.rounds) return null;
  return PAST.rounds.filter(function (r) { return r.id === id; })[0] || null;
}

/* ── 수업용 고정 순서 ──────────────────────────────────────
   ?fix=… 로 들어오면 fixorder.js 가 켜진다. 이때 기출 회차는 기본이 «섞지 않음» —
   시험지 번호가 그대로라 "12번 보세요" 가 통한다. 켜더라도 그날 시드로 우리끼리
   난수를 만들어 쓰므로 학생 전원이 같은 순서를 받는다. */
function fixMode() { return !!(window.FixOrder && window.FixOrder.on); }
function mixRnd(key) {
  if (!fixMode()) return Math.random;
  var h = 2166136261, k = String(key);
  for (var i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = (h * 16777619) >>> 0; }
  var a = ((window.FixOrder.seed >>> 0) ^ h) >>> 0;
  return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffledBy(a, rnd) {
  a = a.slice();
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor((rnd || Math.random)() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
var CIRC4 = ['①', '②', '③', '④'];
var CIRCRE = /[①②③④]/, AGGREG = /모두 (옳|맞|정답|해당)|위 모두|위의 모두|정답이 없|해당 없/;
/* 보기를 섞으면 안 되는 문항 — 문제·보기에 ①~④ 가 적혀 있거나 «위 모두 옳다» 류 */
function optLocked(item) {
  return CIRCRE.test(item.q || '') || item.o.some(function (o) { return CIRCRE.test(o) || AGGREG.test(o); });
}
function makeQ(item, keepOrder, rnd) {
  var lock = keepOrder || optLocked(item);
  var order = item.o.map(function (_, i) { return i; });
  if (!lock) order = shuffledBy(order, rnd);
  var opts = order.map(function (i) { return { t: item.o[i], correct: i === item.a }; });
  var to = []; order.forEach(function (old, now) { to[old] = now; });
  /* 해설이 «③은 알파 버전» 처럼 번호를 짚는 곳이 있어 함께 옮긴다 */
  var ex = item.ex;
  if (!lock) ex = String(item.ex == null ? '' : item.ex)
    .replace(/[①②③④]/g, function (c) { return CIRC4[to[CIRC4.indexOf(c)]]; });
  return {
    subj: item.subj, subjName: item.subjName || SUBJ_NAME[item.subj], unit: item.unit,
    q: item.q, opts: opts, ans: opts.findIndex(function (o) { return o.correct; }),
    ex: ex, sel: null, flag: false, ver: item.ver,
  };
}
/* 2016~2020 기출(Windows 7·엑셀 2010 시절)은 지문을 원문 그대로 두고 작은 표시만 붙인다.
   정답이 Windows 10·엑셀 2021 에서도 같은 문항만 실었다 — 달라지는 문항은 전사할 때 뺐다. */
var VER_LABEL = { win7: '원문: Windows 7 기준', xl2010: '원문: Excel 2010 기준' };
function verTag(q) {
  return (q && VER_LABEL[q.ver]) ? '<div class="vertag">📎 ' + VER_LABEL[q.ver] + ' · 정답은 지금 버전에서도 같아요</div>' : '';
}
function normTxt(t) { return String(t == null ? '' : t).replace(/<[^>]*>/g, '').replace(/[\s'"‘’“”·.,?]/g, ''); }
function dupKey(x) { return normTxt(x.q).slice(0, 40) + '|' + normTxt(x.o[x.a]).slice(0, 15); }
function buildExam(counts, minutes, bestFirst) {
  var qs = [];
  SUBJECTS.forEach(function (s) {
    var want = counts[s.key] || 0;
    // bestFirst면 실제 기출(120선·회차)을 먼저 채우고 모자란 만큼 개념 문제로 보충
    var pool = bestFirst
      ? shuffle(bestPool(s.key).concat(roundPool(s.key))).concat(shuffle(poolOf(s.key)))
      : shuffle(poolOf(s.key).concat(bestPool(s.key)).concat(roundPool(s.key)));
    // 같은 문제가 여러 은행에 겹쳐 들어있을 수 있어 중복 제거.
    // "조건부 서식…옳지 않은 것은?"처럼 지문이 같고 보기만 다른 기출이 있어 정답 보기까지 키에 넣는다.
    // 교재마다 띄어쓰기·보기 순서가 달라 태그·공백을 빼고, 첫 보기 대신 «정답 보기»로 비교한다
    // (예전 키 «지문 앞50자|첫 보기 앞30자»는 겹치는 109쌍 중 30쌍을 놓쳤다).
    var seen = {}, added = 0;
    for (var j = 0; j < pool.length && added < want; j++) {
      var k = dupKey(pool[j]);
      if (seen[k]) continue;
      seen[k] = 1;
      qs.push(makeQ(pool[j]));
      added++;
    }
  });
  return { qs: qs, idx: 0, minutes: minutes, deadline: 0, timer: null, startTime: Date.now() };
}

/* ---------- 누적 오답 (회차를 넘어 쌓임) ---------- */
var WKEY = 'comhwal2_cbt_wrong_v1';
function loadWrong() { try { return JSON.parse(localStorage.getItem(WKEY)) || []; } catch (e) { return []; } }
function saveWrong(a) { try { localStorage.setItem(WKEY, JSON.stringify(a)); } catch (e) { } }
function wkey(subj, qtext) { return subj + '|' + String(qtext).slice(0, 60); }
function allPool(subj) { return poolOf(subj).concat(bestPool(subj)).concat(roundPool(subj)); }
function recordWrongs(qs) {
  var list = loadWrong();
  var map = {}; list.forEach(function (w) { map[wkey(w.subj, w.q)] = w; });
  qs.forEach(function (q) {
    var k = wkey(q.subj, q.q);
    if (q.sel === q.ans) { delete map[k]; }            // 맞히면 목록에서 제거
    else { map[k] = { subj: q.subj, q: String(q.q).slice(0, 60) }; }
  });
  saveWrong(Object.keys(map).map(function (k) { return map[k]; }));
}
function reviewPool() {   // 누적 오답 → 실제 문항으로 복원 (복원 못 하면 자동 정리)
  var out = [], keep = [], pruned = false;
  loadWrong().forEach(function (w) {
    var pool = allPool(w.subj);
    var src = pool.filter(function (x) { return String(x.q).slice(0, 60) === w.q; })[0];
    if (src) { out.push(src); keep.push(w); } else { pruned = true; }
  });
  if (pruned) saveWrong(keep);
  return out;
}
function startReviewExam() {
  var pool = reviewPool();
  if (!pool.length) { alert('복습할 오답이 없어요.'); renderStart(); return; }
  var mins = Math.max(5, Math.ceil(pool.length * 0.75));
  exam = {
    qs: shuffle(pool).map(function (x) { return makeQ(x); }),
    idx: 0, minutes: mins, deadline: Date.now() + mins * 60000,
    timer: null, startTime: Date.now(), isReview: true, title: '오답 다시 풀기',
  };
  enterExam();
}

/* ---------- 시작 화면 ---------- */
var MODES = [
  { nm: '🎲 실전 모의고사(랜덤)', ds: '40문항 · 40분 · 2과목', counts: { comp: 20, excel: 20 }, min: 40, best: true },
  { nm: '🎲 하프 모의고사', ds: '20문항 · 20분 · 2과목', counts: { comp: 10, excel: 10 }, min: 20, best: true },
  { nm: '1과목 컴퓨터 일반만', ds: '20문항 · 20분', counts: { comp: 20 }, min: 20, best: false },
  { nm: '2과목 스프레드시트만', ds: '20문항 · 20분', counts: { excel: 20 }, min: 20, best: false },
];
function makeCard(title, desc, color, onclick) {
  var el = document.createElement('div');
  el.className = 'modecard';
  if (color) el.style.borderColor = color;
  el.innerHTML = '<div><div class="nm">' + title + '</div><div class="ds">' + desc + '</div></div>' +
    '<div style="color:' + (color || 'var(--pri2)') + ';font-weight:800">▶</div>';
  el.onclick = onclick;
  return el;
}
var OPEN_YEARS = {};
function renderStart() {
  hide('loading'); hide('exam'); hide('result'); hide('review'); show('start');
  var mb = $('examMix'), mn = $('examMixNote');
  if (mb && !mb.dataset.set) {
    mb.dataset.set = '1'; mb.checked = !fixMode();
    if (mn) mn.innerHTML = fixMode()
      ? '🎓 <b>수업용 링크</b>로 들어왔습니다. 꺼 두면 기출은 시험지 번호 그대로라 «12번 보세요» 가 그대로 통합니다. 켜더라도 오늘 이 링크로 들어온 학생은 모두 같은 순서를 받습니다.'
      : '기출 회차에 든 문제는 그대로이고 나오는 <b>차례</b>와 <b>보기 차례</b>만 바뀝니다. (랜덤 모의고사는 원래부터 섞여 나옵니다)';
  }
  var box = $('modeList'); box.innerHTML = '';

  // 1) 누적 오답
  var wn = loadWrong().length;
  if (wn) {
    box.appendChild(makeCard('🔁 오답 다시 풀기',
      '회차를 넘어 쌓인 <b style="color:var(--warn)">' + wn + '문항</b> · 맞히면 목록에서 빠져요',
      'var(--warn)', startReviewExam));
  }

  // 2) 실제 기출 회차 — 20회가 넘어 연도별로 접는다 (연 상태는 화면을 다시 그려도 유지)
  if (PAST && PAST.rounds && PAST.rounds.length) {
    var byYear = {};
    PAST.rounds.forEach(function (r) {
      var y = String(r.id).slice(0, 4);
      (byYear[y] = byYear[y] || []).push(r);
    });
    Object.keys(byYear).sort().reverse().forEach(function (y) {
      var list = byYear[y].slice().sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
      var nq = list.reduce(function (t, r) { return t + (r.qs || []).length; }, 0);
      var d = document.createElement('details');
      d.className = 'yeargrp';
      d.open = !!OPEN_YEARS[y];
      d.ontoggle = function () { OPEN_YEARS[y] = d.open; };
      d.innerHTML = '<summary><span class="yn">📄 ' + y + '년 실제 기출</span>' +
        '<span class="yd">' + list.length + '회 · ' + nq + '문항' + (+y <= 2020 ? ' · Windows 7·엑셀 2010 시절' : '') + '</span></summary>';
      var inner = document.createElement('div');
      inner.className = 'opts-mode';
      list.forEach(function (r) {
        inner.appendChild(makeCard(r.name,
          '<b style="color:var(--ok)">실제 기출</b> ' + (r.qs || []).length + '문항 · ' + (r.minutes || 40) + '분',
          'var(--ok)', function () { startPastRound(r.id); }));
      });
      d.appendChild(inner);
      box.appendChild(d);
    });
  }
  // 3) 자주 출제되는 기출 모음
  if (PAST && PAST.best && PAST.best.items && PAST.best.items.length) {
    box.appendChild(makeCard('⭐ ' + PAST.best.name,
      '자주 나오는 기출만 ' + PAST.best.items.length + '문항 · 넉넉한 시간', 'var(--gold)', startBestRun));
  }

  // 4) 랜덤 모의고사
  MODES.forEach(function (m) {
    box.appendChild(makeCard(m.nm, m.ds, null, function () { startExam(m); }));
  });

  // 5) 기출이 아직 안 열렸으면 잠금 칸을 보인다 (개념 모의고사는 위에 이미 열려 있다)
  paintLock();
}

/* ---------- 시험 진행 ---------- */
function enterExam() {
  hide('start'); hide('result'); hide('review'); hide('loading'); show('exam');
  $('totalCnt').textContent = exam.qs.length;
  startTimer();
  renderQ();
}
function startExam(m) {
  exam = buildExam(m.counts, m.min, m.best);
  if (!exam.qs.length) { alert('문제를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'); return; }
  exam.title = m.nm;
  exam.deadline = Date.now() + m.min * 60000;
  enterExam();
}
function mixOn() { var b = $('examMix'); return !!(b && b.checked); }
/* 기출 회차 — 스위치를 끄면 시험지 그대로(문제·보기 순서 원본) */
function startPastRound(id) {
  var r = roundById(id);
  if (!r || !r.qs || !r.qs.length) { alert('해당 회차를 불러오지 못했습니다.'); return; }
  var mins = r.minutes || 40;
  var on = mixOn(), rnd = mixRnd('round:' + id);
  var src = r.qs.map(function (x) { return { subj: x.subj, q: x.q, o: x.o, a: x.a, ex: x.ex, unit: r.name, ver: x.ver }; });
  if (on) src = shuffledBy(src, rnd);
  exam = {
    qs: src.map(function (x) { return makeQ(x, !on, rnd); }),
    idx: 0, minutes: mins, deadline: Date.now() + mins * 60000,
    timer: null, startTime: Date.now(), title: r.name, isPast: true,
  };
  enterExam();
}
function startBestRun() {
  var items = bestPool(null);
  if (!items.length) { alert('기출 모음을 불러오지 못했습니다.'); return; }
  var mins = Math.max(20, items.length);
  var on = mixOn(), rnd = mixRnd('best');
  var src = on ? shuffledBy(items, rnd) : items;
  exam = {
    qs: src.map(function (x) { return makeQ(x, !on, rnd); }),
    idx: 0, minutes: mins, deadline: Date.now() + mins * 60000,
    timer: null, startTime: Date.now(), title: PAST.best.name, isReview: true,
  };
  enterExam();
}
function startTimer() {
  clearInterval(exam.timer);
  tick();
  exam.timer = setInterval(tick, 1000);
}
function tick() {
  var left = Math.max(0, Math.round((exam.deadline - Date.now()) / 1000));
  var mm = Math.floor(left / 60), ss = left % 60;
  var el = $('timer');
  el.textContent = pad2(mm) + ':' + pad2(ss);
  el.classList.toggle('warn', left <= 300);
  if (left <= 0) { clearInterval(exam.timer); doSubmit(true); }
}
function answeredCount() {
  return exam.qs.filter(function (q) { return q.sel !== null; }).length;
}
function renderQ() {
  var q = exam.qs[exam.idx];
  var total = exam.qs.length;
  $('subjTag').textContent = q.subjName;
  $('answeredCnt').textContent = answeredCount();
  var opts = q.opts.map(function (o, i) {
    return '<div class="opt' + (q.sel === i ? ' sel' : '') + '" onclick="pick(' + i + ')">' +
      '<div class="k">' + '①②③④'[i] + '</div><div>' + o.t + '</div></div>';
  }).join('');
  $('qhost').innerHTML =
    '<div class="qcard">' +
      '<div class="qmeta"><div class="no">' + (exam.idx + 1) + ' / ' + total + ' · ' + q.subjName + '</div>' +
        '<button class="flagbtn' + (q.flag ? ' on' : '') + '" onclick="toggleFlag()">🚩 다시 볼 문제</button></div>' +
      verTag(q) +
      '<div class="qtext">' + q.q + '</div>' +
      '<div class="opts">' + opts + '</div>' +
    '</div>';
  $('prevBtn').disabled = exam.idx === 0;
  $('nextBtn').textContent = exam.idx === total - 1 ? '끝 · 제출하기' : '다음 →';
}
function pick(i) {
  exam.qs[exam.idx].sel = i;
  renderQ();
}
function toggleFlag() {
  exam.qs[exam.idx].flag = !exam.qs[exam.idx].flag;
  renderQ();
}
function go(d) {
  if (d > 0 && exam.idx === exam.qs.length - 1) { confirmSubmit(); return; }
  exam.idx = Math.min(exam.qs.length - 1, Math.max(0, exam.idx + d));
  renderQ();
}
function jump(i) { exam.idx = i; closePalette(); renderQ(); }

/* ---------- 팔레트 ---------- */
function openPalette() {
  var total = exam.qs.length;
  var cells = exam.qs.map(function (q, i) {
    var cls = 'pcell' + (q.sel !== null ? ' answered' : '') + (q.flag ? ' flagged' : '') + (i === exam.idx ? ' cur' : '');
    return '<div class="' + cls + '" onclick="jump(' + i + ')">' + (i + 1) + '</div>';
  }).join('');
  var d = document.createElement('div');
  d.className = 'drawer'; d.id = 'paletteDrawer';
  d.onclick = function (e) { if (e.target === d) closePalette(); };
  d.innerHTML = '<div class="panel"><div class="row" style="justify-content:space-between">' +
    '<b>문제 이동 (' + answeredCount() + '/' + total + ' 완료)</b>' +
    '<button class="btn ghost" style="padding:6px 12px" onclick="closePalette()">닫기</button></div>' +
    '<div class="palette">' + cells + '</div>' +
    '<div class="legend"><span><i style="background:var(--pri)"></i>푼 문제</span>' +
    '<span><i style="background:var(--card2);outline:2px solid var(--warn)"></i>다시 볼 문제</span>' +
    '<span><i style="background:var(--card2)"></i>안 푼 문제</span></div>' +
    '<button class="btn green" style="width:100%;margin-top:16px" onclick="closePalette();confirmSubmit()">답안 제출하기</button>' +
    '</div>';
  document.body.appendChild(d);
  document.body.classList.add('dw-open');   /* 떠 있는 위젯 숨기기 */
}
function closePalette() {
  var d = $('paletteDrawer'); if (d) d.remove();
  document.body.classList.remove('dw-open');
}

/* ---------- 제출·채점 ---------- */
function confirmSubmit() {
  var un = exam.qs.length - answeredCount();
  var msg = un > 0 ? ('아직 풀지 않은 문제가 ' + un + '개 있습니다.\n제출하시겠어요?') : '답안을 제출하시겠어요?';
  if (confirm(msg)) doSubmit(false);
}
function grade() {
  var per = {};
  SUBJECTS.forEach(function (s) { per[s.key] = { total: 0, correct: 0, name: s.name }; });
  exam.qs.forEach(function (q) {
    if (!per[q.subj]) per[q.subj] = { total: 0, correct: 0, name: SUBJ_NAME[q.subj] || q.subj };
    per[q.subj].total++;
    if (q.sel === q.ans) per[q.subj].correct++;
  });
  var used = Object.keys(per).filter(function (k) { return per[k].total > 0; });
  var scores = used.map(function (k) {
    var p = per[k];
    return { key: k, name: p.name, correct: p.correct, total: p.total, score: Math.round(p.correct / p.total * 100) };
  });
  var avg = Math.round(scores.reduce(function (a, x) { return a + x.score; }, 0) / scores.length);
  var hasFail = scores.some(function (x) { return x.score < FAIL_UNDER; });
  var pass = !hasFail && avg >= PASS_AVG;
  var totalCorrect = exam.qs.filter(function (q) { return q.sel === q.ans; }).length;
  return { scores: scores, avg: avg, pass: pass, hasFail: hasFail, totalCorrect: totalCorrect, totalQ: exam.qs.length };
}
function doSubmit(auto) {
  clearInterval(exam.timer);
  closePalette();
  exam.result = grade();
  exam.durationSec = Math.round((Date.now() - exam.startTime) / 1000);
  recordWrongs(exam.qs);          // 누적 오답 갱신(맞힌 건 제거, 틀린 건 추가)
  /* 랭킹전 — 필기 CBT 는 실전이므로 RP 2배, 합격하면 보너스 30 */
  exam.rp = hasRank()
    ? CH2Rank.award(exam.result.totalCorrect,
                    exam.result.totalQ - exam.result.totalCorrect,
                    2, (!exam.isReview && exam.result.pass) ? 30 : 0)
    : null;
  showResult(auto);
}

function showResult(auto) {
  hide('exam'); hide('review'); show('result');
  var r = exam.result;
  // 오답 복습·기출모음 회차는 합격/불합격 판정 대신 정답률만 보여줌
  var isRev = !!exam.isReview;
  var verdict = isRev ? (r.totalCorrect + ' / ' + r.totalQ) : (r.pass ? '합격' : '불합격');
  var emoji = isRev ? (r.avg >= 80 ? '🎉' : '💪') : (r.pass ? '🎉' : '💪');
  var ss = r.scores.map(function (x) {
    var failMark = x.score < FAIL_UNDER ? '<div class="flag">과락</div>' : '';
    return '<div class="ss"><div class="nm">' + x.name + '</div>' +
      '<div class="sc' + (x.score < FAIL_UNDER ? ' fail' : '') + '">' + x.score + '</div>' +
      '<div class="nm">' + x.correct + '/' + x.total + '</div>' + failMark + '</div>';
  }).join('');
  var wrongN = r.totalQ - r.totalCorrect;
  var sub = auto ? '<div style="color:var(--no);font-size:13px;margin-bottom:6px">⏰ 시간 종료로 자동 제출됨</div>' : '';
  $('result').innerHTML =
    '<div class="result">' + sub +
      (exam.title ? '<div style="color:var(--tx2);font-size:13px;font-weight:700">' + exam.title + '</div>' : '') +
      '<div style="font-size:48px">' + emoji + '</div>' +
      '<div class="verdict ' + (isRev ? (r.avg >= 60 ? 'pass' : 'fail') : (r.pass ? 'pass' : 'fail')) + '">' + verdict + '</div>' +
      '<div class="totscore">' + (isRev ? '정답률' : '평균') + ' <b style="color:var(--tx)">' + r.avg + '점</b> · 정답 ' + r.totalCorrect + '/' + r.totalQ +
        ' · 소요 ' + Math.floor(exam.durationSec / 60) + '분</div>' +
      (isRev ? '<div style="color:var(--tx2);font-size:13px;margin:6px 0">맞힌 문제는 오답 목록에서 빠졌어요 · 남은 오답 <b style="color:var(--warn)">' + loadWrong().length + '문항</b></div>' : '') +
      '<div class="subjscores">' + ss + '</div>' +
      (!isRev && r.hasFail ? '<div style="color:var(--no);font-size:13px;margin-bottom:8px">한 과목 이상 40점 미만(과락)입니다.</div>' : '') +
      rankBanner(exam.rp) +
      submitBtnHtml() +
      '<div class="row" style="justify-content:center;margin-top:8px;flex-wrap:wrap">' +
        '<button class="btn sec" onclick="openReview()">📝 오답노트 (' + wrongN + ')</button>' +
        '<button class="btn" onclick="renderStart()">다시 풀기</button>' +
      '</div>' +
    '</div>';
}

/* ---------- 랭킹전(2급 공용 계급) ---------- */
function hasRank() { return !!window.CH2Rank; }
function rankBanner(r) { return (hasRank() && r) ? CH2Rank.bannerHtml(r) : ''; }
function rankTier() { return hasRank() ? CH2Rank.tierOf(CH2Rank.rp()).name : undefined; }

/* ---------- 결과 제출(collector) ---------- */
function submitEnabled() {
  return !!(window.ResultCollector && ResultCollector.config && ResultCollector.config.endpoint);
}
function submitBtnHtml() {
  
  return '<div class="row" style="justify-content:center;margin:6px 0 12px">' +
    '<button class="btn green" id="cbtSubmit" onclick="submitResult()">📤 선생님께 결과 제출</button></div>';
}
/* 틀린 문제를 "무엇을 틀렸는지"로 (규약 §1 ②) — "7번 하이퍼링크→인덱스" */
function rcShort(t, len) {
  t = String(t == null ? '' : t).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > len ? t.slice(0, len - 1) + '\u2026' : t;
}
function rcWrongList() {
  var qs = (typeof exam !== 'undefined' && exam.qs) ? exam.qs : [];
  var out = [];
  qs.forEach(function (q, i) {
    if (q.sel === q.ans) return;
    var ch = q.choices || q.opts || [];
    var txt = function (o) { return (o && typeof o === 'object') ? (o.t != null ? o.t : o.text) : o; };
    var mine = (q.sel != null && ch[q.sel] != null) ? rcShort(txt(ch[q.sel]), 16) : '\ubb34\uc751\ub2f5';
    var ans = (ch[q.ans] != null) ? rcShort(txt(ch[q.ans]), 16) : '?';
    out.push((q.no != null ? q.no : (i + 1)) + '\ubc88 ' + mine + '\u2192' + ans);
  });
  return out;
}
function submitGuide() {
  alert(['이 링크로는 제출이 되지 않아요.', '',
    '선생님이 나눠 준 제출용 링크(주소 뒤에 ?rc=... 가 붙은 링크)로',
    '들어와야 반·번호를 입력하고 결과를 보낼 수 있습니다.', '',
    '연습은 지금 이대로 계속 하셔도 됩니다.'].join(String.fromCharCode(10)));
}
function submitResult() {
  if (!submitEnabled()) { submitGuide(); return; }
  var r = exam.result;
  // 시트 탭은 하나로 — 회차는 mode 로 (규약 §1 ①)
  ResultCollector.config.tool = '컴활 2급 필기CBT';
  ResultCollector.open({
    tier: rankTier(),               /* 생기부 — 현재 계급 */
    score: r.avg,
    correct: r.totalCorrect,
    total: r.totalQ,
    durationSec: exam.durationSec,
    labels: { score: '평균점수', correct: '맞힘', total: '문항수' },
    mode: '컴활 2급 필기 — ' + (exam.title || '모의고사') +
          (exam.isReview ? ' (복습)' : (r.pass ? ' (합격)' : ' (불합격)')),
    extra: ['필기 모의고사 응시'],
    wrong: rcWrongList(),
  });
}

/* ---------- 오답노트 ---------- */
function openReview() {
  var wrong = exam.qs.filter(function (q) { return q.sel !== q.ans; });
  hide('result'); show('review');
  $('reviewTitle').textContent = '오답노트 · ' + wrong.length + '문항';
  if (!wrong.length) {
    $('reviewHost').innerHTML = '<div class="qcard" style="text-align:center">🏆 틀린 문제가 없어요! 완벽합니다.</div>';
    return;
  }
  $('reviewHost').innerHTML = wrong.map(function (q) {
    var opts = q.opts.map(function (o, i) {
      var cls = 'opt';
      if (i === q.ans) cls += ' correct';
      else if (i === q.sel) cls += ' wrong';
      return '<div class="' + cls + '"><div class="k">' + '①②③④'[i] + '</div><div>' + o.t +
        (i === q.ans ? ' ✔' : (i === q.sel ? ' ✖(내 답)' : '')) + '</div></div>';
    }).join('');
    return '<div class="reviewitem"><div class="no" style="font-size:12px;color:var(--tx2);font-weight:700;margin-bottom:6px">' +
      q.subjName + ' · ' + (q.unit || '') + '</div>' + verTag(q) +
      '<div class="qtext" style="font-size:16px">' + q.q + '</div>' +
      '<div class="opts">' + opts + '</div>' +
      '<div class="exp"><b>해설</b><br>' + q.ex + '</div></div>';
  }).join('');
}

/* ---------- 초기화 ---------- */
function refreshGlobals() {
  DATA = window.COMHWAL2_DATA || DATA || {};
  PAST = window.COMHWAL2_PAST || PAST || null;
}
function dataReady() {
  var conceptOk = DATA.comp && DATA.comp.units && DATA.excel && DATA.excel.units;
  var pastOk = PAST && ((PAST.rounds && PAST.rounds.length) || (PAST.best && PAST.best.items && PAST.best.items.length));
  return !!(conceptOk || pastOk);
}
// 배포된 comhwal2에서 못 받아온 경우(로컬 개발 등) 상대 경로로 재시도
function retryLocal(done) {
  var left = 2;
  ['comp', 'excel'].forEach(function (k) {
    var s = document.createElement('script');
    s.src = '../comhwal2/data/' + k + '.js';
    s.onload = s.onerror = function () { if (!--left) done(); };
    document.head.appendChild(s);
  });
}
function init() {
  refreshGlobals();
  if (dataReady()) { renderStart(); return; }
  retryLocal(function () {
    refreshGlobals();
    if (dataReady()) renderStart();
    else $('loading').textContent = '문제 은행을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.';
  });
}
window.addEventListener('load', init);

/* =========================================================
   실제 기출 잠금 해제
   ─────────────────────────────────────────────────────────
   기출 회차·120선은 기출공략집을 옮긴 것이라 그대로 공개할 수 없다.
   정적 호스팅에서는 화면 비밀번호가 보호가 되지 않으므로(파일 주소를 직접 치면
   그대로 받아진다) 문항 파일 자체를 AES-GCM 으로 암호화해 past.enc 하나로 두고,
   여기서 WebCrypto 로 실제 복호화한다. 암호가 틀리면 복호화가 실패한다.

   개념 문항(comhwal2 저장소의 자작 문항)은 잠그지 않는다 —
   코드가 없어도 랜덤·과목별 모의고사는 그대로 풀 수 있다.

   저장 키가 두 개인 이유 —
     LOCK_KEY   이 도구에서 성공한 암호
     SHARED_KEY 도구 전체 공용. 도구가 모두 같은 주소에 있어 localStorage 를
                공유하므로 어디서든 한 번 열면 나머지도 그냥 열린다.
   실패해도 공용 키는 지우지 않는다 — 여기서 안 맞는 암호가 다른 도구에서는
   맞을 수 있어, 지우면 남의 기억까지 날리게 된다.
   ========================================================= */
var LOCK_KEY = 'ch2cbt_pw_v1', SHARED_KEY = 'hong_pw_v1';
var LOCK_INFO = null;

function lb64(x) { return Uint8Array.from(atob(x), function (c) { return c.charCodeAt(0); }); }
function lIso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function lMonday(d) {
  var x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x;
}

/* 기출이 열렸는지에 따라 잠금 칸을 보이거나 감춘다 */
function paintLock() {
  var box = $('pastLock'); if (!box) return;
  var ok = PAST && ((PAST.rounds && PAST.rounds.length) || (PAST.best && PAST.best.items && PAST.best.items.length));
  box.classList.toggle('hidden', !!ok);
}

/* 감싼 키들을 훑어 맞는 것을 찾는다. salt 를 공유하므로 PBKDF2 는 딱 1회 돈다. */
function lFindKey(kek, keys) {
  var i = 0;
  function next() {
    if (i >= keys.length) return Promise.reject(new Error('BADPW'));
    var k = keys[i++];
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: lb64(k.iv) }, kek, lb64(k.blob))
      .then(function (p) { return JSON.parse(new TextDecoder().decode(p)); }, next);
  }
  return next();
}
/* 교사용으로 열면 그 주 학생 코드를 계산해 보여 준다.
   마스터 시크릿은 교사용으로 감싼 안쪽에만 있어 학생 코드로는 계산할 수 없다. */
function lWeekCode(msB64, mon) {
  return crypto.subtle.importKey('raw', lb64(msB64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then(function (k) {
      return crypto.subtle.sign('HMAC', k,
        new TextEncoder().encode(((LOCK_INFO && LOCK_INFO.prefix) || 'HONGW|') + lIso(mon)));
    })
    .then(function (buf) {
      var s = new Uint8Array(buf);
      var n = ((s[0] << 24) >>> 0) + (s[1] << 16) + (s[2] << 8) + s[3];
      return String(n % 90000000 + 10000000);
    });
}

function unlockPast(pw, quiet) {
  var msg = $('lockMsg');
  function say(t, cls) {
    if (quiet && cls !== 'bad') return;
    if (!msg) return;
    msg.innerHTML = t; msg.className = 'lk-m' + (cls ? ' ' + cls : '');
  }
  say('여는 중…');
  return fetch('past.enc', { cache: 'no-store' }).then(function (r) { return r.json(); })
    .then(function (blob) {
      return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey'])
        .then(function (base) {
          return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: lb64(blob.kdf.salt), iterations: blob.kdf.iter, hash: 'SHA-256' },
            base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
        })
        .then(function (kek) { return lFindKey(kek, blob.keys); })
        .then(function (info) {
          var today = lIso(new Date()), e;
          if (info.nbf && today < info.nbf) { e = new Error('NOTYET'); e.when = info.nbf; throw e; }
          if (info.exp && today >= info.exp) { e = new Error('EXPIRED'); e.when = info.exp; throw e; }
          LOCK_INFO = info;
          return crypto.subtle.importKey('raw', lb64(info.ck), { name: 'AES-GCM' }, false, ['decrypt']);
        })
        .then(function (ck) {
          var u = lb64(blob.data);
          return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, ck, u.slice(12));
        })
        .then(function (gz) {
          var ds = new DecompressionStream('gzip');
          return new Response(new Blob([gz]).stream().pipeThrough(ds)).text();
        })
        .then(function (txt) {
          var payload = JSON.parse(txt);
          /* 표(PAST.T)는 빌드할 때 이미 HTML 로 바뀌어 들어 있다 — 런타임엔 필요 없다 */
          window.COMHWAL2_PAST = { best: payload.best, rounds: payload.rounds };
          refreshGlobals();
          try {
            localStorage.setItem(LOCK_KEY, pw);
            if (!LOCK_INFO.exp) localStorage.setItem(SHARED_KEY, pw);   // 만료되는 코드는 공용에 넣지 않는다
          } catch (e) {}
          var n = (blob.n || 0);
          if (!quiet && LOCK_INFO.role === 'teacher' && LOCK_INFO.ms) {
            return lWeekCode(LOCK_INFO.ms, lMonday(new Date())).then(function (c) {
              say('✅ 기출 ' + n + '문항이 열렸어요!<br><b style="color:var(--gold)">이번 주 학생 코드 — '
                + c.slice(0, 4) + ' ' + c.slice(4) + '</b>', 'ok');
              return true;
            });
          }
          say('✅ 기출 ' + n + '문항이 열렸어요!', 'ok');
          return true;
        });
    })
    .then(function () {
      if ($('lockPw')) $('lockPw').value = '';
      renderStart();
      return true;
    })
    .catch(function (e) {
      var m = e && e.message;
      if (m === 'EXPIRED') say('사용 기간이 끝난 코드예요(' + e.when + '까지). 선생님께 이번 주 코드를 받으세요.', 'bad');
      else if (m === 'NOTYET') say('아직 쓸 수 없는 코드예요. ' + e.when + '부터 쓸 수 있어요.', 'bad');
      else say('코드가 맞지 않아요.', 'bad');
      try { localStorage.removeItem(LOCK_KEY); } catch (_) {}   // 공용 키는 건드리지 않는다
      return false;
    });
}

/* 문항 수 표시 + 이전에 열었으면 조용히 자동 해제 */
(function () {
  fetch('past.enc', { cache: 'no-store' }).then(function (r) { return r.json(); })
    .then(function (b) { if ($('lockN')) $('lockN').textContent = (b.n || 0) + '문항'; })
    .catch(function () { if ($('lockN')) $('lockN').textContent = '(준비 중)'; });

  var go = function () {
    var btn = $('lockGo'), inp = $('lockPw');
    if (!btn || !inp) return;
    btn.onclick = function () {
      var pw = inp.value.replace(/\s+/g, '');
      if (!pw) { inp.focus(); return; }
      unlockPast(pw, false);
    };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();

  try {
    var a = localStorage.getItem(LOCK_KEY), b = localStorage.getItem(SHARED_KEY), t = [];
    if (a) t.push(a);
    if (b && b !== a) t.push(b);
    (function next(i) {
      if (i >= t.length) return;
      unlockPast(t[i], true).then(function (ok) { if (!ok) next(i + 1); });
    })(0);
  } catch (e) {}
})();
