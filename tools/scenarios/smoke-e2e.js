/* 남은 게임 5종 + 방/점수 백본 스모크 점검 — 결과를 <title> 에 적는다(헤드리스로 읽어가려고).
 *
 *   node tools/demo.mjs tools/scenarios/smoke-e2e.js _s.html
 *   node tools/shot.mjs --dom "/_s.html?demo=1"
 *
 * ⚠️ 게임을 지우거나 추가한 뒤에는 **반드시 이걸 먼저 돌린다.**
 *    index.html 이 한 파일이라 한 게임을 들어내면 공용 배선(vPlay 디스패치 · renderSig ·
 *    toScore · pl-quit · 리더보드)이 같이 끊기기 쉽다. v0.13.0 에서 두 게임을 들어낼 때
 *    실제로 이 배선들이 문제였다.
 *
 * ⚠️ 합격 판정은 ck() 가 센 실패 개수로 한다. 출력 텍스트에서 /문제|false/ 를 찾는 방식은
 *    라벨에 그 단어가 들어가는 순간 항상 실패로 뜬다.
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
    addBots(5);                                     // 총 6명
    const P = players().map(([pid]) => pid);
    const view = v => { S.view = v; render(true); return document.getElementById('view').innerHTML; };

    /* ── 0) 레지스트리 ── */
    const ids = GAMES.map(g => g.id);
    say('게임', GAMES.length + '종:', ids.join(','));
    ck('삭제한 게임이 안 남아 있음', !ids.includes('mafia') && !ids.includes('watch'));
    ck('id 중복 없음', ids.length === new Set(ids).size);
    ck('전 게임 필수 필드', GAMES.every(g => g.id && g.name && g.emoji && g.color && g.mode && g.rules));
    ck('전 게임 진행 도구 보유', GAMES.every(g => g.tool));
    ck('미완 규칙 경고(todo) 없음', GAMES.every(g => !g.todo));

    /* ── 1) 목록·상세 화면이 전 게임에서 안 죽는지 ── */
    ck('게임 목록 렌더', view('games').includes(GAMES[0].name));
    let detailOk = true;
    for (const g of GAMES){ S.gameId = g.id; if (!view('game').includes('규칙')) detailOk = false; }
    ck('전 게임 상세 렌더', detailOk);

    /* ── 2) 몸으로 말해요 (deck · 팀전) ── */
    S.room.teams = { count:2, assign:Object.fromEntries(P.map((p,i) => [p, i % 2])) };
    S.gameId = 'body'; act('tool-start', {});
    ck('deck 진입', S.play?.kind === 'deck');
    act('pl-start', {}); act('pl-begin', {});
    const d0 = S.play;
    ck('제시어 나옴', !!d0.cur?.w);
    act('pl-mark', { v:'1' }); act('pl-mark', { v:'0' }); act('pl-mark', { v:'1' });
    ck('마킹 집계 (정답 2)', (d0.hits || []).filter(x => x.ok).length === 2);
    act('pl-stop', {});
    ck('턴 종료', d0.phase === 'turnEnd');
    act('pl-next', {}); act('pl-begin', {}); act('pl-mark', { v:'1' }); act('pl-stop', {}); act('pl-next', {});
    ck('두 팀 다 돌면 done', d0.phase === 'done');
    act('pl-save', {});
    ck('팀 순위로 넘어감', S.view === 'score' && S.draft?.mode === 'team' && S.draft.order.length === 2);
    ck('순위 화면 렌더', view('score').includes('순위'));
    act('score-save', {});
    ck('점수 저장', Object.keys(S.room.scores).length === 1);

    /* ── 3) 멕썸노이즈 · 컵 레이스 (race-* 공유) ── */
    for (const gid of ['noise','cup']){
      S.gameId = gid; go('game'); act('tool-start', {});
      const p = S.play;
      ck(gid + ' 진입', p?.kind === gid);
      if (gid === 'noise'){ act('no-brief', {}); ck('미션 문장 생성', !!p.sen && p.sen.length > 4); }
      for (let i = 0; i < P.length; i++){
        act('race-run', {}); p.elapsed = 1 + i;      // 스톱워치 값을 직접 박아 결정적으로
        act('race-end', { v: i === 1 ? '0' : '1' }); // 두 번째 사람만 실패
        act('race-next', {});
      }
      ck(gid + ' 전원 기록 후 done', p.phase === 'done');
      ck(gid + ' 실패는 null', p.rec[P[1]] === null);
      act('race-save', {});
      ck(gid + ' ★실패자가 꼴찌', S.draft.order[S.draft.order.length-1] === P[1]);
      ck(gid + ' ★빠른 순 정렬', S.draft.order[0] === P[0]);
      act('score-save', {});
    }

    /* ── 4) 연기 대결 (act) ── */
    S.gameId = 'act'; go('game'); act('tool-start', {});
    const a = S.play;
    ck('act 진입 + 카드', a?.kind === 'act' && !!a.card?.l && !!a.card.e);
    const c0 = JSON.stringify(a.card);
    act('ac-reroll', {});
    ck('카드 리롤', JSON.stringify(a.card) !== c0 || ACT_LINES.length === 1);
    for (let i = 0; i < P.length; i++) act('ac-next', {});
    ck('전원 연기 후 done', a.phase === 'done');
    act('ac-score', {});
    ck('심사용 빈 순위 화면', S.view === 'score' && S.play === null);
    act('score-cancel', {});

    /* ── 5) 스마일~! (smile) — 판정 3분기 ── */
    S.gameId = 'smile'; go('game'); act('tool-start', {});
    const m = S.play;
    ck('smile 진입', m?.kind === 'smile');
    act('sm-sul', { pid:P[0] });
    ck('술래 지정 + 대상 5명', m.sul === P[0] && m.pool.length === P.length - 1);
    for (let i = 0; i < 10; i++) act('sm-shot', {});
    ck('사진 10장 소진 → 판정', m.shots === 0 && m.phase === 'judge');
    act('sm-apply', {});                                     // 0명 걸림 → 같은 술래 재도전
    ck('0명 → 술래 유지', m.sul === P[0] && m.phase === 'run');
    act('sm-judge', {}); act('sm-sel', { pid:P[1] }); act('sm-sel', { pid:P[2] }); act('sm-apply', {});
    ck('다수 → 걸린 사람들끼리 재진행', m.sul === P[0] && m.pool.length === 2);
    act('sm-judge', {}); act('sm-sel', { pid:P[1] }); act('sm-apply', {});
    ck('1명 → 술래 교대', m.sul === P[1]);
    ck('라운드 로그 3건', m.log.length === 3);
    act('sm-done', {}); act('sm-score', {});
    ck('smile 순위 화면', S.view === 'score' && S.play === null);
    act('score-cancel', {});

    /* ── 6) 술래 뽑기(중복 방지 로테이션) ── */
    /* ⚠️ S._lastPick 은 {gameId: pid} 맵이다(통째로 읽으면 안 된다).
       그리고 act('pick') 은 rollReveal 을 await 하는 async 다 — 누가 뽑혔는지는
       동기적으로 쌓이는 rotation 배열로 확인한다. */
    S.gameId = 'noise'; go('game');
    if (S.room.rotation) delete S.room.rotation.noise;
    for (let i = 0; i < P.length; i++) act('pick', {});
    const rot = S.room.rotation.noise || [];
    ck('★전원 한 번씩 술래 (중복 없이)',
      rot.length === P.length && rot.slice().sort().join() === P.slice().sort().join());
    act('pick', {});
    ck('전원 소진되면 리셋', (S.room.rotation.noise || []).length === 1);

    /* ── 7) 리더보드 — 지워진 게임의 옛 기록이 섞여도 안 죽는다 ── */
    S.room.scores.zz_old = { gameId:'mafia', mode:'solo', order:[P[0],P[1]], weight:2, assign:{}, at:1 };
    const pts = calcPoints();
    ck('★삭제된 게임 기록도 점수에 반영', pts[P[0]] > 0 && Object.keys(pts).length === P.length);
    const bd = view('board');
    ck('★리더보드가 안 죽음', bd.includes('종합') || bd.includes('점'));
    ck('★알 수 없는 게임은 id로 표시', bd.includes('mafia'));
    ck('gcVars 기본색 폴백', gcVars(undefined).startsWith('--gc:#8B87A6'));
    delete S.room.scores.zz_old;

    /* ── 8) ★ 사회자(관전) 기기 — 태블릿을 공용 화면으로 세워둘 때 ──
       가장 위험한 부분이다: 관전 기기가 「선수」로 새면 팀·술래·순위가 통째로 어긋난다. */
    S.gameId='noise'; go('game');
    const before = playing().length;
    S.pid = P[0];                                        // 나(호스트) 기기를 사회자로
    act('spec-toggle', {});
    ck('★관전 켜면 선수에서 빠진다', playing().length === before - 1);
    ck('방 목록에는 남아 있다', players().length === before);
    ck('★사회자는 점수 계산에서 빠진다', !(P[0] in calcPoints()));
    /* ⚠️ calcPoints 만 보면 부족하다 — vBoard 는 players() 로 행을 만들 수도 있어서
       0점짜리 사회자 줄이 순위표에 남는다. 렌더 결과의 줄 수로 직접 센다. */
    const lbRows = () => { S.view='board'; render(true);
      return document.querySelectorAll('#view .lb-r, #view .pod').length; };
    ck('★사회자는 순위표에 줄이 안 생긴다 (' + lbRows() + '/' + (before-1) + ')', lbRows() === before - 1);

    S.room.teams = { count:2, assign:{} }; act('teams', { n:'2' });
    ck('★팀 편성에서 제외', S.room.teams.assign[P[0]] == null
      && Object.keys(S.room.teams.assign).length === before - 1);

    /* ⚠️ 호스트가 아닌 사람이 관전으로 바꾸면 teams.assign 을 스스로 못 지운다(권위 필드).
       그래서 「보여줄 때」도 걸러야 한다 — 안 그러면 팀 박스에 유령 팀원이 남는다. */
    S.room.teams.assign[P[0]] = 0;                       // 옛 배정이 남아 있는 상황을 만든다
    S.view='lobby'; render(true);
    const tm = [...document.querySelectorAll('#view .tm')].map(e=>e.textContent).join(' ');
    ck('★팀 박스에 관전 기기가 안 보인다', !tm.includes(pname(P[0])));
    ck('  팀 인원 합계가 선수 수와 같다',
      [...document.querySelectorAll('#view .tm .chip')].reduce((n,e)=>n+(parseInt(e.textContent)||0),0) === before - 1);
    delete S.room.teams.assign[P[0]];

    /* ⚠️ 사회자를 뺀 **선수 수(before-1)** 만큼만 뽑는다. 한 번 더 뽑으면 풀이 비어
       rotation 이 리셋되어(= [pick] 한 개) 검사가 헛돈다. */
    if (S.room.rotation) delete S.room.rotation.noise;
    for (let i = 0; i < before - 1; i++) act('pick', {});
    const rot2 = S.room.rotation.noise || [];
    ck('★술래 뽑기에서 제외', !rot2.includes(P[0]));
    ck('★선수 전원만 한 바퀴 (' + rot2.length + '/' + (before-1) + ')', rot2.length === before - 1);

    act('tool-start', {});
    ck('★도구 순번에서 제외', !S.play.order.includes(P[0]) && S.play.order.length === before - 1);
    act('pl-quit', {});

    S.gameId='smile'; go('game'); act('tool-start', {});
    act('sm-sul', { pid:P[1] });
    ck('★스마일 대상 풀에서 제외', !S.play.pool.includes(P[0]));
    act('pl-quit', {});

    S.gameId='act'; go('game'); act('tool-start', {});
    for (let i = 0; i < before; i++) act('ac-next', {});
    act('ac-score', {});
    S.view='score'; render(true);
    ck('★순위 입력 후보에서 제외', !document.getElementById('view').innerHTML.includes('data-pid="'+P[0]+'"'));
    act('score-cancel', {});

    /* ★ 사회자 기기가 있으면 body 의 「사회자 뽑기」가 사라져야 한다 —
       안 그러면 선수 중 한 명이 또 사회자로 빠져 이 기능의 의미가 없어진다. */
    S.gameId='body'; S.view='game'; render(true);
    const gv = document.getElementById('view').innerHTML;
    ck('★사회자 기기가 있으면 사회자 뽑기 숨김', !gv.includes('사회자 뽑기'));
    ck('  대신 사회자 기기를 안내한다', gv.includes('기기가 사회자예요'));
    S.room.players[P[0]].spec = false;
    S.view='game'; render(true);
    ck('사회자 기기가 없으면 뽑기가 다시 뜬다',
      document.getElementById('view').innerHTML.includes('사회자 뽑기'));
    S.room.players[P[0]].spec = true;

    S.gameId='noise'; go('game');
    act('spec-toggle', {});                              // 되돌리기
    ck('관전 해제하면 선수로 복귀', playing().length === before);
    ck('해제하면 리더보드에 다시 뜬다', P[0] in calcPoints());

    /* 마지막 한 명은 관전으로 못 바꾼다(선수가 0명이 되면 아무 게임도 못 한다) */
    const others = P.slice(1);
    others.forEach(pid => { S.room.players[pid].spec = true; });
    ck('★선수가 1명 남으면 관전 전환 차단',
      (act('spec-toggle', {}), !isSpec(S.room.players[P[0]])));
    others.forEach(pid => { delete S.room.players[pid].spec; });

    /* ── 9) 정리 ── */
    ck('타이머 정리', S.play === null || !S.play._t);
    ck('봇 정리', (clearBots() > 0) && players().length === 1);

    L.push(bad ? `‼ 실패 ${bad}건` : '✅ 전부 통과');
    document.title = L.join(' ## ');
  }catch(e){ document.title = 'ERR ' + e.message + ' @@ ' + String(e.stack || '').slice(0, 200); }
}
