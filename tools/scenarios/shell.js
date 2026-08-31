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
    if(v==='score'){ act('score-start',{}); }
    else S.view=v;
  }
  render(true);
}
