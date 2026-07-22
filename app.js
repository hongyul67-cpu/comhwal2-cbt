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
      if (!subj || x.subj === subj) out.push({ subj: x.subj, subjName: SUBJ_NAME[x.subj], q: x.q, o: x.o, a: x.a, ex: x.ex, unit: r.name });
    });
  });
  return out;
}
function roundById(id) {
  if (!PAST || !PAST.rounds) return null;
  return PAST.rounds.filter(function (r) { return r.id === id; })[0] || null;
}

function makeQ(item, keepOrder) {
  var opts = item.o.map(function (t, i) { return { t: t, correct: i === item.a }; });
  if (!keepOrder) opts = shuffle(opts);
  return {
    subj: item.subj, subjName: item.subjName || SUBJ_NAME[item.subj], unit: item.unit,
    q: item.q, opts: opts, ans: opts.findIndex(function (o) { return o.correct; }),
    ex: item.ex, sel: null, flag: false,
  };
}
function buildExam(counts, minutes, bestFirst) {
  var qs = [];
  SUBJECTS.forEach(function (s) {
    var want = counts[s.key] || 0;
    // bestFirst면 실제 기출(120선·회차)을 먼저 채우고 모자란 만큼 개념 문제로 보충
    var pool = bestFirst
      ? shuffle(bestPool(s.key).concat(roundPool(s.key))).concat(shuffle(poolOf(s.key)))
      : shuffle(poolOf(s.key).concat(bestPool(s.key)).concat(roundPool(s.key)));
    // 같은 문제가 두 은행에 겹쳐 들어있을 수 있어 지문 앞부분으로 중복 제거
    var seen = {}, added = 0;
    for (var j = 0; j < pool.length && added < want; j++) {
      var k = String(pool[j].q).slice(0, 50);
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
function renderStart() {
  hide('loading'); hide('exam'); hide('result'); hide('review'); show('start');
  var box = $('modeList'); box.innerHTML = '';

  // 1) 누적 오답
  var wn = loadWrong().length;
  if (wn) {
    box.appendChild(makeCard('🔁 오답 다시 풀기',
      '회차를 넘어 쌓인 <b style="color:var(--warn)">' + wn + '문항</b> · 맞히면 목록에서 빠져요',
      'var(--warn)', startReviewExam));
  }

  // 2) 실제 기출 회차
  if (PAST && PAST.rounds && PAST.rounds.length) {
    PAST.rounds.forEach(function (r) {
      box.appendChild(makeCard('📄 ' + r.name,
        '<b style="color:var(--ok)">실제 기출</b> ' + (r.qs || []).length + '문항 · ' + (r.minutes || 40) + '분',
        'var(--ok)', function () { startPastRound(r.id); }));
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
function startPastRound(id) {
  var r = roundById(id);
  if (!r || !r.qs || !r.qs.length) { alert('해당 회차를 불러오지 못했습니다.'); return; }
  var mins = r.minutes || 40;
  // 실제 기출은 보기 순서를 시험지 그대로 유지
  exam = {
    qs: r.qs.map(function (x) { return makeQ({ subj: x.subj, q: x.q, o: x.o, a: x.a, ex: x.ex, unit: r.name }, true); }),
    idx: 0, minutes: mins, deadline: Date.now() + mins * 60000,
    timer: null, startTime: Date.now(), title: r.name, isPast: true,
  };
  enterExam();
}
function startBestRun() {
  var items = bestPool(null);
  if (!items.length) { alert('기출 모음을 불러오지 못했습니다.'); return; }
  var mins = Math.max(20, items.length);
  exam = {
    qs: items.map(function (x) { return makeQ(x, true); }),
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
}
function closePalette() { var d = $('paletteDrawer'); if (d) d.remove(); }

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
      submitBtnHtml() +
      '<div class="row" style="justify-content:center;margin-top:8px;flex-wrap:wrap">' +
        '<button class="btn sec" onclick="openReview()">📝 오답노트 (' + wrongN + ')</button>' +
        '<button class="btn" onclick="renderStart()">다시 풀기</button>' +
      '</div>' +
    '</div>';
}

/* ---------- 결과 제출(collector) ---------- */
function submitEnabled() {
  return !!(window.ResultCollector && ResultCollector.config && ResultCollector.config.endpoint);
}
function submitBtnHtml() {
  if (!submitEnabled()) return '';
  return '<div class="row" style="justify-content:center;margin:6px 0 12px">' +
    '<button class="btn green" id="cbtSubmit" onclick="submitResult()">📤 선생님께 결과 제출</button></div>';
}
function submitResult() {
  if (!submitEnabled()) return;
  var r = exam.result;
  ResultCollector.config.tool = '컴활2급 필기CBT · ' + (exam.title || '모의고사');
  ResultCollector.open({
    score: r.avg,
    correct: r.totalCorrect,
    total: r.totalQ,
    durationSec: exam.durationSec,
    labels: { score: '평균점수', correct: '맞힘', total: '문항수', wrong: '합격여부' },
    wrong: exam.isReview ? '복습' : (r.pass ? '합격' : '불합격'),
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
      q.subjName + ' · ' + (q.unit || '') + '</div>' +
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
