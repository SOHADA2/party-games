/* 상식 퀴즈 화면 스냅샷용 — 원하는 단계까지 진행시켜 놓는다.
 *
 *   ?demo=1&v=<단계>   단계: setup · run · reveal · done
 *   ?cat=<범위>        한 범위만 켜서 본다(길이 최악 케이스 확인용)
 *   ?q=long            가장 긴 문제(37자)를 강제로 띄운다 — 넘침 확인
 *   ?sec=<초>          생각 시간. **스냅샷 기본은 0(끄기)** — 안 그러면 헤드리스 가상시간이
 *                      5초를 훌쩍 넘겨서 run 을 찍으려 해도 정답이 이미 공개돼 있다.
 *
 * ⚠️ 이 게임은 화면을 **다 같이** 본다(.priv 없음). 그래서 태블릿 폭으로도 찍어볼 것:
 *   node tools/shot.mjs "/_demo.html?demo=1&v=run" -w 1024 -h 768
 * ⚠️ run 단계에는 정답이 화면에 없어야 한다 — 스샷으로도 눈으로 확인할 것.
 */
if (new URLSearchParams(location.search).has('demo')){
  const q = new URLSearchParams(location.search);
  S.pid = 'h1'; S.code = '0000'; S.isHost = true; S.online = true;
  S.room = emptyRoom(); S.room.host = 'h1';
  S.room.players.h1 = { name:'나', joinedAt:1, seen:Date.now(), host:true };
  addBots(5);
  S.gameId = 'quiz'; act('tool-start', {});

  const v = q.get('v') || 'setup';
  if (v !== 'setup'){
    const P = playing().map(([pid]) => pid);
    S.play.n = Number(q.get('n') || 8);
    S.play.sec = q.get('sec') != null ? Number(q.get('sec')) : 0;
    if (q.get('cat')) S.play.cats = [q.get('cat')];
    act('quiz-start', {});
    // 한 문제는 맞히고 넘겨서 「직전」 줄까지 나오게 한다
    act('quiz-show', {}); act('quiz-hit', { pid:P[2] });
    // 가장 긴 문제로 넘침을 확인하고 싶을 때
    if (q.get('q') === 'long'){
      const all = Object.entries(QUIZ_DECKS)
        .flatMap(([c, d]) => d.qs.map(([w, a]) => ({ w, a, c })));
      S.play.cur = all.reduce((m, x) => x.w.length > m.w.length ? x : m, all[0]);
    }
    if (v === 'reveal' || v === 'done') act('quiz-show', {});
    if (v === 'done'){
      act('quiz-hit', { pid:P[1] });
      act('quiz-show', {}); act('quiz-none', {});
      act('quiz-done', {});
    }
  }
  setTimeout(() => window.scrollTo(0, Number(q.get('sc') || 0)), 380);
  render(true);
}
