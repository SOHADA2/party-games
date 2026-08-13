/* 「안 봤어도 들키지마」 전 구간 자동 점검 — 결과를 <title> 에 적는다(헤드리스로 읽어가려고).
 *
 *   node tools/demo.mjs tools/scenarios/watch-e2e.js _w.html
 *   node tools/shot.mjs --dom "/_w.html?demo=1"
 *
 * ⚠️ 이 게임의 생명선은 두 가지다. 검사를 줄이지 말 것.
 *    ① 정답이 홀드 박스 밖으로 새면 안 된다 — 새는 순간 게임이 성립하지 않는다.
 *    ② 토론 화면에 퀴즈·정답이 뜨면 안 된다 — 전원이 같이 보는 화면이다.
 *    그리고 정산은 손으로 하지 않는다(코인판을 수동 ± 로 둔 게 이 게임이 죽은 이유였다).
 *
 * ⚠️ 합격 판정은 **ck() 가 센 실패 개수**로 한다. 예전처럼 출력 텍스트에서
 *    /문제|false/ 를 찾으면 라벨에 그 단어가 들어가는 순간 항상 실패로 뜬다.
 */
if (new URLSearchParams(location.search).has('demo')){
  const L = []; let bad = 0;
  const say = (...a) => L.push(a.join(' '));
  const ck  = (label, cond) => { if (!cond) bad++; L.push(label + ': ' + (cond ? 'OK' : '✕FAIL')); return cond; };
  try{
    window.confirm = () => true;
    S.pid = 'h1'; S.code = '0000'; S.isHost = true; S.online = true;
    S.room = emptyRoom(); S.room.host = 'h1';
    S.room.players.h1 = { name:'나', joinedAt:1, seen:Date.now(), host:true };
    addBots(5);                                   // 총 6명

    /* ── 0) 덱 정합성 ── */
    const cats = Object.keys(WATCH_DECKS);
    const works = cats.flatMap(c => WATCH_DECKS[c]);
    const qs = works.flatMap(w => w.q);
    const titles = works.map(w => w.t), qtexts = qs.map(x => x.q);
    say('덱', cats.length + '카테고리', works.length + '작품', qs.length + '퀴즈');
    ck('작품 중복 없음', titles.length === new Set(titles).size);
    ck('퀴즈문 중복 없음', qtexts.length === new Set(qtexts).size);
    ck('퀴즈·정답 누락 없음', qs.every(x => x.q && x.a));
    ck('작품마다 퀴즈 1개 이상', works.every(w => w.q.length));

    /* ── 1) 시작 ── */
    S.gameId = 'watch'; act('tool-start', {});
    ck('진입 phase=setup', S.play.phase === 'setup');
    ck('기본 카테고리 전체 선택', S.play.cats.length === cats.length);
    act('wa-cat', { v:cats[0] });  const off = S.play.cats.length;
    act('wa-cat', { v:cats[0] });
    ck('카테고리 토글', off === cats.length - 1 && S.play.cats.length === cats.length);
    act('wa-sec', { v:'180' });
    act('wa-start', {});
    const P = S.play, order = [...P.order];
    ck('시작 phase=ready', P.phase === 'ready');
    ck('출제자 순번 = 참가자 전원', order.slice().sort().join() === players().map(([x]) => x).sort().join());

    const host = () => { S.view = 'play'; render(true); return document.getElementById('view').innerHTML; };
    /* 홀드 박스 안(.secret)을 걷어낸 나머지 = 옆사람이 흘끗 봐도 보이는 영역 */
    const outside = () => { host();
      const c = document.getElementById('view').cloneNode(true);
      c.querySelectorAll('.holdbox .secret').forEach(e => e.remove());
      return c.textContent; };

    /* ── 2) 라운드 1 — 카드 · 누출 · 토론 ── */
    ck('ready 화면에 출제자 이름', host().includes(pname(order[0])));
    act('wa-see', {});
    const c1 = { ...P.cur };
    ck('카드 phase', P.phase === 'card');
    ck('카드에 작품·퀴즈 표시', host().includes(c1.t) && host().includes(c1.q));
    ck('★정답이 홀드 밖으로 안 샘', !outside().includes(c1.a.slice(0, 14)));

    act('wa-reroll', {});
    ck('리롤로 다른 퀴즈', P.cur.t !== c1.t || P.cur.q !== c1.q);
    const card = { ...P.cur };

    act('wa-talk', {});
    const tk = host();
    ck('토론 phase + 타이머 동작', P.phase === 'talk' && P.running);
    ck('토론 화면에 작품 공개', tk.includes(card.t));
    ck('★토론 화면에 퀴즈문 안 뜸', !tk.includes(card.q));
    ck('★토론 화면에 정답 안 뜸', !outside().includes(card.a.slice(0, 14)));

    /* ── 3) 지목 — 출제자는 대상이 아니고, 자기 자신도 못 고른다 ── */
    act('wa-vote', {});
    ck('지목 phase + 타이머 정지', P.phase === 'vote' && !P.running);
    host();
    const t0 = [...document.querySelectorAll('[data-act="wa-pick"]')].map(b => b.dataset.pid);
    ck('★지목 대상에서 출제자 제외', !t0.includes(order[0]));
    ck('★지목 대상 수 = 전체−출제자−본인', t0.length === order.length - 1);   // 1번 지목자 = 출제자 본인

    /* 전원이 order[1] 을 지목 (order[1] 본인만 order[2] 를) */
    order.forEach((voter, i) => act('wa-pick', { pid: i === 1 ? order[2] : order[1] }));
    ck('전원 지목 완료', Object.keys(P.votes).length === order.length);
    ck('최다 득표 = order[1] (5표)', watchTop().join() === order[1] && watchTally()[order[1]] === 5);

    act('wa-vback', {});
    ck('지목 되돌리기', Object.keys(P.votes).length === order.length - 1 && P.vi === order.length - 1);
    act('wa-pick', { pid: order[1] });

    /* ── 4) 오답 정산 — 지목한 사람들이 +1 ── */
    act('wa-answer', {});
    ck('답변 phase + 최다 1명', P.phase === 'answer' && P.picked.length === 1);
    ck('★답변 화면 정답이 홀드 밖으로 안 샘', !outside().includes(card.a.slice(0, 14)));
    act('wa-judge', { pid:P.picked[0], v:'0' });
    act('wa-settle', {});
    const votersFor1 = order.filter(v => P.votes[v] === order[1]);
    ck('오답 → 지목자 ' + votersFor1.length + '명 각 +1', votersFor1.every(v => P.pts[v] === 1));
    ck('★지목만 받아선 0점', !P.pts[order[1]]);
    ck('★헛다리 짚은 사람 0점', !P.pts[order[1]] && P.votes[order[1]] === order[2]);

    /* ── 5) 라운드 2 — 정답 +2 · 동점 ── */
    act('wa-next', {});
    ck('다음 라운드 = 2번째 출제자', P.phase === 'ready' && P.turn === 1 && P.order[1] === order[1]);
    act('wa-see', {});
    ck('★같은 작품 다시 안 나옴', P.cur.t !== card.t);
    act('wa-talk', {}); act('wa-vote', {});
    /* order[2] 2표, order[3] 2표 → 동점 */
    const plan = [order[2], order[2], order[3], order[3], order[4], order[4]];
    order.forEach((voter, i) => {
      let t = plan[i];
      if (t === voter) t = order.find(x => x !== voter && x !== order[1]);
      act('wa-pick', { pid:t });
    });
    act('wa-answer', {});
    ck('★동점이면 최다 득표자 전원이 답한다 (' + P.picked.map(x => pname(x)).join(',') + ')', P.picked.length === 2);
    const before = { ...P.pts };
    act('wa-judge', { pid:P.picked[0], v:'1' });
    act('wa-judge', { pid:P.picked[1], v:'0' });
    act('wa-settle', {});
    ck('정답 → 답한 사람 +2', (P.pts[P.picked[0]]||0) - (before[P.picked[0]]||0) === 2);
    ck('동점 중 오답 → 그를 지목한 사람만 +1',
      order.filter(v => P.votes[v] === P.picked[1]).every(v => (P.pts[v]||0) - (before[v]||0) >= 1));
    ck('동점 중 정답자를 지목한 사람은 0점',
      order.filter(v => P.votes[v] === P.picked[0] && P.votes[v] !== P.picked[1])
           .every(v => (P.pts[v]||0) - (before[v]||0) === 0));
    ck('결과 화면에 누적 점수', host().includes('누적 점수'));

    /* ── 6) 끝까지 돌리기 ── */
    let guard = 0;
    while (P.phase !== 'done' && guard++ < 300){   // 한 라운드에 12스텝 남짓 — 넉넉히
      if (P.phase === 'result') act('wa-next', {});
      else if (P.phase === 'ready') act('wa-see', {});
      else if (P.phase === 'card') act('wa-talk', {});
      else if (P.phase === 'talk') act('wa-vote', {});
      else if (P.phase === 'vote'){
        if (P.vi >= P.order.length) act('wa-answer', {});
        else { const v = P.order[P.vi];
          act('wa-pick', { pid: P.order.find(x => x !== v && x !== P.order[P.turn]) }); }
      }
      else if (P.phase === 'answer'){ P.picked.forEach(x => act('wa-judge', { pid:x, v:'1' })); act('wa-settle', {}); }
      else break;
    }
    const usedT = P.log.map(x => x.t);
    ck('전 라운드 완주 (' + P.log.length + '/' + order.length + ')', P.phase === 'done' && P.log.length === order.length);
    ck('★출제자를 전원이 한 번씩', P.log.map(x => x.sul).sort().join() === order.slice().sort().join());
    ck('★한 게임에 같은 작품 두 번 안 나옴', usedT.length === new Set(usedT).size);

    /* ── 7) 순위 반영 ── */
    const fin = host();
    ck('종료 화면 1위·라운드 기록', fin.includes('최종 1위') && fin.includes('라운드 기록'));
    const pts = { ...P.pts };
    act('wa-save', {});
    const dord = S.draft.order;
    ck('순위 화면으로 넘어감', S.view === 'score' && dord.length === order.length);
    ck('★점수 내림차순 정렬', dord.every((x, i) => i === 0 || (pts[dord[i-1]]||0) >= (pts[x]||0)));
    ck('도구 정리 (play 비움)', S.play === null);
    say('최종 점수:', players().map(([pid,pl]) => pl.name + ' ' + (pts[pid]||0)).join(' · '));

    /* ── 8) 3명 미만 차단 ── */
    S.view = 'game'; clearBots();
    S.gameId = 'watch'; act('tool-start', {});
    act('wa-start', {});
    ck('★3명 미만이면 시작 차단', S.play.phase === 'setup');

    L.push(bad ? `‼ 실패 ${bad}건` : '✅ 전부 통과');
    document.title = L.join(' ## ');
  }catch(e){ document.title = 'ERR ' + e.message + ' @@ ' + String(e.stack || '').slice(0, 200); }
}
