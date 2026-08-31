/* 🎲 훈민정음 윷놀이 — 깊은 검증(자동 대국).
 *
 *   node tools/demo.mjs tools/scenarios/yut-verify.js _y.html
 *   node tools/shot.mjs --dom "/_y.html?demo=1"
 *
 * smoke-e2e 의 윷 항목은 「규칙이 맞는가」를 본다. 여기는 **읽기로는 못 잡는 것**을 본다:
 *   ① 어떤 칸에서 어떤 값이 나와도 판 밖으로 안 나가는가(전수)
 *   ② 판이 반드시 끝나는가 · 무한루프가 없는가(랜덤 대국 반복)
 *   ③ 말 개수·위치 불변식이 판 내내 유지되는가
 *   ④ **매 순간 태블릿에 누를 수 있는 것이 하나는 있는가**(데드락 = 게임이 멈춘다)
 *   ⑤ 호스트가 서버로 밀어내는 patch 가 참가자 화면을 맞게 만드는가
 *
 * ⚠️ 판정은 ck() 실패 개수로 한다(출력 문자열 검색 금지 — v0.16.0 참조).
 */
if (new URLSearchParams(location.search).has('demo')){
  const L = []; let bad = 0;
  const say = (...a) => L.push(a.join(' '));
  const ck  = (label, cond) => { if (!cond) bad++; L.push(label + ': ' + (cond ? 'OK' : '✕FAIL')); return cond; };
  try{
    S.pid = 'h1'; S.code = '0000'; S.isHost = true; S.online = true;
    S.room = emptyRoom(); S.room.host = 'h1';
    S.room.players.h1 = { name:'나', joinedAt:1, seen:Date.now(), host:true };
    addBots(5);
    const view = v => { S.view = v; render(true); return document.getElementById('view').innerHTML; };

    /* ── 1) 이동 전수 검증 ──────────────────────────────────
       어떤 칸에서 어떤 값(1~5)이 나와도 결과가 **판 위의 유효한 칸이거나 완주**여야 한다.
       한 군데라도 undefined/NaN 이 나오면 그 칸을 그리다 화면이 죽는다. */
    const valid = p => p === YUT_HOME || (p >= 0 && p < YUT_CELLS.length && !!YUT_CELLS[p]);
    const froms = [-1, ...YUT_CELLS.map((c, i) => c ? i : null).filter(x => x !== null)];
    let badMove = [];
    for (const f of froms)
      for (let n = 1; n <= 5; n++){
        const d = yutMove(f, n);
        if (!valid(d)) badMove.push(`${f}+${n}→${d}`);
      }
    say('이동 조합', froms.length * 5 + '가지 전수 검사');
    ck('★★어떤 칸에서 어떤 값이 나와도 판 밖으로 안 나간다', badMove.length === 0);
    if (badMove.length) say('  깨진 것:', badMove.slice(0, 8).join(', '));

    /* 도(1)만 반복해도 반드시 완주한다 — 경로에 순환이 있으면 여기서 걸린다 */
    let loop = [];
    for (const f of froms){
      let p = f, steps = 0;
      while (p !== YUT_HOME && steps < 100){ p = yutMove(p, 1); steps++; }
      if (p !== YUT_HOME) loop.push(f);
    }
    ck('★★경로에 순환이 없다 (도만 반복해도 반드시 난다)', loop.length === 0);

    /* 되돌아가는 칸이 없는지 — 한 걸음이 제자리면 무한루프다 */
    ck('  한 걸음이 제자리인 칸이 없다', froms.every(f => yutMove(f, 1) !== f));

    /* ── 2) 판 깔기 ── */
    makeTeams(2);
    S.gameId = 'yut'; go('game'); act('tool-start', {});
    act('yut-start', {});
    const m = () => S.room.yut;
    ck('판이 깔린다', m()?.phase === 'play' && m().pieces.length === 2);

    /* ── 3) 호스트가 서버로 밀어내는 patch 검사 ──────────────
       참가자 폰은 서버 값을 **그대로** 그린다. 호스트 로컬에서만 지워지고
       patch 에 안 담기는 필드가 있으면 참가자 화면만 옛 값을 보게 된다. */
    const _push = pushYut;
    let PATCH = [];
    pushYut = p => { PATCH.push(p); return _push(p); };

    {
      // 도(1) 하나만 던져 쓰면 pending 이 비고 canThrow 도 false → 턴이 넘어간다
      const t0 = m().turn;
      PATCH = [];
      yutApplyThrow({ n:'도', v:1, again:false, sticks:[1,0,0,0] }, 'h1');
      yutMoveFrom(-1, 0);
      ck('★턴이 넘어간다', m().turn !== t0);
      ck('  호스트 로컬에서는 윷짝 표시가 지워진다', m().last === null);
      const merged = Object.assign({}, ...PATCH);
      ck('★★턴이 넘어갈 때 윷짝 표시도 서버에 지워진다 (참가자 폰이 옛 결과를 안 본다)',
        'last' in merged && merged.last === null);
      ck('  턴·pending·canThrow 는 서버로 나간다',
        'turn' in merged && 'pending' in merged && 'canThrow' in merged);
    }
    pushYut = _push;

    /* ── 4) 랜덤 자동 대국 ────────────────────────────────
       연출·소리·컨페티는 끈다(60판을 돌려야 한다). 규칙 함수는 그대로 쓴다. */
    const _conf = confetti, _vib = vib;
    confetti = () => {}; vib = () => {};
    const _sfx = {}; for (const k in SFX){ _sfx[k] = SFX[k]; SFX[k] = () => {}; }
    S.view = 'home';                                   // 렌더를 가볍게

    const GAMES_N = 60, STEP_CAP = 3000;
    let unfinished = 0, stuck = 0, badState = 0, capHit = 0;
    let totalSteps = 0, caughtTotal = 0, stackedSeen = 0, shortcutSeen = 0;

    const stateOk = () => {
      const y = m(); if (!y) return false;
      return y.pieces.every(arr => arr.length === 4 && arr.every(valid2));
    };
    function valid2(p){ return p === -1 || p === YUT_HOME || (p >= 0 && p < YUT_CELLS.length && !!YUT_CELLS[p]); }

    for (let g = 0; g < GAMES_N; g++){
      act('yut-start', {});
      let steps = 0;
      while (m().phase === 'play' && steps < STEP_CAP){
        const y = m(), t = y.turn;
        if (!stateOk()){ badState++; break; }
        const pend = y.pending || [];
        // ⚠️ 던질 게 남았으면(윷·모·잡기) **던지기가 먼저다** — 앱도 그때는 이동을 막는다
        if (y.canThrow){ yutApplyThrow(throwYut(), 'h1'); steps++; continue; }
        if (!pend.length){ stuck++; break; }             // 던지지도 옮기지도 못한다 = 멈춤
        const onBoard = [...new Set(y.pieces[t].filter(x => x >= 0 && x !== YUT_HOME))];
        const waiting = y.pieces[t].some(x => x === -1);
        const opts = [...onBoard, ...(waiting ? [-1] : [])];
        if (!opts.length){ stuck++; break; }             // 쓸 값은 있는데 옮길 말이 없다
        const pos = opts[(Math.random() * opts.length) | 0];
        const idx = (Math.random() * pend.length) | 0;
        const before = JSON.parse(JSON.stringify(y.pieces));
        if (onBoard.some(p => y.pieces[t].filter(x => x === p).length > 1)) stackedSeen++;
        if (onBoard.some(p => p >= 21)) shortcutSeen++;
        yutMoveFrom(pos, idx);
        const after = m().pieces;
        // 잡기: 상대 말이 판에서 집으로 돌아간 것
        before.forEach((arr, ti) => { if (ti === t) return;
          arr.forEach((p, i) => { if (p >= 0 && p !== YUT_HOME && after[ti][i] === -1) caughtTotal++; }); });
        steps++;
      }
      totalSteps += steps;
      if (steps >= STEP_CAP) capHit++;
      if (m().phase !== 'ended') unfinished++;
    }

    say('자동 대국', GAMES_N + '판 ·', totalSteps + '수 · 평균', Math.round(totalSteps / GAMES_N) + '수',
        '· 잡기', caughtTotal, '· 업기 등장', stackedSeen, '· 지름길 등장', shortcutSeen);
    ck('★★' + GAMES_N + '판이 모두 승자가 나오고 끝난다', unfinished === 0);
    ck('★★판이 멈추는 상태가 없다 (던지지도 옮기지도 못함)', stuck === 0);
    ck('★★말 개수·위치가 판 내내 유효하다', badState === 0);
    ck('  무한루프로 잘린 판이 없다', capHit === 0);
    ck('  실제로 잡기가 일어났다 (규칙이 살아 있다)', caughtTotal > 0);
    ck('  실제로 업기가 일어났다', stackedSeen > 0);
    ck('  실제로 지름길을 탔다', shortcutSeen > 0);
    ck('  이긴 팀은 말 4개를 다 냈다',
      m().winner != null && m().pieces[m().winner].filter(x => x === YUT_HOME).length === 4);

    /* 3팀에서도 도는가 — 2팀만 검사하면 turn 순환을 못 본다 */
    {
      makeTeams(3);
      act('yut-start', {});
      ck('★3팀도 판이 깔린다', m().pieces.length === 3);
      const turns = new Set();
      let g3 = 0, done3 = 0;
      for (let i = 0; i < 6; i++){
        act('yut-start', {}); let steps = 0;
        while (m().phase === 'play' && steps < STEP_CAP){
          const y = m(), t = y.turn; turns.add(t);
          const pend = y.pending || [];
          if (y.canThrow){ yutApplyThrow(throwYut(), 'h1'); steps++; continue; }
          if (!pend.length) break;
          const onB = [...new Set(y.pieces[t].filter(x => x >= 0 && x !== YUT_HOME))];
          const opts = [...onB, ...(y.pieces[t].some(x => x === -1) ? [-1] : [])];
          if (!opts.length) break;
          yutMoveFrom(opts[(Math.random() * opts.length) | 0], (Math.random() * pend.length) | 0);
          steps++;
        }
        g3++; if (m().phase === 'ended') done3++;
      }
      ck('★★3팀 대국도 6판 모두 끝난다', done3 === g3);
      ck('  세 팀이 모두 차례를 받는다', turns.size === 3);
      makeTeams(2);
    }

    /* ★★ 윷·모가 나오면 **던지기가 먼저** — 중간에 옮기면 배분 자체가 성립하지 않는다 */
    {
      act('yut-start', {});
      yutApplyThrow({ n:'윷', v:4, again:true, sticks:[1,1,1,1] }, 'h1');
      ck('윷이 나오면 더 던질 수 있다', m().canThrow === true && m().pending.length === 1);
      yutMoveFrom(-1, 0);
      ck('★★던질 게 남았으면 말을 못 옮긴다',
        m().pieces[0].every(x => x === -1) && m().pending.length === 1);
      S.view = 'play'; render(true);
      const hb = document.getElementById('view').innerHTML;
      ck('★던질 게 남았으면 초록 셀도 안 뜬다', !hb.includes('data-act="yut-move"'));
      ck('  화면이 「한 번 더 던지세요」라고 알려준다', hb.includes('한 번 더 던지세요'));
      yutApplyThrow({ n:'도', v:1, again:false, sticks:[1,0,0,0] }, 'h1');
      ck('  다 던지면 값이 두 개 모인다', m().canThrow === false && m().pending.length === 2);
      act('yut-use', { i:'1' });                          // 도(1칸)로 새 말
      act('yut-move', { pos:'-1' });
      ck('★★다 던진 뒤에는 옮길 수 있다', m().pieces[0].filter(x => x === 1).length === 1);
      ck('  남은 값(윷)이 그대로 있다', m().pending.length === 1 && m().pending[0].n === '윷');
      act('yut-move', { pos:'-1' });                      // 윷(4칸)으로 또 새 말
      ck('★★각각 원하는 말에 나눠 준다',
        m().pieces[0].filter(x => x === 1).length === 1
        && m().pieces[0].filter(x => x === 4).length === 1);
    }

    /* ★★ 집(아직 안 낸 말) — 버튼이 아니라 **실제 말을 눌러서** 내보낸다 */
    {
      act('yut-start', {});
      const M = m(); M.turn = 0;
      S.view = 'play'; render(true);
      const V = () => document.getElementById('view');
      const homePcs = ti => V().querySelectorAll(`.hteam:nth-child(${ti + 1}) .hpc`).length;
      const goPcs   = ti => V().querySelectorAll(`.hteam:nth-child(${ti + 1}) .hpc.go`).length;

      /* ★★ 「누구 차례인가」는 **공용 화면**에 있어야 한다 — 각자 폰에만 있으면 본인만 안다 */
      {
        const tb = V().querySelector('.hteam.on');
        ck('★★공용 화면에 지금 차례가 크게 뜬다',
          !!tb && tb.textContent.includes(teamName(0)) && tb.textContent.includes('차례'));
        ck('  그 팀 색을 쓴다 (멀리서 색으로도 구분)',
          !!tb && tb.getAttribute('style').includes(TEAM_COLORS[0]));
        M.turn = 1; render(true);
        const tb2 = V().querySelector('.hteam.on');
        ck('★★차례가 넘어가면 표시도 따라간다',
          !!tb2 && tb2.textContent.includes(teamName(1)) && !tb2.textContent.includes(teamName(0)));
        M.turn = 0; render(true);
      }

      ck('★★집에 안 낸 말이 개수만큼 실제로 놓인다', homePcs(0) === 4 && homePcs(1) === 4);
      ck('  던지기 전에는 아직 못 누른다', goPcs(0) === 0);

      yutApplyThrow({ n:'윷', v:4, again:true, sticks:[1,1,1,1] }, 'h1');
      render(true);
      ck('★★던질 게 남았으면 집 말도 못 누른다 (던지기가 먼저다)', goPcs(0) === 0);

      yutApplyThrow({ n:'개', v:2, again:false, sticks:[1,1,0,0] }, 'h1');
      render(true);
      ck('★★다 던지면 그때 집 말이 눌린다', goPcs(0) === 4);
      ck('★★차례가 아닌 팀의 집 말은 못 누른다', homePcs(1) === 4 && goPcs(1) === 0);

      /* 화면에 있는 그 말을 실제로 눌러본다 — 핸들러까지 이어지는지 */
      V().querySelector('.hpc.go').click();
      render(true);
      ck('★★집 말을 누르면 판으로 나간다', m().pieces[0].filter(x => x >= 0).length === 1);
      ck('  집에 남은 말이 하나 줄어 보인다', homePcs(0) === 3);

      /* ⚠️ 같은 일을 두 군데서 하면 다시 헷갈린다 — 옛 버튼이 되살아나지 않았는지 본다 */
      ck('★★「새 말 내보내기」 버튼은 없다 (집 트레이 하나로 통일)',
        !V().innerHTML.includes('새 말 내보내기'));

      /* 다 내보내면 트레이가 「다 나왔어요」로 바뀐다 */
      const M2 = m(); M2.pieces[0] = [1, 2, 3, 4]; render(true);
      ck('  집이 비면 그렇게 알려준다',
        homePcs(0) === 0 && V().innerHTML.includes('다 나왔어요'));
    }

    /* 잡으면 한 번 더 던진다 — 랜덤 대국에 묻히지 않게 못을 박는다 */
    {
      act('yut-start', {});
      const M = m();
      M.pieces[1][0] = 3;                                  // 2팀 말이 3번 칸에
      M.turn = 0;
      yutApplyThrow({ n:'걸', v:3, again:false, sticks:[1,1,1,0] }, 'h1');
      ck('  던진 뒤에는 더 못 던진다 (걸)', m().canThrow === false);
      yutMoveFrom(-1, 0);                                  // 1팀 새 말 → 3번 칸, 잡기
      ck('★★상대 말을 잡으면 집으로 돌아간다', m().pieces[1][0] === -1);
      ck('★★잡으면 한 번 더 던진다', m().canThrow === true);
      ck('  잡았으면 턴이 안 넘어간다', m().turn === 0);
      ck('★잡은 뒤에도 던지기가 먼저다 (이동 차단)', (() => {
        const before = JSON.stringify(m().pieces);
        yutMoveFrom(3, 0);
        return JSON.stringify(m().pieces) === before;
      })());
    }

    /* 났을 때 — 완주한 말은 아무도 못 잡는다 */
    {
      act('yut-start', {});
      const M = m();
      M.pieces[0][0] = 19; M.turn = 0;
      yutApplyThrow({ n:'도', v:1, again:false, sticks:[1,0,0,0] }, 'h1');
      yutMoveFrom(19, 0);
      ck('★출발점을 지나면 난다', m().pieces[0][0] === YUT_HOME);
      ck('  난 말은 판에서 사라진다', yutAt(m().pieces, 19).length === 0);
    }

    confetti = _conf; vib = _vib; for (const k in _sfx) SFX[k] = _sfx[k];

    /* ── 5) 화면 데드락 검사 ──────────────────────────────
       한 판을 실제로 그리면서, **매 순간 태블릿에 누를 수 있는 것이 하나는 있는지** 본다.
       버튼이 하나도 없는 순간이 있으면 그 자리에서 게임이 멈춘다. */
    {
      act('yut-start', {});
      let noAction = 0, renderErr = 0, seen = 0, guard = 0;
      while (m().phase === 'play' && guard < 600){
        guard++;
        let html = '';
        try { html = view('play'); } catch(e){ renderErr++; break; }
        seen++;
        const acts = (html.match(/data-act="yut-[a-z-]+"/g) || []);
        // pl-quit 은 「나가기」라 진행 수단이 아니다 — 진행할 수 있는 버튼만 센다
        const usable = acts.filter(a => !/yut-clear|yut-score/.test(a));
        if (!usable.length) noAction++;
        const y = m(), t = y.turn, pend = y.pending || [];
        if (y.canThrow){ yutApplyThrow(throwYut(), 'h1'); continue; }
        if (!pend.length) break;
        const onBoard = [...new Set(y.pieces[t].filter(x => x >= 0 && x !== YUT_HOME))];
        const waiting = y.pieces[t].some(x => x === -1);
        const opts = [...onBoard, ...(waiting ? [-1] : [])];
        if (!opts.length) break;
        yutMoveFrom(opts[(Math.random() * opts.length) | 0], (Math.random() * pend.length) | 0);
      }
      say('화면 검사', seen + '개 상태를 실제로 그림');
      ck('★★한 판 내내 렌더 예외가 없다', renderErr === 0);
      ck('★★누를 것이 하나도 없는 순간이 없다 (데드락)', noAction === 0);
      ck('  종료 화면이 그려진다', view('play').includes('승리'));
    }

    /* ── 6) 참가자 폰 화면 ── */
    {
      act('yut-start', {});
      const savedHost = S.isHost, savedPid = S.pid;
      const other = players().map(([p]) => p).find(p => p !== 'h1');
      S.isHost = false; S.pid = other;
      // ⚠️ 그 사람의 팀 차례로 **고정**한다. makeTeams 가 섞으므로 고정하지 않으면
      //    「윷 던지기」가 뜰 때와 「N팀 차례예요」가 뜰 때가 반반이라 검사가 흔들린다
      //    (랜덤 실패는 진짜 실패까지 무시하게 만든다 — v0.24.0 의 「I」 사건과 같은 병).
      S.room.yut.turn = myTeam();
      let err = 0, html = '';
      try { S.view = 'yut'; render(true); html = document.getElementById('view').innerHTML; }
      catch(e){ err++; }
      ck('참가자 폰 화면이 그려진다', err === 0 && html.includes('윷 던지기'));
      ck('  「✋ 잠시!」 버튼이 있다', html.includes('data-act="yut-halt"'));
      ck('★참가자 화면에 말판 조작 버튼이 없다',
        !/data-act="yut-(move|pickback|use|skip|start|clear)"/.test(html));
      S.isHost = savedHost; S.pid = savedPid;
    }

    /* ── 7) 「잠시!」 전 과정 ── */
    {
      act('yut-start', {});
      yutApplyThrow({ n:'걸', v:3, again:false, sticks:[1,1,1,0] }, 'h1');
      yutMoveFrom(-1, 0);                                 // 1팀 말 하나가 3번 칸

      /* ★ 지적 버튼에 **손이 닿는가** — 이게 안 되면 기능이 있어도 없는 것이다.
         참가자는 입장하면 대기실에 머무르므로 거기에 입구가 있어야 하고,
         다 같이 보는 태블릿에서도 바로 누를 수 있어야 한다. */
      {
        const board0 = view('play');
        ck('★★태블릿 판 화면에서 바로 지적할 수 있다', board0.includes('data-act="yut-halt-here"'));
        const lob = view('lobby');
        ck('★★대기실에 윷 진행 배너가 있다 (각자 폰의 유일한 입구)',
          lob.includes('data-act="go-yut"'));
        ck('  홈에도 그대로 있다', view('home').includes('data-act="go-yut"'));
        ck('  배너가 「잠시!」로 갈 수 있다고 알려준다', lob.includes('잠시'));
        // 태블릿에서 누르면 진행 중인 팀이 지적 대상이 된다
        S.view = 'play'; render(true);
        act('yut-halt-here', { team:String(m().turn) });
        ck('★태블릿에서 누르면 판정 단계로 간다',
          !!m().halt && m().halt.team === m().turn && m().halt.board === true);
        ck('  판정 화면이 이름 대신 팀을 말한다',
          view('play').includes('영어를 썼다는 지적'));
        yutHaltResolve(false);
        ck('  취소하면 아무 말도 안 빠진다', !m().halt && !m().pick);
      }

      const M = m();
      M.turn = 0; M.halt = { by:'bot1', team:0, at:Date.now() };
      const hh = view('play');
      ck('판정 화면이 최우선으로 뜬다', hh.includes('✋ 잠시!'));
      ck('★판정 중에는 말을 못 움직인다 (초록 셀 없음)', !hh.includes('data-act="yut-move"'));
      yutHaltResolve(true);
      ck('★인정하면 그 팀이 되돌릴 말을 고르는 단계로 간다', !!m().pick && m().pick.team === 0);
      ck('  아직 아무 말도 안 빠졌다', m().pieces[0].filter(x => x >= 0 && x !== YUT_HOME).length === 1);
      ck('  영어 횟수가 기록된다', (m().penalty || {})[0] === 1);
      const pk = view('play');
      ck('  고르는 화면에 초록 셀이 뜬다', pk.includes('data-act="yut-pickback"'));
      yutPickBack(3);
      ck('★고른 말이 집으로 돌아간다', m().pieces[0].every(x => x === -1) && !m().pick);
    }

    /* ── 8) 레이아웃 — 태블릿 크기로 돌렸을 때만 ────────────
       ⚠️ 가로 태블릿(1024x768)은 **세로가 모자라다.** 예전에 「🎲 여기서 대신 던지기」가
          기록 카드 뒤에 있어서 통째로 화면 밖으로 밀렸다 — 폰이 없는 사람 대신 던져주는
          버튼이라 안 보이면 그 사람은 아예 못 던진다. 진행에 꼭 필요한 것만 검사한다.
       ⚠️ 이 검사는 창 크기를 줘야 의미가 있다:
          node tools/shot.mjs --dom "/_y.html?demo=1" -w 1024 -h 768 */
    {
      const W = window.innerWidth, H = window.innerHeight;
      const tablet = W >= 760 && H >= 560;
      if (!tablet){ say('레이아웃 검사', `건너뜀 (${W}x${H} — 태블릿 크기로 다시 돌리세요)`); }
      else {
        act('yut-start', {});
        const M = m();
        M.pieces = [[3, 3, 22, -1], [9, 15, -1, YUT_HOME]];
        M.pending = [{ n:'윷', v:4 }, { n:'도', v:1 }];
        M.last = { n:'윷', v:4, again:true, sticks:[1,1,1,1], by:'h1' };
        M.turn = 0;
        const box = sel => { const e = document.querySelector(sel); return e && e.getBoundingClientRect(); };
        const fits = r => !!r && r.bottom <= window.innerHeight + 1;

        /* ⚠️ 던지기와 이동은 이제 **동시에 뜨지 않는다**(던지기가 먼저다).
           그래서 두 상태를 각각 그려서 잰다. */
        M.canThrow = true; S.view = 'play'; render(true);
        const bThrow = box('.board');
        const b2 = box('[data-act="yut-throw-here"]');
        M.canThrow = false; render(true);
        const b  = box('.board');
        const b1 = box('[data-act="yut-move"][data-pos="-1"]');
        say('레이아웃', `${W}x${H} · 판 아래 ${b ? Math.round(b.bottom) : '?'}`
          + ` · 새말 ${b1 ? Math.round(b1.bottom) : '없음'}`
          + ` · 대신던지기 ${b2 ? Math.round(b2.bottom) : '없음'}`);
        ck('★★말판이 스크롤 없이 다 보인다', fits(b) && fits(bThrow));
        ck('★★지금 차례 표시가 화면 안에 있다', fits(box('.hteam.on')));
        ck('★★집에 있는 말(눌러서 내보내기)이 화면 안에 있다', fits(b1));
        ck('★★「여기서 대신 던지기」가 화면 안에 있다 (던질 게 남은 상태)', fits(b2));
        /* ✋ 지적·🔄 재시작도 눌러야 하는 버튼이다 — 화면 밖으로 밀리면 못 쓴다 */
        ck('★★팀별 「잠시!」 버튼이 화면 안에 있다',
          fits(box('[data-act="yut-halt-here"][data-team="0"]'))
          && fits(box(`[data-act="yut-halt-here"][data-team="${M.pieces.length-1}"]`)));
        /* ⚠️ 재시작은 **가로에서만** 화면 안을 요구한다. 세로 태블릿은 세로로만 쌓여
              아래로 밀리는데, 이건 가끔 진행자만 누르는 버튼이라 스크롤해도 된다.
              스크롤이 없어야 하는 건 판·던지기·지적까지다. */
        if (W >= H) ck('★★「처음부터 다시 시작」이 화면 안에 있다 (가로)',
          fits(box('[data-act="yut-restart"]')));
        ck('  재시작 버튼이 화면에 있기는 하다', !!box('[data-act="yut-restart"]'));
        /* ⚠️ 「판이 화면 안에 들어간다」만 검사하면 판을 줄여서 통과시킬 수 있다 —
           실제로 그렇게 272px 까지 내려가 **폰(453px)보다 작아졌다.** 이 화면은 상 위에
           세워두고 다 같이 보는 것이라 작아지면 그 순간 쓸모가 없다. 하한을 못 박는다. */
        ck('★★말판이 충분히 크다 (한 변 420px 이상)', !!b && b.width >= 420);
        /* ⚠️ 가로로 놓였으면 **2단**이어야 한다 — 판이 왼쪽, 조작이 오른쪽.
           예전엔 `max-height:860px` 으로 걸어서 **큰 태블릿을 가로로 놓으면**
           (아이패드 프로 1366×1024) 2단이 안 걸리고 세로 배치가 그대로 나왔다. */
        if (W / H >= 1.25){
          const side = box('.ytop'), bd2 = box('.yboard');
          ck('★★가로로 놓으면 2단으로 배치된다 (판 왼쪽 · 조작 오른쪽)',
            !!side && !!bd2 && side.left >= bd2.right - 4);
          ck('  조작 칸이 판과 같은 높이에서 시작한다',
            !!side && !!bd2 && Math.abs(side.top - bd2.top) < 60);
          /* ⚠️ 넓은 화면에서 판을 #app 밖으로 빼내므로 **가로 스크롤**이 생기면 안 된다 */
          ck('★가로 스크롤이 생기지 않는다',
            document.documentElement.scrollWidth <= window.innerWidth + 1);
        } else {
          ck('  세로로 놓으면 1단으로 쌓인다', (() => {
            const side = box('.ytop'), bd2 = box('.yboard');
            return !!side && !!bd2 && side.left < bd2.right - 4;
          })());
        }
        say('  말 지름', (() => { const e = document.querySelector('.pc');
          return e ? Math.round(e.getBoundingClientRect().width) + 'px' : '없음'; })());
        /* 업은 말은 하나씩 그리면 칸을 덮는다 → 개수로 적는다 */
        M.pieces[0] = [7, 7, 7, 7]; render(true);
        const stack = [...document.querySelectorAll('.cell .pc')]
          .filter(e => e.textContent.trim() === '4');
        ck('★★업은 말 4개는 말 하나 + 개수로 표시된다', stack.length === 1);
        /* ⚠️ 판에는 **글씨를 넣지 않는다**(사장님 지시 — 다 아는 규칙이다).
           모서리·방은 칸 크기로만 구분한다. 말 위의 「업은 개수」만 예외다.
           ⚠️ 예전에 ⤢(U+2922) 를 라벨로 쓰다가 기기에서 네모로 깨진 적이 있다 —
              글씨를 다시 넣을 일이 생기면 한글·숫자·영문만 쓸 것. */
        {
          const texts = [];
          document.querySelectorAll('.cell').forEach(el => {
            // 말(.pc) 안의 개수는 빼고, 칸 자체에 붙은 글자만 본다
            [...el.childNodes].forEach(n => {
              if (n.nodeType === 3){ const t = n.textContent.trim(); if (t) texts.push(t); }
            });
          });
          ck('★★말판 칸에 글씨가 없다', texts.length === 0);
          if (texts.length) say('  남아 있는 글씨:', [...new Set(texts)].join(' '));
          ck('  모서리·방은 큰 칸으로 구분된다',
            document.querySelectorAll('.cell.big').length === 5
            && document.querySelectorAll('.cell.hub').length === 1);
        }
        ck('  칸을 덮지 않는다 (말이 칸보다 작다)', (() => {
          const c = document.querySelector('.cell'), pc = stack[0];
          return !!c && !!pc && pc.getBoundingClientRect().width < c.getBoundingClientRect().width;
        })());
      }
    }

    /* ── 9) 말 고르기 ────────────────────────────────────────
       ⚠️ 색만으로 팀을 나누면 색약인 사람이 구분을 못 한다 — 모양이 두 번째 단서다.
          그래서 **기본값부터 팀마다 달라야** 한다(안 고르고 시작하는 게 보통이다). */
    {
      makeTeams(4);
      // ⚠️ 앞 단계에서 판이 깔린 채면 tool-start 가 곧바로 play 로 간다 — 설정 화면을 보려면 비운다
      S.room.yut = null;
      S.gameId = 'yut'; go('game'); act('tool-start', {});
      ck('설정 화면으로 들어간다', S.play?.phase === 'setup');
      ck('말 모양이 4가지 이상', YUT_SKINS.length >= 4);
      ck('  모양 키가 안 겹친다', new Set(YUT_SKINS.map(x => x.k)).size === YUT_SKINS.length);
      const def = [0,1,2,3].map(i => yutSkinOf(null, i));
      ck('★★안 고르면 팀마다 기본 모양이 다르다', new Set(def).size === 4);

      const setup = view('play');
      ck('★설정 화면에 말 고르는 버튼이 있다', setup.includes('data-act="yut-skin"'));
      ck('  팀 수만큼 줄이 나온다', (setup.match(/class="skinrow"/g) || []).length === 4);

      act('yut-skin', { t:'0', k:'neon' });
      ck('★고르면 바뀐다', S.play.skins[0] === 'neon');
      ck('  고른 것만 바뀌고 나머지는 그대로', yutSkinOf(S.play.skins, 1) === def[1]);

      act('yut-start', {});
      ck('★★고른 모양이 방 노드에 저장된다',
        Array.isArray(m().skins) && m().skins.length === 4 && m().skins[0] === 'neon');

      m().pieces[0] = [7, -1, -1, -1];
      m().pieces[1] = [9, -1, -1, -1];
      const bd = view('play');
      ck('★판 위 말에 모양 클래스가 붙는다', bd.includes('pc sk-neon'));
      ck('  팀마다 다른 모양이 실제로 그려진다',
        new Set((bd.match(/pc sk-[a-z]+/g) || [])).size >= 2);
      /* ⚠️ `bd.includes(...)` 로 문자열만 보면 판 위의 말에 걸려서도 통과한다 —
         **팀 카드 안에** 있는지를 DOM 으로 본다. */
      S.view = 'play'; render(true);
      const cards = [...document.querySelectorAll('.hteam')];
      ck('  팀 카드에도 그 팀 말이 보인다',
        cards.length >= 2 && cards.every(c => /(^|\s)sk-[a-z]+/.test(c.querySelector('.pcw>i')?.className || '')));
      /* ⚠️ 인라인 background 를 주면 모양의 그라데이션이 통째로 지워진다(색만 남는다).
         실제로 그렇게 만들었다가 고친 적이 있어서 못을 박는다. */
      ck('★★말에 인라인 background 를 주지 않는다',
        !/class="pc sk-[a-z]+"[^>]*style="[^"]*background/.test(bd));
      ck('  색 톤 세 가지가 인라인으로 내려온다',
        /--pc:#[0-9A-Fa-f]{6};--pcL:rgb\([^)]*\);--pcD:rgb\([^)]*\)/.test(bd));
      makeTeams(2);
    }

    /* 정리 */
    act('yut-clear', {}); act('ask-yes', {});
    ck('판을 정리하면 노드가 비워진다', !S.room.yut);
    clearBots();
    ck('봇 정리', players().length === 1);

  } catch(err){
    bad++; L.push('ERR ' + (err && err.message ? err.message : String(err)));
    if (err && err.stack) L.push(String(err.stack).split('\n').slice(0, 4).join(' | '));
  }
  L.push(bad ? `‼ 실패 ${bad}건` : '✅ 전부 통과');
  document.title = L.join('\n');
  document.body.innerHTML = '<pre style="white-space:pre-wrap;font:12px/1.6 monospace;padding:14px">'
    + L.join('\n').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])) + '</pre>';
}
