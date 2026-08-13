/* 크라임씬 전 구간 자동 점검 — 결과를 <title> 에 적는다(헤드리스로 읽어가려고).
 *
 *   node tools/demo.mjs tools/scenarios/crime-e2e.js _t.html
 *   node tools/shot.mjs --dom "/_t.html?demo=1"
 *
 * ⚠️ 여기서 보는 것들은 전부 **과거에 실제로 터졌던 것**이다. 줄이지 말 것.
 *    - order 가 pool 그대로면 순서가 범인을 흘린다
 *    - 항상 보이는 영역이 배역마다 다르면 옆에서 흘끗 보고 정체를 안다
 *    - 참가자 폰에 조작 버튼이 생기면 테이블 방식이 도로 무너진다
 */
if (new URLSearchParams(location.search).has('demo')){
  const L = []; const say = (...a) => L.push(a.join(' '));
  const done = () => { document.title = L.join(' ## '); };
  try{
    window.confirm = () => true;
    S.pid = 'h1'; S.code = '0000'; S.isHost = true; S.online = true;
    S.room = emptyRoom(); S.room.host = 'h1';
    S.room.players.h1 = { name:'나', joinedAt:1, seen:Date.now(), host:true };
    addBots(6);
    S.gameId = 'mafia'; act('tool-start', {});
    S.play.sit = '왕궁 연회';

    /* ★ 발언 순서가 범인을 흘리지 않는지 — 한 판만 봐서는 알 수 없다.
       예전 버그는 `order = pool` 이라 **항상** order[0]이 범인이었다. 지금은 shuffle 이라
       7명이면 1/7 확률로 범인이 맨 앞에 오는 게 정상이다. 그래서 "이번 판에 맨 앞이 아니다"로
       검사하면 1/7 확률로 헛되이 실패한다 — 실제로 그랬고, 그건 검사기 쪽 버그였다.
       여러 번 배정해 **범인 자리가 흩어지는지**를 본다(옛 버그면 40판 전부 0이 나온다).
       ⚠️ 재배정은 반드시 아래 M 을 잡기 전에 끝낼 것 — mf-deal 은 room.mafia 를 새 객체로 갈아끼운다. */
    const pos = [];
    for (let i = 0; i < 40; i++){ act('mf-deal', {});
      const m = S.room.mafia; pos.push(m.order.indexOf(m.culprit)); }
    say('★범인 자리 분포(40판): 맨앞', pos.filter(x => x === 0).length + '회',
        '| 서로 다른 자리', new Set(pos).size + '가지',
        '| 순서가 범인을 흘리지 않음:', new Set(pos).size >= 4 && pos.filter(x => x === 0).length < 20);

    act('mf-deal', {});                                   // 아래 검사들이 쓸 판을 새로 깐다
    const M = S.room.mafia, hp = S.pid, P = Object.keys(M.roles);
    say('배정', P.length + '명 | 피해자=' + M.victim, '| 범인 1명:', P.filter(x => x === M.culprit).length === 1);
    const chars = P.map(x => M.roles[x].char);
    say('배역중복:', chars.length !== new Set(chars).size ? '있음(문제)' : '없음',
        '| 피해자 배역 제외:', !chars.includes(M.victim));
    say('전원 관계/동기/알리바이:', P.every(x => M.roles[x].rel && M.roles[x].mot && M.roles[x].alibi));
    say('order=참가자집합:', M.order.slice().sort().join() === P.slice().sort().join());
    say('★범인 흔적 배치:', M.places.some(pl => pl.ev.includes(M.roles[M.culprit].trace)),
        '| 무고한 사람 흔적 미배치:',
        !P.filter(x => x !== M.culprit).some(x => M.places.some(pl => pl.ev.includes(M.roles[x].trace))));

    const grab = pid => { S.pid = pid; S.isHost = false; S.view = 'role'; render(true);
      const x = document.getElementById('view').innerHTML; S.pid = hp; S.isHost = true; return x; };
    const host = () => { S.view = 'play'; render(true); return document.getElementById('view').innerHTML; };

    /* 자기소개 */
    act('cr-intro', {});
    say('자기소개 첫 차례=', pname(M.order[0]), '| 화면표시:', host().includes(pname(M.order[0])));
    say('★내 차례 배지 — 당사자:', grab(M.order[0]).includes('지금 내 차례'),
        '| 남:', grab(M.order[1]).includes('지금 내 차례') ? '보임(문제)' : '안 보임');
    for (let i = 0; i < M.order.length; i++) act('cr-intronext', {});
    say('소개 종료:', host().includes('모두 소개했습니다'));

    /* 현장 조사 — 진행자 폰 하나로 */
    act('cr-search', {});
    say('장소 버튼:', (host().match(/data-act="cr-place"/g) || []).length + '개', '| 남은 조사:', cSearchLeft());
    act('cr-place', { i:'1' });
    const rd = host();
    say('★낭독 화면:', rd.includes('소리 내어 읽으세요'), '| 증거 노출:', rd.includes(M.places[1].ev[0].slice(0, 14)));
    act('cr-readdone', {});
    act('cr-place', { i:'1' }); say('★중복 조사 차단:', cRevealed().length === 1);
    act('cr-place', { i:'0' }); act('cr-readdone', {});
    act('cr-place', { i:'2' }); act('cr-readdone', {});
    say('조사 3회 소진 → 남은:', cSearchLeft(), '| 「심문 시작」:', host().includes('심문 시작'),
        '| 게시판:', cBoard().length + '곳');

    const pv = grab(P[0]);
    say('★참가자 폰 조작버튼 없음:', !/data-act="cr-(place|vadj|reveal|search)/.test(pv),
        '| 「폰을 내려놓고」:', pv.includes('폰을 내려놓고'));

    /* 심문 */
    act('cr-grill', {}); act('cr-grillnext', {});
    const g = S.room.mafia.grill;
    say('★심문:', pname(g.q) + '→' + pname(g.t), '| 자문자답 아님:', g.q !== g.t, '| 화면:', host().includes(g.hint));

    /* 지목 — 정답 / 오답 / 동점 */
    act('cr-final', {}); act('cr-vote', {});
    act('cr-vadj', { pid:M.culprit, v:'1' }); act('cr-vadj', { pid:M.culprit, v:'1' });
    act('cr-vadj', { pid:P.find(x => x !== M.culprit), v:'1' });
    act('cr-vadj', { pid:M.culprit, v:'-1' }); say('− 동작:', cTally()[M.culprit] === 1);
    act('cr-vadj', { pid:M.culprit, v:'1' });
    act('cr-reveal', {});
    say('★판정(최다=범인):', S.room.mafia.result.caught ? '용의자 승' : '범인 승(문제)');
    act('cr-score', {});
    say('순위 꼴찌=범인:', S.draft.order[S.draft.order.length - 1] === M.culprit, '| 인원:', S.draft.order.length);

    const replay = tally => {
      S.draft = null; S.view = 'play';
      const m = S.room.mafia; m.phase = 'vote'; m.result = null; m.tally = {};
      S.play = { gameId:'mafia', kind:'mafia', phase:'dealt', sit:m.sit, show:false };
      tally.forEach(([pid, n]) => { for (let i = 0; i < n; i++) act('cr-vadj', { pid, v:'1' }); });
      act('cr-reveal', {}); return m.result;
    };
    const nc = P.find(x => x !== M.culprit);
    const r2 = replay([[nc, 2], [M.culprit, 1]]);
    say('★판정(오답):', r2.caught ? '용의자 승(문제)' : '범인 승');
    act('cr-score', {}); say('순위 1등=범인:', S.draft.order[0] === M.culprit);
    const r3 = replay([[nc, 1], [M.culprit, 1]]);
    say('★동점 → 범인 승:', !r3.caught, '| tie 표기:', r3.tie);

    /* 정체 누수 — 홀드 박스 밖은 배역과 무관하게 똑같아야 한다 */
    S.play = { gameId:'mafia', kind:'mafia', phase:'dealt', sit:S.room.mafia.sit, show:false };
    S.room.mafia.phase = 'grill'; S.room.mafia.result = null;
    const outside = h => h.replace(/<div class="secret">[\s\S]*?<\/div>\s*<\/div>/g, '');
    const cul = grab(S.room.mafia.culprit), inn = grab(P.find(x => x !== S.room.mafia.culprit));
    say('★홀드 밖 범인 단서:',
        ['내가 범인','범인이다','흔적을 남겼'].filter(w => outside(cul).includes(w)).join(',') || '없음');
    const strip = x => x.replace(/>[^<]*</g, '><');
    say('  구조 동일:', strip(outside(cul)).length === strip(outside(inn)).length
        ? '동일' : '길이차 ' + Math.abs(strip(outside(cul)).length - strip(outside(inn)).length));
    const th = x => (x.match(/<div class="th">([^<]*)<\/div>/) || [])[1] || '';
    say('  안내문구 동일:', th(cul) === th(inn));

    say(L.some(x => /문제|false/.test(x)) ? '‼ 실패 항목 있음' : '✅ 전부 통과');
    done();
  }catch(e){ document.title = 'ERR ' + e.message + ' @@ ' + String(e.stack || '').slice(0, 200); }
}
