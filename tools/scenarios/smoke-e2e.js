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

    /* ── 5.2) 🎵 노래 맞히기 (song) ──
       ⚠️ 이 게임의 정답은 **곡 제목**이고, 그걸 진행자가 봐야 노래를 튼다.
          그래서 초성 퀴즈와 반대로 「.priv 를 반드시 붙여야」 한다 —
          태블릿 공용 화면에서 커지면 그 자리에서 게임이 끝난다. */
    S.room.used = {};
    S.gameId = 'song'; go('game'); act('tool-start', {});
    ck('song 진입', S.play?.kind === 'song' && S.play.phase === 'setup');
    say('곡 데이터', SONG_KEYS.length + '범위 ' + songPool(SONG_KEYS).length + '곡');
    ck('★범위가 연도별로 나뉘어 있다',
      ['y90','y20'].every(k => SONG_KEYS.includes(k)));
    ck('  전 범위에 이름·이모지·곡 있음',
      SONG_KEYS.every(k => SONG_DECKS[k].name && SONG_DECKS[k].emoji && SONG_DECKS[k].songs.length >= 15));
    ck('  곡마다 제목과 가수가 다 있다',
      songPool(SONG_KEYS).every(x => x.w && x.a));
    // ⚠️ songPool() 은 이미 중복을 걸러 돌려준다 — 그걸 자기 자신과 비교하면 **항상 통과**한다.
    //    원본 SONG_DECKS 배열을 봐야 진짜 중복이 잡힌다.
    {
      const raw = SONG_KEYS.flatMap(k => SONG_DECKS[k].songs.map(x => x[0] + '|' + x[1]));
      const dup = [...new Set(raw.filter((x,i) => raw.indexOf(x) !== i))];
      ck('★같은 곡이 두 범위에 들어가 있지 않다', dup.length === 0);
      if (dup.length) say('  중복:', dup.slice(0,5).join(' / '));
    }
    ck('★시대가 다섯으로 나뉘어 있다',
      ['y80','y90','y00a','y00b','y10a','y10b','y20'].every(k => SONG_KEYS.includes(k)));
    ck('  곡이 충분히 많다(300곡 이상)', songPool(SONG_KEYS).length >= 300);
    ck('★사회자 전담 게임이다 (트는 사람이 답을 보므로)',
      G('song').mc === 'need' && G('song').minP >= 3);

    S.play.cats = ['y10b']; S.play.n = 3;
    act('song-start', {});
    ck('곡 뽑힘', S.play.phase === 'run' && !!S.play.cur?.w);

    // ⚠️ 곡을 **고정**한다. 랜덤으로 뽑으면 「I」(태연) 같은 한 글자 제목이 걸리는 순간
    //    화면 아무 데나 매칭돼서 「.priv 밖에 제목이 없다」가 **가끔** 실패한다.
    //    랜덤하게 실패하는 검사는 사람을 길들여 진짜 실패까지 무시하게 만든다.
    S.play.cur = { w:'벚꽃엔딩', a:'버스커 버스커', c:'y10a' };
    const sv = view('play');
    {
      // ⚠️ 앞의 정규식은 사실상 아무거나 통과했다(`[\s\S]{0,400}?[^<>]*`).
      //    「.priv 블록 **안에** 제목이 있고, 블록을 지우면 **밖엔 없다**」로 정확히 본다.
      const priv = (sv.match(/<div class="wcard priv">[\s\S]*?<\/div>\s*<\/div>/) || [''])[0];
      ck('★★정답(제목)이 .priv 안에 있다',
        priv.includes(S.play.cur.w) && sv.includes('사회자만 보세요'));
      ck('★★.priv 밖에는 곡 제목이 없다',
        !sv.replace(priv, '').includes(S.play.cur.w));
    }
    ck('★유튜브 뮤직 딥링크가 걸려 있다',
      sv.includes('music.youtube.com/search?q=') && sv.includes('target="_blank"'));
    ck('  딥링크에 제목과 가수가 함께 들어간다', (() => {
      const m = sv.match(/href="(https:\/\/music\.youtube\.com[^"]+)"/);
      if (!m) return false;
      const q = decodeURIComponent(m[1].split('q=')[1] || '');
      return q.includes(S.play.cur.w) && q.includes(S.play.cur.a);
    })());

    const s1 = S.play.cur.w;
    act('song-hit', { pid:P[1] });
    ck('맞히면 +1 후 다음 곡', songScores()[P[1]] === 1 && S.play.cur.w !== s1);
    act('song-undo', {});
    ck('방금 취소 — 점수·곡 복구', songScores()[P[1]] === 0 && S.play.cur.w === s1);
    act('song-pass', {});
    ck('정답 공개 단계', S.play.phase === 'reveal');
    ck('★공개하면 그때 제목이 크게 뜬다', (() => {
      const v = view('play');
      return v.includes(S.play.cur.w) && !/wcard priv/.test(v);
    })());
    act('song-skip', {});
    act('song-hit', { pid:P[2] }); act('song-hit', { pid:P[2] });
    ck('★곡 수를 채우면 자동 종료', S.play.phase === 'done' && S.play.log.length === 3);
    ck('종료 화면에 가수까지 공개', view('play').includes(S.play.log[0].a));
    ck('★판이 끝나면 중복 방지에 기록된다', usedWords('song').size === 3);
    act('song-save', {});
    ck('song 순위 화면', S.view === 'score' && S.play === null);
    ck('★많이 맞힌 사람이 1등', S.draft.order[0] === P[2]);
    act('score-cancel', {});
    S.room.used = {};

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
    act('used-reset', {});
    ck('★초기화하면 기록이 지워진다', usedWords('chosung').size === 0);
    act('tool-start', {}); S.play.cats = ['movie']; S.play.n = 10;
    act('cho-start', {});
    ck('  초기화 후에는 전체 풀에서 다시 낸다',
      S.play.deck.length === choWords(['movie']).length);
    act('pl-quit', {});

    /* ③ 남은 게 모자라면 자동으로 비우고 처음부터 (멈추면 안 된다) */
    S.room.used = { chosung: choWords(['movie']).map(x => x.w).slice(0, -2) };
    S.gameId = 'chosung'; go('game'); act('tool-start', {});
    S.play.cats = ['movie']; S.play.n = 10;
    act('cho-start', {});
    ck('★모자라면 자동으로 한 바퀴 돈다', S.play.wrapped === true);
    ck('  자동 순환 시 기록이 비워진다', usedWords('chosung').size === 0);
    ck('  그래도 문제는 정상 출제된다', !!S.play.cur?.w && S.play.deck.length >= 10);
    act('pl-quit', {});
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
    act('pl-quit', {});
    S.room.used = {};
    }

    /* ── 5.45) 🎲 훈민정음 윷놀이 ──
       ⚠️ 각자 폰이 방 노드에 쓰는 유일한 게임 + 규칙이 제일 복잡하다.
          「대각선 통과 vs 방에 멈춤」과 「던진 값을 모아 배분」이 윷놀이의 핵심이다. */
    {
    makeTeams(2);
    S.gameId = 'yut'; go('game'); act('tool-start', {});
    ck('yut 진입', S.play?.kind === 'yut');
    act('yut-start', {});
    const m = () => S.room.yut;
    ck('★판이 깔린다', m().phase === 'play' && m().pieces.length === 2);
    ck('  팀마다 말 4개가 집에서 시작', m().pieces.every(a => a.length === 4 && a.every(x => x === -1)));
    ck('★판이 29칸이다 (외곽20 + 대각선8 + 방1)', YUT_CELLS.filter(Boolean).length === 29);

    /* ── 판 규칙: 여기가 v0.22 에서 제일 많이 틀렸던 곳 ── */
    ck('★★바깥 한 바퀴가 20칸', yutMove(-1, 20) === YUT_HOME && yutMove(-1, 19) === 19);
    ck('★모서리를 지나가면 지름길을 안 탄다', yutMove(4, 2) === 6 && yutMove(9, 2) === 11);
    ck('★모서리에 멈췄다 출발하면 탄다', yutMove(5, 1) === 21 && yutMove(10, 1) === 26);
    ck('★★방을 지나갈 땐 타고 온 대각선을 유지한다',
      yutMove(5, 4) === 24 && yutMove(10, 4) === 28);
    ck('★★방에 멈췄다 출발하면 날 쪽 지름길로 빠진다', yutMove(23, 1) === 28);
    ck('  5 지름길은 반대 모서리(15)로 나간다', yutMove(5, 6) === 15);
    ck('  5 지름길 전체가 11칸', yutMove(5, 11) === YUT_HOME);
    ck('  10 지름길 전체가 6칸', yutMove(10, 6) === YUT_HOME);
    ck('  방에서 나기까지 3칸', yutMove(23, 3) === YUT_HOME);

    /* ── 던진 값을 모아서 배분한다 ── */
    S.view = 'play'; render(true);
    ck('★차례 팀이 던질 수 있다', m().canThrow === true && m().pending.length === 0);
    yutApplyThrow({ n:'윷', v:4, again:true, sticks:[1,1,1,1] }, 'h1');
    ck('★윷이 나오면 한 번 더 던질 수 있다', m().canThrow === true && m().pending.length === 1);
    yutApplyThrow({ n:'도', v:1, again:false, sticks:[1,0,0,0] }, 'h1');
    ck('★★던진 값이 쌓인다 (즉시 이동하지 않는다)',
      m().pending.length === 2 && m().canThrow === false);
    ck('  화면에 고를 결과가 뜬다', view('play').includes('data-act="yut-use"'));
    ck('  윷짝 4개가 그려진다', (view('play').match(/class="stick/g) || []).length >= 4);

    /* 모아둔 값을 골라 배분 — 도로 새 말, 윷으로 그 말 */
    act('yut-use', { i:'1' });                        // 도(1칸) 선택
    act('yut-move', { pos:'-1' });                    // 집에서 새 말
    ck('★고른 값으로 움직인다 (도 → 1번 칸)', m().pieces[0].filter(x => x === 1).length === 4);
    ck('  쓴 값은 사라진다', m().pending.length === 1 && m().pending[0].n === '윷');
    ck('  남은 값이 있으면 턴이 안 넘어간다', m().turn === 0);
    act('yut-use', { i:'0' });
    act('yut-move', { pos:'1' });
    ck('★같은 칸 말은 업고 함께 간다', m().pieces[0].every(x => x === 5));
    ck('★다 쓰면 턴이 넘어간다', m().turn === 1 && m().pending.length === 0 && m().canThrow === true);

    /* ── 잡기 → 한 번 더 던진다 ── */
    S.room.yut.pieces = [[3,-1,-1,-1],[1,-1,-1,-1]];
    S.room.yut.turn = 1; S.room.yut.pending = [{ n:'개', v:2 }]; S.room.yut.canThrow = false;
    S.play.useIdx = 0;
    act('yut-move', { pos:'1' });
    ck('★★상대 말을 잡으면 집으로 보낸다', m().pieces[0][0] === -1);
    ck('★잡으면 한 번 더 던진다', m().canThrow === true && m().turn === 1);

    /* ── 나기(완주) → 승리 ── */
    S.room.yut.pieces = [[0,0,0,0],[19,19,19,19]];
    S.room.yut.turn = 1; S.room.yut.pending = [{ n:'도', v:1 }]; S.play.useIdx = 0;
    act('yut-move', { pos:'19' });
    ck('★말 4개를 다 내보내면 승리', m().phase === 'ended' && m().winner === 1);

    /* ── ✋ 잠시! ── */
    act('yut-start', {});
    S.room.yut.pieces = [[3,7,-1,-1],[1,-1,-1,-1]];
    S.room.yut.turn = 0;
    S.play = { gameId:'yut', kind:'yut', phase:'play', useIdx:0 };
    const other = Object.entries(S.room.teams.assign).find(([,t]) => Number(t) !== 0)?.[0];
    const mine0 = Object.entries(S.room.teams.assign).find(([,t]) => Number(t) === 0)?.[0];
    const meWas = S.pid;
    S.pid = other; act('yut-halt', {}); S.pid = meWas;
    ck('★상대팀이 「잠시!」를 걸 수 있다', !!m().halt && m().halt.team === 0);
    S.pid = mine0; act('yut-halt', {}); S.pid = meWas;
    ck('★우리 팀은 「잠시!」를 못 건다 (이미 걸린 것만 남음)', m().halt.by === other);
    act('yut-halt-ok', {});
    ck('★★인정하면 「그 팀이 고르는」 단계로 간다', !!m().pick && m().pick.team === 0);
    ck('  아직 아무 말도 안 빠졌다', m().pieces[0].filter(x => x === -1).length === 2);
    ck('  영어 횟수는 이때 기록된다', (m().penalty || {})[0] === 1);
    ck('  고르는 화면이 뜬다', view('play').includes('되돌릴 말을 고르세요'));
    // ★ 앞선 말(7) 대신 뒤의 말(3)을 고를 수 있어야 한다
    act('yut-pickback', { pos:'3' });
    ck('★★고른 말이 집으로 간다 (앱이 고르지 않는다)',
      !m().pieces[0].includes(3) && m().pieces[0].includes(7));
    ck('  고르고 나면 pick 이 지워진다', !m().pick && !m().halt);

    /* ── 쓰기 주체 분리 ── */
    S.room.yut.pending = []; S.room.yut.canThrow = true; S.room.yut.turn = 0;
    S.room.yut.throw = { n:'걸', v:3, again:false, sticks:[1,1,1,0], by:mine0 };
    // ⚠️ 던지는 연출이 끝나야 판에 반영된다(연출이 결과를 바꾸진 않는다)
    await yutConsume();
    ck('★★참가자가 던진 결과를 호스트가 반영한다', m().pending.length === 1 && m().pending[0].v === 3);
    ck('★★반영 뒤 throw 를 지운다', !m().throw);
    S.room.yut.throw = { n:'모', v:5, again:true, sticks:[0,0,0,0], by:other };  // 남의 차례
    await yutConsume();
    ck('★남의 차례 던지기는 버린다', m().pending.length === 1 && !m().throw);

    /* ── 화면 ── */
    const sig1 = renderSig(); S.room.yut.turn = 1;
    ck('★★yut 변화가 renderSig 에 잡힌다', renderSig() !== sig1);
    S.room.yut.turn = 0;
    S.pid = mine0; S.view = 'yut'; render(true);
    const ph = document.getElementById('view').innerHTML;
    ck('★폰에 윷 던지기와 잠시!가 있다',
      ph.includes('data-act="yut-throw"') && ph.includes('data-act="yut-halt"'));
    S.pid = meWas; S.view = 'play'; render(true);
    ck('★집에 있는 말을 내보내는 버튼이 있다',
      document.getElementById('view').innerHTML.includes('data-pos="-1"'));

    act('yut-clear', {});
    ck('정리하면 판이 사라진다', !S.room.yut);
    S.view = 'game';
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
    ck('★★진행 화면에 정답이 없다', !runHtml.includes(S.play.cur.w));
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
    ck('  대신 사회자 기기를 안내한다', gv.includes('기기가 사회자를 맡고 있어요'));
    // ★ 요구와 해결이 동시에 뜨면 안 된다 — 갖췄는데도 모자란 것처럼 보였다(v0.21.0에서 고침)
    ck('★★사회자 기기가 있으면 「있어야 깔끔해요」 요구가 사라진다',
      !gv.includes('있어야 깔끔해요'));
    ck('  화면에 답이 있는 게임은 「가운데 두지 말라」를 같이 안내한다',
      gv.includes('가운데 두지 말고'));
    S.room.players[P[0]].spec = false;
    S.view='game'; render(true);
    {
      const gv2 = document.getElementById('view').innerHTML;
      ck('사회자 기기가 없으면 뽑기가 다시 뜬다', gv2.includes('사회자 뽑기'));
      ck('★사회자 기기가 없으면 요구 문구가 다시 뜬다', gv2.includes('있어야 깔끔해요'));
    }
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
