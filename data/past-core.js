/* 컴퓨터활용능력 2급 필기 - 실제 기출 문제 은행 (공통 뼈대)
 *
 *   window.COMHWAL2_PAST = {
 *     best:   { name, items:[{subj,q,o,a,ex,tag}] }   자주 출제되는 기출 모음
 *     rounds: [{ id, name, minutes, qs:[{no,subj,q,o,a,ex}] }]   회차별 실전 기출
 *   }
 *
 * 회차 파일(r2023-1.js 등)은 이 파일 뒤에 로드되어 PAST.add(...) / PAST.addBest(...)를 호출합니다.
 * 문제·보기·정답은 기출공략집 원본 전사, 해설은 학습용으로 다듬었습니다.
 */
(function () {
  var PAST = {
    best: { name: '자주 출제되는 기출문제', items: [] },
    rounds: [],
  };

  // 문제 안에 넣는 워크시트/조건 표 HTML 생성기
  PAST.T = function (rows, opt) {
    opt = opt || {};
    var s = '<table class="qtbl">';
    rows.forEach(function (r, i) {
      s += '<tr>';
      r.forEach(function (c) {
        var tag = (i === 0 && opt.head) ? 'th' : 'td';
        s += '<' + tag + '>' + (c === null || c === undefined ? '' : c) + '</' + tag + '>';
      });
      s += '</tr>';
    });
    return s + '</table>';
  };

  PAST.add = function (round) { PAST.rounds.push(round); };
  PAST.addBest = function (items) { PAST.best.items = PAST.best.items.concat(items); };

  window.COMHWAL2_PAST = PAST;
})();
