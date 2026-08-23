/* 📐 가로 화면 점검 — 태블릿은 거의 항상 가로로 세워둔다.
 *
 *   node tools/demo.mjs tools/scenarios/landscape.js _lz.html
 *   node tools/shot.mjs --dom "/_lz.html?demo=1" -w 1024 -h 768
 *   node tools/shot.mjs --dom "/_lz.html?demo=1" -w 1366 -h 1024
 *
 * ⚠️ **크기를 안 주면 의미가 없다** — --dom 은 -w/-h 를 줘야 그 크기로 띄운다.
 * ⚠️ 기준은 「몇 명이 보는가」다(디자인 시스템의 그 표와 같다):
 *      다 같이 보는 화면(진행 도구·대기실·순위·리더보드) = **스크롤 0** 이어야 한다.
 *        뒤에서 보는 사람은 스크롤을 못 한다.
 *      혼자 훑는 화면(게임 목록·상세) = 조금 넘쳐도 된다. 진행자가 손에 쥐고 넘긴다.
 */
if (new URLSearchParams(location.search).has('demo')){
  const L = []; let bad = 0;
  const say = (...a) => L.push(a.join(' '));
  const ck  = (label, cond) => { if (!cond) bad++; L.push(label + ': ' + (cond ? 'OK' : '✕FAIL')); return cond; };
  try{
    window.confirm = () => true;
    S.pid='h1'; S.code='0000'; S.isHost=true; S.online=true;
    S.room = emptyRoom(); S.room.host='h1';
    S.room.players.h1 = { name:'나', joinedAt:1, seen:Date.now(), host:true };
    addBots(5); makeTeams(2); confetti = () => {};
    S.room.scores = {
      s1:{ gameId:'yut', mode:'team', order:[0,1], weight:1, assign:{...S.room.teams.assign}, at:1 },
      s2:{ gameId:'quiz', mode:'solo', order:players().map(([p])=>p), weight:1, at:2 },
    };

    const W = window.innerWidth, H = window.innerHeight;
    const land = W >= 860 && W / H >= 1.25;
    say('화면', W + 'x' + H, land ? '(가로)' : '(가로 아님 — 검사 건너뜀)');
    if (!land){ say('  1024x768 같은 가로 크기로 다시 돌리세요'); }
    else {
      const over = () => Math.max(0, document.documentElement.scrollHeight - H);
      const show = v => { S.view = v; render(true); };
      /* ⚠️ 10px 은 main 아래 여백이라 실제로는 스크롤이 아니다 */
      const fits = (label, tol) => { const o = over();
        ck(label + (o ? ` (넘침 ${o}px)` : ''), o <= (tol ?? 12)); };

      show('lobby'); fits('★★대기실이 한 화면에 들어간다');

      /* 진행 도구 — 「다 같이 보는」 화면이다. 여기가 넘치면 게임이 안 굴러간다. */
      for (const g of GAMES){
        S.gameId = g.id; S.room.yut = null; go('game');
        try { act('tool-start', {}); } catch(e){}
        if (!S.play) continue;
        const nm = g.name.split(' / ')[0];
        try {
          if (g.tool === 'yut'){ act('yut-start', {}); }
          if (g.tool === 'cho'){ S.play.n = 3; act('cho-start', {}); }
          if (g.tool === 'quiz'){ S.play.n = 3; act('quiz-start', {}); act('quiz-show', {}); }
          if (g.tool === 'song'){ S.play.n = 3; act('song-start', {}); }
          if (g.tool === 'deck'){ act('pl-start', {}); act('pl-begin', {}); }
          if (g.tool === 'noise'){ act('no-brief', {}); }
          if (g.tool === 'smile'){ act('sm-sul', { pid:players()[1][0] }); }
        } catch(e){}
        show('play'); fits('★★진행 화면: ' + nm);
        S.play = null;
      }

      S.draft = { mode:'solo', order:players().map(([p])=>p), gameId:'quiz', weight:1 };
      show('score'); fits('★순위 입력이 한 화면에 들어간다');
      show('board'); fits('★리더보드가 한 화면에 들어간다', 90);

      /* 혼자 훑는 화면 — 조금 넘쳐도 되지만 **가로인데 세로처럼 쌓이면** 안 된다 */
      show('games');
      ck('  게임 목록이 2열로 펴진다',
        getComputedStyle(document.querySelector('.glist')).gridTemplateColumns.split(' ').length === 2);
      S.gameId = 'body'; show('game');
      ck('  게임 상세가 2단으로 나뉜다', (() => {
        const t = document.querySelector('.two');
        return !!t && t.children.length === 2
          && t.children[1].getBoundingClientRect().left > t.children[0].getBoundingClientRect().right - 4;
      })());
      ck('★가로 스크롤이 생기지 않는다',
        document.documentElement.scrollWidth <= W + 1);
      clearBots();
    }
  } catch(err){
    bad++; L.push('ERR ' + (err && err.message ? err.message : String(err)));
  }
  L.push(bad ? `‼ 실패 ${bad}건` : '✅ 전부 통과');
  document.title = L.join('\n');
  document.body.innerHTML = '<pre style="white-space:pre-wrap;font:12px/1.6 monospace;padding:14px">'
    + L.join('\n').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])) + '</pre>';
}
