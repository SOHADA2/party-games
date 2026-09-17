/* 앱 셸 화면 스냅샷 — ?demo=1&v=home|lobby|games|game|score|board|settings (&teams=1 &guest=1) */
if (new URLSearchParams(location.search).has('demo')){
  const q=new URLSearchParams(location.search);
  const v=q.get('v')||'lobby';
  if(v!=='home'){
    S.pid='h1'; S.code='4821'; S.isHost=!q.get('guest'); S.online=true;
    S.room=emptyRoom(); S.room.host='h1';
    S.room.players.h1={name:'나',joinedAt:1,seen:Date.now(),host:true};
    addBots(5); if(q.get('teams')) makeTeams(2);
    S.room.scores.s1={gameId:'noise',mode:'solo',order:players().map(([p])=>p),weight:1,assign:{},at:1};
    S.room.scores.s2={gameId:'chosung',mode:'solo',order:players().map(([p])=>p).reverse(),weight:1,assign:{},at:2};
    S.gameId=q.get('g')||'chosung';
    /* &next=게임id → 그 게임을 고른 대기실 · &guest=1 과 같이 쓰면 참가자 화면 · &ready=1 → 내가 준비한 상태 */
    if(q.get('next')) S.room.next={ g:q.get('next'), at:Date.now() };
    if(q.get('guest')){ S.room.players.g1={name:'손님',joinedAt:2,seen:Date.now()}; S.room.host='h1'; S.pid='g1';
      if(q.get('ready') && S.room.next) S.room.players.g1.ready=S.room.next.at; }
    /* &rule=1 → 게임마다 배점 + 경품·벌칙이 적힌 상태(설정·순위 화면 확인용) */
    if(q.get('rule')) S.room.rule={ wmode:'game', weights:{ cup:0 },
      prize:'다음 날 아침 안 차려도 됨', penalty:'설거지 담당' };
    if(v==='score'){ act('score-start',{}); }
    else S.view=v;
  }
  render(true);
}
