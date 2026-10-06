/* 게임 6종 + 방/점수 백본 스모크 점검 — 결과를 <title> 에 적는다(헤드리스로 읽어가려고).
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
    window.confirm = () => { throw new Error('confirm() 을 쓰면 안 된다 — 앱 안 경고창(S.ask)으로 물어야 한다'); };
    /* 되돌릴 수 없는 액션은 이제 경고창을 띄운다 → 「예」까지 눌러야 실제로 실행된다 */
    const quit = () => { act('pl-quit', {}); if (S.ask) act('ask-yes', {}); };
    S.pid = 'h1'; S.code = '0000'; S.isHost = true; S.online = true;
    S.room = emptyRoom(); S.room.host = 'h1';
    S.room.players.h1 = { name:'나', joinedAt:1, seen:Date.now(), host:true };
    addBots(5);                                     // 총 6명
    const P = players().map(([pid]) => pid);
    const view = v => { S.view = v; render(true); return document.getElementById('view').innerHTML; };

    /* ── 0) 레지스트리 ── */
    const ids = GAMES.map(g => g.id);
    say('게임', GAMES.length + '종:', ids.join(','));
    /* 지운 게임이 되살아나지 않게 — 되살릴 땐 git 이력에서 데이터만 꺼내 쓴다 */
    ck('삭제한 게임이 안 남아 있음',
      ['mafia','watch','noise','smile','song','yut'].every(x => !ids.includes(x)));
    ck('  남은 6종이 맞다', ids.join(',') === 'chosung,quiz,relay,body,act,cup');
    ck('id 중복 없음', ids.length === new Set(ids).size);
    ck('전 게임 필수 필드', GAMES.every(g => g.id && g.name && g.emoji && g.color && g.mode && g.rules));
    ck('전 게임 진행 도구 보유', GAMES.every(g => g.tool));
    ck('미완 규칙 경고(todo) 없음', GAMES.every(g => !g.todo));
    /* ★ 설명 구조 — 하나라도 비면 상세 화면이 휑하게 뜬다 */
    ck('★전 게임에 한 줄 요약·준비물·인원·시간',
      GAMES.every(g => g.line && g.prep && g.minP > 0 && g.mins));
    ck('★전 게임에 진행 단계(3개 이상)와 승패 한 줄',
      GAMES.every(g => Array.isArray(g.how) && g.how.length >= 3 && g.win));
    ck('  한 줄 요약이 실제로 짧다(45자 이내)', GAMES.every(g => g.line.length <= 45));
    ck('  진행 단계도 한 줄씩(45자 이내)',
      GAMES.every(g => g.how.every(x => x.length <= 45)));

    /* ── 1) 목록·상세 화면이 전 게임에서 안 죽는지 ── */
    ck('게임 목록 렌더', view('games').includes(GAMES[0].name));
    let detailOk = true, structOk = true;
    for (const g of GAMES){
      S.gameId = g.id; const v = view('game');
      if (!v.includes('규칙')) detailOk = false;
      // 구조화된 설명이 실제로 화면에 나오는지 — 필드만 있고 안 그리면 소용없다
      if (!v.includes('이렇게 진행합니다') || !v.includes(g.line) || !v.includes(g.win)
          || !v.includes(g.minP + '명 이상')) structOk = false;
    }
    ck('전 게임 상세 렌더', detailOk);
    ck('★상세 화면이 구조화된 설명을 그린다', structOk);
    ck('  자세한 규칙은 접혀 있다', view('game').includes('<details'));

    /* minP 일원화 — 화면 표시와 실제 시작 조건이 같은 값이어야 한다 */
    {
      const g3 = GAMES.find(x => x.minP >= 3);
      const keep = { ...S.room.players };
      // minP 미만이 되도록 줄인다(minP 이상이면 당연히 통과라 시험이 안 된다)
      Object.keys(S.room.players).filter(x => x !== 'h1')
        .slice(g3.minP - 2).forEach(x => delete S.room.players[x]);
      S.gameId = g3.id; go('game'); act('tool-start', {});
      ck('★인원이 모자라면 도구가 안 열린다 (minP 한 곳에서 읽는다)', S.play === null);
      S.room.players = keep;
    }

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

    /* ── 2.5) 🔗 한 단어 릴레이 (deck · relay 모드) ──
       ⚠️ 앱은 **제시어와 시간만** 챙긴다. 누가 맞히고 누가 먼저 말하는지는 사람이 정한다
          (사장님 지시 — "단어를 번갈아 말하는 건 우리끼리 알아서 할 문제라서").
          그래도 **규칙은 화면에 적혀 있어야** 하고, 맞히는 사람이 같은 팀이라
          제시어는 `.priv` 를 반드시 유지해야 한다. */
    {
      const g = G('relay');
      ck('★릴레이가 등록돼 있다', !!g && g.mode === 'team' && g.tool === 'deck');
      ck('  3대 3이 기본이라 최소 6명', g.minP === 6);
      /* 한 단어로 못 잇는 범위는 아예 안 뜬다 */
      ck('★★릴레이에 속담·사자성어가 안 뜬다',
        !deckKeys('relay').includes('proverb') && !deckKeys('relay').includes('idiom'));
      ck('  그래도 범위가 10종 이상 남는다', deckKeys('relay').length >= 10);
      ck('  기본 범위가 릴레이용으로 잡혀 있다',
        RELAY_CATS.every(k => deckKeys('relay').includes(k)));
      /* 규칙을 적어주는 게 이 게임에서 앱이 하는 일의 절반이다 */
      ck('★★상세 화면이 한 단어씩·번갈아를 설명한다',
        ['한 단어', '번갈아'].every(x => g.how.join(' ').includes(x)));
      ck('★★상세 화면이 반칙 기준을 적어준다',
        g.rules.includes('두 단어') && g.rules.includes('단어가 아닌'));

      S.gameId = 'relay'; go('game'); act('tool-start', {});
      ck('릴레이 진입', S.play?.kind === 'deck' && S.play.mode === 'relay');
      const setupHtml = view('play');
      ck('★방식 고르는 칸이 없다 (릴레이는 고정)', !setupHtml.includes('data-act="pl-mode"'));

      act('pl-start', {});
      const readyHtml = view('play');
      ck('★★준비 화면이 방식을 다시 알려준다',
        readyHtml.includes('한 단어') && readyHtml.includes('번갈아'));
      ck('★★맞히는 사람은 팀이 정한다 (앱이 안 뽑는다)',
        !S.play.guesser && !readyHtml.includes('data-act="pl-reguess"'));

      act('pl-begin', {});
      const runHtml = view('play');
      ck('릴레이 진행 시작', S.play.phase === 'run' && !!S.play.cur?.w);
      ck('★★제시어는 .priv 안에만 있다 (맞히는 사람이 보면 안 된다)',
        /wcard[^"]*priv/.test(runHtml));
      ck('  진행 중에도 「보면 안 된다」를 알려준다', runHtml.includes('보면 안'));
      ck('★반칙은 패스로 처리한다 (전용 버튼 없음)',
        !runHtml.includes('data-act="pl-foul"') && runHtml.includes('data-act="pl-mark"'));

      const t0 = S.play.order[S.play.turn];
      act('pl-mark', { v:'1' }); act('pl-mark', { v:'0' }); act('pl-mark', { v:'1' });
      ck('  맞춘 것만 센다', S.play.hits.filter(x => x.ok).length === 2);
      act('pl-stop', {}); act('pl-next', {});
      act('pl-begin', {}); act('pl-mark', { v:'1' }); act('pl-stop', {}); act('pl-next', {});
      ck('두 팀 다 돌면 done', S.play.phase === 'done');
      act('pl-save', {});
      ck('★릴레이는 팀 순위로 넘어간다', S.view === 'score' && S.draft?.mode === 'team');
      ck('  많이 맞힌 팀이 앞', S.draft.order[0] === t0);
      act('score-cancel', {});
      S.room.used = {};
    }

    /* ── 3) 컵 레이스 (race-*) ── */
    for (const gid of ['cup']){
      S.gameId = gid; go('game'); act('tool-start', {});
      const p = S.play;
      ck(gid + ' 진입', p?.kind === gid);
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

    /* ── 5.3) ★ 중복 방지 — 판을 거듭해도 같은 제시어가 안 나온다 ──
       ⚠️ 셋을 따로 본다: ① 판 사이 ② 같은 판의 팀 사이 ③ 다 쓰면 자동 순환 */
    S.room.used = {};
    S.gameId = 'chosung'; go('game'); act('tool-start', {});
    S.play.cats = ['movie']; S.play.n = 10;
    act('cho-start', {});
    const r1 = S.play.deck.slice(0, 10).map(x => x.w);
    for (let i = 0; i < 10; i++) act('cho-hit', { pid:P[0] });
    ck('판이 끝나면 나온 문제가 기록된다', usedWords('chosung').size === 10);
    act('cho-save', {}); act('score-cancel', {});

    act('tool-start', {}); S.play.cats = ['movie']; S.play.n = 10;
    act('cho-start', {});
    // ⚠️ 뽑힌 10개만 비교하면 안 된다 — 87개 풀에서는 필터가 없어도 27% 확률로
    //    우연히 안 겹쳐서 **버그가 있는데 통과**한다(실제로 그렇게 헛통과했다).
    //    덱 전체가 걸러졌는지를 본다.
    ck('★★2판째 덱에 1판 문제가 하나도 없다',
      S.play.deck.length > 0 && !S.play.deck.some(x => r1.includes(x.w)));
    ck('  덱 크기도 그만큼 줄었다',
      S.play.deck.length === choWords(['movie']).length - r1.length);

    /* 초기화 버튼 — 「다음에 다시 시작하는」 용도 */
    act('used-reset', {}); act('ask-yes', {});
    ck('★초기화하면 기록이 지워진다', usedWords('chosung').size === 0);
    act('tool-start', {}); S.play.cats = ['movie']; S.play.n = 10;
    act('cho-start', {});
    ck('  초기화 후에는 전체 풀에서 다시 낸다',
      S.play.deck.length === choWords(['movie']).length);
    quit();

    /* ③ 남은 게 모자라면 자동으로 비우고 처음부터 (멈추면 안 된다) */
    S.room.used = { chosung: choWords(['movie']).map(x => x.w).slice(0, -2) };
    S.gameId = 'chosung'; go('game'); act('tool-start', {});
    S.play.cats = ['movie']; S.play.n = 10;
    act('cho-start', {});
    ck('★모자라면 자동으로 한 바퀴 돈다', S.play.wrapped === true);
    ck('  자동 순환 시 기록이 비워진다', usedWords('chosung').size === 0);
    ck('  그래도 문제는 정상 출제된다', !!S.play.cur?.w && S.play.deck.length >= 10);
    quit();
    S.room.used = {};

    /* ② 같은 판에서 팀끼리 제시어가 겹치면 안 된다 (몸으로 말해요) */
    makeTeams(2);
    S.gameId = 'body'; go('game'); act('tool-start', {});
    S.play.cats = ['movie']; S.play.sec = 60;
    act('pl-start', {});
    const deckStart = S.play.deck.map(x => x.w);
    act('pl-begin', {});
    const t1 = []; for (let i = 0; i < 5; i++){ t1.push(S.play.cur.w); act('pl-mark', { v:'1' }); }
    act('pl-stop', {}); act('pl-next', {});
    act('pl-begin', {});
    const t2 = []; for (let i = 0; i < 5; i++){ t2.push(S.play.cur.w); act('pl-mark', { v:'1' }); }
    act('pl-stop', {});
    // ⚠️ 5개씩만 비교하면 우연히 안 겹쳐 통과한다 → 「덱을 앞에서부터 이어 썼는가」로 본다.
    ck('★★같은 판에서 팀끼리 제시어가 안 겹친다',
      new Set([...t1, ...t2]).size === t1.length + t2.length);
    ck('★덱을 이어서 쓴다(팀마다 되감기지 않는다)',
      t1.concat(t2).join('|') === deckStart.slice(0, 10).join('|'));
    act('pl-next', {});
    ck('deck 판 종료 시에도 기록된다', usedWords('body').size >= 10);
    act('pl-save', {}); act('score-cancel', {});
    S.room.used = {};

    /* ── 5.35) 🗣 한글자로 말해요 — 앱이 글자를 준다 ──
       ⚠️ 예전엔 팀이 입력창에 직접 쳤다. 아무도 안 정해서 시작이 지연됐고,
          팀마다 같은 글자를 골라 뒷 팀이 앞 팀 방식을 그대로 베끼기도 했다. */
    {
    makeTeams(2);
    S.gameId = 'body'; go('game'); act('tool-start', {});
    S.play.mode = 'oneword'; S.play.cats = ['animal'];
    act('pl-start', {});
    const t0 = S.play.order[0];
    ck('★한 글자를 앱이 자동으로 준다', !!S.play.letters[t0]);
    ck('  준 글자가 목록 안에 있다', ONE_LETTERS.includes(S.play.letters[t0]));
    ck('  입력창이 없다', !view('play').includes('id="in-letter"'));
    ck('  글자가 화면에 뜬다', view('play').includes(S.play.letters[t0]));
    const before = S.play.letters[t0];
    let changed = false;
    for (let i = 0; i < 8 && !changed; i++){ act('pl-reletter', {}); changed = S.play.letters[t0] !== before; }
    ck('★다시 뽑으면 다른 글자가 나온다', changed);
    act('pl-begin', {});
    for (let i = 0; i < 3; i++) act('pl-mark', { v:'1' });
    act('pl-stop', {}); act('pl-next', {});
    const t1 = S.play.order[1];
    ck('★다음 팀도 자동으로 받는다', !!S.play.letters[t1]);
    ck('★★팀끼리 글자가 겹치지 않는다', S.play.letters[t0] !== S.play.letters[t1]);
    quit();
    S.room.used = {};
    }

    /* ── 5.44) 🧭 앱 셸 — 하단 탭 · 뒤로가기 · 대기실 체크리스트 (v0.36.0) ──
       ⚠️ 「길을 잃지 않게」가 이 개편의 목적이다. 탭이 안 뜨거나 활성 표시가 틀리면
          그 목적이 무너지는데 화면은 멀쩡해 보인다 → 검사로 못 박는다. */
    {
    const navOn = () => [...document.querySelectorAll('#nav .nav-b')]
      .filter(b => b.classList.contains('on')).map(b => b.dataset.nav);
    const navShown = () => document.getElementById('nav').style.display !== 'none';
    const backShown = () => document.getElementById('hd-back').style.display !== 'none';

    S.view = 'lobby'; render(true);
    ck('★대기실에서 하단 탭이 보인다', navShown() && navOn().join() === 'lobby');
    ck('  탭 루트에서는 뒤로가기를 안 띄운다', !backShown());
    /* ⚠️ v0.41.0 — 「게임」 탭을 없앴다. 게임은 대기실에서 고르고, 목록·상세는 대기실의 하위 화면이다 */
    ck('★★하단 탭은 대기실·순위·설정 셋이다 (게임 탭 없음)',
      [...document.querySelectorAll('#nav .nav-b')].map(b => b.dataset.nav).join() === 'lobby,board,settings');
    S.view = 'games'; render(true);
    ck('★게임 목록은 「대기실」 탭을 켜둔다(하위 화면)', navOn().join() === 'lobby');
    ck('  목록에서는 뒤로가기가 뜬다', backShown());
    S.gameId = 'chosung'; S.view = 'game'; render(true);
    ck('★게임 상세도 「대기실」 탭을 켜둔다', navOn().join() === 'lobby');
    ck('  하위 화면에서는 뒤로가기가 뜬다', backShown());
    ck('  「이 게임으로 하기」가 하단 고정 액션바에 있다',
      /<div class="actbar">[\s\S]*?data-act="next-set"/.test(document.getElementById('view').innerHTML));
    S.view = 'board'; render(true);
    ck('★순위 탭 활성', navOn().join() === 'board');
    S.view = 'settings'; render(true);
    ck('★설정 탭 활성', navOn().join() === 'settings');

    /* 진행 화면에서는 탭을 숨긴다 — 도구가 화면을 다 써야 한다 */
    S.play = { gameId:'chosung', kind:'cho', phase:'setup', cats:['movie'], n:10, deck:[], di:0, log:[] };
    S.view = 'play'; render(true);
    ck('★★진행 화면에서는 하단 탭을 숨긴다', !navShown());
    S.play = null; S.view = 'lobby'; render(true);

    /* 대기실 체크리스트 */
    const lv = document.getElementById('view').innerHTML;
    ck('★대기실에 방 준비와 「다음 게임」이 있다', lv.includes('방 준비') && lv.includes('다음 게임'));
    ck('  초대·팀 나누기·게임 고르기가 다 있다',
      lv.includes('친구 초대') && lv.includes('팀 나누기') && lv.includes('게임 고르기'));
    ck('  「이 기기」 같이 겨루기/구경 모드 토글이 있다', lv.includes('구경 모드'));
    ck('★칩이 블록으로 퍼지지 않는다(자손 선택자 사고 재발 방지)',
      !/\.tdi \.tx span\{display:block/.test(document.documentElement.innerHTML));

    /* 게임 목록 — 한 줄 요약과 인원·시간 */
    S.view = 'games'; render(true);
    const gv3 = document.getElementById('view').innerHTML;
    ck('★목록에 한 줄 요약이 나온다', GAMES.every(g => gv3.includes(g.line)));
    ck('  인원 메타가 나온다', gv3.includes('명+'));
    S.view = 'lobby'; render(true);
    }

    /* ── 5.4) 덱 카테고리의 use 태그 ──
       ⚠️ 두 게임이 같은 덱을 쓰지만 요구가 정반대다. 태그가 새면
          「아르헨티나를 몸으로 표현하세요」가 나온다. */
    ck('★몸으로 말해요에 나라·사자성어가 안 들어간다',
      !deckKeys('body').includes('place') && !deckKeys('body').includes('idiom'));
    ck('  두 게임 모두 쓸 카테고리는 양쪽에 다 있다',
      deckKeys('body').includes('animal') && deckKeys('cho').includes('animal'));
    ck('  초성 전용 카테고리도 초성에는 있다',
      deckKeys('cho').includes('place') && deckKeys('cho').includes('idiom'));
    ck('전 카테고리에 use 태그가 있다',
      DECK_KEYS.every(k => Array.isArray(WORD_DECKS[k].use) && WORD_DECKS[k].use.length));
    ck('전 카테고리 이름·이모지·단어 있음',
      DECK_KEYS.every(k => WORD_DECKS[k].name && WORD_DECKS[k].emoji && WORD_DECKS[k].words.length));
    /* 덱 안 원문 중복 0 (같은 단어를 두 번 넣으면 한 판에 두 번 나온다) */
    {
      const all = DECK_KEYS.flatMap(k => WORD_DECKS[k].words);
      const dup = all.filter((w,i) => all.indexOf(w) !== i);
      ck('★덱 전체에 같은 단어가 두 번 없다', dup.length === 0);
      if (dup.length) say('  중복:', [...new Set(dup)].slice(0,6).join(','));
    }
    /* 규모 — 판을 거듭해도 안 겹치게 하려고 늘린 것이다 */
    say('덱 규모', DECK_KEYS.length + '종 ' + DECK_KEYS.reduce((n,k)=>n+WORD_DECKS[k].words.length,0) + '단어',
        '| 초성 출제가능 ' + choWords(deckKeys('cho')).length);
    ck('★초성 출제 가능 600문제 이상', choWords(deckKeys('cho')).length >= 600);
    ck('  기본 범위만으로도 300문제 이상', choWords(CHO_CATS).length >= 300);

    /* ── 5.5) 🔠 초성 퀴즈 (cho) ──
       ⚠️ 이 게임의 핵심 제약은 「정답이 맞히기 전까지 화면에 없다」는 것이다.
          태블릿을 다 같이 보므로 정답이 새면 게임이 통째로 성립하지 않는다. */
    S.gameId = 'chosung'; go('game'); act('tool-start', {});
    ck('cho 진입', S.play?.kind === 'cho' && S.play.phase === 'setup');
    S.play.n = 3;                                     // 짧게 한 판
    act('cho-start', {});
    ck('초성 문제 생성', S.play.phase === 'run' && !!S.play.cur?.w);

    /* ★ 답이 하나로 정해지는가 — 사장님 제보(「ㄱㄹ·동물」이면 기린도 고래도 된다)
       실측상 원인은 덱 중복보다 단어 길이였다. 두 겹(3글자↑ · 초성 충돌 제거)을 다 본다. */
    const dk = S.play.deck;
    ck('★출제 후보가 충분', dk.length >= 20);
    ck('★★두 글자 이하 단어가 안 나온다',
      dk.every(x => x.w.replace(/\s/g, '').length >= 3));
    ck('★★덱 안에 초성이 겹치는 문제가 없다',
      new Set(dk.map(x => cho(x.w))).size === dk.length);
    ck('  기린/고래 같은 짝은 아예 빠졌다',
      !dk.some(x => x.w === '기린') && !dk.some(x => x.w === '고래'));
    /* 전 카테고리를 켜도 같은 보장이 유지되는지 — 조합이 바뀌면 충돌도 바뀐다 */
    const allCat = choWords(DECK_KEYS);
    ck('★전 범위를 켜도 초성 충돌 0',
      new Set(allCat.map(x => cho(x.w))).size === allCat.length);
    ck('  전 범위에서도 카테고리마다 남는 게 있다',
      DECK_KEYS.every(k => choWords([k]).length >= 20));
    /* 덱이 바닥나도 규칙이 유지되는지(nextWord 재빌드 경로)
       ⚠️ 단어 **하나**만 보면 안 된다 — 필터를 벗겨놔도 우연히 3글자가 걸려 통과한다.
          (실제로 그렇게 헛통과하는 걸 보고 덱 전체를 보도록 고쳤다.) */
    S.play.di = S.play.deck.length; nextWord();
    const re = S.play.deck;
    ck('★덱 재빌드 후에도 규칙 유지',
      re.length >= 20
      && re.every(x => x.w.replace(/\s/g, '').length >= 3)
      && new Set(re.map(x => cho(x.w))).size === re.length);

    /* 변환 정확도 — 겹자음·공백·비한글 */
    ck('★초성 변환 정확', cho('삼계탕') === 'ㅅㄱㅌ' && cho('짜장면') === 'ㅉㅈㅁ'
      && cho('가는 말이') === 'ㄱㄴ ㅁㅇ' && cho('BTS 노래') === 'BTS ㄴㄹ');

    /* ★ 정답 누출 — 진행 화면 어디에도 원문이 있으면 안 된다 */
    const runHtml = view('play');
    ck('★진행 화면에 초성이 뜬다', runHtml.includes(cho(S.play.cur.w)));
    /* ⚠️ 뽑힌 낱말 **하나**만 보면 무작위로 통과/실패가 갈린다(실제로 그랬다).
       덱 전체를 돌려 「어떤 낱말이 걸려도 안 새는가」를 본다. */
    /* ⚠️ 화면에는 참가자 이름도 있다. 테스트 봇 이름이 동물이라 「다람쥐」가 제시어로 뽑히면
       **정답이 아니라 이름 때문에** 걸린다 — 그래서 제시어와 무관한 기준 화면을 먼저 떠서 뺀다. */
    const _keepCur = S.play.cur, _leak = [];
    S.play.cur = { ...S.play.cur, w:' 없는낱말 ' };
    const _base = view('play');
    for (const it of S.play.deck){
      S.play.cur = it;
      if (view('play').includes(it.w) && !_base.includes(it.w)) _leak.push(it.w);
    }
    S.play.cur = _keepCur;
    ck('★★진행 화면에 정답이 없다' + (_leak.length ? ' — 새는 낱말 ' + _leak.slice(0,6).join('/') : ''), !_leak.length);
    ck('★.priv 를 안 붙였다 (전원이 봐야 하는 화면)', !/wcard[^"]*priv/.test(runHtml));

    /* 맞히면 +1 하고 바로 다음 문제 */
    const q1 = S.play.cur.w;
    act('cho-hit', { pid:P[1] });
    ck('맞히면 점수 +1', choScores()[P[1]] === 1);
    ck('바로 다음 문제로', S.play.phase === 'run' && S.play.cur.w !== q1);
    ck('직전 문제 줄에 정답 공개', view('play').includes(q1));

    /* 잘못 눌렀을 때 되돌리기 — 그 문제부터 다시 */
    act('cho-undo', {});
    ck('★방금 취소 — 점수 복구', choScores()[P[1]] === 0);
    ck('★방금 취소 — 그 문제로 복귀', S.play.cur.w === q1 && S.play.phase === 'run');
    ck('취소 후 진행 카운터도 되돌아감', S.play.log.length === 0);

    /* 아무도 못 맞히면 정답 공개 */
    act('cho-pass', {});
    const revHtml = view('play');
    ck('정답 공개 단계', S.play.phase === 'reveal');
    ck('★공개하면 그때 정답이 뜬다', revHtml.includes(S.play.cur.w));
    act('cho-skip', {});
    ck('못 맞힌 문제는 by:null', S.play.log[0].by === null && S.play.log.length === 1);

    /* 남은 문제를 채우면 자동 종료 */
    act('cho-hit', { pid:P[2] });
    act('cho-hit', { pid:P[2] });
    ck('★목표 문제 수를 채우면 자동 종료', S.play.phase === 'done' && S.play.log.length === 3);
    const choSc = choScores();
    ck('점수 집계', choSc[P[2]] === 2 && choSc[P[1]] === 0);
    const doneHtml = view('play');
    ck('종료 화면에 나온 문제 공개', doneHtml.includes(S.play.log[0].w));
    act('cho-save', {});
    ck('cho 순위 화면', S.view === 'score' && S.play === null);
    ck('★많이 맞힌 사람이 1등', S.draft.order[0] === P[2]);
    ck('cho 는 개인전으로 넘어간다', S.draft.mode === 'solo');
    ck('선수 전원이 순위에 들어간다', S.draft.order.length === playing().length);
    act('score-cancel', {});

    /* ── 5.6) 🧠 상식 퀴즈 (quiz) ──
       ⚠️ 초성 퀴즈와 흐름이 **뒤집혀 있다**. 그게 이 게임의 핵심이므로 순서를 못 박는다.
            run(문제만) → 「정답 공개」 → reveal(정답 + 누가 맞혔나) → 다음
          정답 공개 **전에는** 누구도 고를 수 없어야 하고(그래야 진행자도 같이 맞힌다),
          정답 문자열이 run 화면에 새면 게임이 통째로 성립하지 않는다. */
    {
      /* 데이터 정합 */
      const qAll = Object.values(QUIZ_DECKS).flatMap(v => v.qs);
      say('상식 퀴즈', QUIZ_KEYS.length + '범위', qAll.length + '문제');
      ck('★상식 퀴즈 1400문제 이상', qAll.length >= 1400);
      ck('★범위 10가지 이상', QUIZ_KEYS.length >= 10);
      ck('  범위마다 100문제 이상', QUIZ_KEYS.every(k => QUIZ_DECKS[k].qs.length >= 100));
      ck('전 범위에 이름·이모지·문제 보유',
        QUIZ_KEYS.every(k => QUIZ_DECKS[k].name && QUIZ_DECKS[k].emoji
          && Array.isArray(QUIZ_DECKS[k].qs)));
      ck('★★문제 문장이 범위를 넘어 중복되지 않는다',
        new Set(qAll.map(x => x[0])).size === qAll.length);
      /* ★★ 유사 중복 — 글자만 조금 다른 같은 질문을 막는다.
         ⚠️ 문제를 1,500개까지 늘리면서 실제로 「일본의 수도는?」/「일본의 수도 이름은?」
            같은 쌍이 생기기 쉬워졌다. 완전 일치 검사만으로는 이걸 못 잡는다.
            공백·기호·흔한 어미를 떼고 비교해서 같으면 중복으로 본다. */
      {
        const norm = q => q.replace(/[\s·?!,()]/g, '')
          .replace(/(이름|것)?(은|는|을|를|이|가)?(무엇|뭐라하나|뭐라부르나|몇개|얼마)?$/, '');
        const ns = new Set(qAll.map(x => norm(x[0])));
        ck('★★어미만 다른 같은 질문이 없다', ns.size === qAll.length);
      }
      ck('전 문제에 정답이 있다', qAll.every(x => x[0].trim() && x[1].trim()));
      ck('  문제는 물음표로 끝난다', qAll.every(x => x[0].endsWith('?')));
      /* 기본 범위 — 쏠리기 쉬운 범위는 꺼둔 상태여야 한다(난이도 손잡이) */
      ck('★기본 범위에 어려운 쪽이 안 켜져 있다',
        !QUIZ_CATS.includes('hist') && !QUIZ_CATS.includes('art')
        && !QUIZ_CATS.includes('sport') && !QUIZ_CATS.includes('it'));
      ck('  그래도 기본 범위만으로 700문제 이상', quizPool(QUIZ_CATS).length >= 700);
      /* ★ 판을 거듭해도 안 겹치는지 — 사장님 요구의 핵심.
         20문제씩 20판(400문제)을 돌려도 같은 문제가 두 번 안 나와야 한다. */
      {
        const pool = quizPool(QUIZ_CATS);
        const seenQ = new Set(); let again = 0;
        const used = new Set();
        for (let r = 0; r < 20; r++){
          const fresh = pool.filter(x => !used.has(x.w));
          const round = shuffle(fresh.slice()).slice(0, 20);
          for (const x of round){ if (seenQ.has(x.w)) again++; seenQ.add(x.w); used.add(x.w); }
        }
        ck('★★20문제씩 20판을 돌려도 재출제 0', again === 0 && seenQ.size === 400);
      }

      S.gameId = 'quiz'; go('game'); act('tool-start', {});
      ck('quiz 진입', S.play?.kind === 'quiz' && S.play.phase === 'setup');
      S.play.n = 3;
      act('quiz-start', {});
      ck('문제 생성', S.play.phase === 'run' && !!S.play.cur?.w && !!S.play.cur?.a);

      /* ★ 정답 누출 — 카드를 **고정**해서 본다.
         ⚠️ 랜덤 카드로 검사하면 안 된다. 정답이 「M」 처럼 짧으면 화면 아무 데나 걸려
            뽑기에 따라 실패하는 검사가 된다(v0.24.0 의 「I」 사건과 같은 병). */
      S.play.cur = { w:'세계에서 가장 긴 강은?', a:'나일강', c:'world' };
      const qRun = view('play');
      ck('★진행 화면에 문제가 뜬다', qRun.includes('세계에서 가장 긴 강은?'));
      ck('★★진행 화면에 정답이 없다', !qRun.includes('나일강'));
      ck('★.priv 를 안 붙였다 (전원이 봐야 하는 화면)', !/wcard[^"]*priv/.test(qRun));
      ck('★공개 전에는 「누가 맞혔나」가 안 뜬다', !qRun.includes('누가 맞혔나요?'));

      /* ★ 공개 전에는 아무도 고를 수 없다 — 이게 뚫리면 정답 없이 판정하게 된다 */
      act('quiz-hit', { pid:P[1] });
      ck('★★정답 공개 전에는 맞힌 사람을 고를 수 없다',
        S.play.log.length === 0 && S.play.phase === 'run');

      act('quiz-show', {});
      const qRev = view('play');
      ck('정답 공개 단계', S.play.phase === 'reveal');
      ck('★공개하면 그때 정답이 뜬다', qRev.includes('나일강'));
      ck('공개 후에 「누가 맞혔나」가 뜬다', qRev.includes('누가 맞혔나요?'));

      /* 맞히면 +1 하고 바로 다음 문제 */
      act('quiz-hit', { pid:P[1] });
      ck('맞히면 점수 +1', quizScores()[P[1]] === 1);
      ck('바로 다음 문제로', S.play.phase === 'run' && S.play.cur.w !== '세계에서 가장 긴 강은?');
      ck('직전 줄에 정답이 남는다', view('play').includes('나일강'));

      /* 되돌리기 — ⚠️ 정답이 보이는 상태(reveal)로 돌아가야 다시 고를 수 있다 */
      act('quiz-undo', {});
      ck('★방금 취소 — 점수 복구', quizScores()[P[1]] === 0);
      ck('★★방금 취소 — 정답이 보이는 단계로 복귀',
        S.play.phase === 'reveal' && S.play.cur.w === '세계에서 가장 긴 강은?');
      ck('취소 후 진행 카운터도 되돌아감', S.play.log.length === 0);

      /* 아무도 못 맞힘 */
      act('quiz-none', {});
      ck('못 맞힌 문제는 by:null', S.play.log[0].by === null && S.play.log.length === 1);
      ck('  넘어가면 다음 문제', S.play.phase === 'run');

      /* ── ⏱ 생각 시간 5초 — 다 되면 진행자가 안 눌러도 정답이 나온다 ──
         사장님 지시: "이거 게임 5초로 바로 결과 나오게 해줘" */
      {
        ck('★★기본 생각 시간이 5초다', S.play.sec === 5);
        const runH = view('play');
        ck('  진행 화면에 남은 시간이 보인다',
          runH.includes('id="t-sec"') && runH.includes('id="t-bar"'));
        ck('  시간이 다 되면 정답이 나온다고 알려준다', runH.includes('정답이 자동으로'));
        ck('★문제가 뜨면 타이머가 돈다', !!S.play._t && S.play.left === 5);

        /* 시간이 다 됐을 때 — 진행자가 아무것도 안 눌러도 정답 단계로 간다 */
        quizAutoShow();
        ck('★★5초가 지나면 정답이 자동 공개된다', S.play.phase === 'reveal');
        ck('  그때 정답이 화면에 뜬다', view('play').includes(S.play.cur.a));
        ck('★공개되면 타이머는 멈춘다', !S.play._t);

        /* 먼저 맞혔으면 기다릴 필요가 없다 — 직접 공개하면 타이머가 끊긴다 */
        act('quiz-hit', { pid:P[2] });
        ck('  다음 문제에서 타이머가 다시 돈다', S.play.phase === 'run' && !!S.play._t);
        act('quiz-show', {});
        ck('★★직접 공개하면 타이머가 끊긴다', S.play.phase === 'reveal' && !S.play._t);
        act('quiz-undo', {});
        ck('  되돌려도 정답이 보이는 채로 시간이 안 흐른다',
          S.play.phase === 'reveal' && !S.play._t);

        /* 「끄기」면 진행자가 누를 때까지 정답이 안 나온다 */
        act('quiz-hit', { pid:P[2] });
        act('quiz-sec', { v:'0' });
        ck('★생각 시간을 끄면 타이머가 안 돈다', S.play.sec === 0 && !S.play._t);
        ck('  그 상태에서도 정답은 아직 안 나온다',
          S.play.phase === 'run' && !view('play').includes(S.play.cur.a));
        act('quiz-sec', { v:'5' });
        ck('  다시 켜면 그 자리에서 돈다', S.play.sec === 5 && !!S.play._t);
        /* 뒤 검사가 이어지도록 「못 맞힌 1문제」 상태로 되돌려 둔다 */
        S.play.log = [{ w:'세계에서 가장 긴 강은?', a:'나일강', c:'world', by:null }];
        S.play.n = 3;
      }

      /* 목표 수를 채우면 자동 종료 */
      act('quiz-show', {}); act('quiz-hit', { pid:P[2] });
      act('quiz-show', {}); act('quiz-hit', { pid:P[2] });
      ck('★목표 문제 수를 채우면 자동 종료',
        S.play.phase === 'done' && S.play.log.length === 3);
      const qSc = quizScores();
      ck('점수 집계', qSc[P[2]] === 2 && qSc[P[1]] === 0);
      /* ⚠️ 정답만 적으면 뭘 물었는지 알 수 없다 — 「60세」가 환갑인지 정년인지 모른다.
            초성 퀴즈는 제시어가 곧 답이라 문제없지만 이 게임은 둘이 따로다. */
      const qDone = view('play');
      ck('종료 화면에 정답 목록', qDone.includes(S.play.log[0].a));
      ck('★★종료 화면에 문제도 같이 적힌다', qDone.includes(S.play.log[0].w));
      ck('★판이 끝나면 나온 문제가 기록된다', usedWords('quiz').size === 3);

      act('quiz-save', {});
      ck('quiz 순위 화면', S.view === 'score' && S.play === null);
      ck('★많이 맞힌 사람이 1등', S.draft.order[0] === P[2]);
      ck('quiz 는 개인전으로 넘어간다', S.draft.mode === 'solo');
      ck('선수 전원이 순위에 들어간다', S.draft.order.length === playing().length);
      act('score-cancel', {});

      /* 중복 방지 — 이미 나온 문제는 다음 판에 안 나온다 */
      S.gameId = 'quiz'; go('game'); act('tool-start', {});
      S.play.n = 3; act('quiz-start', {});
      const used2 = usedWords('quiz');
      ck('★다음 판 덱에 이미 나온 문제가 없다',
        S.play.deck.every(x => !used2.has(x.w)));
      quit();
      S.room.used = {};
    }

    /* ── 6) 술래 뽑기(중복 방지 로테이션) ── */
    /* ⚠️ S._lastPick 은 {gameId: pid} 맵이다(통째로 읽으면 안 된다).
       그리고 act('pick') 은 rollReveal 을 await 하는 async 다 — 누가 뽑혔는지는
       동기적으로 쌓이는 rotation 배열로 확인한다. */
    S.gameId = 'body'; go('game');
    if (S.room.rotation) delete S.room.rotation.body;
    for (let i = 0; i < P.length; i++) act('pick', {});
    const rot = S.room.rotation.body || [];
    ck('★전원 한 번씩 술래 (중복 없이)',
      rot.length === P.length && rot.slice().sort().join() === P.slice().sort().join());
    act('pick', {});
    ck('전원 소진되면 리셋', (S.room.rotation.body || []).length === 1);

    /* ── 7) 리더보드 — 지워진 게임의 옛 기록이 섞여도 안 죽는다 ── */
    S.room.scores.zz_old = { gameId:'mafia', mode:'solo', order:[P[0],P[1]], weight:2, assign:{}, at:1 };
    const pts = calcPoints();
    ck('★삭제된 게임 기록도 점수에 반영', pts[P[0]] > 0 && Object.keys(pts).length === P.length);
    const bd = view('board');
    ck('★리더보드가 안 죽음', bd.includes('종합') || bd.includes('점'));
    ck('★알 수 없는 게임은 id로 표시', bd.includes('mafia'));
    ck('gcVars 기본색 폴백', gcVars(undefined).startsWith('--gc:#8A8279'));
    delete S.room.scores.zz_old;

    /* ── 8) ★ 사회자(관전) 기기 — 태블릿을 공용 화면으로 세워둘 때 ──
       가장 위험한 부분이다: 관전 기기가 「선수」로 새면 팀·술래·순위가 통째로 어긋난다. */
    S.gameId='body'; go('game');
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
    if (S.room.rotation) delete S.room.rotation.body;
    for (let i = 0; i < before - 1; i++) act('pick', {});
    const rot2 = S.room.rotation.body || [];
    ck('★술래 뽑기에서 제외', !rot2.includes(P[0]));
    ck('★선수 전원만 한 바퀴 (' + rot2.length + '/' + (before-1) + ')', rot2.length === before - 1);

    S.gameId='cup'; go('game'); act('tool-start', {});
    ck('★도구 순번에서 제외', !S.play.order.includes(P[0]) && S.play.order.length === before - 1);
    quit();

    act('sm-sul', { pid:P[1] });
    quit();

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
    ck('★구경 모드 기기가 있으면 화면 담당 뽑기 숨김', !gv.includes('화면 담당 뽑기'));
    ck('  대신 그 기기를 안내한다', gv.includes('기기가 구경 모드예요'));
    // ★ 요구와 해결이 동시에 뜨면 안 된다 — 갖췄는데도 모자란 것처럼 보였다(v0.21.0에서 고침)
    ck('★★사회자 기기가 있으면 「있어야 깔끔해요」 요구가 사라진다',
      !gv.includes('있어야 깔끔해요'));
    ck('  화면에 답이 있는 게임은 「가운데 두지 말라」를 같이 안내한다',
      gv.includes('가운데 두지 말고'));
    S.room.players[P[0]].spec = false;
    S.view='game'; render(true);
    {
      const gv2 = document.getElementById('view').innerHTML;
      ck('구경 모드 기기가 없으면 뽑기가 다시 뜬다', gv2.includes('화면 담당 뽑기'));
      ck('★사회자 기기가 없으면 요구 문구가 다시 뜬다', gv2.includes('있어야 깔끔해요'));
    }
    S.room.players[P[0]].spec = true;

    S.gameId='body'; go('game');
    act('spec-toggle', {});                              // 되돌리기
    ck('관전 해제하면 선수로 복귀', playing().length === before);
    ck('해제하면 리더보드에 다시 뜬다', P[0] in calcPoints());

    /* 마지막 한 명은 관전으로 못 바꾼다(선수가 0명이 되면 아무 게임도 못 한다) */
    const others = P.slice(1);
    others.forEach(pid => { S.room.players[pid].spec = true; });
    ck('★선수가 1명 남으면 관전 전환 차단',
      (act('spec-toggle', {}), !isSpec(S.room.players[P[0]])));
    others.forEach(pid => { delete S.room.players[pid].spec; });

    /* ── 8.35) 🔢 문제 수 고르기 (상식 퀴즈 · 초성 퀴즈 공용) ──
       사장님 지시: "상식 퀴즈 푸는 문제를 개수 설정할 수 있게 해줘" */
    {
      S.gameId = 'quiz'; go('game'); act('tool-start', {});
      const setup = view('play');
      ck('★★문제 수를 ±로 고를 수 있다',
        /data-act="quiz-n"[^>]*>−/.test(setup) && /data-act="quiz-n"[^>]*>＋/.test(setup));
      ck('  빠른 선택도 같이 있다', (setup.match(/data-act="quiz-n"/g) || []).length >= 5);

      const base = S.play.n;
      act('quiz-n', { v:String(base + 1) });
      ck('  ＋ 로 1문제씩 올라간다', S.play.n === base + 1);
      act('quiz-n', { v:'5' });
      ck('★빠른 선택은 그 숫자로 딱 맞춘다', S.play.n === 5);
      act('quiz-n', { v:'4' });
      ck('  ＋/− 는 1씩 (20 아래)', S.play.n === 4);

      /* 20 위로는 5씩 — 40을 맞추려고 스무 번 누르게 하면 안 된다 */
      act('quiz-n', { v:'20' }); act('quiz-n', { v:'25' });
      ck('★20 위로는 5씩 움직인다', S.play.n === 25);

      /* 경계 */
      act('quiz-n', { v:'0' });
      ck('★0문제로는 못 내려간다', S.play.n === 1);
      act('quiz-n', { v:'999' });
      ck('★★낼 수 있는 것보다 많이 고를 수 없다',
        S.play.n === Math.min(50, quizPool(S.play.cats).length));

      /* 범위를 좁혀도 상한이 따라온다 */
      act('quiz-n', { v:'30' });
      const start = view('play');
      ck('  시작 버튼이 고른 개수를 그대로 말한다', start.includes(`시작하기 — ${S.play.n}문제`));
      act('quiz-start', {});
      ck('★★고른 개수만큼만 낸다', S.play.n === 30 && S.play.deck.length >= 30);
      quit();

      /* 초성 퀴즈도 같은 위젯을 쓴다 */
      S.gameId = 'chosung'; go('game'); act('tool-start', {});
      ck('★초성 퀴즈도 ± 로 고른다', /data-act="cho-n"[^>]*>＋/.test(view('play')));
      act('cho-n', { v:'7' });
      ck('  같은 방식으로 동작한다', S.play.n === 7);
      quit();
      S.room.used = {};
    }

    /* ── 8.4) 🏅 팀 점수가 개인 점수로 쌓인다 + 🗂 지난 기록 ──
       사장님 지시: "개인전 점수 위주 · 팀 점수를 받으면 개인 점수에 반영돼서 랭킹이 맺어지는 시스템"
                    "방에서 모두 나가더라도 다시 확인할 수 있도록 메인화면에 시간과 일자를 표시" */
    {
      localStorage.removeItem('partygames_rooms');
      S.room.scores = {}; S.room.teams = { count:2, assign:{} };
      players().forEach(([pid], i) => { S.room.teams.assign[pid] = i % 2; });
      const T0 = P.filter(pid => Number(S.room.teams.assign[pid]) === 0);
      const T1 = P.filter(pid => Number(S.room.teams.assign[pid]) === 1);

      /* 팀전 한 판 — 1팀(index 0)이 1등 */
      S.room.scores.t1 = { gameId:'body', mode:'team', order:[0,1], weight:1.5,
        assign:JSON.parse(JSON.stringify(S.room.teams.assign)), at:1 };
      const pt1 = calcPoints();
      ck('★★팀 1등 점수를 팀원 전원이 똑같이 받는다',
        T0.every(pid => pt1[pid] === 15) && T0.length >= 2);
      ck('  진 팀도 팀 순위대로 받는다', T1.every(pid => pt1[pid] === 10.5));
      ck('★한 판이 나에게 준 점수를 따로 셀 수 있다', scorePt(S.room.scores.t1, T0[0]) === 15);

      /* 개인전 한 판을 더해도 같은 리더보드에 합산된다 */
      S.room.scores.s1 = { gameId:'chosung', mode:'solo', order:[T1[0], T0[0]], weight:1, at:2 };
      const pt2 = calcPoints();
      ck('★★개인전과 팀전이 한 리더보드에 합산된다',
        pt2[T1[0]] === 10.5 + 10 && pt2[T0[0]] === 15 + 7);
      /* ⚠️ 팀을 다시 짜도 과거 팀전 점수는 안 깨진다(그 시점 assign 을 저장해두기 때문) */
      S.room.teams = { count:2, assign:Object.fromEntries(P.map((p,i) => [p, (i+1) % 2])) };
      ck('★★팀을 다시 짜도 과거 팀전 점수가 그대로다', calcPoints()[T0[0]] === 15 + 7);

      /* 🗂 지난 기록 — 방이 사라져도 이 기기에 남는다 */
      S.view = 'board'; render(true);
      const rec = JSON.parse(localStorage.getItem('partygames_rooms') || '[]');
      ck('★★점수가 있으면 이 기기에 기록이 남는다', rec.length === 1 && rec[0].code === '0000');
      ck('  최종 순위가 점수 내림차순으로 들어간다',
        rec[0].rows.length === players().length && rec[0].rows[0].p >= rec[0].rows[1].p);
      ck('  진행한 게임도 같이 남는다', rec[0].games.length === 2);
      ck('  날짜·시간을 만들 수 있다', /월 .*일/.test(fmtDay(rec[0].last)) && /[0-9]:[0-9]/.test(fmtTime(rec[0].last)));

      /* 홈 화면 — 시간과 일자가 보여야 한다 */
      go('home');
      const hh = view('home');
      ck('★★홈 화면에 지난 기록이 뜬다', hh.includes('지난 기록'));
      ck('★★날짜와 시간이 적혀 있다',
        hh.includes(fmtDay(rec[0].last).split(' ')[0]) && hh.includes(fmtTime(rec[0].last)));
      ck('  1등과 인원·판 수를 요약해준다',
        hh.includes(rec[0].rows[0].n) && hh.includes(`${rec[0].games.length}판`));

      /* 방이 없어도 열린다 — 상세는 저장된 값만 쓴다 */
      act('hist-open', { i:'0' });
      const keepRoom = S.room, keepCode = S.code;
      S.room = null; S.code = null; render(true);
      const hv = view('hist');
      ck('★★방이 사라져도 지난 기록이 열린다',
        hv.includes(rec[0].rows[0].n) && hv.includes(fmtPt(rec[0].rows[0].p)));
      S.room = keepRoom; S.code = keepCode;

      /* ⚠️ 지금 들어가 있는 방의 기록은 살아 있는 값이라 지울 수 없다(지워도 다시 쌓인다) */
      act('hist-del', { i:'0' });
      ck('★지금 있는 방의 기록은 못 지운다',
        !S.ask && JSON.parse(localStorage.getItem('partygames_rooms')).length === 1);
      ck('  홈에서도 그 줄엔 ✕ 가 없다', !/rec-x[^]{0,80}data-i="0"/.test(view('home')));

      /* 방을 나간 뒤에는 지울 수 있다 — 되돌릴 수 없으니 물어본다 */
      const keepC = S.code; S.code = null;
      act('hist-del', { i:'0' });
      ck('★기록 지우기도 경고창이 뜬다',
        !!S.ask && JSON.parse(localStorage.getItem('partygames_rooms')).length === 1);
      act('ask-yes', {});
      ck('  확인하면 지워진다', JSON.parse(localStorage.getItem('partygames_rooms') || '[]').length === 0);
      S.code = keepC;
      localStorage.removeItem('partygames_rooms'); _histSig = '';
      S.room.teams = { count:0, assign:{} }; go('lobby');
    }

    /* ── 8.5) ⚠️ 경고창 — 되돌릴 수 없는 것은 먼저 물어본다 ──
       사장님 지시: "방 나가기나 게임 나가기를 할 때 점수가 사라질 수 있다는 경고창."
       ⚠️ 「물어본다」만으로는 부족하다 — **무엇이 사라지는지**를 적어야 경고다. */
    {
      S.ask = null;
      players().forEach(([pid]) => { delete S.room.players[pid].spec; });
      /* ① 게임 나가기 — 진행 중일 때만 */
      S.gameId = 'chosung'; go('game'); act('tool-start', {});
      act('pl-quit', {});
      ck('  아무것도 안 했으면 그냥 나간다', !S.ask && S.play === null);

      S.gameId = 'chosung'; go('game'); act('tool-start', {});
      S.play.n = 3; act('cho-start', {}); act('cho-hit', { pid:P[1] });
      act('pl-quit', {});
      ck('★★진행 중에 나가면 경고창이 뜬다', !!S.ask && S.play !== null);
      const askHtml = view('play');
      ck('★★무엇이 사라지는지 적혀 있다', /사라져/.test(askHtml) && askHtml.includes('asklose'));
      /* ⚠️ 「취소가 있다」를 data-act 문자열로만 보면 안 된다 — 배경(.askov)에도 ask-no 가 있어서
            버튼을 지워도 통과한다. **버튼**이 있는지를 본다. */
      ck('  「예/아니오」 버튼이 둘 다 있다',
        /<button[^>]+data-act="ask-yes"/.test(askHtml) && /<button[^>]+data-act="ask-no"/.test(askHtml));
      act('ask-no', {});
      ck('★취소하면 게임이 그대로 남는다', !S.ask && S.play !== null && S.play.log.length === 1);
      act('pl-quit', {}); act('ask-yes', {});
      ck('★확인하면 그때 나간다', !S.ask && S.play === null);

      /* ② 방 나가기 — 참가자는 다시 들어오면 새 사람이 된다(점수가 끊긴다) */
      act('leave', {});
      ck('★★방 나가기도 경고창이 뜬다', !!S.ask && S.code === '0000');
      const lv = view('lobby');
      ck('  진행자에게는 「순위를 저장할 수 없다」를 알린다', lv.includes('순위를 저장할 수 없어요'));
      act('ask-no', {});
      ck('★취소하면 방에 남는다', !S.ask && S.code === '0000');
      S.isHost = false; act('leave', {});
      ck('★참가자에게는 「내 점수가 사라진다」를 알린다',
        S.ask.lose.join(' ').includes('내 점수'));
      act('ask-no', {}); S.isHost = true;

      /* ③ 화면을 옮기면 열려 있던 경고창은 사라진다 */
      act('leave', {}); go('board');
      ck('  화면이 바뀌면 경고창이 닫힌다', !S.ask);

      /* ④ 점수 전부 지우기 */
      act('reset-scores', {});
      ck('★점수 지우기도 경고창이 뜬다', !!S.ask && Object.keys(S.room.scores).length > 0);
      act('ask-yes', {});
      ck('  확인하면 지워진다', Object.keys(S.room.scores).length === 0);
    }

    /* ★★★ 진행자(호스트)를 다른 기기로 넘긴다 — 태블릿이 「화면」만 되던 문제
       ⚠️ 진행자 = 점수·순서·게임 도구가 **돌아가는 기기**. 사회자(화면) 와는 다른 것이라
          방을 폰으로 만들면 태블릿은 화면만 되고 도구는 폰에 남았다(사장님 지적). */
    {
      const P = players().map(([pid]) => pid);
      const other = P.find(x => x !== 'h1');

      /* 진행자 기기에는 넘겨받기 버튼이 없다 */
      S.isHost = true; S.pid = 'h1'; S.room.host = 'h1'; S.play = null;
      ck('★진행자 기기에는 「넘겨받기」가 없다', !view('lobby').includes('data-act="host-take"'));

      /* 참가자 기기에는 지금 진행자가 누구인지와 넘겨받기가 보인다 */
      S.pid = other; S.isHost = false;
      const lb = view('lobby');
      ck('★★참가자 기기에 지금 메인 화면이 누구인지 보인다',
        lb.includes('메인 화면 — ') && lb.includes(pname('h1')));
      ck('★★거기서 바로 넘겨받을 수 있다', lb.includes('data-act="host-take"'));

      /* 진행 중인 도구가 있으면 못 넘긴다 — 그 판이 통째로 사라지기 때문
         ⚠️ 예전 검사는 **넘겨받는 기기**에 S.play 를 넣어놓고 통과했다. 진행자가 아닌 기기는
            S.play 가 늘 비어 있으니 가드가 무의미했는데 검사도 같이 헛통과했다(v0.40.1 점검).
            진행 중인지는 **진행자 기기가 서버에 실은 busy** 로만 알 수 있다. */
      S.play = null;
      S.room.busy = 'body'; S.room.players.h1.seen = Date.now();
      act('host-take', {});
      ck('★★★진행자 기기에서 게임 중이면 안 넘어간다', !S.ask && S.isHost === false);
      /* 진행자 기기가 **끊겨 있으면** 막을 수 없다(영영 못 넘긴다) — 잃는 것을 알리고 허용 */
      S.room.players.h1.seen = 1;
      act('host-take', {});
      ck('★★진행자 기기가 끊겨 있으면 넘길 수 있다', !!S.ask && S.ask.go === 'host-take-go');
      ck('  대신 진행 중이던 판이 사라진다고 알린다',
        (S.ask.lose || []).join(' ').includes('사라져요') && (S.ask.lose || []).join(' ').includes('끊겨'));
      S.ask = null; S.room.busy = null; S.room.players.h1.seen = Date.now();

      /* 경고창 → 확인 */
      act('host-take', {});
      ck('★넘기기 전에 경고창이 뜬다', !!S.ask && S.ask.go === 'host-take-go');
      ck('  무엇이 바뀌는지 적혀 있다',
        (S.ask.lose || []).join(' ').includes('참가자가 돼요'));
      globalThis.__W = [];
      act('ask-yes', {});
      ck('★★★이 기기가 진행자가 된다', S.isHost === true && S.room.host === S.pid);
      ck('★★서버에도 host 를 올린다',
        (globalThis.__W || []).some(x => x[2] && x[2].host === S.pid));
      ck('★★옛 진행자 표시도 같이 내린다 (진행자가 둘로 보이지 않게)',
        (globalThis.__W || []).some(x => x[2] && x[2]['players/h1/host'] === null)
        && S.room.players.h1.host === false);
      ck('  참가자 목록에 진행자는 한 명뿐이다',
        Object.entries(S.room.players).filter(([pid,p]) => p.host || pid === S.room.host).length === 1);

      /* 옛 진행자 기기는 스냅샷을 받는 순간 내려와야 한다 */
      const keepPid = S.pid;
      S.pid = 'h1'; S.isHost = true;                       // 옛 진행자 흉내
      S.play = { kind:'deck', gameId:'body', phase:'run' }; S.view = 'play';
      applySnapshot({ createdAt:1, host:keepPid, status:'lobby',
        players:S.room.players, teams:S.room.teams, scores:S.room.scores,
        rotation:S.room.rotation, used:S.room.used });
      ck('★★★옛 진행자는 스냅샷을 받는 순간 내려온다', S.isHost === false);
      ck('★★옛 기기에 남아 있던 도구 화면도 닫는다 (혼자 진행하는 척하지 않게)',
        !S.play && S.view !== 'play');

      /* 태블릿 통합 — 진행자 + 사회자(화면)를 한 번에 */
      S.pid = keepPid; S.isHost = false; S.room.host = 'h1';
      S.room.players[keepPid].spec = false;
      act('host-take', { spec:'1' }); act('ask-yes', {});
      ck('★★★「이 기기를 진행자 화면으로」는 진행자와 사회자(화면)를 한 번에 켠다',
        S.isHost === true && isSpec(S.room.players[keepPid]) === true);
      ck('  사회자가 됐으니 팀에서도 빠진다', S.room.teams.assign[keepPid] == null);

      /* 원래대로 */
      S.room.players[keepPid].spec = false;
      S.pid = 'h1'; S.isHost = true; S.room.host = 'h1';
      S.room.players.h1.host = true;
    }

    /* ★★★ 배점은 **방장이 정한다** · 경품·벌칙은 **적어만 둔다**
       ⚠️ 게임마다 배점을 코드에 박아두던 것을 기본값으로만 남겼다(사장님 지적).
          기본은 **모든 게임 똑같이 ×1** — 점수를 빡빡하게 굴리는 게 목적이 아니다. */
    {
      S.pid = 'h1'; S.isHost = true; S.room.host = 'h1'; S.play = null; S.draft = null;
      S.room.scores = {}; S.room.rule = null;
      const P2 = playing().map(([pid]) => pid);

      ck('★★기본은 모든 게임 똑같이 (배점 ×1)',
        gameWeight('body') === 1 && gameWeight('cup') === 1 && gameWeight('chosung') === 1);
      ck('  게임 상세에 배점 칩을 안 띄운다 (기본일 땐 볼 것도 없다)',
        !(S.gameId = 'body', view('game')).includes('배점'));

      /* 「게임마다 다르게」로 바꾸면 게임에 박힌 값이 **출발점**이 된다 */
      globalThis.__W = [];
      act('rule-wmode', { v:'game' });
      ck('★★게임마다 다르게로 바꿀 수 있다', RULE().wmode === 'game');
      ck('  바꾸면 원래 값이 출발점이 된다 (몸으로 ×1.5 · 컵 ×0.5)',
        gameWeight('body') === 1.5 && gameWeight('cup') === 0.5);
      ck('★서버에도 규칙이 나간다',
        (globalThis.__W || []).some(x => x[2] && x[2].rule && x[2].rule.wmode === 'game'));
      ck('  이때만 게임 상세에 배점이 보인다', (S.gameId = 'body', view('game')).includes('배점'));

      /* ⚠️ 배점 칩 5개 + 게임 이름이라 **좁은 폰에서 가로로 넘칠 수 있다.**
         넘치면 칩 줄이 아래로 접혀야 한다 — 눈으로는 스크린샷 우측 잘림과 구분이 안 돼서 잰다. */
      S.view = 'settings'; render(true);
      {
        /* ⚠️ 헤드리스 창은 **492px 아래로 안 좁아진다** — window 폭으로는 진짜 폰을 못 잰다.
           그래서 #app 을 360px 로 묶어놓고 **줄 자체가 넘치는지**를 본다. */
        const app = document.getElementById('app'), keep = app.style.maxWidth;
        app.style.maxWidth = '360px';
        const rows = [...document.querySelectorAll('.wrow')];
        const over = rows.filter(r => r.scrollWidth > r.clientWidth + 1);
        /* ⚠️ 「안 넘친다」만 보면 헛통과한다 — 이름이 `…`로 잘려도 줄은 안 넘치기 때문이다.
              칩 줄이 아래로 접혀서 **게임 이름이 온전히 보이는지**까지 봐야 한다. */
        const cut = rows.map(r => r.querySelector('.n'))
          .filter(el => el && el.scrollWidth > el.clientWidth + 1);
        ck('★배점 줄이 좁은 폰(360px)에서도 안 넘친다 (' + rows.length + '줄)',
          rows.length === GAMES.length && !over.length);
        ck('  게임 이름이 잘리지 않는다 (칩 줄이 아래로 접힌다)', !cut.length);
        app.style.maxWidth = keep;
      }

      /* 방장이 직접 바꾼다 */
      act('rule-weight', { id:'cup', v:'2' });
      ck('★★★방장이 게임별 배점을 바꾼다', gameWeight('cup') === 2);
      ck('  건드린 게임만 바뀐다', gameWeight('body') === 1.5 && gameWeight('chosung') === 1);

      /* 바꾼 배점이 **그 뒤 저장하는 판**에 실린다 */
      S.gameId = 'cup'; act('tool-start', {}); act('score-start', {});
      ck('  순위 화면이 그 배점을 쓴다', S.draft && S.draft.weight === 2);
      P2.slice(0, 2).forEach(id => act('pickrank', { id }));
      ck('  순위를 두 명 골랐다', S.draft.order.length === 2);
      act('score-save', {});
      const rec = Object.values(S.room.scores)[0];
      ck('★★★저장한 판에 그때의 배점이 박제된다', rec && rec.weight === 2);
      const ptBefore = calcPoints()[rec.order[0]];
      ck('  1등이 10점 × 2 = 20점', ptBefore === 20);

      /* 나중에 배점을 바꿔도 **지난 판은 안 흔들린다** */
      act('rule-weight', { id:'cup', v:'0.5' });
      ck('★★★배점을 바꿔도 지난 판 점수는 그대로다', calcPoints()[rec.order[0]] === ptBefore);

      /* 제외(×0) — 그냥 재미로 하는 판 */
      act('rule-weight', { id:'chosung', v:'0' });
      ck('★「제외」로 두면 점수에 안 들어간다', gameWeight('chosung') === 0);
      S.play = null; S.draft = null;
      S.gameId = 'chosung'; act('tool-start', {}); act('score-start', {});
      P2.slice(0, 2).forEach(id => act('pickrank', { id }));
      act('score-save', {});
      ck('  제외한 판을 해도 점수가 안 오른다', calcPoints()[rec.order[0]] === ptBefore);
      ck('  그래도 진행한 게임 기록에는 남는다', Object.keys(S.room.scores).length === 2);

      /* ⚠️ 순위를 안 고르고 저장하면 **빈 판**이 기록에 남았다(검증 중에 실제로 봤다) */
      S.play = null; S.draft = null;
      S.gameId = 'act'; act('tool-start', {}); act('score-start', {});
      const before = Object.keys(S.room.scores).length;
      act('score-save', {});
      ck('★순위를 안 고르면 저장되지 않는다 (빈 판이 기록에 남지 않게)',
        Object.keys(S.room.scores).length === before);
      act('score-cancel', {}); S.play = null; S.draft = null;

      /* 🏆 경품 · 😅 벌칙 — 앱은 **적어두기만** 한다(집행하지 않는다) */
      S.view = 'settings'; render(true);
      document.getElementById('in-prize').value = '아침 안 차리기';
      document.getElementById('in-penalty').value = '설거지 담당';
      act('rule-stake', {});
      ck('★★★적어둔 경품·벌칙이 방에 저장된다',
        RULE().prize === '아침 안 차리기' && RULE().penalty === '설거지 담당');
      const bd = view('board');
      ck('★★★순위 탭 맨 위에 걸린 것이 보인다',
        bd.includes('우승 경품') && bd.includes('아침 안 차리기')
        && bd.includes('꼴찌 벌칙') && bd.includes('설거지 담당'));
      ck('★★참가자 기기에도 똑같이 보인다 (다 같이 아는 약속이다)', (() => {
        const k = S.pid, kh = S.isHost; S.pid = P2[1]; S.isHost = false;
        const v = view('board'); S.pid = k; S.isHost = kh;
        return v.includes('아침 안 차리기');
      })());
      ck('★참가자는 규칙을 못 바꾼다', (() => {
        const k = S.pid, kh = S.isHost; S.pid = P2[1]; S.isHost = false;
        act('rule-weight', { id:'body', v:'0' });
        const ok = gameWeight('body') === 1.5;
        S.pid = k; S.isHost = kh; return ok;
      })());

      /* 비우면 사라진다 */
      S.view = 'settings'; render(true);
      document.getElementById('in-prize').value = '';
      document.getElementById('in-penalty').value = '';
      act('rule-stake', {});
      ck('  비우면 순위 탭에서도 사라진다',
        !RULE().prize && !view('board').includes('우승 경품'));

      S.room.rule = null; S.room.scores = {}; S.play = null; S.draft = null; S.view = 'lobby';
    }

    /* ════ v0.40.1 전체 점검에서 나온 것들 ════ */
    {
      S.pid = 'h1'; S.isHost = true; S.room.host = 'h1'; S.play = null; S.draft = null;
      S.room.scores = {}; S.room.rule = null; S.room.busy = null;
      const P3 = playing().map(([pid]) => pid);

      /* ── 새로고침해도 방 규칙이 안 사라진다 ──
         ⚠️ 방을 서버에서 다시 만들 때 필드를 빠뜨리면 그 필드는 **다음 저장에서 서버에서도 지워진다.**
            그래서 「진행자가 서버로 보내는 필드」를 전부 **다시 읽어오는지** 기계적으로 대조한다. */
      globalThis.__W = [];
      S.room.rule = { wmode:'game', prize:'경품' };
      pushHostState();
      const pushed = (globalThis.__W || []).filter(x => x[0] === 'update' && x[2] && 'scores' in x[2]).pop();
      const keys = pushed ? Object.keys(pushed[2]).filter(k => k !== 'touchedAt') : [];
      const back = roomFrom({ ...pushed[2], players:{ h1:{ name:'나' } } });
      ck('★★★진행자가 보내는 방 필드를 다시 읽어올 때 하나도 안 빠뜨린다 (' + keys.length + '개)',
        keys.length >= 7 && keys.every(k => k in back));
      ck('  배점·경품이 되살아난다', back.rule && back.rule.prize === '경품');
      ck('★★진행자는 host 를 쓰지 않는다 (끊겼던 옛 진행자가 되돌려놓지 않게)', !('host' in pushed[2]));
      S.room.rule = null;

      /* ── 내보낸 사람이 유령으로 안 살아난다 ── */
      const ghost = P3[P3.length - 1];
      const keepGhost = S.room.players[ghost];
      S.room.players[ghost] = { seen: Date.now() };             // 하트비트가 되살린 모양
      ck('★★★이름 없는 유령 노드는 선수 명단에 안 들어간다', !playing().some(([pid]) => pid === ghost));
      let boardOk = true;
      try{ view('board'); }catch(e){ boardOk = false; }
      ck('★★순위 탭이 유령 때문에 멈추지 않는다', boardOk && document.getElementById('view').innerHTML.length > 100);
      globalThis.__W = [];
      applySnapshot({ host:'h1', players:{ ...S.room.players, [ghost]:{ seen:Date.now() } },
        teams:S.room.teams, scores:{}, rotation:{}, used:{} });
      ck('★★진행자가 서버의 유령 노드를 치운다',
        (globalThis.__W || []).some(x => x[0] === 'remove' && String(x[1]).endsWith('/players/' + ghost)));
      S.room.players[ghost] = keepGhost;

      /* 내보내진 기기는 스스로 나간다 */
      { const keep = { pid:S.pid, host:S.isHost, code:S.code, room:S.room };
        S.pid = ghost; S.isHost = false;
        const others = { ...S.room.players }; delete others[ghost];
        applySnapshot({ host:'h1', players:others, teams:S.room.teams, scores:{}, rotation:{}, used:{} });
        ck('★★★내보내진 기기는 스스로 방을 나온다 (하트비트로 유령을 되살리지 않게)', S.code === null);
        Object.assign(S, { pid:keep.pid, isHost:keep.host, code:keep.code, room:keep.room }); }

      /* ── 진행 중 표시(busy)는 진행자 기기가 서버에 싣는다 ── */
      globalThis.__W = [];
      S.gameId = 'act'; act('tool-start', {});
      ck('★★도구를 켜면 서버에 「진행 중」이 실린다',
        S.room.busy === 'act' && (globalThis.__W || []).some(x => x[2] && x[2].busy === 'act'));
      act('pl-quit', {}); S.play = null; render(true);
      ck('  끄면 풀린다', !S.room.busy);

      /* ── 진행자에서 내려올 때: 타이머·작성 중 순위를 치운다 ── */
      S.gameId = 'chosung'; act('tool-start', {}); act('score-start', {});
      const zombie = setInterval(() => {}, 100000); S.play = { gameId:'x', kind:'deck', _t:zombie };
      S.draft = S.draft || { order:[], tie:[] }; S.view = 'score';
      applySnapshot({ host:P3[1], players:S.room.players, teams:S.room.teams, scores:{}, rotation:{}, used:{} });
      ck('★★★내려오면 작성 중이던 순위를 버린다 (저장해도 사라질 판을 만들지 않게)',
        S.isHost === false && !S.draft && S.view !== 'score');
      ck('★★내려오면 진행 도구 타이머도 멈춘다 (좀비 타이머 방지)', !S.play);
      clearInterval(zombie);
      /* 그래도 순위 화면에 남아 저장을 누르면 막는다 */
      S.draft = { gameId:'act', mode:'solo', order:[P3[0], P3[1]], tie:[0,0], weight:1, assign:{} };
      const nScore = Object.keys(S.room.scores).length;
      act('score-save', {});
      ck('★★진행자가 아닌 기기는 순위를 저장하지 못한다', Object.keys(S.room.scores).length === nScore);
      S.pid = 'h1'; S.isHost = true; S.room.host = 'h1'; S.draft = null; S.play = null; S.view = 'lobby';

      /* ── 옛 진행자의 밀린 쓰기가 덮으면 진행자가 되세운다 ── */
      S.room.scores = { a:{ gameId:'act', mode:'solo', order:[P3[0], P3[1]], weight:1, assign:{}, at:1 } };
      pushHostState();
      /* RTDB 흉내: 빈 객체는 사라지고 키 순서가 바뀐다 — 이걸 「다르다」고 보면 무한히 밀어댄다 */
      const rtdb = x => {
        if (Array.isArray(x)) return x.map(rtdb);
        if (x && typeof x === 'object'){
          const o = {}; for (const k of Object.keys(x).reverse()){
            const v = rtdb(x[k]);
            if (v === null || v === undefined) continue;
            if (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) continue;
            o[k] = v; }
          return o; }
        return x;
      };
      const snap = () => rtdb({ host:'h1', players:S.room.players, teams:S.room.teams, scores:S.room.scores,
        rotation:S.room.rotation, used:S.room.used, rule:S.room.rule, busy:S.room.busy });
      _hostReassertAt = 0; globalThis.__W = [];
      applySnapshot(snap());
      ck('★★★같은 내용이면 다시 밀지 않는다 (RTDB 가 모양을 바꿔도 — 무한 반복 방지)',
        !(globalThis.__W || []).some(x => x[0] === 'update'));
      const stale = snap(); stale.scores = {};                       // 옛 진행자가 덮어버림
      _hostReassertAt = 0; globalThis.__W = [];
      applySnapshot(stale);
      ck('★★★서버가 옛 값으로 덮이면 진행자가 자기 값을 되세운다',
        (globalThis.__W || []).some(x => x[0] === 'update' && x[2].scores && x[2].scores.a));
      globalThis.__W = [];
      applySnapshot(stale);
      ck('  되세우기는 5초에 한 번까지 (혹시 모를 반복 방지)', !(globalThis.__W || []).some(x => x[0] === 'update'));
      S.room.scores = {};

      /* ── 동점 ── */
      S.gameId = 'act'; act('tool-start', {}); act('score-start', {});
      [P3[0], P3[1], P3[2]].forEach(id => act('pickrank', { id }));
      act('tie', { i:'1' });
      const sv = view('score');
      ck('★★순위 화면에서 공동 순위를 고를 수 있다', sv.includes('data-act="tie"') && sv.includes('공동 ✓'));
      act('score-save', {});
      const trec = Object.values(S.room.scores).pop();
      const tp = calcPoints();
      ck('★★★공동 1등은 둘 다 10점, 다음은 3등 점수(1·1·3 방식)',
        tp[P3[0]] === 10 && tp[P3[1]] === 10 && tp[P3[2]] === 5);
      ck('  기록에 공동 순위가 남는다', Array.isArray(trec.tie) && trec.tie[1] === 1);
      S.room.scores = {};
      /* 도구 결과는 같은 점수를 **알아서** 공동으로 넘긴다 */
      S.gameId = 'quiz'; act('tool-start', {});
      S.play.log = [];                                         // 아무도 못 맞힘 = 전원 0개
      act('quiz-save', {});
      ck('★★★퀴즈에서 전원 0개면 전원 공동 1등으로 넘어간다 (입장 순서로 점수가 갈리지 않게)',
        S.draft && S.draft.tie.slice(1).every(x => x === 1));
      S.draft = null; S.play = null;

      /* ── 기록형: 나간 사람 · 실패끼리 ── */
      S.gameId = 'cup'; act('tool-start', {});
      const cp = S.play; const [r1, r2, r3] = cp.order;
      cp.rec = { [r1]:5.1, [r2]:null, [r3]:null };
      const keepR1 = S.room.players[r1]; delete S.room.players[r1];     // 1위가 나갔다
      act('race-save', {});
      ck('★★★나간 사람은 순위에서 빠진다 (1위 자리를 없는 사람이 차지하지 않게)',
        S.draft && !S.draft.order.includes(r1));
      ck('  실패한 사람끼리는 공동 순위다',
        S.draft.tie[S.draft.order.indexOf(r3)] === 1 || S.draft.tie[S.draft.order.indexOf(r2)] === 1);
      S.room.players[r1] = keepR1; S.draft = null; S.play = null;

      /* ── 연기 대결: 다음 사람 연타 ── */
      S.gameId = 'act'; act('tool-start', {});
      act('ac-next', { turn:'0' }); act('ac-next', { turn:'0' });
      ck('★★「다음 사람」을 두 번 눌러도 한 명만 넘어간다', S.play.turn === 1);
      S.play = null;

      /* ── 한 판 안에서 제시어 반복 ── */
      S.play = { gameId:'body', kind:'deck', drawn:new Set(['사자', '호랑이']) };
      const pk = freshPick('body', [{ w:'사자' }, { w:'호랑이' }, { w:'기린' }], 1);
      ck('★★이번 판에 이미 나온 제시어는 덱을 다시 만들어도 안 나온다',
        pk.list.length === 1 && pk.list[0].w === '기린');
      S.play = null;

      S.gameId = null; S.view = 'lobby'; S.room.scores = {};
    }

    /* ════ 🎮 게임 로비 — 고르기 → 준비 → 시작 (v0.41.0) ════
       사장님: "실제 게임 느낌처럼 방에서 게임을 선택하고 다들 레디하고 게임 시작" */
    {
      S.pid = 'h1'; S.isHost = true; S.room.host = 'h1'; S.play = null; S.draft = null;
      S.room.next = null; S.room.busy = null; S.room.scores = {};
      S.room.teams = { count:0, assign:{} };
      Object.values(S.room.players).forEach(p => { delete p.ready; });
      const PL = playing().map(([pid]) => pid);
      const human = PL.find(pid => pid !== 'h1' && !isBot(pid));
      const as = (pid, fn) => { const k = [S.pid, S.isHost]; S.pid = pid; S.isHost = pid === S.room.host;
        try{ return fn(); } finally { [S.pid, S.isHost] = k; } };

      /* 사람 참가자 하나를 만든다(봇은 알아서 준비라 검사에 못 쓴다) */
      const guest = human || 'g_guest';
      if (!human) S.room.players[guest] = { name:'손님', joinedAt:9e12, seen:Date.now() };

      /* ① 아직 안 골랐다 */
      ck('★★진행자 대기실에 「게임 고르기」가 있다', view('lobby').includes('data-act="go-games"'));
      ck('  참가자는 「고르는 중」과 어디서 고르는지를 본다', (() => {
        const v = as(guest, () => view('lobby'));
        return v.includes('고르는 중') && v.includes('메인 화면에서 고르면');
      })());
      ck('  참가자에게는 「게임 고르기」 버튼이 없다', !as(guest, () => view('lobby')).includes('data-act="go-games"'));

      /* ② 진행자가 고른다 */
      globalThis.__W = [];
      act('next-set', { id:'chosung' });
      ck('★★★진행자가 고르면 다음 게임이 정해진다', NEXT() && NEXT().g === 'chosung' && S.view === 'lobby');
      ck('★★서버에도 다음 게임이 나간다',
        (globalThis.__W || []).some(x => x[2] && x[2].next && x[2].next.g === 'chosung'));
      ck('  참가자는 고를 수 없다', as(guest, () => { act('next-set', { id:'quiz' }); return NEXT().g === 'chosung'; }));

      /* ③ 참가자 화면: 게임 카드 + 준비 */
      const gv = as(guest, () => view('lobby'));
      ck('★★★참가자 대기실에 다음 게임과 준비 버튼이 뜬다',
        gv.includes('초성 퀴즈') && gv.includes('data-act="ready"') && />\s*준비<\/button>/.test(gv));
      ck('  규칙을 바로 볼 수 있다', gv.includes('data-act="game" data-id="chosung"'));
      const hv = view('lobby');
      ck('★★진행자 대기실에는 게임 시작 버튼이 있다', hv.includes('data-act="game-start"'));

      /* ── ★ 대기실이 「게임 로비」처럼 보이는가 (v0.45.0) ──
         사장님: "보통의 게임 같은 대기실 느낌이 안 들어 — **어떤 게임을 설정하는지가 눈에 잘
         보여야** 하고, 고른 게임이 **다른 사람들에게도** 나와야 하고, **그 게임 설명을 볼 수
         있어야** 하고, 폰으로 보니까 **세로 레이아웃**이 맞아야 한다" */
      {
        /* ① 고른 게임이 진행자·참가자 **양쪽** 대기실에 이름과 한 줄로 뜬다 */
        const G0 = G('chosung');
        for (const [who, v] of [['진행자', hv], ['참가자', gv]]){
          ck(`★★★${who} 대기실에 고른 게임의 이름과 설명 한 줄이 뜬다`,
            v.includes(G0.name) && v.includes(G0.line || G0.tag));
        }
        /* ② 설명을 **대기실 안에서** 펼쳐 본다 — 진행 순서와 이기는 조건이 거기 있다.
           ⚠️ 「규칙 버튼이 있다」로 검사하면 안 된다. 그건 **다른 화면으로 나가는 것**이라
              사장님이 지적한 그 불편(준비 버튼과 멀어진다)이 그대로 남는다. */
        ck('★★★설명이 대기실 안에 들어 있다 (화면을 떠나지 않아도 된다)',
          gv.includes('어떻게 하나요?') && (G0.how || []).every(x => gv.includes(x)));
        ck('  이기는 조건도 같이 있다', !G0.win || gv.includes(G0.win));
        ck('  접힌 채로 시작한다 (펼친 채면 참가자 목록이 화면 밖으로 밀린다)',
          /<details class="np-how">(?!\s*<summary[^>]*open)/.test(gv) && !/np-how[^>]*\sopen/.test(gv));
        ck('  자세한 규칙으로 가는 길은 그대로 있다', gv.includes('data-act="game" data-id="chosung"'));

        /* ③ 게임을 고르면 방 코드는 한 줄로 비킨다 — 주인공이 둘이면 둘 다 안 보인다 */
        ck('★★고른 뒤 방 코드가 한 줄로 비킨다', hv.includes('rc slim') && !hv.includes('class="rc-v"'));
        ck('  그래도 코드는 계속 보인다 (늦게 오는 친구가 묻는다)', hv.includes('rc-mini'));
        const keepNext = NEXT();
        S.room.next = null;
        ck('★안 골랐을 때는 방 코드가 크다', (() => { const v = view('lobby');
          return v.includes('class="rc-v"') && !v.includes('rc slim'); })());
        S.room.next = keepNext;

        /* ④ 세로(폰)에서 **게임 바로 아래가 참가자**다. 설정 부스러기는 그 뒤로.
           ⚠️ DOM 순서로는 못 믿는다 — 묶음은 가로 2단 기준이고 세로는 CSS order 가 세운다.
              그래서 **실제로 그려진 자리(top)** 로 잰다. */
        S.view = 'lobby'; render(true);
        const topOf = sel => { const e = document.querySelector(sel);
          return e ? e.getBoundingClientRect().top : null; };
        const tGame = topOf('.nextp'), tPl = topOf('.pchips'), tDev = topOf('.seg2');
        ck('★★★세로 순서: 게임 → 참가자 → 이 기기' +
            ` (${Math.round(tGame)} · ${Math.round(tPl)} · ${Math.round(tDev)})`,
          tGame != null && tPl != null && tDev != null && tGame < tPl && tPl < tDev);
        ck('  (이 검사가 살아 있다 — 가로 2단이면 자리가 달라진다)', innerWidth < 860 || innerWidth / innerHeight < 1.25);

        /* ⑤ 준비한 사람은 **칩 자체가** 바뀐다 (작은 글씨를 하나하나 읽지 않아도 된다) */
        const anyReady = playing().some(([pid,pl]) => readyOf(pid, pl));
        ck('★준비한 사람의 칩에 표시가 붙는다', anyReady && view('lobby').includes('rdy-on'));
      }
      ck('  진행자와 봇은 알아서 준비된다', readyOf('h1', S.room.players.h1)
        && PL.filter(isBot).every(pid => readyOf(pid, S.room.players[pid])));
      ck('  사람 참가자는 아직 준비 전이다', !readyOf(guest, S.room.players[guest]));

      /* ④ 준비 — 자기 칸에만 쓴다 */
      globalThis.__W = [];
      as(guest, () => act('ready', {}));
      ck('★★★✋ 준비를 누르면 준비된다', readyOf(guest, S.room.players[guest]));
      const w = (globalThis.__W || []).filter(x => x[0] === 'update' || x[0] === 'set');
      ck('★★준비는 **자기 칸에만** 쓴다 (새 쓰기 예외를 만들지 않는다)',
        w.length === 1 && String(w[0][1]).endsWith('/players/' + guest) && w[0][2].ready === NEXT().at);
      ck('  카드에 준비 수가 오른다', (() => { const [a, b] = readyCount(); return a === b; })());
      as(guest, () => act('ready', {}));
      ck('  한 번 더 누르면 준비가 풀린다', !readyOf(guest, S.room.players[guest]));

      /* ⑤ 게임을 바꾸면 준비가 저절로 풀린다(남의 칸을 안 건드리고) */
      as(guest, () => act('ready', {}));
      const oldAt = NEXT().at;
      S.room.next.at = oldAt - 1000;                 // 「조금 전에 고른 것」으로 만들어두고
      S.room.players[guest].ready = S.room.next.at;
      globalThis.__W = [];
      act('next-set', { id:'quiz' });
      ck('★★★게임을 바꾸면 전원의 준비가 풀린다', !readyOf(guest, S.room.players[guest]));
      ck('  그러려고 남의 칸에 쓰지 않는다',
        !(globalThis.__W || []).some(x => String(x[1]).includes('/players/' + guest)));

      /* ⑥ 준비 안 한 사람이 있으면 확인하고 시작 */
      act('game-start', {});
      ck('★★★준비 안 한 사람이 있으면 경고창으로 확인한다',
        !!S.ask && S.ask.go === 'game-start-go' && (S.ask.lose || []).join('').includes(pname(guest)));
      ck('  아직 시작하지 않는다', !S.play);
      act('ask-yes', {});
      ck('★★★「그래도 시작」이면 그 게임 도구가 열린다', S.play && S.play.gameId === 'quiz' && S.view === 'play');
      render(true);
      ck('★★시작하면 서버에 「진행 중」이 실린다', S.room.busy === 'quiz');
      act('pl-quit', {}); if (S.ask) act('ask-yes', {});
      ck('  도구를 그냥 나가면 대기실로 (게임 탭이 없다)', S.view === 'lobby' && !S.play);
      ck('  나가도 다음 게임은 그대로 — 바로 다시 시작할 수 있다', NEXT() && NEXT().g === 'quiz');

      /* ⑦ 전원 준비면 바로 시작 */
      S.room.players[guest].ready = NEXT().at;
      act('game-start', {});
      ck('★★★전원 준비면 확인 없이 바로 시작한다', !S.ask && S.play && S.play.gameId === 'quiz');
      render(true);

      /* ⑧ 참가자는 시작을 따라간다 */
      const snapOf = extra => ({ host:'h1', players:S.room.players, teams:S.room.teams, scores:S.room.scores,
        rotation:{}, used:{}, next:S.room.next, ...extra });
      { const keep = { room:S.room, view:S.view, play:S.play };
        S.pid = guest; S.isHost = false;
        S.room = { ...keep.room, busy:null }; S.view = 'board';
        applySnapshot(snapOf({ busy:'quiz' }));
        ck('★★★진행자가 시작하면 참가자 화면이 대기실로 넘어와 「진행 중」을 본다',
          S.view === 'lobby' && document.getElementById('view').innerHTML.includes('진행 중'));
        S.room = { ...S.room, busy:'quiz' }; S.view = 'board';
        applySnapshot(snapOf({ busy:'quiz' }));
        ck('  이미 진행 중이던 스냅샷에는 끌고 가지 않는다(보던 화면 유지)', S.view === 'board');
        S.room = { ...S.room, busy:null }; S.view = 'board';
        applySnapshot(snapOf({ busy:'score' }));
        ck('  「순위만 직접 입력」은 시작이 아니다', S.view === 'board');
        S.pid = 'h1'; S.isHost = true; S.room = keep.room; S.view = keep.view; S.play = keep.play; }

      /* ⑨ 팀전인데 팀이 없으면 시작 못 한다 */
      act('pl-quit', {}); if (S.ask) act('ask-yes', {});
      act('next-set', { id:'body' });
      const tv = view('lobby');
      ck('★★팀전인데 팀을 안 나눴으면 시작 버튼이 잠기고 이유가 뜬다',
        /data-act="game-start"[^>]*disabled/.test(tv) && tv.includes('팀을 먼저 나눠주세요'));

      /* ⑩ 한 판 끝(순위 저장)이면 다음 게임을 비운다 */
      act('next-set', { id:'act' });
      act('game-start-go', {});
      act('score-start', {});
      act('pickrank', { id:PL[0] }); act('pickrank', { id:PL[1] });
      act('score-save', {});
      ck('★★★순위를 올리면 대기실은 다시 「게임 고르기」로 돌아간다', !NEXT());

      if (!human) delete S.room.players[guest];
      S.room.scores = {}; S.play = null; S.draft = null; S.room.busy = null; S.view = 'lobby';
    }

    /* ════ ✦ 모임 이름 · 부르는 이름 통일 (v0.42.0) ════
       사장님: "모임 이름을 정하고 멋있게 꾸며 내부에도 배치하면 소속감 있는 게임" ·
              "방장·태블릿·사회자 용어가 산재해 직관적이지 않다" */
    {
      S.pid = 'h1'; S.isHost = true; S.room.host = 'h1'; S.play = null; S.draft = null;
      S.room.next = null; S.room.busy = null; S.room.title = null; S.room.scores = {};

      /* 방 만들 때 적는 자리 — **선택**이라 비워도 된다 */
      { const keep = S.code; S.code = null;
        const hv = view('home');
        ck('★★방 만들기 화면에 모임 이름 칸이 있다',
          hv.includes('id="in-title"') && hv.includes('모임 이름'));
        ck('  선택이라고 알려준다', hv.includes('(선택)'));
        S.code = keep; }

      /* 메인 화면에서만 정한다 */
      S.view = 'settings'; render(true);
      ck('★설정에 모임 이름 칸이 있다', !!document.getElementById('in-gname'));
      globalThis.__W = [];
      document.getElementById('in-gname').value = '  양양 2박 3일  ';
      act('gname-save', {});
      ck('★★★모임 이름이 방에 저장된다 (앞뒤 공백은 떼고)', ROOM_TITLE() === '양양 2박 3일');
      ck('★★서버에도 나간다', (globalThis.__W || []).some(x => x[2] && x[2].title === '양양 2박 3일'));

      /* 다 같이 보는 자리에 뜬다 */
      const lv2 = view('lobby');
      ck('★★★대기실 방 코드 카드에 모임 이름이 뜬다',
        lv2.includes('gname') && lv2.includes('양양 2박 3일'));
      ck('★★순위 탭에도 뜬다', view('board').includes('양양 2박 3일'));
      /* ⚠️ 클래스 이름이 겹치면 **조용히 거대한 빈 상자**가 된다 — 예전에 `.gname.board` 가
         말판 `.board`(aspect-ratio:1/1)에 걸려 445px 정사각형이 됐었다. 높이로 못 박는다. */
      { S.view = 'board'; render(true);
        const el = document.querySelector('.gname');
        const hgt = el ? Math.round(el.getBoundingClientRect().height) : -1;
        ck('  모임 이름 줄이 한 줄 높이다 (' + hgt + 'px — 클래스 이름 충돌 방지)', hgt > 0 && hgt < 90); }
      S.view = 'lobby'; render(true);
      ck('★머리글도 모임 이름이 된다', document.getElementById('hd-t').textContent === '양양 2박 3일');

      /* 참가자 기기에도 똑같이 — 같은 모임이라는 느낌이 핵심이다 */
      { const k = [S.pid, S.isHost]; S.pid = players()[1][0]; S.isHost = false;
        ck('★★★참가자 기기에도 모임 이름이 보인다', view('lobby').includes('양양 2박 3일'));
        [S.pid, S.isHost] = k; }
      ck('★참가자는 모임 이름을 못 바꾼다', (() => {
        const k = [S.pid, S.isHost]; S.pid = players()[1][0]; S.isHost = false;
        S.view = 'settings'; render(true);
        const none = !document.getElementById('in-gname');
        act('gname-save', {});
        [S.pid, S.isHost] = k; S.isHost = true;
        return none && ROOM_TITLE() === '양양 2박 3일';
      })());

      /* 이름에 HTML 을 넣어도 실행되지 않는다 */
      S.view = 'settings'; render(true);
      document.getElementById('in-gname').value = '<img src=x onerror=1>';
      act('gname-save', {});
      const lv3 = view('lobby');
      ck('★★★모임 이름이 HTML 로 실행되지 않는다',
        !lv3.includes('<img src=x') && lv3.includes('&lt;img'));

      /* 비우면 사라진다 */
      S.view = 'settings'; render(true);
      document.getElementById('in-gname').value = '';
      act('gname-save', {});
      ck('  비우면 방 코드만 뜬다', !ROOM_TITLE() && !view('lobby').includes('gname'));

      /* 지난 기록에도 남는다 — 방이 사라져도 「그때 그 모임」으로 */
      S.room.title = '양양 2박 3일';
      S.room.scores = { a:{ gameId:'act', mode:'solo', order:players().slice(0,2).map(([p])=>p),
        weight:1, assign:{}, at:1 } };
      _histSig = null; snapRoom();
      const rec0 = histAll()[0];
      ck('★★★지난 기록에 모임 이름이 남는다', rec0 && rec0.t === '양양 2박 3일');
      ck('  홈 기록 줄에도 보인다', view('home').includes('양양 2박 3일'));

      /* ── 부르는 이름은 둘뿐: 메인 화면 · 구경 모드 ── */
      S.room.title = null; S.room.scores = {}; S.view = 'lobby'; render(true);
      const old = ['진행자', '사회자', '호스트', '방장'];
      const screens = ['home', 'lobby', 'games', 'board', 'settings'];
      const bad = [];
      /* ⚠️ HTML 주석은 화면 글이 아니다 — 안 빼면 코드 주석 때문에 헛걸린다 */
      const visible = v => view(v).replace(/<!--[\s\S]*?-->/g, '');
      for (const v of screens){
        const html = visible(v);
        for (const w of old) if (html.includes(w)) bad.push(v + ':' + w);
      }
      S.gameId = 'body'; const gv9 = visible('game');
      for (const w of old) if (gv9.includes(w)) bad.push('game:' + w);
      ck('★★★화면 글에 옛 용어(진행자·사회자·호스트·방장)가 없다' + (bad.length ? ' — ' + bad.slice(0,4).join(', ') : ''),
        !bad.length);
      ck('  대신 「메인 화면」과 「구경 모드」를 쓴다',
        view('lobby').includes('메인 화면') && view('lobby').includes('구경 모드'));

      /* ── ★ 장식용 그림글자(이모지) 금지 (v0.44.0) ──
         사장님: "너무 사이트가 AI로 만든 것 같은 느낌이 드는데"
         버튼·구역 제목·칩마다 그림글자를 달면 **어느 기기에나 있는 그림을 가져다 붙인
         화면**처럼 보인다. 그래서 화면 글에서 그림글자를 **전부** 걷어냈다.
         ⚠️ 딱 둘만 예외다 — 그건 장식이 아니라 **내용**이기 때문이다:
            ① 게임의 얼굴(GAMES[].emoji)  ② 덱·퀴즈 범위의 얼굴(DECKS/QUIZ 의 emoji)
         ⚠️ ✓ ✕ ○ × → ‹ › · ★ 같은 **글자**는 그림글자가 아니다(어느 글꼴에나 같은 모양으로
            있고 줄을 흐트리지 않는다) — 여기서 안 잡는다.
         ⚠️ 이 검사를 「없으면 통과」로 두지 말 것: 아래 bad2 가 **빈 배열이어도** 통과라
            헛통과하기 쉽다. 그래서 바로 뒤에 **일부러 그림글자를 넣어 걸리는지** 확인한다. */
      const PICTO = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2B00}-\u{2BFF}\u{FE0F}]|\u26A0|\u{1F3B2}/gu;
      const okEmo = new Set([
        ...GAMES.map(g => g.emoji),
        ...Object.values(WORD_DECKS).map(d => d.emoji),
        ...Object.values(QUIZ_DECKS).map(d => d.emoji),
      ].filter(Boolean));
      const picto = html => {
        let t = html;
        for (const e of okEmo) t = t.split(e).join('');   // 내용인 얼굴 그림은 빼고 본다
        return [...new Set((t.match(PICTO) || []))];
      };
      const bad2 = [];
      for (const v of [...screens, 'hist']){
        const f = picto(visible(v));
        if (f.length) bad2.push(v + ':' + f.join(''));
      }
      for (const gid of GAMES.map(g => g.id)){
        S.gameId = gid; const f = picto(visible('game'));
        if (f.length) bad2.push(gid + ':' + f.join(''));
      }
      S.gameId = null;
      ck('★★★화면 글에 장식용 그림글자가 없다' + (bad2.length ? ' — ' + bad2.slice(0,4).join(' / ') : ''),
        !bad2.length);
      ck('  (이 검사가 살아 있다 — 일부러 넣으면 걸린다)', picto('<b>시작 🎉</b>').length === 1);
      ck('  게임의 얼굴 그림은 그대로 둔다', visible('games').includes(GAMES[0].emoji));

      /* ── ★ 그라데이션 글자·주색 그라데이션 금지 (v0.44.0) ──
         글자에 비스듬한 색 띠를 입히면(-webkit-background-clip:text) 화려하지만
         **어느 화면에나 같은 띠**가 깔려 틀로 찍은 것처럼 보이고 글씨도 흐려진다.
         색은 --hot 한 가지로 평평하게 쓴다. */
      /* ⚠️ 이 검사 자신이 `background-clip:text` 라는 글자를 품고 있다 — 문서 전체를
            훑으면 **검사 코드가 자기 자신에 걸린다**(처음에 그렇게 짰다가 헛실패했다).
            그래서 ① <style> 안과 ② 화면이 그려 낸 글(style= 속성 포함)만 본다. */
      const css = document.querySelector('style')?.textContent || '';
      const clipped = [...screens, 'hist'].filter(v => visible(v).includes('background-clip'));
      ck('★★그라데이션 글자가 한 곳도 없다' + (clipped.length ? ' — ' + clipped.join(', ') : ''),
        !/background-clip:\s*text/.test(css) && !clipped.length);
      ck('★주색 그라데이션(--hero) 토큰이 없다', !/--hero\s*:/.test(css));
      ck('  색 번짐 그림자(--glow) 토큰도 없다', !/--glow\s*:/.test(css));

      S.view = 'lobby';
    }

    /* ── 9) 정리 ── */
    ck('타이머 정리', S.play === null || !S.play._t);
    ck('봇 정리', (clearBots() > 0) && players().length === 1);

    L.push(bad ? `‼ 실패 ${bad}건` : '✅ 전부 통과');
    document.title = L.join(' ## ');
  }catch(e){ document.title = 'ERR ' + e.message + ' @@ ' + String(e.stack || '').slice(0, 200); }
}
