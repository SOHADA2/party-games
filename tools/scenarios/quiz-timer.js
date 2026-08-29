/* 상식 퀴즈 생각 시간 — **시계를 실제로 흘려보고** 본다.
 * smoke-e2e 는 quizAutoShow() 를 직접 불러서 「그 함수가 맞게 도는지」만 본다.
 * 여기서는 아무것도 안 누르고 기다렸을 때 **정말 5초 뒤에 정답이 나오는지**를 본다.
 *
 *   node tools/demo.mjs tools/scenarios/quiz-timer.js _t.html
 *   node tools/shot.mjs --dom "/_t.html?demo=1"
 *
 * ⚠️ 헤드리스 가상시간 예산이 20초다 — 기다리는 시간을 다 더해 그 안에 들어와야 한다.
 *    넘기면 「시나리오가 실행되지 않았습니다」로 잡힌다(합격 표시를 못 찍으므로).
 */
if (new URLSearchParams(location.search).has('demo')){
  const L = []; let bad = 0;
  const ck = (l, c) => { if (!c) bad++; L.push(l + ': ' + (c ? 'OK' : '✕FAIL')); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  (async () => {
   try{
    S.pid = 'h1'; S.code = '0000'; S.isHost = true; S.online = true;
    S.room = emptyRoom(); S.room.host = 'h1';
    S.room.players.h1 = { name:'나', joinedAt:1, seen:Date.now(), host:true };
    addBots(3);
    S.gameId = 'quiz'; go('game'); act('tool-start', {});
    S.play.n = 5; act('quiz-start', {});
    ck('시작하면 run', S.play.phase === 'run');
    const w0 = S.play.cur.w;

    await wait(2000);
    ck('★2초 뒤에는 아직 정답이 안 나온다', S.play.phase === 'run');
    ck('  남은 시간이 줄어든다', S.play.left < 5 && S.play.left > 2);
    ck('  화면 숫자도 같이 줄어든다',
      (document.getElementById('t-sec')?.textContent || '') === Math.ceil(S.play.left) + '초');

    await wait(3600);
    ck('★★5초가 지나면 저절로 정답이 나온다', S.play.phase === 'reveal');
    ck('  같은 문제 그대로다', S.play.cur.w === w0);
    ck('  화면에 정답이 떠 있다', document.getElementById('view').innerHTML.includes(S.play.cur.a));
    ck('★타이머는 멈춰 있다', !S.play._t);

    /* ⚠️ 정답이 뜬 뒤에는 **저절로 넘어가면 안 된다** — 누가 맞혔는지 사람이 골라야 한다 */
    await wait(2000);
    ck('★★정답이 뜬 뒤에는 저절로 안 넘어간다', S.play.phase === 'reveal' && S.play.log.length === 0);

    /* 「끄기」면 시간이 지나도 그대로 */
    act('quiz-hit', { pid:'h1' });
    act('quiz-sec', { v:'0' });
    await wait(7000);
    ck('★★끄면 시간이 지나도 정답이 안 나온다', S.play.phase === 'run');

    L.push(bad ? `‼ 실패 ${bad}건` : '✅ 전부 통과');
   }catch(e){ L.push('ERR ' + e.message); }
   document.title = L.join(' ## ');
  })();
}
