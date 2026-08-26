/* 한 단어 릴레이 화면 스냅샷용 — 원하는 단계까지 진행시켜 놓는다.
 *
 *   ?demo=1&v=<단계>   단계: setup · ready · run · turnEnd · done
 *   ?long=1            가장 긴 제시어를 강제로 띄운다 — 넘침 확인
 *
 * ⚠️ 이 게임은 **한 팀 안에서** 화면을 보는 사람이 갈린다(설명하는 둘만 본다).
 *    그래서 제시어 카드는 `.priv` 다 — 큰 화면에서도 커지면 안 된다.
 *    반대로 역할·타이머·점수는 다 같이 보므로 커져야 한다. 태블릿 폭으로도 찍을 것:
 *      node tools/shot.mjs "/_demo.html?demo=1&v=run" -w 1024 -h 768
 */
if (new URLSearchParams(location.search).has('demo')){
  const q = new URLSearchParams(location.search);
  S.pid = 'h1'; S.code = '0000'; S.isHost = true; S.online = true;
  S.room = emptyRoom(); S.room.host = 'h1';
  S.room.players.h1 = { name:'나', joinedAt:1, seen:Date.now(), host:true };
  addBots(5);
  act('teams', { n:'2' });
  S.gameId = 'relay'; act('tool-start', {});

  const v = q.get('v') || 'setup';
  if (v !== 'setup'){
    S.play.sec = 60;
    act('pl-start', {});
    if (v !== 'ready'){
      act('pl-begin', {});
      if (q.get('long')){
        const pool = Object.entries(WORD_DECKS)
          .filter(([, d]) => (d.use || ['body','cho']).includes('relay'))
          .flatMap(([c, d]) => d.words.map(w => ({ w, c })));
        S.play.cur = pool.reduce((m, x) => x.w.length > m.w.length ? x : m, pool[0]);
      }
      if (v === 'turnEnd' || v === 'done'){
        act('pl-mark', { v:'1' }); act('pl-mark', { v:'0' }); act('pl-mark', { v:'1' });
        act('pl-stop', {});
      }
      if (v === 'done'){
        act('pl-next', {}); act('pl-begin', {});
        act('pl-mark', { v:'1' }); act('pl-stop', {}); act('pl-next', {});
      }
    }
  }
  setTimeout(() => window.scrollTo(0, Number(q.get('sc') || 0)), 380);
  render(true);
}
