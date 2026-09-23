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
  // 120선은 주제(tag)마다 3문항씩 — 주제를 개념게임 단원 id(dan)에 짝지어 «단원별 기출»에 함께 쓴다.
  // 회차 문항은 파일에 dan 을 직접 적어 둔다.
  var TAG_DAN = {
    'Windows의 특징': 'win', '바로 가기 키': 'win', '바로 가기 아이콘': 'win', '휴지통': 'file',
    '[설정] 창': 'winsys', '네트워크 명령어': 'net', '연산 속도 단위': 'sys', '컴퓨터의 분류': 'sys',
    '자료의 단위': 'sys', '문자 표현 코드': 'sys', '제어 장치': 'sys', '연산 장치': 'sys',
    '주기억 장치': 'hw', '기타 기억 장치': 'hw', '소프트웨어의 구분': 'sw', '웹 프로그래밍 언어': 'sw',
    'IPv6 주소': 'net', '그래픽 표현 방식': 'multi', '그래픽 관련 용어': 'multi', '네트워크 접속 장비': 'net',
    '데이터 입력 방법': 'basic', '각종 데이터 입력': 'basic', '메모와 윗주': 'basic', '찾기/바꾸기': 'data',
    '사용자 지정 표시 형식': 'format', '조건부 서식': 'format', '수식의 오류값': 'formula',
    '수학/통계 함수': 'func', '논리/문자열 함수': 'func', '찾기/참조 함수': 'func', 'D(데이터베이스) 함수': 'func',
    '정렬': 'data', '필터': 'data', '부분합': 'analysis', '피벗 테이블': 'analysis', '목표값 찾기': 'analysis',
    '시나리오': 'analysis', '페이지 설정': 'print', '차트': 'analysis', '매크로': 'print'
  };
  PAST.addBest = function (items) {
    items.forEach(function (x) { if (!x.dan && TAG_DAN[x.tag]) x.dan = TAG_DAN[x.tag]; });
    PAST.best.items = PAST.best.items.concat(items);
  };

  window.COMHWAL2_PAST = PAST;
})();
