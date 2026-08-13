/* 「안 봤어도 들키지마」 화면 스냅샷용 시나리오 — 화면 하나를 원하는 단계까지 진행시켜 놓는다.
 *
 *   ?demo=1&v=<단계>   단계: rules setup ready card talk vote tally answer result done
 *   &show=1            카드/답변 화면의 정답 홀드 박스를 펼친 채로
 *   &sc=800            스크롤 위치
 *
 * 전 구간이 진행자 폰 하나짜리 화면이다(참가자 폰에는 이 게임 전용 화면이 없다).
 */
if (new URLSearchParams(location.search).has('demo')){
  const q = new URLSearchParams(location.search);
  S.pid = 'h1'; S.code = '0000'; S.isHost = true; S.online = true;
  S.room = emptyRoom(); S.room.host = 'h1';
  S.room.players.h1 = { name:'나', joinedAt:1, seen:Date.now(), host:true };
  addBots(5);                                   // 총 6명
  S.gameId = 'watch'; act('tool-start', {});

  const v = q.get('v') || 'setup';
  const AFTER_CARD = ['talk','vote','tally','answer','result','done'];

  if (v === 'rules'){ S.play = null; S.view = 'game'; }      // 게임 상세(규칙 전문)
  else if (v !== 'setup'){
    act('wa-start', {});
    const P = S.play, order = P.order;

    if (v !== 'ready') act('wa-see', {});
    if (AFTER_CARD.includes(v)){
      act('wa-talk', {});
      act('wa-toggle', {});                                   // 타이머는 멈춰두고 찍는다
      P.left = Math.round(P.sec * 0.45);
    }
    if (v !== 'talk' && AFTER_CARD.includes(v)){
      act('wa-vote', {});
      if (v !== 'vote')                                       // v=vote 는 첫 지목자 입력 화면
        order.forEach((voter, i) => act('wa-pick', { pid: i === 1 ? order[2] : order[1] }));
    }
    if (['answer','result','done'].includes(v)){
      act('wa-answer', {});
      if (v !== 'answer'){
        act('wa-judge', { pid:P.picked[0], v:'0' });
        act('wa-settle', {});
      }
    }
    if (v === 'done'){
      let guard = 0;
      while (P.phase !== 'done' && guard++ < 300){
        if (P.phase === 'result') act('wa-next', {});
        else if (P.phase === 'ready') act('wa-see', {});
        else if (P.phase === 'card') act('wa-talk', {});
        else if (P.phase === 'talk') act('wa-vote', {});
        else if (P.phase === 'vote'){
          if (P.vi >= P.order.length) act('wa-answer', {});
          else { const w = P.order[P.vi];
            act('wa-pick', { pid: P.order.find(x => x !== w && x !== P.order[P.turn]) }); }
        }
        else if (P.phase === 'answer'){
          P.picked.forEach((x, i) => act('wa-judge', { pid:x, v: i ? '0' : '1' }));
          act('wa-settle', {});
        }
        else break;
      }
    }
  }

  setTimeout(() => {
    if (q.has('show')) document.getElementById('role-hold')?.classList.add('show');
    window.scrollTo(0, Number(q.get('sc') || 0));
  }, 380);
  render(true);
}
