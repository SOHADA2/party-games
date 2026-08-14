/* 초성 퀴즈 화면 스냅샷용 — 원하는 단계까지 진행시켜 놓는다.
 *
 *   ?demo=1&v=<단계>   단계: setup · run · reveal · done
 *
 * ⚠️ 이 게임은 화면을 **다 같이** 본다(.priv 없음). 그래서 태블릿 폭으로도 찍어볼 것:
 *   node tools/shot.mjs "/_demo.html?demo=1&v=run" -w 1024 -h 768
 */
if (new URLSearchParams(location.search).has('demo')){
  const q = new URLSearchParams(location.search);
  S.pid = 'h1'; S.code = '0000'; S.isHost = true; S.online = true;
  S.room = emptyRoom(); S.room.host = 'h1';
  S.room.players.h1 = { name:'나', joinedAt:1, seen:Date.now(), host:true };
  addBots(5);
  S.gameId = 'chosung'; act('tool-start', {});

  const v = q.get('v') || 'setup';
  if (v !== 'setup'){
    const P = playing().map(([pid]) => pid);
    S.play.n = Number(q.get('n') || 8);
    if (q.get('cat')) S.play.cats = [q.get('cat')];   // 최악 케이스(속담) 확인용
    act('cho-start', {});
    // 한 문제는 맞히고 넘겨서 「직전 문제」 줄까지 나오게 한다
    act('cho-hit', { pid:P[2] });
    if (v === 'reveal') act('cho-pass', {});
    if (v === 'done'){
      act('cho-hit', { pid:P[1] });
      act('cho-pass', {}); act('cho-skip', {});
      act('cho-done', {});
    }
  }
  setTimeout(() => window.scrollTo(0, Number(q.get('sc') || 0)), 380);
  render(true);
}
