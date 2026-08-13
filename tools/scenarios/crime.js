/* 크라임씬 화면 스냅샷용 시나리오 — 화면 하나를 원하는 단계까지 진행시켜 놓는다.
 *
 *   ?demo=1&v=<단계>   단계: setup brief intro search read grill vote ended role culprit myturn
 *   &show=1            역할 화면의 홀드 박스를 펼친 채로
 *   &sc=800            스크롤 위치
 *
 * 진행자 화면은 v=brief..ended, 참가자 폰은 v=role(무고) / culprit(범인) / myturn(내 차례).
 */
if (new URLSearchParams(location.search).has('demo')){
  const q = new URLSearchParams(location.search);
  S.pid = 'h1'; S.code = '0000'; S.isHost = true; S.online = true;
  S.room = emptyRoom(); S.room.host = 'h1';
  S.room.players.h1 = { name:'나', joinedAt:1, seen:Date.now(), host:true };
  addBots(6);                                   // 총 7명
  S.gameId = 'mafia'; act('tool-start', {});
  S.play.sit = q.get('sit') || '왕궁 연회';

  const v = q.get('v') || 'setup';
  const AFTER_INTRO = ['search','read','grill','vote','ended','role','culprit'];

  if (v !== 'setup'){
    act('mf-deal', {});
    const M = S.room.mafia;

    if (v !== 'brief') act('cr-intro', {});

    if (AFTER_INTRO.includes(v)){
      for (let i = 0; i < M.order.length; i++) act('cr-intronext', {});
      act('cr-search', {});
      if (v !== 'search') act('cr-place', { i:'1' });                       // 낭독 중
      if (v !== 'search' && v !== 'read'){
        act('cr-readdone', {});
        act('cr-place', { i:'3' }); act('cr-readdone', {});                 // 증거 2곳 확보
      }
    }
    if (v === 'grill' || v === 'role' || v === 'culprit'){
      act('cr-grill', {}); act('cr-grillnext', {});
    }
    if (v === 'vote' || v === 'ended'){
      act('cr-final', {}); act('cr-vote', {});
      act('cr-vadj', { pid:M.culprit, v:'1' });
      act('cr-vadj', { pid:M.culprit, v:'1' });
      act('cr-vadj', { pid:M.order.find(x => x !== M.culprit), v:'1' });
    }
    if (v === 'ended') act('cr-reveal', {});

    // 참가자 폰으로 시점을 옮긴다
    if (v === 'role' || v === 'culprit'){
      S.pid = v === 'culprit' ? M.culprit : M.order.find(x => x !== M.culprit);
      S.isHost = false; S.view = 'role';
    }
    if (v === 'myturn'){ S.pid = M.order[0]; S.isHost = false; S.view = 'role'; }
  }

  setTimeout(() => {
    if (q.has('show')) document.getElementById('role-hold')?.classList.add('show');
    window.scrollTo(0, Number(q.get('sc') || 0));
  }, 380);
  render(true);
}
