/* 윷놀이 화면 스냅샷 — ?demo=1&v=board|pick|halt|phone|setup */
if (new URLSearchParams(location.search).has('demo')){
  const q=new URLSearchParams(location.search);
  S.pid='h1'; S.code='0000'; S.isHost=true; S.online=true;
  S.room=emptyRoom(); S.room.host='h1';
  S.room.players.h1={name:'나',joinedAt:1,seen:Date.now(),host:true};
  addBots(5); makeTeams(2);
  S.gameId='yut'; act('tool-start',{});
  // ⚠️ 컨페티가 화면을 덮어 스샷 판독을 방해한다 — 스냅샷에서는 끈다
  confetti=()=>{};
  const v=q.get('v')||'board';
  if(v!=='setup'){
    act('yut-start',{});
    S.room.yut.pieces=[[3,3,22,-1],[9,15,-1,YUT_HOME]];
    S.room.yut.log=['1팀 개(2칸)','2팀이 상대 말 1개를 잡았다! 한 번 더','나 — 윷 (한 번 더!)'];
    S.room.yut.last={n:'윷',v:4,again:true,sticks:[1,1,1,1],by:'h1'};
    S.room.yut.pending=[{n:'윷',v:4},{n:'도',v:1}];
    S.room.yut.canThrow=false;
    if(v==='halt'){ S.room.yut.halt={by:players()[1][0],team:0,at:1}; }
    if(v==='pick'){ S.room.yut.pick={team:0}; }
    if(v==='phone'){ S.view='yut'; }
  }
  render(true);
}
